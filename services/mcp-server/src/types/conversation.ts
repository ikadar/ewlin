import type Anthropic from '@anthropic-ai/sdk';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ChatToolCall[];
}

export interface ChatToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
}

export interface ChatRequest {
  conversationId: string | null;
  message: string;
}

export interface ChatResponse {
  conversationId: string;
  messages: ChatMessage[];
  status: 'idle' | 'awaiting_confirmation' | 'executing' | 'completed' | 'error';
  pendingActions: ChatToolCall[];
  usage?: TokenUsage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export function emptyTokenUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
}

export interface ConversationState {
  id: string;
  messages: Anthropic.MessageParam[];
  pendingActions: ChatToolCall[];
  status: 'idle' | 'awaiting_confirmation' | 'executing' | 'completed' | 'error';
  jwtToken: string;
  totalUsage: TokenUsage;
  createdAt: number;
  updatedAt: number;
}
