import { useState, useCallback, type ReactElement } from 'react';
import { Minus, Plus, AlertTriangle } from 'lucide-react';
import { fmtTimeMin } from './timeUtils';

export interface NonLinearStepperProps {
  plannedEndMin: number;
  label: string;
  onTimeChange: (timeMin: number) => void;
  showBlockedButton?: boolean;
  onBlockedClick?: () => void;
}

const STEPS_POS = [0, 15, 30, 45, 60, 90, 120];
const STEPS_NEG = [0, -15, -30, -45, -60, -90, -120];

function getOffset(index: number): number {
  if (index >= 0) {
    return index < STEPS_POS.length
      ? STEPS_POS[index]
      : STEPS_POS[STEPS_POS.length - 1] + (index - STEPS_POS.length + 1) * 60;
  }
  const i = -index;
  return i < STEPS_NEG.length
    ? STEPS_NEG[i]
    : STEPS_NEG[STEPS_NEG.length - 1] - (i - STEPS_NEG.length + 1) * 60;
}

function fmtDuration(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function NonLinearStepper({
  plannedEndMin,
  label,
  onTimeChange,
  showBlockedButton,
  onBlockedClick,
}: NonLinearStepperProps): ReactElement {
  const [stepIndex, setStepIndex] = useState(0);

  const offset = getOffset(stepIndex);
  const currentTime = plannedEndMin + offset;

  const handleMinus = useCallback(() => {
    const next = stepIndex - 1;
    setStepIndex(next);
    onTimeChange(plannedEndMin + getOffset(next));
  }, [stepIndex, plannedEndMin, onTimeChange]);

  const handlePlus = useCallback(() => {
    const next = stepIndex + 1;
    setStepIndex(next);
    onTimeChange(plannedEndMin + getOffset(next));
  }, [stepIndex, plannedEndMin, onTimeChange]);

  let statusText: string;
  let statusClass: string;
  if (offset === 0) {
    statusText = "À l'heure";
    statusClass = 'text-emerald-300';
  } else if (offset > 0) {
    statusText = `${fmtDuration(offset)} de retard par rapport au planning en vigueur`;
    statusClass = offset > 30 ? 'text-red-300' : 'text-amber-300';
  } else {
    statusText = `${fmtDuration(-offset)} d'avance par rapport au planning en vigueur`;
    statusClass = 'text-emerald-300';
  }

  return (
    <div className="flex flex-col items-center gap-1.5 py-[18px] px-5 border-b border-flux-border" data-testid="pm-stepper">
      <div className="text-[12px] font-semibold text-flux-text-tertiary uppercase tracking-wide">
        {label}
      </div>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={handleMinus}
          className="w-10 h-10 rounded-[6px] border border-flux-border-light bg-[rgb(45,45,45)] text-flux-text-secondary flex items-center justify-center hover:bg-[rgb(60,60,60)] hover:text-flux-text-primary active:bg-[rgb(70,70,70)] transition-colors"
          data-testid="pm-stepper-minus"
        >
          <Minus size={16} />
        </button>
        <div
          className="min-w-[120px] text-center text-[28px] font-bold font-mono tabular-nums px-3 text-flux-text-primary"
          data-testid="pm-stepper-value"
        >
          {fmtTimeMin(currentTime)}
        </div>
        <button
          type="button"
          onClick={handlePlus}
          className="w-10 h-10 rounded-[6px] border border-flux-border-light bg-[rgb(45,45,45)] text-flux-text-secondary flex items-center justify-center hover:bg-[rgb(60,60,60)] hover:text-flux-text-primary active:bg-[rgb(70,70,70)] transition-colors"
          data-testid="pm-stepper-plus"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className={`text-[11.5px] font-semibold min-h-[17px] transition-colors ${statusClass}`} data-testid="pm-stepper-status">
        {statusText}
      </div>

      {showBlockedButton && (
        <button
          type="button"
          onClick={onBlockedClick}
          className="mt-3 flex items-center justify-center gap-1.5 px-3.5 py-[7px] rounded border border-flux-border-light text-[11.5px] font-semibold text-flux-text-muted hover:text-amber-300 hover:border-amber-300/40 hover:bg-amber-500/[0.06] transition-colors"
          data-testid="pm-blocked-btn"
        >
          <AlertTriangle size={13} />
          Je suis bloqué(e)
        </button>
      )}
    </div>
  );
}

export { getOffset };
