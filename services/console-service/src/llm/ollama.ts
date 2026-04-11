/**
 * Ollama OpenAI-compatible chat completions client.
 *
 * Uses the /v1/chat/completions endpoint that mirrors the OpenAI shape,
 * which means the same code works against:
 *   - Ollama (default, http://localhost:11434/v1)
 *   - Google AI Studio (gemini-* via https://generativelanguage.googleapis.com/v1beta/openai)
 *   - LM Studio, vLLM, etc.
 *
 * Function calling is requested via the standard `tools` parameter, and
 * tool calls come back in `choices[0].message.tool_calls`.
 */
export interface OllamaToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OllamaToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  tools?: OllamaToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  stream?: false;
}

export interface OllamaChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OllamaMessage;
    finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OllamaClient {
  constructor(private readonly baseUrl: string) {}

  async chat(request: OllamaChatRequest, signal?: AbortSignal): Promise<OllamaChatResponse> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const body: OllamaChatRequest = { ...request, stream: false };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      throw new Error(
        `Failed to reach Ollama at ${url}: ${err instanceof Error ? err.message : String(err)}. ` +
          `Is Ollama running? Try 'ollama serve' and 'ollama pull ${request.model}'.`,
      );
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama returned ${res.status}: ${text.slice(0, 500)}`);
    }
    return (await res.json()) as OllamaChatResponse;
  }
}
