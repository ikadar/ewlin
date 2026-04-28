/**
 * Multi-turn LLM execution loop with Anthropic Messages API.
 *
 * The loop:
 *   1. Builds the system prompt + tool catalog from the registry
 *   2. Sends the user prompt + prior conversation to Anthropic
 *   3. Runs the tool_use blocks the model emits, in dry-run mode for
 *      /execute and in wet mode for /apply
 *   4. Loops until the model emits a propose_plan or ask_user tool_use
 *   5. Returns the final result
 *
 * Two terminal tools (propose_plan, ask_user) short-circuit the loop:
 * propose_plan returns a structured plan, ask_user returns a question
 * back to the frontend.
 *
 * The FE-visible ConversationMessage type mirrors Anthropic's wire
 * format directly (role + content blocks). The FE never reads it —
 * it just round-trips it back on the next /execute call so the model
 * keeps prior tool-use context.
 */
import type { Config } from '../config.js';
import {
  AnthropicClient,
  type AnthropicMessage,
  type AnthropicMessagesRequest,
  type AnthropicMessagesResponse,
  type AnthropicContentBlock,
  type AnthropicToolDefinition,
  type AnthropicToolUseBlock,
} from './anthropic.js';
import { OpenAICompatClient } from './openaiCompat.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { allTools, findTool } from '../tools/registry.js';
import { zodToJsonSchema } from '../tools/jsonSchema.js';
import { PhpClient } from '../phpClient.js';
import type { ToolContext, ToolResult } from '../tools/types.js';
import { todayIsoUtc } from '../tools/dates.js';

/**
 * Provider-agnostic surface used by the loop. Anthropic and OpenAI-compat
 * (Groq) both implement this — see anthropic.ts and openaiCompat.ts.
 */
interface LlmClient {
  messages(
    request: AnthropicMessagesRequest,
    signal?: AbortSignal,
  ): Promise<AnthropicMessagesResponse>;
}

function buildLlmClient(config: Config): { client: LlmClient; model: string } | { error: string } {
  if (config.llmProvider === 'openai-compat') {
    if (!config.openaiCompatApiKey) {
      return { error: "OPENAI_COMPAT_API_KEY n'est pas configurée côté console-service. Ajoute-la dans .env puis redémarre le service." };
    }
    // OpenRouter `:nitro` suffix sorts providers by throughput (tokens/sec).
    // It's a model-id alias, only meaningful for OpenRouter — appending it
    // for Groq/Together/etc. would 404. Idempotent: skip if already suffixed.
    const isOpenRouter = /openrouter\.ai/i.test(config.openaiCompatBaseUrl);
    const effectiveModel =
      config.openaiCompatNitro && isOpenRouter && !/:nitro$/i.test(config.openaiCompatModel)
        ? `${config.openaiCompatModel}:nitro`
        : config.openaiCompatModel;
    return {
      client: new OpenAICompatClient(
        config.openaiCompatApiKey,
        config.openaiCompatBaseUrl,
        effectiveModel,
      ),
      model: effectiveModel,
    };
  }
  if (!config.anthropicApiKey) {
    return { error: "ANTHROPIC_API_KEY n'est pas configurée côté console-service. Ajoute-la dans .env puis redémarre le service." };
  }
  return {
    client: new AnthropicClient(config.anthropicApiKey, config.anthropicBaseUrl),
    model: config.llmModel,
  };
}

/**
 * Wire shape stored on the FE between turns. Mirrors Anthropic's
 * messages format so we can pass it straight back to the API.
 */
export type ConversationMessage = AnthropicMessage;

export interface ProposedAction {
  tool: string;
  args: Record<string, unknown>;
  preview: string;
}

export interface ResolvedEntity {
  kind: 'operator' | 'station' | 'job' | 'task' | 'constraint';
  id: string;
  label: string;
}

