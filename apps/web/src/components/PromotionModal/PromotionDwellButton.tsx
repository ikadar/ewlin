/**
 * Hold-to-confirm primary button for the promotion modal.
 *
 * Thin wrapper over the shared <DwellButton color="violet" /> so the
 * destructive RAZ flow (color="red") can reuse the exact same gesture.
 */
import { Rocket } from 'lucide-react';
import { DwellButton } from '../DwellButton/DwellButton';

interface PromotionDwellButtonProps {
  onConfirmed: () => void;
  disabled?: boolean;
  label?: string;
}

export function PromotionDwellButton({
  onConfirmed,
  disabled = false,
  label = 'Maintenir pour promouvoir',
}: PromotionDwellButtonProps) {
  return (
    <DwellButton
      color="violet"
      icon={Rocket}
      label={label}
      onConfirmed={onConfirmed}
      disabled={disabled}
      testId="promotion-dwell-button"
    />
  );
}
