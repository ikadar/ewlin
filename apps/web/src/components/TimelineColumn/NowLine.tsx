import { timeToYPosition, formatTime } from './utils';
import { PIXELS_PER_HOUR } from './HourMarker';
import type { Collapse } from '../SchedulingGrid/collapseConfig';

export interface NowLineProps {
  /** Current time */
  currentTime: Date;
  /** Start hour of the timeline (default: 6) */
  startHour?: number;
  /** Pixels per hour (default: 80) */
  pixelsPerHour?: number;
  /**
   * Grid start date. Required for multi-day grids so the line's Y matches
   * what `timeToYPosition` produces for tiles. Legacy single-day usages
   * may pass `undefined` (e.g. `StationColumns`).
   */
  gridStartDate: Date | undefined;
  /**
   * Active collapse bands. Pass `[]` for a linear grid. Without this the
   * now line drifts against the rendered content whenever a weekend or
   * night sits between `gridStartDate` and `currentTime`.
   */
  collapses: readonly Collapse[];
}

/**
 * NowLine - Red line indicating current time with time label.
 */
export function NowLine({
  currentTime,
  startHour = 6,
  pixelsPerHour = PIXELS_PER_HOUR,
  gridStartDate,
  collapses,
}: NowLineProps) {
  const yPosition = timeToYPosition(currentTime, startHour, pixelsPerHour, gridStartDate, collapses);

  return (
    <>
      {/* Red line */}
      <div
        className="absolute left-0 right-0 h-0.5 bg-red-500 z-20"
        style={{ top: yPosition }}
        data-testid="now-line"
      />
      {/* Time label */}
      <span
        className="absolute left-1 text-xs font-mono text-red-400 bg-zinc-900 px-1 rounded z-20"
        style={{ top: yPosition - 7 }}
        data-testid="now-line-label"
      >
        {formatTime(currentTime)}
      </span>
    </>
  );
}
