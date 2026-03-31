import { User, Bot } from 'lucide-react';
import { ChatToolCallBadge } from './ChatToolCallBadge';
import type { ChatMessage as ChatMessageType } from '@flux/types';

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="shrink-0 w-6 h-6 rounded-full bg-amber-600/20 flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-amber-400" />
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-zinc-800 text-zinc-100'
            : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((tc) => (
              <ChatToolCallBadge key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="shrink-0 w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-zinc-300" />
        </div>
      )}
    </div>
  );
}
