/**
 * FeasibilityPreview — live status of the chosen pin target inside the
 * SetStartTimeDialog. Shows one of three states :
 *
 *   - loading   : a request to /schedule/feasibility-preview is in flight
 *   - feasible  : the slot is available, the pin will land verbatim
 *   - glided    : the slot is unavailable (closure / capacity / dependency),
 *                 the engine will glide the pin to the next open slot ; the
 *                 resolved datetime is shown so the operator can validate.
 *
 * The component is presentational ; the parent owns the API call (via
 * `feasibilityPreviewApi`) and forwards the result.
 */
import { Check, AlertTriangle } from 'lucide-react';
import type { ReactElement } from 'react';

const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function frDateLong(iso: string): string {
  const d = new Date(iso);
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

function frTimeShort(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export interface FeasibilityPreviewProps {
  /** Whether the preview request is in flight. */
  isLoading?: boolean;
  /** True when the target lands verbatim, false when the engine will glide it. */
  feasible: boolean;
  /** ISO datetime that the engine will commit (target if feasible, next open slot otherwise). */
  resolvedIso: string;
}

export function FeasibilityPreview({
  isLoading = false,
  feasible,
  resolvedIso,
}: FeasibilityPreviewProps): ReactElement {
  if (isLoading) {
    return (
      <div className="feas feas-loading" data-testid="feas-preview" data-feas-state="loading">
        <span className="text-flux-text-tertiary text-[12px]">Vérification du créneau…</span>
      </div>
    );
  }

  if (feasible) {
    return (
      <div className="feas feas-ok" data-testid="feas-preview" data-feas-state="feasible">
        <Check className="feas-icon" strokeWidth={2.5} />
        <div className="feas-content">
          <div className="feas-title">Créneau disponible</div>
          <div className="feas-detail">
            {frDateLong(resolvedIso)} · {frTimeShort(resolvedIso)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="feas feas-warn" data-testid="feas-preview" data-feas-state="glided">
      <AlertTriangle className="feas-icon" strokeWidth={2.5} />
      <div className="feas-content">
        <div className="feas-title">Sera glissé au prochain créneau dispo</div>
        <div className="feas-detail">
          {frDateLong(resolvedIso)} · {frTimeShort(resolvedIso)}
        </div>
      </div>
    </div>
  );
}
