/**
 * Promotion preview modal.
 *
 * Shown when the chef clicks "Promouvoir" in the planning-env header.
 * Layout (validated via playground):
 *   - Header: title + current prod stamp + close button
 *   - KPI strip: 2 tiles only (Jobs planifiés delta, Jobs en retard delta)
 *   - Footer: cancel + 1.2 s dwell-to-confirm primary button
 *
 * A diff list (per-job) was prototyped but is deferred to v1.x — for v1
 * the two-KPI summary is the chef's go/no-go signal.
 */
import { useEffect } from 'react';
import { Rocket, X, TrendingUp, TrendingDown, CircleDot, AlertTriangle, Undo2 } from 'lucide-react';
import {
  useGetPromotionPreviewQuery,
  usePromoteMutation,
} from '../../store';
import { PromotionDwellButton } from './PromotionDwellButton';

interface PromotionModalProps {
  open: boolean;
  onClose: () => void;
  /** Called once promotion has succeeded; receives the undo TTL ISO string (or null). */
  onPromoted: (undoExpiresAt: string | null) => void;
}

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '±0';
}

export function PromotionModal({ open, onClose, onPromoted }: PromotionModalProps) {
  const { data: preview, isFetching } = useGetPromotionPreviewQuery(undefined, { skip: !open });
  const [promote, promoteState] = usePromoteMutation();

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    try {
      const result = await promote().unwrap();
      onPromoted(result.undoAvailable ? result.undoExpiresAt : null);
      onClose();
    } catch {
      // RTK Query exposes the error in promoteState.error.
      // Keep modal open so the user can retry or cancel.
    }
  };

  const planned = preview?.kpi.planned;
  const late = preview?.kpi.late;
  const prodStamp = preview?.prod?.promotedAt;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="promotion-modal"
    >
      <div
        className="bg-zinc-950 rounded-lg border border-zinc-800 w-full max-w-[820px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-emerald-600/15 border border-emerald-600/30 flex items-center justify-center">
              <Rocket size={16} className="text-emerald-300" />
            </div>
            <div>
              <div className="text-sm font-medium">Promouvoir préprod → prod</div>
              <div className="text-[11px] text-zinc-500">
                L'ancienne prod est conservée 5 minutes en undo
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {prodStamp && (
              <div className="text-right">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Prod actuelle</div>
                <div className="text-xs text-zinc-300">{new Date(prodStamp).toLocaleString('fr-FR')}</div>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* KPI strip */}
        <div className="px-5 py-3 border-b border-zinc-800 grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 rounded-md p-3 border border-zinc-800">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
              <CircleDot size={12} className="text-zinc-300" /> Jobs planifiés
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-2xl font-semibold text-zinc-100">
                {isFetching || !planned ? '—' : planned.preprod}
              </div>
              {planned && (
                <div className={`flex items-center gap-1 text-xs ${planned.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {planned.delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span className="font-mono">{formatDelta(planned.delta)}</span>
                  <span className="text-[10px] text-zinc-500 font-sans">
                    vs prod actuelle ({planned.prod})
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="bg-zinc-900 rounded-md p-3 border border-zinc-800">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
              <AlertTriangle size={12} className="text-rose-400" /> Jobs en retard
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-2xl font-semibold text-rose-300">
                {isFetching || !late ? '—' : late.preprod}
              </div>
              {late && (
                <div className={`flex items-center gap-1 text-xs ${late.delta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {late.delta <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                  <span className="font-mono">{formatDelta(late.delta)}</span>
                  <span className="text-[10px] text-zinc-500 font-sans">
                    vs prod actuelle ({late.prod})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error display */}
        {promoteState.error && (
          <div className="px-5 py-2 bg-rose-950/40 text-rose-300 text-xs border-b border-rose-900">
            La promotion a échoué. Vérifiez les services back-end et réessayez.
          </div>
        )}

        {/* Footer */}
        <footer className="px-5 py-3.5 border-t border-zinc-800 flex items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Undo2 size={12} />
            <span>Annulation possible 5 minutes après promotion</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
            >
              Annuler
            </button>
            <PromotionDwellButton
              onConfirmed={handleConfirm}
              disabled={isFetching || promoteState.isLoading}
              label={promoteState.isLoading ? 'Promotion en cours…' : 'Maintenir pour promouvoir'}
            />
          </div>
        </footer>
      </div>
    </div>
  );
}
