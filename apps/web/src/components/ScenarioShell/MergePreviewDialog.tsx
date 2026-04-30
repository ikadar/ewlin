/**
 * Merge preview dialog — shows the scenario → préprod diff and asks
 * for a 1.2 s dwell-confirm before applying. Last-write-wins on
 * conflicts (per the user's spec); adds and deletes are reported
 * but skipped in V2.0.
 */
import { GitMerge, AlertTriangle, Plus, Minus, Edit3 } from 'lucide-react';
import {
  useGetScenarioDiffQuery,
  useMergeScenarioMutation,
} from '../../store';
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
    <Modal open={open} onClose={onClose} width={680} maxHeight="80vh" testId="merge-preview-dialog">
      <ModalHeader
        icon={<GitMerge size={14} />}
        iconTone="violet"
        title="Promouvoir vers préprod"
        description={scenarioName}
        onClose={onClose}
      />
      <ModalBody scroll gap={13}>
        {/* Headline counts */}
        <div className="grid grid-cols-3 gap-[10px]">
          <CountTile icon={<Edit3 size={11} />} label="Modifications" value={totalMods} tone="violet" />
          <CountTile icon={<Plus size={11} />} label="Ajouts (skipped)" value={totalAdds} tone="zinc" />
          <CountTile icon={<Minus size={11} />} label="Suppressions (skipped)" value={totalDeletes} tone="zinc" />
        </div>

        {(totalAdds > 0 || totalDeletes > 0) && (
          <div className="flex items-start gap-2 px-[10px] py-[8px] bg-amber-950/20 border border-amber-900/40 rounded-[3px] text-[11px] text-amber-300">
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
      </ModalBody>
      <ModalFooter
        ribbon={mergeState.error ? (
          <div className="text-xs text-rose-300">
            La promotion a échoué (peut-être un job/station déjà supprimé en préprod entre-temps).
          </div>
        ) : null}
        hint="Last-write-wins · pas de fenêtre d'undo · maintenir 1.2 s pour confirmer"
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
