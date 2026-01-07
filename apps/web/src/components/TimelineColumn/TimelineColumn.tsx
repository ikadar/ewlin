import { useMemo } from 'react';
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
  /** Pixels per hour (default: 80) */
  pixelsPerHour?: number;
  /** v0.3.46: Visible day range for virtual scrolling */
  visibleDayRange?: { start: number; end: number };
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
 * v0.3.46: Supports virtual scrolling to only render visible hour markers.
 */
export function TimelineColumn({
  startHour = 6,
  hourCount = 24,
  currentTime = new Date(),
  showNowLine = true,
  pixelsPerHour = PIXELS_PER_HOUR,
  visibleDayRange,
}: TimelineColumnProps) {
  const totalHeight = hourCount * pixelsPerHour;

  // v0.3.46: Only generate hours for visible day range (performance optimization)
  const visibleHours = useMemo(() => {
    if (visibleDayRange) {
      // Virtual scroll mode: only render hours for visible days
      const startHourIndex = visibleDayRange.start * 24;
      const endHourIndex = (visibleDayRange.end + 1) * 24;
      const hours: Array<{ hour: number; index: number }> = [];
      for (let i = startHourIndex; i < endHourIndex && i < hourCount; i++) {
        hours.push({
          hour: (startHour + i) % 24,
          index: i,
        });
      }
      return hours;
    } else {
      // Legacy mode: render all hours
      const hours: Array<{ hour: number; index: number }> = [];
      for (let i = 0; i < hourCount; i++) {
        hours.push({
          hour: (startHour + i) % 24,
          index: i,
        });
      }
      return hours;
    }
  }, [visibleDayRange, startHour, hourCount]);

  return (
    <div className="w-12 shrink-0 border-r border-white/5 sticky left-0 z-10 bg-zinc-950">
      <div
        className="relative bg-zinc-900/50"
        style={{ height: totalHeight }}
      >
        {visibleHours.map(({ hour, index }) => (
          <HourMarker
            key={`hour-${index}`}
            hour={hour}
            yPosition={index * pixelsPerHour}
            pixelsPerHour={pixelsPerHour}
          />
        ))}
        {showNowLine && (
          <NowLine currentTime={currentTime} startHour={startHour} pixelsPerHour={pixelsPerHour} />
        )}
      </div>
    </div>
  );
}
