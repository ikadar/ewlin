import { AlertTriangle } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCancelButton, ModalPrimaryButton } from '../Modal';

/**
 * Delete confirmation dialog for the Flux dashboard (qa.md K6.1).
 * Uses the shared Modal shell but keeps legacy test IDs (and the
 * legacy `flux-delete-dialog-backdrop` hook used by light-mode CSS).
 */
export function FluxDeleteConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open
      onClose={onCancel}
      width="22rem"
      testId="flux-delete-dialog"
      backdropTestId="flux-delete-dialog-backdrop"
    >
      <ModalHeader
        icon={<AlertTriangle size={14} />}
        iconTone="red"
        title="Supprimer le job ?"
      />
      <ModalBody>
        <p className="text-zinc-300 text-sm leading-relaxed">
          Cette action est irréversible.
        </p>
      </ModalBody>
      <ModalFooter>
        <ModalCancelButton onClick={onCancel} testId="flux-delete-cancel">Annuler</ModalCancelButton>
        <ModalPrimaryButton onClick={onConfirm} variant="destructive" testId="flux-delete-confirm">
          Supprimer
        </ModalPrimaryButton>
      </ModalFooter>
    </Modal>
  );
}
