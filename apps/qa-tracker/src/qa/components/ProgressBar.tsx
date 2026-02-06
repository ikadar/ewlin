/**
 * Progress Bar Component
 *
 * Shows segmented progress bar with colors for each status:
 * - Green: OK
 * - Amber: Partial
 * - Red: KO
 * - Gray: Untested (background)
 */

import type { Progress } from '../types';

interface ProgressBarProps {
  progress: Progress;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const { ok, partial, ko, total } = progress;

  if (total === 0) return null;

  const okPercent = (ok / total) * 100;
  const partialPercent = (partial / total) * 100;
  const koPercent = (ko / total) * 100;

  return (
    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden flex">
      {ok > 0 && (
        <div
          className="bg-emerald-500 h-full"
          style={{ width: `${okPercent}%` }}
        />
      )}
      {partial > 0 && (
        <div
          className="bg-amber-500 h-full"
          style={{ width: `${partialPercent}%` }}
        />
      )}
      {ko > 0 && (
        <div className="bg-red-500 h-full" style={{ width: `${koPercent}%` }} />
      )}
    </div>
  );
}
