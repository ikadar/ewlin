import { CheckCircle } from 'lucide-react';
import type { ReactElement } from 'react';

export interface ConfirmOntimeButtonProps {
  onClick: () => void;
}

export function ConfirmOntimeButton({ onClick }: ConfirmOntimeButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 w-full mt-2.5 py-2.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-[12px] font-semibold text-emerald-300 active:bg-emerald-500/20 active:scale-[0.98] transition-all"
      data-testid="mobile-confirm-ontime"
    >
      <CheckCircle size={14} />
      Je confirme être à l'heure
    </button>
  );
}
