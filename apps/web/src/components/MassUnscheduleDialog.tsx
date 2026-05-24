import { Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { MassUnscheduleState } from '../hooks/useMassUnschedule';
import { DwellButton } from './DwellButton/DwellButton';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCancelButton } from './Modal';

interface Props {
  state: MassUnscheduleState;
  scenarioLabel: string;
  getClearableCount: (
    includeInProgress?: boolean,
    includePinned?: boolean,
    includeFrozen?: boolean,
    includeCompleted?: boolean,
  ) => number;
  onConfirm: () => void;
  onDismiss: () => void;
  onUpdate: (updater: (prev: MassUnscheduleState | null) => MassUnscheduleState | null) => void;
}

export function MassUnscheduleDialog({ state, scenarioLabel, getClearableCount, onConfirm, onDismiss, onUpdate }: Props) {
  if (state.phase === 'working') {
    return (
      <Modal open onClose={() => {}} width="28rem" testId="mass-unschedule-dialog">
        <ModalHeader
          icon={<Loader2 size={14} className="animate-spin" />}
          title="Effacement en cours…"
        />
        <ModalBody gap={10}>
          <p className="text-zinc-400 text-sm">
            Suppression des tuiles sur <span className="text-zinc-200 font-medium">{scenarioLabel}</span>…
          </p>
        </ModalBody>
        <ModalFooter>
          <span />
        </ModalFooter>
      </Modal>
    );
  }

  if (state.phase === 'result') {
    const hasError = !!state.error;
    return (
      <Modal open onClose={onDismiss} width="28rem" testId="mass-unschedule-dialog">
        <ModalHeader
          icon={hasError
            ? <AlertCircle size={14} />
            : <CheckCircle2 size={14} />}
          iconTone={hasError ? 'red' : 'emerald'}
          title={hasError ? 'Erreur' : 'Terminé'}
        />
        <ModalBody gap={6}>
          {hasError ? (
            <p className="text-red-400 text-sm">{state.error}</p>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-zinc-100 text-sm font-mono tabular-nums">
                {state.unassignedCount} tuile{(state.unassignedCount ?? 0) > 1 ? 's' : ''} effacée{(state.unassignedCount ?? 0) > 1 ? 's' : ''}
              </p>
              {state.includeCompleted && (
                <p className="text-zinc-400 text-xs">+ drapeaux « marqué fini » réinitialisés</p>
              )}
              {state.clearedProgress && (
                <p className="text-zinc-400 text-xs">+ saisies d'avancement réinitialisées</p>
              )}
              <p className="text-zinc-500 text-xs mt-1">
                Environnement : {scenarioLabel}
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <ModalCancelButton onClick={onDismiss}>Fermer</ModalCancelButton>
        </ModalFooter>
      </Modal>
    );
  }

  const count = getClearableCount(
    state.includeInProgress,
    state.includePinned,
    state.includeFrozen,
    state.includeCompleted,
  );

  return (
    <Modal open onClose={onDismiss} width="28rem" testId="mass-unschedule-dialog">
      <ModalHeader
        icon={<Trash2 size={14} />}
        iconTone="red"
        title="Effacer toutes les tuiles"
        description={state.includeCompleted
          ? 'Table rase : les tuiles terminées seront aussi retirées.'
          : 'Les tuiles terminées sont conservées (cocher pour les inclure).'}
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
        <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-sm">
          <input
            type="checkbox"
            checked={state.includeCompleted}
            onChange={(e) => onUpdate((prev) => prev ? { ...prev, includeCompleted: e.target.checked } : prev)}
            className="rounded-[3px] accent-red-500"
            data-testid="mass-unschedule-include-completed"
          />
          Inclure les tuiles terminées
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-sm">
          <input
            type="checkbox"
            checked={state.resetRecordedProgress}
            onChange={(e) => onUpdate((prev) => prev ? { ...prev, resetRecordedProgress: e.target.checked } : prev)}
            className="rounded-[3px] accent-red-500"
            data-testid="mass-unschedule-reset-progress"
          />
          Réinitialiser aussi les saisies d'avancement
        </label>
        <p className="text-zinc-500 text-xs">
          Environnement : {scenarioLabel}
        </p>
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
