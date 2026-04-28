/**
 * Anthropic Messages API client.
 *
 * https://docs.claude.com/en/api/messages
 *
 * Why we replaced the Ollama / OpenAI-compatible client:
 *   - Local 7B models (qwen2.5, gemma) skip the resolve_* step on
 *     simple French prompts and pass human references as if they were
 *     UUIDs. They also ignore tool_choice='required' under Ollama.
 *   - Claude Haiku 4.5 follows multi-step instructions reliably and
 *     supports tool_choice {type:'any'} which the API actually honors.
 *
 * The wire format differs from OpenAI:
 *   - `system` is a top-level field, not a role inside `messages`
 *   - assistant messages can have multiple content blocks: text and
 *     tool_use blocks coexist in a single message
 *   - tool results are user messages with content blocks of type
 *     tool_result, identified by tool_use_id
 *   - tools are { name, description, input_schema } (no nested function)
 *   - tool_choice supports {type:'any'} (force a tool call) and
 *     {type:'tool', name:'...'} (force a specific tool)
 */

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<AnthropicTextBlock>;
  is_error?: boolean;
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type AnthropicToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string }
  | { type: 'none' };

export interface AnthropicMessagesRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
  tools?: AnthropicToolDefinition[];
  tool_choice?: AnthropicToolChoice;
  temperature?: number;
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicMessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: AnthropicContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: AnthropicUsage;
}

export class AnthropicClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://api.anthropic.com',
  ) {}

  async messages(
    request: AnthropicMessagesRequest,
    signal?: AbortSignal,
  ): Promise<AnthropicMessagesResponse> {
    const url = `${this.baseUrl}/v1/messages`;

    // Mark prompt-caching breakpoints on the two stable, identical-across-
    // turns pieces: the system prompt and the tool catalog. Anthropic
    // discounts cached input tokens by ~90% and lowers TTFT on cache hits.
    // Up to 4 breakpoints supported; we use 2.
    const wireRequest = applyCacheControl(request);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(wireRequest),
        signal,
      });
    } catch (err) {
      throw new Error(
        `Failed to reach Anthropic API at ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API returned ${res.status}: ${text.slice(0, 500)}`);
    }
    return (await res.json()) as AnthropicMessagesResponse;
  }
}

/**
 * Expand the request to use Anthropic's prompt-caching wire format on the
 * stable prefix (system prompt + tools). Caller passes a string `system`
 * and a flat tools array; we rewrite them to:
 *   - system: [{ type: 'text', text, cache_control: ephemeral }]
 *   - tools : [...rest, { ...lastTool, cache_control: ephemeral }]
 * Both breakpoints sit at the boundary of "things that don't change between
 * turns" (system + tools) and "things that change every turn" (messages).
 *
 * Returns an opaque shape because the cache-aware fields aren't in the
 * AnthropicMessagesRequest type — they're a wire-only concern.
 */
function applyCacheControl(req: AnthropicMessagesRequest): unknown {
  const ephemeral = { type: 'ephemeral' } as const;
  const out: Record<string, unknown> = { ...req };

  if (typeof req.system === 'string' && req.system.length > 0) {
    out.system = [{ type: 'text', text: req.system, cache_control: ephemeral }];
  }

  if (req.tools && req.tools.length > 0) {
    out.tools = req.tools.map((t, i) =>
      i === req.tools!.length - 1
        ? { ...t, cache_control: ephemeral }
        : t,
    );
  }

  return out;
}
