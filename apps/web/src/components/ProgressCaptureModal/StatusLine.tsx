/**
 * StatusLine — live feedback under the saisie controls. Renders one of three
 * states based on the delta between the user's selected end-time and the
 * fragment's planned end-time:
 *
 *   ✓ green   → "Vous finirez à l'heure prévue."
 *   ↓ green   → "Vous finirez X min en avance."
 *   ↑ amber   → "Vous finirez X min en retard."
 *
 * The colour grammar mirrors the rest of the V2 UX (cf. doc design § 6) — being
 * early is treated as positive, being late is amber-warned but not alarming.
 */
import { Check, ArrowDown, ArrowUp } from 'lucide-react';
import type { ReactElement } from 'react';

export interface StatusLineProps {
  currentTimeMin: number;
  plannedEndMin: number;
}

export function StatusLine({ currentTimeMin, plannedEndMin }: StatusLineProps): ReactElement {
  const delta = currentTimeMin - plannedEndMin;

  if (Math.abs(delta) < 1) {
    return (
      <div className="pm-status is-ontime" data-testid="pm-status" data-pm-status="ontime">
        <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
        <span>Vous finirez à l'heure prévue.</span>
      </div>
    );
  }

  if (delta < 0) {
    return (
      <div className="pm-status is-avance" data-testid="pm-status" data-pm-status="avance">
        <ArrowDown className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
        <span>Vous finirez {Math.abs(delta)} min en avance.</span>
      </div>
    );
  }

  return (
    <div className="pm-status is-retard" data-testid="pm-status" data-pm-status="retard">
      <ArrowUp className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
      <span>Vous finirez {delta} min en retard.</span>
    </div>
  );
}