export type ExecuteResult =
  | {
      kind: 'plan';
      narration: string;
      actions: ProposedAction[];
      resolvedEntities: ResolvedEntity[];
      conversationAfter: ConversationMessage[];
    }
  | {
      kind: 'question';
      question: string;
      options?: string[];
      conversationAfter: ConversationMessage[];
    }
  | {
      kind: 'error';
      error: string;
      message: string;
      conversationAfter: ConversationMessage[];
    };

export interface RunExecuteLoopArgs {
  prompt: string;
  conversation: ConversationMessage[];
  jwt: string;
  config: Config;
  dryRun: boolean;
  /** Override the PhpClient (for tests). Production callers omit this. */
  php?: PhpClient;
}

function buildToolCatalog(): AnthropicToolDefinition[] {
  return allTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToJsonSchema(t.inputSchema) as Record<string, unknown>,
  }));
}

function extractResolvedEntities(
  toolHistory: Array<{ name: string; result: ToolResult }>,
): ResolvedEntity[] {
  const entities: ResolvedEntity[] = [];
  for (const { name, result } of toolHistory) {
    if (!result.ok) continue;
    const data = result.data as {
      candidates?: Array<{
        id: string;
        label?: string;
        reference?: string;
        firstName?: string;
        lastName?: string;
        name?: string;
      }>;
    };
    if (!data?.candidates) continue;
    if (data.candidates.length !== 1) continue; // only commit unambiguous resolutions
    const c = data.candidates[0]!;
    const kind: ResolvedEntity['kind'] | null =
      name === 'resolve_operator'
        ? 'operator'
        : name === 'resolve_station'
          ? 'station'
          : name === 'resolve_job'
            ? 'job'
            : name === 'resolve_task_in_job'
              ? 'task'
              : null;
    if (!kind) continue;
    const label =
      c.label ||
      (c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : undefined) ||
      c.name ||
      c.reference ||
      c.id;
    entities.push({ kind, id: c.id, label });
  }
  return entities;
}

/**
 * Pull the assistant's tool_use blocks out of the latest message, in
 * the original order so tool_result blocks line up.
 */
function extractToolUses(content: AnthropicContentBlock[]): AnthropicToolUseBlock[] {
  return content.filter((b): b is AnthropicToolUseBlock => b.type === 'tool_use');
}

