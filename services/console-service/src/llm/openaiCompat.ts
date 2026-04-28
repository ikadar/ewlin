/**
 * OpenAI-compatible Messages client + Anthropic ⇄ OpenAI wire-format adapter.
 *
 * Why an adapter rather than rewriting the loop:
 *   - `loop.ts` already speaks the Anthropic shape internally — content
 *     blocks, `tool_use`/`tool_result` blocks, top-level `system`. The
 *     conversation is also stored on the FE in that exact shape and
 *     round-tripped on every /execute call. Touching that contract
 *     would ripple into the FE, the audit log, and the MCP server.
 *   - Encapsulating the conversion at the API boundary lets us add
 *     more providers (Gemini, DeepSeek, …) by writing a sibling client,
 *     not a parallel loop.
 *
 * Format differences handled here:
 *
 *   System prompt:    Anthropic top-level `system` field
 *                     OpenAI `role: 'system'` message at index 0
 *
 *   Tool definition:  Anthropic { name, description, input_schema }
 *                     OpenAI    { type: 'function', function: { name, description, parameters } }
 *
 *   tool_choice:      Anthropic { type: 'auto' | 'any' | 'tool' | 'none' }
 *                     OpenAI    'auto' | 'required' | 'none' | { type: 'function', function: { name } }
 *
 *   Tool emit:        Anthropic content block { type: 'tool_use', id, name, input }
 *                     OpenAI    sibling field tool_calls[i] = { id, function: { name, arguments: JSON-string } }
 *
 *   Tool result:      Anthropic content block { type: 'tool_result', tool_use_id, content }
 *                     OpenAI    standalone message { role: 'tool', tool_call_id, content: string }
 *                     (one OpenAI message per tool_result block; never grouped)
 *
 *   Reasoning trace:  Groq GPT OSS exposes a `reasoning` field on the
 *                     assistant message. We drop it on the way back —
 *                     it never makes it into the Anthropic-shaped
 *                     conversation, so nothing downstream sees it.
 *
 *   Usage:            Anthropic { input_tokens, output_tokens }
 *                     OpenAI    { prompt_tokens, completion_tokens, completion_tokens_details? }
 *                     reasoning_tokens are billed inside completion_tokens.
 */
import type {
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  AnthropicContentBlock,
  AnthropicTextBlock,
  AnthropicToolUseBlock,
  AnthropicToolResultBlock,
} from './anthropic.js';

// ----------------------------------------------------------------------------
// OpenAI wire types (only the subset we use)
// ----------------------------------------------------------------------------

interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON-encoded
  };
}

interface OpenAISystemMessage {
  role: 'system';
  content: string;
}

interface OpenAIUserMessage {
  role: 'user';
  content: string;
}

interface OpenAIAssistantMessage {
  role: 'assistant';
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

type OpenAIMessage =
  | OpenAISystemMessage
  | OpenAIUserMessage
  | OpenAIAssistantMessage
  | OpenAIToolMessage;

type OpenAIToolChoice =
  | 'auto'
  | 'required'
  | 'none'
  | { type: 'function'; function: { name: string } };

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAIToolDefinition[];
  tool_choice?: OpenAIToolChoice;
  max_tokens?: number;
  temperature?: number;
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: OpenAIToolCall[];
      reasoning?: string;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
}

// ----------------------------------------------------------------------------
// Client
// ----------------------------------------------------------------------------

export class OpenAICompatClient {
  constructor(
    private readonly apiKey: string,
    /** Base URL ending in `/v1` (e.g. https://api.groq.com/openai/v1) */
    private readonly baseUrl: string,
    /** Model id pushed into every outgoing request */
    private readonly model: string,
  ) {}

  async messages(
    request: AnthropicMessagesRequest,
    signal?: AbortSignal,
  ): Promise<AnthropicMessagesResponse> {
    const openAIReq = toOpenAIRequest(request, this.model);
    const url = `${this.baseUrl}/chat/completions`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(openAIReq),
        signal,
      });
    } catch (err) {
      throw new Error(
        `Failed to reach OpenAI-compat API at ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI-compat API returned ${res.status}: ${text.slice(0, 500)}`);
    }
    const data = (await res.json()) as OpenAIChatResponse;
    return fromOpenAIResponse(data, request.model);
  }
}

// ----------------------------------------------------------------------------
// Adapter: Anthropic request → OpenAI request
// ----------------------------------------------------------------------------

