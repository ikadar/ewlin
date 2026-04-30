import { Trash2 } from 'lucide-react';
import type { MassUnscheduleState } from '../hooks/useMassUnschedule';
import { DwellButton } from './DwellButton/DwellButton';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCancelButton } from './Modal';

interface Props {
  state: MassUnscheduleState;
  getClearableCount: (
    includeInProgress?: boolean,
    includePinned?: boolean,
    includeFrozen?: boolean,
  ) => number;
  onConfirm: () => void;
  onDismiss: () => void;
  onUpdate: (updater: (prev: MassUnscheduleState | null) => MassUnscheduleState | null) => void;
}

export function MassUnscheduleDialog({ state, getClearableCount, onConfirm, onDismiss, onUpdate }: Props) {
  const count = getClearableCount(state.includeInProgress, state.includePinned, state.includeFrozen);
  return (
    <Modal open onClose={onDismiss} width="28rem" testId="mass-unschedule-dialog">
      <ModalHeader
        icon={<Trash2 size={14} />}
        iconTone="red"
        title="Effacer toutes les tuiles"
        description="Les tuiles terminées sont toujours conservées."
      />
      <ModalBody gap={10}>
        <p className="text-zinc-100 text-sm font-mono tabular-nums">
          {count} tuile{count > 1 ? 's' : ''} à effacer
        </p>
        <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-sm">
          <input
            type="checkbox"
            checked={state.includeInProgress}
            onChange={(e) => onUpdate((prev) => prev ? { ...prev, includeInProgress: e.target.checked } : prev)}
            className="rounded-[3px] accent-red-500"
          />
          Inclure les tuiles en cours d'exécution
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-sm">
          <input
            type="checkbox"
            checked={state.includePinned}
            onChange={(e) => onUpdate((prev) => prev ? { ...prev, includePinned: e.target.checked } : prev)}
            className="rounded-[3px] accent-red-500"
          />
          Inclure les tuiles épinglées
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-sm">
          <input
            type="checkbox"
            checked={state.includeFrozen}
            onChange={(e) => onUpdate((prev) => prev ? { ...prev, includeFrozen: e.target.checked } : prev)}
            className="rounded-[3px] accent-red-500"
          />
          Inclure les tuiles avec flocon actif (safety zone)
        </label>
      </ModalBody>
      <ModalFooter hint="Maintenir 1.2 s pour confirmer.">
        <ModalCancelButton onClick={onDismiss}>Annuler</ModalCancelButton>
        <DwellButton
          color="red"
          icon={Trash2}
          label="Maintenir pour effacer"
          onConfirmed={onConfirm}
          testId="mass-unschedule-dwell-button"
        />
      </ModalFooter>
    </Modal>
  );
}