function extractAssistantText(content: AnthropicContentBlock[]): string {
  return content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

export async function runExecuteLoop(args: RunExecuteLoopArgs): Promise<ExecuteResult> {
  const todayIso = todayIsoUtc();
  const systemPrompt = buildSystemPrompt(todayIso);
  const toolCatalog = buildToolCatalog();

  const built = buildLlmClient(args.config);
  if ('error' in built) {
    return {
      kind: 'error',
      error: 'MISSING_API_KEY',
      message: built.error,
      conversationAfter: [],
    };
  }
  const { client: llm, model: llmModel } = built;
  const php = args.php ?? new PhpClient(args.config.phpApiUrl, args.jwt);
  const ctx: ToolContext = { php, dryRun: args.dryRun, todayIso };

  // The conversation we feed Anthropic on every turn. Starts with the prior
  // conversation (if any) plus the new user prompt.
  const messages: AnthropicMessage[] = [
    ...args.conversation,
    { role: 'user', content: args.prompt },
  ];

  const toolHistory: Array<{ name: string; result: ToolResult }> = [];

  const startedAt = Date.now();
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), args.config.llmTotalTimeoutMs);

  try {
    for (let turn = 0; turn < args.config.llmMaxTurns; turn++) {
      const response = await llm.messages(
        {
          model: llmModel,
          max_tokens: args.config.llmMaxTokensPerTurn,
          system: systemPrompt,
          messages,
          tools: toolCatalog,
          // 'any' forces a tool call every turn — the model still chooses
          // WHICH tool, so it can call propose_plan/ask_user to terminate.
          // Anthropic honors this directly; OpenAICompatClient maps to
          // OpenAI's 'required'.
          tool_choice: { type: 'any' },
          temperature: args.config.llmTemperature,
        },
        abortController.signal,
      );

      // Persist the full assistant message verbatim — Anthropic requires
      // the round-trip to include text + tool_use blocks together.
      messages.push({ role: 'assistant', content: response.content });

      const toolUses = extractToolUses(response.content);

      // Per-turn trace to debug stuck loops (MAX_TURNS_REACHED).
      // Logs to stderr → visible via `docker compose logs console-service`.
      const turnTools = toolUses.map((tu) => tu.name).join(',') || '(none)';
      const stop = response.stop_reason ?? '?';
      const usage = response.usage;
      console.error(
        `[loop] turn=${turn + 1}/${args.config.llmMaxTurns} stop=${stop} ` +
          `tools=[${turnTools}] in=${usage.input_tokens} out=${usage.output_tokens}`,
      );

      // tool_choice='any' should make this impossible, but defend anyway.
      if (toolUses.length === 0) {
        if (turn < args.config.llmMaxTurns - 1) {
          messages.push({
            role: 'user',
            content:
              "Tu dois IMPÉRATIVEMENT appeler un tool. Si tu as besoin de l'UUID d'un job/opérateur/station, appelle d'abord resolve_job/resolve_operator/resolve_station avec la référence DÉJÀ donnée par l'utilisateur dans le tout premier message. Quand tu as les UUIDs, appelle propose_plan. Ne demande PAS à l'utilisateur ce qu'il a déjà dit.",
          });
          continue;
        }
        return errorResult(
          'MISSING_TERMINAL_TOOL',
          `Le modèle a répondu sans appeler propose_plan ni ask_user après ${args.config.llmMaxTurns} tours. Réponse brute : ${extractAssistantText(response.content).slice(0, 500)}`,
          messages,
        );
      }

      // Run all tool_use blocks. Read-only tools (resolve_*) run in
      // parallel — the model often fans out 2-3 resolvers per turn for
      // composite prompts ("Frédéric absent sur la MBO XL"). Mutating
      // tools and terminals stay sequential to keep audit ordering.
      const orderedResults: Array<ToolResult | null> = toolUses.map(() => null);
      const parallelIdx: number[] = [];
      const sequentialIdx: number[] = [];
      for (let i = 0; i < toolUses.length; i++) {
        const def = findTool(toolUses[i]!.name);
        if (def?.readOnly) parallelIdx.push(i);
        else sequentialIdx.push(i);
      }
      await Promise.all(
        parallelIdx.map(async (i) => {
          orderedResults[i] = await runToolCall(toolUses[i]!, ctx);
        }),
      );
      for (const i of sequentialIdx) {
        orderedResults[i] = await runToolCall(toolUses[i]!, ctx);
      }

      // Collect tool_result blocks for this turn into a single user message.
      // Anthropic requires every assistant tool_use to be acknowledged in
      // ONE user message — split per call would be a protocol violation.
      const toolResultBlocks: AnthropicContentBlock[] = [];
      let terminal: ExecuteResult | null = null;

      for (let i = 0; i < toolUses.length; i++) {
        const tu = toolUses[i]!;
        const result = orderedResults[i]!;
        toolHistory.push({ name: tu.name, result });

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
          is_error: !result.ok,
        });

        if (tu.name === 'propose_plan' && result.ok) {
          const planData = result.data as {
            kind: 'plan';
            narration: string;
            actions: ProposedAction[];
          };

          // Validate each action's args against the target tool's schema.
          // propose_plan's own schema only validates the wrapper shape, so
          // without this an action with missing/wrong fields slips through
          // and surfaces as a baffling Zod error at /apply time. Catching
          // it here means the model gets the issue as a tool_result and
          // can self-correct on the next turn.
          interface PlanError {
            tool: string;
            issues: Array<{ path: string; message: string }>;
            sentArgs: Record<string, unknown>;
            expectedSchema: Record<string, unknown>;
          }
          const planErrors: PlanError[] = [];
          const unknownTools: string[] = [];
          for (const action of planData.actions) {
            const actionDef = findTool(action.tool);
            if (!actionDef) {
              unknownTools.push(action.tool);
              continue;
            }
            const argsCheck = actionDef.inputSchema.safeParse(action.args);
            if (!argsCheck.success) {
              planErrors.push({
                tool: action.tool,
                issues: argsCheck.error.issues.map((i) => ({
                  path: i.path.join('.') || '<root>',
                  message: i.message,
                })),
                sentArgs: action.args,
                expectedSchema: zodToJsonSchema(actionDef.inputSchema) as Record<string, unknown>,
              });
            }
          }

          if (planErrors.length > 0 || unknownTools.length > 0) {
            // Rich, structured error so even smaller models can see exactly
            // what they sent and what was expected. Emphasises that the
            // recovery path is to call propose_plan again — NOT the action
            // tool — because some models otherwise re-invoke the action
            // tool in dry-run instead of repackaging the plan.
            const payload = {
              ok: false,
              error: 'PROPOSE_PLAN_REJECTED',
              message:
                'Le plan que tu viens d’émettre a des actions invalides. ' +
                'NE rappelle PAS le tool d’action ; rappelle propose_plan ' +
                'avec les args corrigés selon "expected_schema" ci-dessous.',
              unknown_tools: unknownTools,
              invalid_actions: planErrors.map((p) => ({
                tool: p.tool,
                issues: p.issues,
                sent_args: p.sentArgs,
                expected_schema: p.expectedSchema,
              })),
            };
            toolResultBlocks[toolResultBlocks.length - 1] = {
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(payload),
              is_error: true,
            };
            continue; // don't terminate — let the loop iterate
          }

          terminal = {
            kind: 'plan',
            narration: planData.narration,
            actions: planData.actions,
            resolvedEntities: extractResolvedEntities(toolHistory),
            conversationAfter: messages.concat([
              { role: 'user', content: toolResultBlocks },
            ]),
          };
        } else if (tu.name === 'ask_user' && result.ok) {
          const qData = result.data as {
            kind: 'question';
            question: string;
            options: string[];
          };
          terminal = {
            kind: 'question',
            question: qData.question,
            options: qData.options.length > 0 ? qData.options : undefined,
            conversationAfter: messages.concat([
              { role: 'user', content: toolResultBlocks },
            ]),
          };
        }
      }

      messages.push({ role: 'user', content: toolResultBlocks });

      if (terminal) {
        clearTimeout(timeoutId);
        return terminal;
      }
    }

    return errorResult(
      'MAX_TURNS_REACHED',
      `Le modèle n'a pas terminé en ${args.config.llmMaxTurns} tours. Réessaie avec une requête plus simple.`,
      messages,
    );
  } catch (err) {
    if (abortController.signal.aborted) {
      const elapsed = Date.now() - startedAt;
      return errorResult(
        'TIMEOUT',
        `Le tour LLM a dépassé le timeout de ${args.config.llmTotalTimeoutMs}ms (${elapsed}ms écoulés).`,
        messages,
      );
    }
    return errorResult(
      'LLM_FAILURE',
      err instanceof Error ? err.message : String(err),
      messages,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runToolCall(toolUse: AnthropicToolUseBlock, ctx: ToolContext): Promise<ToolResult> {
  const def = findTool(toolUse.name);
  if (!def) {
    return { ok: false, error: `Unknown tool: ${toolUse.name}` };
  }
  // Anthropic gives us the input pre-parsed as an object, so no JSON.parse.
  const validation = def.inputSchema.safeParse(toolUse.input);
  if (!validation.success) {
    return {
      ok: false,
      error: `Validation failed for ${toolUse.name}: ${validation.error.issues.map((i) => i.message).join('; ')}`,
    };
  }
  try {
    return await def.handler(validation.data, ctx);
  } catch (err) {
    return {
      ok: false,
      error: `Tool ${toolUse.name} threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function errorResult(error: string, message: string, messages: AnthropicMessage[]): ExecuteResult {
  return {
    kind: 'error',
    error,
    message,
    conversationAfter: messages,
  };
}
