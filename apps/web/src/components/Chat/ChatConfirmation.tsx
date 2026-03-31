import { Check, X, Loader2 } from 'lucide-react';
import { ChatToolCallBadge } from './ChatToolCallBadge';
import type { ChatToolCall } from '@flux/types';

interface Props {
  actions: ChatToolCall[];
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming: boolean;
}

export function ChatConfirmation({
  actions,
  onConfirm,
  onCancel,
  isConfirming,
}: Props) {
  return (
    <div className="bg-amber-600/5 border border-amber-600/20 rounded-lg p-3">
      <p className="text-xs font-medium text-amber-400 mb-2">
        Pending actions ({actions.length})
      </p>

      <div className="space-y-1 mb-3">
        {actions.map((action) => (
          <ChatToolCallBadge key={action.id} toolCall={action} />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 text-white text-xs font-medium rounded transition-colors"
        >
          {isConfirming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          Execute
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isConfirming}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
