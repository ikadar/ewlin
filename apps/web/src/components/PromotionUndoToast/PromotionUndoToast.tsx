/**
 * 5-minute undo toast shown after a successful promotion.
 *
 * Operates as a top-right floating toast with a live countdown. Clicking
 * "Annuler" within the window calls POST /api/v1/promotion/undo. After
 * the countdown reaches 00:00 the toast self-dismisses; subsequent
 * undo attempts hit a 410 Gone (handled by the API gracefully).
 */
import { useEffect, useState } from 'react';
import { Check, Undo2 } from 'lucide-react';
import { useUndoPromotionMutation } from '../../store';

interface PromotionUndoToastProps {
  /** ISO timestamp when the undo window expires. null = no undo available, toast hidden. */
  expiresAt: string | null;
  onUndone: () => void;
  onDismiss: () => void;
}

function secondsRemaining(expiresAt: string): number {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  return Math.max(0, Math.floor((exp - now) / 1000));
}

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PromotionUndoToast({ expiresAt, onUndone, onDismiss }: PromotionUndoToastProps) {
  const [remaining, setRemaining] = useState<number>(() =>
    expiresAt ? secondsRemaining(expiresAt) : 0,
  );
  const [undo, undoState] = useUndoPromotionMutation();

  useEffect(() => {
    if (!expiresAt) return;
    setRemaining(secondsRemaining(expiresAt));
    const id = setInterval(() => {
      const next = secondsRemaining(expiresAt);
      setRemaining(next);
      if (next <= 0) {
        clearInterval(id);
        onDismiss();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onDismiss]);

  if (!expiresAt || remaining <= 0) return null;

  const handleClick = async () => {
    try {
      await undo().unwrap();
      onUndone();
    } catch {
      // 410 Gone: window expired. Just dismiss.
      onDismiss();
    }
  };

  return (
    <div className="fixed top-4 right-4 z-40 w-[380px]" data-testid="promotion-undo-toast">
      <div className="bg-zinc-900 rounded-md border-l-4 border-l-emerald-500 border border-zinc-800 shadow-xl p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-full bg-emerald-600/20 flex items-center justify-center shrink-0 mt-0.5">
            <Check size={14} className="text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-zinc-100">Promotion effectuée</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              L'ancienne prod reste récupérable durant cette fenêtre
            </div>
          </div>
          <button
            type="button"
            onClick={handleClick}
            disabled={undoState.isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 shrink-0 disabled:opacity-50"
          >
            <Undo2 size={12} />
            <span>Annuler</span>
            <span className="font-mono text-zinc-400 ml-0.5">{formatCountdown(remaining)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
