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
import { Rocket, TrendingUp, TrendingDown, CircleDot, AlertTriangle, Undo2 } from 'lucide-react';
import {
  useGetPromotionPreviewQuery,
  usePromoteMutation,
} from '../../store';
import { PromotionDwellButton } from './PromotionDwellButton';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCancelButton } from '../Modal';

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
    <Modal open={open} onClose={onClose} width={820} testId="promotion-modal">
      <ModalHeader
        icon={<Rocket size={14} />}
        iconTone="emerald"
        title="Promouvoir préprod → prod"
        description="L'ancienne prod est conservée 5 minutes en undo"
        onClose={onClose}
        extra={prodStamp ? (
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Prod actuelle</div>
            <div className="text-xs text-zinc-300">{new Date(prodStamp).toLocaleString('fr-FR')}</div>
          </div>
        ) : null}
      />
      <ModalBody>
        <div className="grid grid-cols-2 gap-[13px]">
          <div className="bg-zinc-900 rounded-[3px] p-[13px] border border-zinc-800">
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
          <div className="bg-zinc-900 rounded-[3px] p-[13px] border border-zinc-800">
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
            <span>Annulation possible 5 minutes après promotion · maintenir 1.2 s pour confirmer</span>
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
