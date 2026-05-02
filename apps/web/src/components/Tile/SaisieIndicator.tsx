/**
 * Saisie indicator on a tile (V2 progress capture — see
 * docs/operator-sandbox/progress-capture-design.md).
 *
 * Completion is derived (`scheduledEnd < now`); explicit progress reporting
 * goes through the ProgressCaptureModal opened from this indicator.
 *
 * Visibility rule: only visible in prod mode. Préprod stays read-only —
 * operators cannot create a saisie there.
 *
 * Three visual states (set by the parent via useProgressTriggers):
 *   - 'inactive'  : neutral grey ring at low opacity. Cliquable à tout moment
 *                   pour saisie proactive (l'opérateur sait qu'il peut saisir).
 *   - 'hourly'    : solid blue fill. Heure pleine atteinte sans saisie récente.
 *   - 'tile-end'  : amber fill + pulse animation. `now ≥ scheduledEnd`,
 *                   moment-clef avant l'auto-completion silencieuse.
 *
 * Click → opens the ProgressCaptureModal (parent-supplied callback).
 */
import { Clock } from 'lucide-react';
import { useScenarioMode } from '../../contexts/ScenarioContext';

export type SaisieState = 'inactive' | 'hourly' | 'tile-end';

export interface SaisieIndicatorProps {
  /** Current saisie state, driven by useProgressTriggers in the parent. */
  state: SaisieState;
  /** Callback fired when the operator clicks the indicator (opens the modal). */
  onClick: () => void;
  /** Override the indicator's outer dimensions (default: 14×14). */
  className?: string;
}

const STATE_BG_CLASS: Record<SaisieState, string> = {
  'inactive': 'border border-zinc-500/45 bg-transparent opacity-55 hover:opacity-100',
  'hourly':   'bg-blue-500',
  'tile-end': 'bg-amber-500 animate-saisie-pulse',
};

const STATE_LABEL: Record<SaisieState, string> = {
  'inactive': 'Saisir l\'avancement',
  'hourly':   'Saisie suggérée — saisir l\'avancement',
  'tile-end': 'Saisie attendue — saisir l\'avancement',
};

const STATE_ICON_TONE: Record<SaisieState, string> = {
  'inactive': 'text-zinc-400/70',
  'hourly':   'text-white/90',
  'tile-end': 'text-white/95',
};

export function SaisieIndicator({
  state,
  onClick,
  className = 'w-3.5 h-3.5',
}: SaisieIndicatorProps) {
  const { mode } = useScenarioMode();
  if (mode !== 'prod') return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`saisie-indicator p-0 m-0 rounded-full inline-flex items-center justify-center shrink-0 transition-[opacity,background-color,box-shadow] cursor-pointer pointer-events-auto ${className} ${STATE_BG_CLASS[state]}`}
      title={STATE_LABEL[state]}
      aria-label={STATE_LABEL[state]}
      data-testid="tile-saisie-indicator"
      data-saisie-state={state}
    >
      <Clock className={`w-[9px] h-[9px] ${STATE_ICON_TONE[state]}`} strokeWidth={2.5} />
    </button>
  );
}
