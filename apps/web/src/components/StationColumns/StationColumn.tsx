import type { ReactNode } from 'react';
import type { Station, DaySchedule } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { UnavailabilityOverlay } from './UnavailabilityOverlay';

export interface StationColumnProps {
  /** Station to display */
  station: Station;
  /** Starting hour of the grid (e.g., 6 for 6:00 AM) */
  startHour?: number;
  /** Number of hours to display */
  hoursToDisplay?: number;
  /** Day of week to show schedule for (0 = Sunday, 1 = Monday, etc.) */
  dayOfWeek?: number;
  /** Children (tiles) to render inside the column */
  children?: ReactNode;
}

const DAY_NAMES: (keyof Station['operatingSchedule'])[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Get the day schedule for a specific day of week.
 */
function getDaySchedule(station: Station, dayOfWeek: number): DaySchedule {
  const dayName = DAY_NAMES[dayOfWeek];
  return station.operatingSchedule[dayName];
}

/**
 * StationColumn - Individual station column with grid lines and unavailability overlay.
 */
export function StationColumn({
  station,
  startHour = 6,
  hoursToDisplay = 24,
  dayOfWeek,
  children,
}: StationColumnProps) {
  // Use current day if not specified
  const effectiveDayOfWeek = dayOfWeek ?? new Date().getDay();
  const daySchedule = getDaySchedule(station, effectiveDayOfWeek);

  // Calculate total height
  const totalHeight = hoursToDisplay * PIXELS_PER_HOUR;

  // Generate hour grid lines
  const gridLines: number[] = [];
  for (let i = 0; i <= hoursToDisplay; i++) {
    gridLines.push(i * PIXELS_PER_HOUR);
  }

  return (
    <div
      className="w-60 shrink-0 bg-[#0a0a0a] relative"
      style={{ height: `${totalHeight}px` }}
      data-testid={`station-column-${station.id}`}
    >
      {/* Unavailability overlay */}
      <UnavailabilityOverlay
        daySchedule={daySchedule}
        startHour={startHour}
        hoursToDisplay={hoursToDisplay}
      />

      {/* Hour grid lines */}
      {gridLines.map((top) => (
        <div
          key={top}
          className="absolute left-0 right-0 h-px bg-zinc-700/50"
          style={{ top: `${top}px` }}
          data-testid="hour-grid-line"
        />
      ))}

      {/* Tiles (children) */}
      {children}
    </div>
  );
}
