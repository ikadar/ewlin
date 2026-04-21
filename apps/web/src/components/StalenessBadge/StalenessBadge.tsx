/**
 * StalenessBadge — fallback indicator shown when auto-recompute fails.
 *
 * The happy path keeps the planning fresh silently. This badge only
 * appears when a compute failed (engine down, timeout, error). Offers
 * a retry button to re-attempt without re-editing.
 */

import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  hasFailed: boolean;
  isRetrying: boolean;
  lastError: string | null;
  onRetry: () => void;
}

export function StalenessBadge({ hasFailed, isRetrying, lastError, onRetry }: Props) {
  if (!hasFailed) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 px-4 py-2 bg-red-950/60 border border-red-800/50 text-red-200 text-sm"
    >
      <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
      <span className="flex-1 truncate">
        Planning potentiellement incohérent — dernier recalcul échoué
        {lastError && <span className="text-red-300/70"> ({lastError})</span>}
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
      >
        <RotateCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
        {isRetrying ? 'Recalcul…' : 'Réessayer'}
      </button>
    </div>
  );
}
