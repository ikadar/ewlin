import { HourMarker, PIXELS_PER_HOUR } from './HourMarker';
import { NowLine } from './NowLine';

export interface TimelineColumnProps {
  /** Start hour (default: 6) */
  startHour?: number;
  /** Number of hours to display (default: 24) */
  hourCount?: number;
  /** Current time for now line (default: new Date()) */
  currentTime?: Date;
  /** Whether to show the now line (default: true) */
  showNowLine?: boolean;
}

/**
 * Generate hour sequence starting from startHour.
 * E.g., startHour=6, count=24 => [6,7,8,...,23,0,1,2,3,4,5]
 */
function generateHourSequence(startHour: number, count: number): number[] {
  const hours: number[] = [];
  for (let i = 0; i < count; i++) {
    hours.push((startHour + i) % 24);
  }
  return hours;
}

/**
 * TimelineColumn - Displays hour markers and now line.
 * Used alongside station columns in the scheduling grid.
 */
export function TimelineColumn({
  startHour = 6,
  hourCount = 24,
  currentTime = new Date(),
  showNowLine = true,
}: TimelineColumnProps) {
  const hours = generateHourSequence(startHour, hourCount);
  const totalHeight = hourCount * PIXELS_PER_HOUR;

  return (
    <div className="w-12 shrink-0 border-r border-white/5 sticky left-0 z-10 bg-zinc-950">
      <div
        className="relative bg-zinc-900/50"
        style={{ height: totalHeight }}
      >
        {hours.map((hour, index) => (
          <HourMarker
            key={`hour-${hour}-${index}`}
            hour={hour}
            yPosition={index * PIXELS_PER_HOUR}
          />
        ))}
        {showNowLine && (
          <NowLine currentTime={currentTime} startHour={startHour} />
        )}
      </div>
    </div>
  );
}
