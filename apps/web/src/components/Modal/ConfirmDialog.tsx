import type { ReactNode } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCancelButton, ModalPrimaryButton } from './Modal';

/**
 * Shared confirmation dialog. Replaces ad-hoc per-modal confirms and
 * native `window.confirm()` calls. Built on the JCF-aligned Modal
 * shell, with two variants:
 *
 *   - default      → blue primary, HelpCircle icon (zinc tone)
 *   - destructive  → red primary, AlertTriangle icon (red tone)
 */
interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: ReactNode;
  /** Body copy. Use a node for richer markup (highlighted name, etc.). */
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  /** Override the auto-picked icon. */
  icon?: ReactNode;
  /** Disable the confirm button (e.g. while a mutation is in-flight). */
  busy?: boolean;
  testId?: string;
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  icon,
  busy,
  testId,
}: ConfirmDialogProps) {
  const isDestructive = variant === 'destructive';
  const resolvedIcon = icon ?? (isDestructive
    ? <AlertTriangle size={14} />
    : <HelpCircle size={14} />);
  const resolvedConfirmLabel = confirmLabel ?? (isDestructive ? 'Supprimer' : 'Confirmer');

  return (
    <Modal open={open} onClose={onCancel} width="22rem" testId={testId}>
      <ModalHeader
        icon={resolvedIcon}
        iconTone={isDestructive ? 'red' : 'zinc'}
        title={title}
      />
      <ModalBody>
        <p className="text-zinc-300 text-sm leading-relaxed">{description}</p>
      </ModalBody>
      <ModalFooter>
        <ModalCancelButton onClick={onCancel} testId={testId ? `${testId}-cancel` : undefined}>
          {cancelLabel ?? 'Annuler'}
        </ModalCancelButton>
        <ModalPrimaryButton
          onClick={onConfirm}
          variant={isDestructive ? 'destructive' : 'primary'}
          disabled={busy}
          testId={testId ? `${testId}-confirm` : undefined}
        >
          {resolvedConfirmLabel}
        </ModalPrimaryButton>
      </ModalFooter>
    </Modal>
  );
}
