import { Rocket, Undo2 } from 'lucide-react';
import {
  useGetPromotionPreviewQuery,
  usePromoteMutation,
  useGetSnapshotQuery,
  useGetProdSnapshotQuery,
} from '../../store';
import { PromotionDwellButton } from './PromotionDwellButton';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCancelButton } from '../Modal';
import { computePromotionChanges } from './computePromotionChanges';
import { useMemo } from 'react';

interface PromotionModalProps {
  open: boolean;
  onClose: () => void;
  onPromoted: (undoExpiresAt: string | null) => void;
}

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '±0';
}

function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-[8px]">
      <span className="text-[13px] text-zinc-400">{label}</span>
      <div className="flex items-baseline justify-end gap-2 text-[14px] font-medium text-zinc-100 tabular-nums min-w-[100px] text-right">
        {children}
      </div>
    </div>
  );
}

export function PromotionModal({ open, onClose, onPromoted }: PromotionModalProps) {
  const { data: preview, isFetching } = useGetPromotionPreviewQuery(undefined, { skip: !open });
  const { data: preprodSnapshot } = useGetSnapshotQuery(undefined, { skip: !open });
  const { data: prodSnapshot } = useGetProdSnapshotQuery(undefined, { skip: !open });
  const [promote, promoteState] = usePromoteMutation();

  const changes = useMemo(() => {
    if (!preprodSnapshot || !prodSnapshot) return null;
    return computePromotionChanges(preprodSnapshot, prodSnapshot);
  }, [preprodSnapshot, prodSnapshot]);

  const handleConfirm = async () => {
    try {
      const result = await promote().unwrap();
      onPromoted(result.undoAvailable ? result.undoExpiresAt : null);
      onClose();
    } catch {
      // Keep modal open so the user can retry or cancel.
    }
  };

  const planned = preview?.kpi.planned;
  const late = preview?.kpi.late;
  const prodStamp = preview?.prod?.promotedAt;
  const jcfCount = changes
    ? changes.jcf.added + changes.jcf.removed + changes.jcf.modified
    : null;

  return (
    <Modal open={open} onClose={onClose} width={560} testId="promotion-modal">
      <ModalHeader
        icon={<Rocket size={14} />}
        iconTone="emerald"
        title="Promouvoir préprod → prod"
        onClose={onClose}
        extra={prodStamp ? (
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Prod actuelle</div>
            <div className="text-xs text-zinc-400">{new Date(prodStamp).toLocaleString('fr-FR')}</div>
          </div>
        ) : null}
      />
      <ModalBody>
        <div className="px-0 py-1">
          <StatRow label="Jobs planifiés">
            {isFetching || !planned ? '—' : (
              <>
                <span>{planned.preprod}</span>
                <span className={`font-mono text-[12px] ${planned.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatDelta(planned.delta)}
                </span>
              </>
            )}
          </StatRow>
          <StatRow label="Jobs en retard">
            {isFetching || !late ? '—' : (
              <>
                <span className={late.preprod > 0 ? 'text-rose-300' : ''}>
                  {late.preprod}
                </span>
                <span className={`font-mono text-[12px] ${late.delta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatDelta(late.delta)}
                </span>
              </>
            )}
          </StatRow>

          <div className="h-px my-1 bg-zinc-800/50" />

          <StatRow label="Modifications de jobs">
            {jcfCount == null ? '—' : (
              jcfCount > 0
                ? <span className="text-[13px] text-amber-400">{jcfCount} modif.</span>
                : <span className="text-[13px] text-zinc-600">aucun</span>
            )}
          </StatRow>
          <StatRow label="Config. stations">
            {!changes ? '—' : (
              changes.stations.modified > 0
                ? <span className="text-[13px] text-amber-400">{changes.stations.modified} modif.</span>
                : <span className="text-[13px] text-zinc-600">aucun</span>
            )}
          </StatRow>
          <StatRow label="Config. opérateurs">
            {!changes ? '—' : (
              changes.operators.modified > 0
                ? <span className="text-[13px] text-amber-400">{changes.operators.modified} modif.</span>
                : <span className="text-[13px] text-zinc-600">aucun</span>
            )}
          </StatRow>
        </div>
      </ModalBody>
      <ModalFooter
        ribbon={promoteState.error ? (
          <div className="text-xs text-rose-300">
            La promotion a échoué. Vérifiez les services back-end et réessayez.
          </div>
        ) : null}
        hint={(
          <div className="flex items-center gap-1.5">
            <Undo2 size={12} />
            <span>Undo disponible 5 min</span>
          </div>
        )}
      >
        <ModalCancelButton onClick={onClose}>Annuler</ModalCancelButton>
        <PromotionDwellButton
          onConfirmed={handleConfirm}
          disabled={isFetching || promoteState.isLoading}
          label={promoteState.isLoading ? 'Promotion en cours…' : 'Maintenir pour promouvoir'}
        />
      </ModalFooter>
    </Modal>
  );
}