export function toOpenAIRequest(
  req: AnthropicMessagesRequest,
  modelOverride: string,
): OpenAIChatRequest {
  const messages: OpenAIMessage[] = [];

  if (req.system && req.system.length > 0) {
    messages.push({ role: 'system', content: req.system });
  }

  for (const msg of req.messages) {
    if (typeof msg.content === 'string') {
      // String shorthand. Both 'user' and 'assistant' allowed.
      if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      } else {
        messages.push({ role: 'user', content: msg.content });
      }
      continue;
    }

    if (msg.role === 'user') {
      // User content blocks: tool_result blocks become standalone
      // role='tool' messages; text blocks aggregate into a single user
      // message. Mixed bundles are unusual but supported.
      const toolResults = msg.content.filter(
        (b): b is AnthropicToolResultBlock => b.type === 'tool_result',
      );
      const texts = msg.content.filter((b): b is AnthropicTextBlock => b.type === 'text');

      for (const tr of toolResults) {
        const content =
          typeof tr.content === 'string'
            ? tr.content
            : tr.content.map((c) => c.text).join('');
        messages.push({
          role: 'tool',
          tool_call_id: tr.tool_use_id,
          content,
        });
      }
      if (texts.length > 0) {
        messages.push({ role: 'user', content: texts.map((t) => t.text).join('\n') });
      }
      continue;
    }

    // Assistant content blocks: text + tool_use coexist in a single
    // OpenAI message, with tool_use moving to a sibling tool_calls field.
    const texts = msg.content.filter((b): b is AnthropicTextBlock => b.type === 'text');
    const toolUses = msg.content.filter(
      (b): b is AnthropicToolUseBlock => b.type === 'tool_use',
    );

    const assistantMsg: OpenAIAssistantMessage = { role: 'assistant' };
    if (texts.length > 0) {
      assistantMsg.content = texts.map((t) => t.text).join('\n');
    } else {
      assistantMsg.content = null;
    }
    if (toolUses.length > 0) {
      assistantMsg.tool_calls = toolUses.map((tu) => ({
        id: tu.id,
        type: 'function',
        function: {
          name: tu.name,
          arguments: JSON.stringify(tu.input ?? {}),
        },
      }));
    }
    messages.push(assistantMsg);
  }

  const tools: OpenAIToolDefinition[] | undefined = req.tools?.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));

  let tool_choice: OpenAIToolChoice | undefined;
  if (req.tool_choice) {
    switch (req.tool_choice.type) {
      case 'auto':
        tool_choice = 'auto';
        break;
      case 'any':
        tool_choice = 'required';
        break;
      case 'tool':
        tool_choice = { type: 'function', function: { name: req.tool_choice.name } };
        break;
      case 'none':
        tool_choice = 'none';
        break;
    }
  }

  return {
    model: modelOverride,
    messages,
    tools,
    tool_choice,
    max_tokens: req.max_tokens,
    temperature: req.temperature,
  };
}

// ----------------------------------------------------------------------------
// Adapter: OpenAI response → Anthropic response
// ----------------------------------------------------------------------------

export function fromOpenAIResponse(
  resp: OpenAIChatResponse,
  originalRequestModel: string,
): AnthropicMessagesResponse {
  const choice = resp.choices[0];
  if (!choice) {
    throw new Error('OpenAI-compat response has no choices');
  }

  const blocks: AnthropicContentBlock[] = [];
  if (choice.message.content && choice.message.content.length > 0) {
    blocks.push({ type: 'text', text: choice.message.content });
  }
  for (const tc of choice.message.tool_calls ?? []) {
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(tc.function.arguments) as Record<string, unknown>;
    } catch {
      // Defensive: malformed args from the model still need to round-trip
      // so the downstream Zod validation can surface the error.
      input = { _rawArguments: tc.function.arguments };
    }
    blocks.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.function.name,
      input,
    });
  }

  let stop_reason: AnthropicMessagesResponse['stop_reason'];
  switch (choice.finish_reason) {
    case 'stop':
      stop_reason = 'end_turn';
      break;
    case 'length':
      stop_reason = 'max_tokens';
      break;
    case 'tool_calls':
      stop_reason = 'tool_use';
      break;
    case 'content_filter':
      stop_reason = 'stop_sequence';
      break;
    default:
      stop_reason = 'end_turn';
  }

  return {
    id: resp.id,
    type: 'message',
    role: 'assistant',
    model: originalRequestModel,
    content: blocks,
    stop_reason,
    stop_sequence: null,
    usage: {
      input_tokens: resp.usage.prompt_tokens,
      output_tokens: resp.usage.completion_tokens,
    },
  };
}
