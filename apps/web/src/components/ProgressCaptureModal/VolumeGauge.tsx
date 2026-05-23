/**
 * VolumeGauge — task-scoped progress bar for the saisie modal.
 *
 * Visual reinforcement of the « vous devriez en être à X% » sentence rendered
 * above. No duplicated percentage label here — the bar is the picture, the
 * sentence above is the words. Calage neutral, run-only — see
 * project_calage_run_ratio.
 *
 *   [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
 *   0%                         100% · fin de la tâche
 */
import type { ReactElement } from 'react';

export interface VolumeGaugeProps {
  /** % of the task already done at "now" (0–100). Run-only (calage neutral). */
  taskProgressPct: number;
}

export function VolumeGauge({ taskProgressPct }: VolumeGaugeProps): ReactElement {
  const progress = Math.max(0, Math.min(100, taskProgressPct));

  return (
    <div className="volume-gauge" data-testid="volume-gauge">
      <div className="volume-gauge-track">
        <div
          className="volume-gauge-slot-zone"
          style={{ left: '0%', width: '100%' }}
          data-testid="volume-gauge-slot-zone"
        >
          <div
            className="volume-gauge-slot-fill"
            style={{ width: `${progress}%` }}
            data-testid="volume-gauge-slot-fill"
          />
        </div>
        <div
          className="volume-gauge-marker"
          style={{ left: `${progress}%` }}
          data-testid="volume-gauge-marker"
        />
      </div>
      <div className="volume-gauge-endpoints">
        <span>0%</span>
        <span>
          <strong>100%</strong>&nbsp;·&nbsp;fin de la tâche
        </span>
      </div>
    </div>
  );
}
