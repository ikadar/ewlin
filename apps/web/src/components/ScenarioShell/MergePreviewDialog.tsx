/**
 * Merge preview dialog — shows the scenario → préprod diff and asks
 * for a 1.2 s dwell-confirm before applying. Last-write-wins on
 * conflicts (per the user's spec); adds and deletes are reported
 * but skipped in V2.0.
 */
import { useEffect } from 'react';
import { GitMerge, X, AlertTriangle, Plus, Minus, Edit3 } from 'lucide-react';
import {
  useGetScenarioDiffQuery,
  useMergeScenarioMutation,
} from '../../store';
import { PromotionDwellButton } from '../PromotionModal/PromotionDwellButton';

interface MergePreviewDialogProps {
  open: boolean;
  scenarioId: string;
  scenarioName: string;
  onClose: () => void;
  onMerged: () => void;
}

export function MergePreviewDialog({
  open,
  scenarioId,
  scenarioName,
  onClose,
  onMerged,
}: MergePreviewDialogProps) {
  const { data: diff, isFetching } = useGetScenarioDiffQuery(scenarioId, { skip: !open });
  const [merge, mergeState] = useMergeScenarioMutation();

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
      await merge(scenarioId).unwrap();
      onMerged();
    } catch {
      // Error stays on screen via mergeState.error
    }
  };

  const totalMods = diff?.modifications.length ?? 0;
  const totalAdds = diff?.adds.length ?? 0;
  const totalDeletes = diff?.deletes.length ?? 0;
  const canMerge = !isFetching && !!diff && totalMods > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="merge-preview-dialog"
    >
      <div
        className="bg-zinc-950 rounded-lg border border-zinc-800 w-full max-w-[680px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-violet-600/15 border border-violet-600/30 flex items-center justify-center">
              <GitMerge size={16} className="text-violet-300" />
            </div>
            <div>
              <div className="text-sm font-medium">Promouvoir vers préprod</div>
              <div className="text-[11px] text-zinc-500">
                {scenarioName}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Headline counts */}
          <div className="grid grid-cols-3 gap-2">
            <CountTile icon={<Edit3 size={11} />} label="Modifications" value={totalMods} tone="violet" />
            <CountTile icon={<Plus size={11} />} label="Ajouts (skipped)" value={totalAdds} tone="zinc" />
            <CountTile icon={<Minus size={11} />} label="Suppressions (skipped)" value={totalDeletes} tone="zinc" />
          </div>

          {(totalAdds > 0 || totalDeletes > 0) && (
            <div className="flex items-start gap-2 p-2 bg-amber-950/20 border border-amber-900/40 rounded-md text-[11px] text-amber-300">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <div>
                V2.0 ne mergeait que les modifications de colonnes existantes.
                Les ajouts ({totalAdds}) et suppressions ({totalDeletes}) sont
                listés mais pas appliqués — il faut les recréer dans la préprod
                à la main si besoin.
              </div>
            </div>
          )}

          {/* Modifications list */}
          {totalMods > 0 && diff && (
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                Détail des modifications
              </div>
              <ul className="space-y-1">
                {diff.modifications.slice(0, 50).map((m, idx) => (
                  <li
                    key={`${m.table}-${idx}`}
                    className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[11px]"
                    data-testid={`merge-mod-${idx}`}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span className="text-zinc-300 font-medium">{m.label}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        row {m.preprodRowId.slice(0, 8)}
                      </span>
                    </div>
                    {Object.entries(m.changes).map(([col, change]) => (
                      <div key={col} className="text-[10px] text-zinc-500 ml-1">
                        <span className="text-zinc-400 font-mono">{col}</span>:{' '}
                        <span className="text-rose-300 line-through">
                          {String(change.from ?? '∅').slice(0, 40)}
                        </span>{' '}
                        →{' '}
                        <span className="text-emerald-300">
                          {String(change.to ?? '∅').slice(0, 40)}
                        </span>
                      </div>
                    ))}
                  </li>
                ))}
                {diff.modifications.length > 50 && (
                  <li className="px-2 py-1 text-[10px] text-zinc-500 italic">
                    … et {diff.modifications.length - 50} autres modifications
                  </li>
                )}
              </ul>
            </div>
          )}

          {totalMods === 0 && !isFetching && (
            <div className="text-center text-xs text-zinc-500 py-6">
              Aucune modification à promouvoir.
            </div>
          )}

          {isFetching && (
            <div className="text-center text-xs text-zinc-500 py-4">Calcul du diff…</div>
          )}
        </div>

        {mergeState.error && (
          <div className="px-5 py-2 bg-rose-950/40 text-rose-300 text-xs border-t border-rose-900">
            La promotion a échoué (peut-être un job/station déjà supprimé en préprod entre-temps).
          </div>
        )}

        <footer className="px-5 py-3.5 border-t border-zinc-800 flex items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-500">
            Last-write-wins · pas de fenêtre d'undo
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
              disabled={!canMerge || mergeState.isLoading}
              label={mergeState.isLoading ? 'Promotion…' : 'Maintenir pour promouvoir'}
            />
          </div>
        </footer>
      </div>
    </div>
  );
}

function CountTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'violet' | 'zinc';
}) {
  const valueClass = tone === 'violet' ? 'text-violet-300' : 'text-zinc-300';
  return (
    <div className="bg-zinc-900 rounded-md p-2.5 border border-zinc-800">
      <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
