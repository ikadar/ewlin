/**
 * QuickActionsRow — primary action targets in the progress-capture modal.
 *
 * Layout en T (cf. playgrounds/tile-prompts-and-menu.html, pm-quick block):
 *   ┌─────────────────────────────────────────────────────┐
 *   │              À L'HEURE  (full width, green)          │
 *   └─────────────────────────────────────────────────────┘
 *   ┌────┬────┬────┬────┬────┬────┐
 *   │ −1h│ −30│ −15│ +15│ +30│ +1h│  (compact, symmetric)
 *   └────┴────┴────┴────┴────┴────┘
 *
 * "À l'heure" is the dominant, easy target (Fitt's Law applied to expected
 * usage frequency). The 6 adjustments are strictly symmetric so the system
 * doesn't communicate a bias toward retard or avance.
 */
import type { ReactElement } from 'react';

export interface QuickActionsRowProps {
  /** Fragment's planned end time (minutes from midnight) — anchors "À l'heure". */
  plannedEndMin: number;
  /** Currently selected time (minutes from midnight) — drives active highlights. */
  currentTimeMin: number;
  /** Lower bound — must be `nowMin` (no retroactive reporting). */
  lowerBoundMin: number;
  /** Upper bound (typically end of day or planned + N hours). */
  upperBoundMin?: number;
  /** Callback fired when the operator picks a preset. */
  onSelect: (timeMin: number) => void;
}

const ADJUSTMENTS: ReadonlyArray<{ delta: number; label: string; variant: 'is-early' | 'is-late' }> = [
  { delta: -60, label: '−1h', variant: 'is-early' },
  { delta: -30, label: '−30', variant: 'is-early' },
  { delta: -15, label: '−15', variant: 'is-early' },
  { delta:  15, label: '+15', variant: 'is-late'  },
  { delta:  30, label: '+30', variant: 'is-late'  },
  { delta:  60, label: '+1h', variant: 'is-late'  },
];

const DEFAULT_UPPER = 23 * 60 + 45; // 23h45 — last 15-min slot of the day

export function QuickActionsRow({
  plannedEndMin,
  currentTimeMin,
  lowerBoundMin,
  upperBoundMin = DEFAULT_UPPER,
  onSelect,
}: QuickActionsRowProps): ReactElement {
  const handleSelect = (target: number) => {
    onSelect(Math.max(lowerBoundMin, Math.min(upperBoundMin, target)));
  };

  return (
    <div className="pm-quick">
      <button
        type="button"
        className={`pm-quick-btn is-ontime ${currentTimeMin === plannedEndMin ? 'is-active' : ''}`}
        onClick={() => handleSelect(plannedEndMin)}
        data-testid="pm-quick-ontime"
      >
        À l'heure
      </button>
      <div className="pm-adjust-row">
        {ADJUSTMENTS.map(({ delta, label, variant }) => {
          const target = plannedEndMin + delta;
          const isActive = currentTimeMin === target;
          return (
            <button
              key={delta}
              type="button"
              className={`pm-quick-btn ${variant} ${isActive ? 'is-active' : ''}`}
              onClick={() => handleSelect(target)}
              data-testid={`pm-quick-${delta > 0 ? 'plus' : 'minus'}${Math.abs(delta)}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
