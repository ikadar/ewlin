/**
 * Multi-turn LLM execution loop with function calling.
 *
 * The loop:
 *   1. Builds the system prompt + tool catalog
 *   2. Sends the user prompt + conversation history to Ollama
 *   3. If Ollama returns tool_calls, runs each tool in dry-run mode and
 *      appends the tool results to the conversation
 *   4. Loops until Ollama calls propose_plan, ask_user, or hits a limit
 *   5. Returns the final result to the caller
 *
 * Two terminal tools (propose_plan, ask_user) short-circuit the loop:
 * propose_plan returns a structured plan, ask_user returns a question
 * back to the frontend.
 */
import type { Config } from '../config.js';
import { OllamaClient, type OllamaMessage, type OllamaToolDefinition, type OllamaToolCall } from './ollama.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { allTools, findTool } from '../tools/registry.js';
import { zodToJsonSchema } from '../tools/jsonSchema.js';
import { PhpClient } from '../phpClient.js';
import type { ToolContext, ToolResult } from '../tools/types.js';
import { todayIsoUtc } from '../tools/dates.js';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

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
}

function buildToolCatalog(): OllamaToolDefinition[] {
  return allTools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.inputSchema) as Record<string, unknown>,
    },
  }));
}

function convertToOllamaMessages(
  systemPrompt: string,
  conversation: ConversationMessage[],
  newPrompt: string,
): OllamaMessage[] {
  const messages: OllamaMessage[] = [{ role: 'system', content: systemPrompt }];
  for (const m of conversation) {
    if (m.role === 'tool') {
      messages.push({
        role: 'tool',
        content: m.content,
        tool_call_id: m.toolCallId,
      });
    } else if (m.role === 'assistant' && m.toolCalls) {
      messages.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }
  messages.push({ role: 'user', content: newPrompt });
  return messages;
}

function extractResolvedEntities(toolHistory: Array<{ name: string; result: ToolResult }>): ResolvedEntity[] {
  const entities: ResolvedEntity[] = [];
  for (const { name, result } of toolHistory) {
    if (!result.ok) continue;
    const data = result.data as { candidates?: Array<{ id: string; label?: string; reference?: string; firstName?: string; lastName?: string; name?: string }> };
    if (!data?.candidates) continue;
    if (data.candidates.length !== 1) continue; // only commit unambiguous resolutions
    const c = data.candidates[0]!;
    const kind: ResolvedEntity['kind'] | null = name === 'resolve_operator'
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

export async function runExecuteLoop(args: RunExecuteLoopArgs): Promise<ExecuteResult> {
  const todayIso = todayIsoUtc();
  const systemPrompt = buildSystemPrompt(todayIso);
  const toolCatalog = buildToolCatalog();
  const ollama = new OllamaClient(args.config.ollamaBaseUrl);
  const php = new PhpClient(args.config.phpApiUrl, args.jwt);
  const ctx: ToolContext = { php, dryRun: args.dryRun, todayIso };

  // Build the conversation history that we'll keep extending
  const messages = convertToOllamaMessages(systemPrompt, args.conversation, args.prompt);

  // Track tool execution history so we can extract resolved entities later
  const toolHistory: Array<{ name: string; result: ToolResult }> = [];

  const startedAt = Date.now();
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), args.config.llmTotalTimeoutMs);

  try {
    for (let turn = 0; turn < args.config.llmMaxTurns; turn++) {
      const response = await ollama.chat(
        {
          model: args.config.llmModel,
          messages,
          tools: toolCatalog,
          tool_choice: 'auto',
          temperature: args.config.llmTemperature,
        },
        abortController.signal,
      );

      const choice = response.choices[0];
      if (!choice) {
        return errorResult('NO_CHOICE', 'LLM returned no choices', messages);
      }
      const assistantMessage = choice.message;

      // Append the assistant message to history regardless
      messages.push(assistantMessage);

      // No tool calls → the LLM gave a plain text answer. We expect a tool
      // call (propose_plan or ask_user) — treat this as an error so we
      // can surface what the LLM said.
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return errorResult(
          'MISSING_TERMINAL_TOOL',
          `Le modèle a répondu sans appeler propose_plan ni ask_user. Réponse brute : ${assistantMessage.content?.slice(0, 500) ?? '(vide)'}`,
          messages,
        );
      }

      // Process each tool call. If propose_plan or ask_user is called, the
      // loop ends with the corresponding result.
      let terminal: ExecuteResult | null = null;
      for (const toolCall of assistantMessage.tool_calls) {
        const result = await runToolCall(toolCall, ctx);
        toolHistory.push({ name: toolCall.function.name, result });

        // Append the tool result to the conversation for the next turn
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });

        // Detect terminal tools
        if (toolCall.function.name === 'propose_plan' && result.ok) {
          const planData = result.data as {
            kind: 'plan';
            narration: string;
            actions: ProposedAction[];
          };
          terminal = {
            kind: 'plan',
            narration: planData.narration,
            actions: planData.actions,
            resolvedEntities: extractResolvedEntities(toolHistory),
            conversationAfter: ollamaMessagesToConversation(messages),
          };
        } else if (toolCall.function.name === 'ask_user' && result.ok) {
          const qData = result.data as {
            kind: 'question';
            question: string;
            options: string[];
          };
          terminal = {
            kind: 'question',
            question: qData.question,
            options: qData.options.length > 0 ? qData.options : undefined,
            conversationAfter: ollamaMessagesToConversation(messages),
          };
        }
      }
      if (terminal) {
        clearTimeout(timeoutId);
        return terminal;
      }
    }

    // Hit the turn limit without a terminal tool
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

async function runToolCall(toolCall: OllamaToolCall, ctx: ToolContext): Promise<ToolResult> {
  const def = findTool(toolCall.function.name);
  if (!def) {
    return { ok: false, error: `Unknown tool: ${toolCall.function.name}` };
  }
  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON arguments for ${toolCall.function.name}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const validation = def.inputSchema.safeParse(parsedArgs);
  if (!validation.success) {
    return {
      ok: false,
      error: `Validation failed for ${toolCall.function.name}: ${validation.error.message}`,
    };
  }
  try {
    return await def.handler(validation.data, ctx);
  } catch (err) {
    return {
      ok: false,
      error: `Tool ${toolCall.function.name} threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function ollamaMessagesToConversation(messages: OllamaMessage[]): ConversationMessage[] {
  const out: ConversationMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'tool') {
      out.push({ role: 'tool', content: m.content ?? '', toolCallId: m.tool_call_id });
    } else if (m.role === 'assistant' && m.tool_calls) {
      out.push({
        role: 'assistant',
        content: m.content ?? '',
        toolCalls: m.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: safeJsonParse(tc.function.arguments),
        })),
      });
    } else {
      out.push({ role: m.role as ConversationMessage['role'], content: m.content ?? '' });
    }
  }
  return out;
}

function safeJsonParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorResult(error: string, message: string, messages: OllamaMessage[]): ExecuteResult {
  return {
    kind: 'error',
    error,
    message,
    conversationAfter: ollamaMessagesToConversation(messages),
  };
}
