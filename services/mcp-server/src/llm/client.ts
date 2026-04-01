import Anthropic from '@anthropic-ai/sdk';
import { READ_TOOLS, WRITE_TOOLS } from './tools.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { executeReadTool } from './toolExecutor.js';
import { classifyIntent, getToolsForIntent } from './router.js';
import { PhpApiClient } from '../api/phpClient.js';
import type { ConversationState, ChatToolCall, ChatMessage, TokenUsage } from '../types/conversation.js';
import { emptyTokenUsage } from '../types/conversation.js';

export type ModelChoice = 'sonnet' | 'haiku';

const MODEL_MAP: Record<ModelChoice, string> = {
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-haiku-4-5-20251001',
};

const DEFAULT_MODEL: ModelChoice = 'haiku';
const MAX_TOKENS = 300;

/** Maximum number of message pairs to keep in conversation history. */
export const MAX_CONVERSATION_MESSAGES = 12;

/** Maximum characters for a single tool result before truncation. */
export const MAX_TOOL_RESULT_CHARS = 2000;

export function resolveModel(choice?: string): string {
  if (choice && choice in MODEL_MAP) {
    return MODEL_MAP[choice as ModelChoice];
  }
  return MODEL_MAP[DEFAULT_MODEL];
}

function createAnthropicClient(): Anthropic {
  return new Anthropic();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Truncate a tool result string to MAX_TOOL_RESULT_CHARS.
 * Appends a truncation notice if content was cut.
 */
export function truncateToolResult(content: string): string {
  if (content.length <= MAX_TOOL_RESULT_CHARS) {
    return content;
  }
  return content.slice(0, MAX_TOOL_RESULT_CHARS) + '\n...[truncated, ' + (content.length - MAX_TOOL_RESULT_CHARS) + ' chars omitted]';
}

/**
 * Trim conversation messages to the most recent MAX_CONVERSATION_MESSAGES.
 * Always keeps the first user message for context continuity.
 */
export function trimConversation(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  if (messages.length <= MAX_CONVERSATION_MESSAGES) {
    return messages;
  }
  // Keep the first message (initial user context) + the last (MAX - 1) messages
  return [messages[0]!, ...messages.slice(-(MAX_CONVERSATION_MESSAGES - 1))];
}

/**
 * Add cache_control to the last tool in a list for prompt caching.
 */
function withCacheControl(tools: Anthropic.Tool[]): Anthropic.Tool[] {
  if (tools.length === 0) return [];
  return tools.map((t, i) =>
    i === tools.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t
  );
}

/**
 * Process a user message through Claude, executing read tools immediately
 * and collecting write tools as pending actions.
 *
 * Uses two-phase routing: first classifies intent cheaply, then sends only relevant tools.
 */
export async function processMessage(
  conversation: ConversationState,
  phpClient: PhpApiClient,
  model?: string
): Promise<{ assistantMessages: ChatMessage[]; pendingActions: ChatToolCall[]; usage: TokenUsage }> {
  const anthropic = createAnthropicClient();
  const resolvedModel = resolveModel(model);
  const currentDate = new Date().toISOString().split('T')[0]!;
  const systemPrompt = buildSystemPrompt(currentDate);

  // Phase 1: Classify intent to select tool subset (cheap ~160 token call)
  const lastUserMessage = [...conversation.messages].reverse().find((m: Anthropic.MessageParam) => m.role === 'user');
  const userText = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '';
  const classification = await classifyIntent(userText, model);
  const selectedTools = withCacheControl(getToolsForIntent(classification.intent));
  const assistantMessages: ChatMessage[] = [];
  const pendingActions: ChatToolCall[] = [];
  const usage = emptyTokenUsage();

  // Add classification call tokens
  usage.inputTokens += classification.inputTokens;
  usage.outputTokens += classification.outputTokens;

  // Agentic loop: keep processing until Claude gives a final text response
  let continueLoop = true;

  while (continueLoop) {
    // Trim conversation history to cap token usage
    const trimmedMessages = trimConversation(conversation.messages);

    const response = await anthropic.messages.create({
      model: resolvedModel,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: selectedTools,
      messages: trimmedMessages,
    });

    // Accumulate token usage
    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    const cacheUsage = response.usage as unknown as Record<string, unknown>;
    usage.cacheReadTokens += ((cacheUsage.cache_read_input_tokens as number) ?? 0);
    usage.cacheCreationTokens += ((cacheUsage.cache_creation_input_tokens as number) ?? 0);

    // Process the response content blocks
    const toolUseBlocks: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }> = [];
    let textContent = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    // If there's text content, add it as an assistant message
    if (textContent) {
      assistantMessages.push({
        id: generateId(),
        role: 'assistant',
        content: textContent,
        timestamp: new Date().toISOString(),
      });
    }

    // Add assistant turn to conversation
    conversation.messages.push({
      role: 'assistant',
      content: response.content,
    });

    // If no tool calls, we're done
    if (toolUseBlocks.length === 0) {
      continueLoop = false;
      break;
    }

    // Process tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      if (READ_TOOLS.has(toolUse.name)) {
        // Execute read tools immediately
        try {
          const result = await executeReadTool(toolUse.name, toolUse.input, phpClient);
          const resultStr = truncateToolResult(JSON.stringify(result));
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: resultStr,
          });
        } catch (e) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${e instanceof Error ? e.message : String(e)}`,
            is_error: true,
          });
        }
      } else if (WRITE_TOOLS.has(toolUse.name)) {
        // Collect write tools as pending actions
        pendingActions.push({
          id: toolUse.id,
          toolName: toolUse.name,
          input: toolUse.input,
          status: 'pending',
        });

        // Tell Claude clearly that the action was NOT executed
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'NOT EXECUTED. Action blocked pending user confirmation. Tell the user what will happen and that they need to confirm.',
          is_error: true,
        });
      }
    }

    // Add tool results to conversation
    conversation.messages.push({
      role: 'user',
      content: toolResults,
    });

    // If we only had write tools (no more read tools to process), stop the loop
    // Let Claude generate the confirmation message
    if (response.stop_reason === 'end_turn') {
      continueLoop = false;
    }
  }

  return { assistantMessages, pendingActions, usage };
}
