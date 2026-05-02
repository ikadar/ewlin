/**
 * VolumeGauge — graphical representation of the volume expected for the
 * active fragment, on the **full job 100% scale** with the active slot
 * isolated as a distinct band.
 *
 * Visual layout (cf. playgrounds/tile-prompts-and-menu.html, gauge variant):
 *   ┌─ Volume attendu (sur le job entier) ─────────────┐
 *   │                                                    │
 *   │  [░░░░░░│██████░░░░░░░░░│░░░░░░░░░░░░] 100%       │
 *   │         ▲      ▲         ▲                          │
 *   │       slot   marker     slot                        │
 *   │       start  (cumul     end                         │
 *   │              now)                                   │
 *   │                                                      │
 *   │  0%                                          100%    │
 *   │                                                       │
 *   │  Créneau actif : 35% du job (de 30% à 65%)           │
 *   └────────────────────────────────────────────────────────┘
 *
 * The cumulBeforeSlotPct positioning is supplied by the engine — see
 * `services/scheduling-engine/src/fragments::cumulative_position` (planned).
 */
import type { ReactElement } from 'react';

export interface VolumeGaugeProps {
  /** % of the job already delivered by previous fragments (0–100). */
  cumulBeforeSlotPct: number;
  /** % of the job that this slot will deliver (0–100). */
  slotVolumePct: number;
  /**
   * % of the job that this slot has delivered at "now". Slot-local volume
   * expressed in job terms — must satisfy 0 ≤ expectedAtNowPct ≤ slotVolumePct.
   * Computed run-only (calage neutral) — see project_calage_run_ratio memory.
   */
  expectedAtNowPct: number;
}

export function VolumeGauge({
  cumulBeforeSlotPct,
  slotVolumePct,
  expectedAtNowPct,
}: VolumeGaugeProps): ReactElement {
  // Defensive clamping — keeps the visual sane against malformed inputs.
  const before = Math.max(0, Math.min(100, cumulBeforeSlotPct));
  const slot = Math.max(0, Math.min(100 - before, slotVolumePct));
  const expected = Math.max(0, Math.min(slot, expectedAtNowPct));

  const slotEnd = before + slot;
  const cumulNow = before + expected;
  const slotFillPct = slot > 0 ? (expected / slot) * 100 : 0;

  return (
    <div className="volume-gauge" data-testid="volume-gauge">
      <div className="volume-gauge-track">
        <div
          className="volume-gauge-slot-zone"
          style={{ left: `${before}%`, width: `${slot}%` }}
          data-testid="volume-gauge-slot-zone"
        >
          <div
            className="volume-gauge-slot-fill"
            style={{ width: `${slotFillPct}%` }}
            data-testid="volume-gauge-slot-fill"
          />
        </div>
        <div
          className="volume-gauge-marker"
          style={{ left: `${cumulNow}%` }}
          data-testid="volume-gauge-marker"
        >
          <div className="volume-gauge-marker-label">
            ≈ {Math.round(cumulNow)}% du job
          </div>
        </div>
      </div>
      <div className="volume-gauge-endpoints">
        <span>0%</span>
        <span>
          <strong>100%</strong>&nbsp;·&nbsp;fin du job
        </span>
      </div>
      <div className="volume-gauge-slot-info">
        Créneau actif&nbsp;: <strong>{slot}%</strong> du job (de {before}% à {slotEnd}%)
      </div>
    </div>
  );
}
