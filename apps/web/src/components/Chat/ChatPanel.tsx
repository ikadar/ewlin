import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { useAppSelector, useAppDispatch, setChatOpen } from '../../store';
import {
  useSendMessageMutation,
  useConfirmActionsMutation,
  useCancelActionsMutation,
} from '../../store';
import { ChatMessage } from './ChatMessage';
import { ChatConfirmation } from './ChatConfirmation';
import type {
  ChatMessage as ChatMessageType,
  ChatToolCall,
  ChatConversationStatus,
  ChatModelId,
  TokenUsage,
} from '@flux/types';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ChatPanel() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.ui.isChatOpen);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<ChatModelId>('haiku');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [pendingActions, setPendingActions] = useState<ChatToolCall[]>([]);
  const [status, setStatus] = useState<ChatConversationStatus>('idle');
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
  const [confirmActions, { isLoading: isConfirming }] =
    useConfirmActionsMutation();
  const [cancelActions] = useCancelActionsMutation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    // Add user message to local state immediately
    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const response = await sendMessage({
        conversationId,
        message: trimmed,
        model,
      }).unwrap();

      setConversationId(response.conversationId);
      setMessages((prev) => [...prev, ...response.messages]);
      setPendingActions(response.pendingActions);
      setStatus(response.status);
      if (response.usage) setTokenUsage(response.usage);
    } catch (err) {
      const errorMsg: ChatMessageType = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to send message'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }

  async function handleConfirm() {
    if (!conversationId || isConfirming) return;

    try {
      const response = await confirmActions({ conversationId }).unwrap();
      setMessages((prev) => [...prev, ...response.messages]);
      setPendingActions([]);
      setStatus('completed');
    } catch (err) {
      const errorMsg: ChatMessageType = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Execution error: ${err instanceof Error ? err.message : 'Failed to execute actions'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }

  async function handleCancel() {
    if (!conversationId) return;

    try {
      await cancelActions({ conversationId }).unwrap();
      setPendingActions([]);
      setStatus('idle');

      const cancelMsg: ChatMessageType = {
        id: `cancel-${Date.now()}`,
        role: 'assistant',
        content: 'Actions cancelled.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, cancelMsg]);
    } catch {
      // silently fail
    }
  }

  function handleNewConversation() {
    setConversationId(null);
    setMessages([]);
    setPendingActions([]);
    setStatus('idle');
    setTokenUsage(null);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-[420px] bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          {/* Model selector tabs */}
          <div className="flex items-center bg-zinc-900 rounded-md p-0.5" data-testid="model-selector">
            {(['sonnet', 'haiku'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModel(m)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  model === m
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                data-testid={`model-tab-${m}`}
              >
                {m === 'sonnet' ? 'Sonnet' : 'Haiku'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleNewConversation}
            className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            New
          </button>
          <button
            type="button"
            onClick={() => dispatch(setChatOpen(false))}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-8">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
            <p className="font-medium text-zinc-400">AI Scheduler Assistant</p>
            <p className="mt-1">
              Describe what you need in natural language.
            </p>
            <div className="mt-4 text-left space-y-2 text-xs text-zinc-600">
              <p>&quot;Job 4428 on G37 will be 2h late&quot;</p>
              <p>&quot;MBO in maintenance Tuesday 09h-11h30&quot;</p>
              <p>&quot;Everything until 10am this morning is done&quot;</p>
              <p>&quot;Jobs 4827, 2489, 204482 done&quot;</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}

        {status === 'awaiting_confirmation' && pendingActions.length > 0 && (
          <ChatConfirmation
            actions={pendingActions}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isConfirming={isConfirming}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you need..."
            rows={1}
            className="flex-1 resize-none bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !input.trim()}
            className="p-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-zinc-600">
            Enter to send, Shift+Enter for new line
          </p>
          {tokenUsage && (
            <p className="text-xs text-zinc-600 tabular-nums" data-testid="token-usage">
              {formatTokens(tokenUsage.inputTokens)} in / {formatTokens(tokenUsage.outputTokens)} out
              {tokenUsage.cacheReadTokens > 0 && (
                <span className="text-green-600"> ({formatTokens(tokenUsage.cacheReadTokens)} cached)</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
