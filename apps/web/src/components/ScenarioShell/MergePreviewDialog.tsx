/**
 * Merge preview dialog — shows the scenario → préprod diff and asks
 * for a 1.2 s dwell-confirm before applying. Last-write-wins on
 * conflicts (per the user's spec); adds and deletes are reported
 * but skipped in V2.0.
 */
import { GitMerge, AlertTriangle, Plus, Minus, Edit3, Pin } from 'lucide-react';
import {
  useGetScenarioDiffQuery,
  useMergeScenarioMutation,
} from '../../store';
import { useComputeScheduleMutation } from '../../store/api/scheduleApi';
import { useAutoRecomputeCtx } from '../../contexts/AutoRecomputeContext';
import { PromotionDwellButton } from '../PromotionModal/PromotionDwellButton';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCancelButton } from '../Modal';

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
  const [computeSchedule] = useComputeScheduleMutation();
  const { showToast } = useAutoRecomputeCtx();

  const handleConfirm = async () => {
    try {
      await merge(scenarioId).unwrap();
      // After a successful merge, the chef's data has changed (modifications +
      // pin propagations) so the existing préprod schedule is stale. Kick off
      // a full recompute against préprod (no scenario header — `computeSchedule`
      // routes through realBaseQuery which is scoped by URL/headers, and we're
      // about to navigate away from the fork shell). We don't await it so the
      // navigation isn't blocked by the compute roundtrip ; the `.catch()`
      // surfaces compute failures via the toaster so the chef knows the plan
      // is stale rather than seeing nothing change.
      computeSchedule({ mode: 'full' })
        .unwrap()
        .catch(() => {
          showToast({
            type: 'error',
            title: 'Promotion appliquée, mais le recalcul automatique a échoué — relancez manuellement.',
          });
        });
      onMerged();
    } catch {
      // Error stays on screen via mergeState.error
    }
  };

  const totalMods = diff?.modifications.length ?? 0;
  const totalAdds = diff?.adds.length ?? 0;
  const totalDeletes = diff?.deletes.length ?? 0;
  const totalPinChanges = diff?.pinChanges?.length ?? 0;
  const canMerge = !isFetching && !!diff && (totalMods > 0 || totalPinChanges > 0);

  return (
    <Modal open={open} onClose={onClose} width={680} maxHeight="80vh" testId="merge-preview-dialog">
      <ModalHeader
        icon={<GitMerge size={14} />}
        iconTone="violet"
        title="Promouvoir vers préprod"
        description={scenarioName}
        onClose={onClose}
      />
      <ModalBody scroll gap={13}>
        {/* Headline counts. The 4-tile layout splits structural changes (left)
            from pin changes (right) so the chef sees at a glance whether the
            promotion will touch entity columns, pin state, or both. */}
        <div className="grid grid-cols-4 gap-[10px]">
          <CountTile icon={<Edit3 size={11} />} label="Modifications" value={totalMods} tone="violet" />
          <CountTile icon={<Pin size={11} />} label="Épinglages" value={totalPinChanges} tone="violet" />
          <CountTile icon={<Plus size={11} />} label="Ajouts (non promus)" value={totalAdds} tone="zinc" />
          <CountTile icon={<Minus size={11} />} label="Suppressions (non promues)" value={totalDeletes} tone="zinc" />
        </div>

        {(totalAdds > 0 || totalDeletes > 0) && (
          <div className="flex items-start gap-2 px-[10px] py-[8px] bg-amber-950/20 border border-amber-900/40 rounded-[3px] text-[11px] text-amber-300">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <div>
              Seules les modifications listées ci-dessous seront appliquées
              en préprod.{' '}
              {totalAdds > 0 && (
                <>
                  Les <strong>{totalAdds}</strong> entité{totalAdds > 1 ? 's' : ''}{' '}
                  ajoutée{totalAdds > 1 ? 's' : ''} dans la simulation{' '}
                  {totalAdds > 1 ? 'devront être recréées' : 'devra être recréée'}{' '}
                  manuellement.
                </>
              )}
              {totalAdds > 0 && totalDeletes > 0 && ' '}
              {totalDeletes > 0 && (
                <>
                  Les <strong>{totalDeletes}</strong> suppression{totalDeletes > 1 ? 's' : ''}{' '}
                  {totalDeletes > 1 ? 'devront être refaites' : 'devra être refaite'}{' '}
                  manuellement.
                </>
              )}
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
                  className="px-[10px] py-[6px] rounded-[3px] bg-zinc-900 border border-zinc-800 text-[11px]"
                  data-testid={`merge-mod-${idx}`}
                >
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="text-zinc-300 font-medium">{m.label}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      row {m.preprodRowId.slice(0, 8)}
                    </span>
                  </div>
                  {Object.entries(m.changes).map(([col, change]) => (
                    <ChangeRow key={col} col={col} from={change.from} to={change.to} />
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

        {/* Pin changes list — pin/unpin operations the chef did in the fork.
            Surfaced separately so the Détail des modifications above stays
            focused on entity column changes. */}
        {totalPinChanges > 0 && diff && (
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
              Détail des épinglages
            </div>
            <ul className="space-y-1">
              {diff.pinChanges.slice(0, 30).map((p, idx) => {
                const action = p.after.isPinned ? 'Épinglée' : 'Désépinglée';
                const tone = p.after.isPinned ? 'text-emerald-300' : 'text-rose-300';
                return (
                  <li
                    key={p.taskId}
                    className="px-[10px] py-[6px] rounded-[3px] bg-zinc-900 border border-zinc-800 text-[11px]"
                    data-testid={`merge-pin-${idx}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`font-medium ${tone}`}>{action}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">task {p.taskId.slice(0, 8)}</span>
                    </div>
                  </li>
                );
              })}
              {diff.pinChanges.length > 30 && (
                <li className="px-2 py-1 text-[10px] text-zinc-500 italic">
                  … et {diff.pinChanges.length - 30} autres épinglages
                </li>
              )}
            </ul>
          </div>
        )}

        {totalMods === 0 && totalPinChanges === 0 && !isFetching && (
          <div className="text-center text-xs text-zinc-500 py-6">
            Aucune modification à promouvoir.
          </div>
        )}

        {isFetching && (
          <div className="text-center text-xs text-zinc-500 py-4">Calcul du diff…</div>
        )}
      </ModalBody>
      <ModalFooter
        ribbon={mergeState.error ? (
          <div className="text-xs text-rose-300">
            La promotion a échoué (peut-être un job/station déjà supprimé en préprod entre-temps).
          </div>
        ) : null}
        hint="Maintenir 1.2 s pour confirmer · last-write-wins, pas d'undo · le planning préprod sera recalculé automatiquement après promotion"
      >
        <ModalCancelButton onClick={onClose}>Annuler</ModalCancelButton>
        <PromotionDwellButton
          onConfirmed={handleConfirm}
          disabled={!canMerge || mergeState.isLoading}
          label={mergeState.isLoading ? 'Promotion…' : 'Maintenir pour promouvoir'}
        />
      </ModalFooter>
    </Modal>
  );
}

/**
 * Renders a single column-level change. Defends against the easy
 * trap of truncating at a fixed width on JSON columns: the prefix
 * of two arrays often matches for tens of chars before they diverge,
 * so a short truncation makes the modal look like a no-op even
 * though the data really did change.
 *
 * Strategy:
 *   1. If both sides parse as a JSON array, show the entry count
 *      delta upfront ("1 → 2 entrées") so the structural change
 *      is unambiguous, then dump the truncated raw on a second line.
 *   2. Otherwise show the raw values with a generous truncation
 *      and word-break so the divergence is actually visible.
 */
function ChangeRow({
  col,
  from,
  to,
}: {
  col: string;
  from: unknown;
  to: unknown;
}) {
  const fromStr = from === null || from === undefined ? '∅' : String(from);
  const toStr = to === null || to === undefined ? '∅' : String(to);
  const fromArr = tryParseArray(fromStr);
  const toArr = tryParseArray(toStr);
  const showCount = fromArr !== null && toArr !== null;
  return (
    <div className="text-[10px] text-zinc-500 ml-1 mt-0.5">
      <div className="flex items-baseline gap-1">
        <span className="text-zinc-400 font-mono">{col}</span>
        {showCount && (
          <span className="text-zinc-500">
            <span className="text-rose-300/80">{fromArr!.length}</span>
            {' → '}
            <span className="text-emerald-300/80">{toArr!.length}</span>
            {' entrée' + (toArr!.length > 1 ? 's' : '')}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-0.5 font-mono break-all whitespace-pre-wrap leading-snug">
        <div className="text-rose-300/90 line-through">{truncate(fromStr, 220)}</div>
        <div className="text-emerald-300/90">{truncate(toStr, 220)}</div>
      </div>
    </div>
  );
}

function tryParseArray(s: string): unknown[] | null {
  if (!s.startsWith('[')) return null;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
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
    <div className="bg-zinc-900 rounded-[3px] p-[10px] border border-zinc-800">
      <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
