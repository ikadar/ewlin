import { timeToYPosition, formatTime } from './utils';
import { PIXELS_PER_HOUR } from './HourMarker';

export interface NowLineProps {
  /** Current time */
  currentTime: Date;
  /** Start hour of the timeline (default: 6) */
  startHour?: number;
  /** Pixels per hour (default: 80) */
  pixelsPerHour?: number;
}

/**
 * NowLine - Red line indicating current time with time label.
 */
export function NowLine({ currentTime, startHour = 6, pixelsPerHour = PIXELS_PER_HOUR }: NowLineProps) {
  const yPosition = timeToYPosition(currentTime, startHour, pixelsPerHour);

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
