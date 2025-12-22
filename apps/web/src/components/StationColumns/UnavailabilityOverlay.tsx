import type { DaySchedule } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';

export interface UnavailabilityOverlayProps {
  /** Day schedule containing operating time slots */
  daySchedule: DaySchedule;
  /** Starting hour of the grid (e.g., 6 for 6:00 AM) */
  startHour: number;
  /** Number of hours to display (e.g., 24) */
  hoursToDisplay: number;
  /** Pixels per hour for grid scaling (default: 80) */
  pixelsPerHour?: number;
}

interface UnavailablePeriod {
  startMinutes: number;
  endMinutes: number;
}

/**
 * Parse time string "HH:MM" to minutes since midnight.
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

interface OperatingPeriod {
  startMinutes: number;
  endMinutes: number;
}

/**
 * Add gap before the first operating period (if any).
 */
function addGapBeforeFirstPeriod(
  periods: UnavailablePeriod[],
  firstPeriodStart: number,
  displayStart: number,
  displayEnd: number
): void {
  if (firstPeriodStart > displayStart) {
    periods.push({
      startMinutes: displayStart,
      endMinutes: Math.min(firstPeriodStart, displayEnd),
    });
  }
}

/**
 * Add gaps between consecutive operating periods.
 */
function addGapsBetweenPeriods(
  periods: UnavailablePeriod[],
  operatingPeriods: OperatingPeriod[],
  displayStart: number,
  displayEnd: number
): void {
  for (let i = 0; i < operatingPeriods.length - 1; i++) {
    const currentEnd = operatingPeriods[i].endMinutes;
    const nextStart = operatingPeriods[i + 1].startMinutes;

    if (nextStart > currentEnd) {
      const gapStart = Math.max(currentEnd, displayStart);
      const gapEnd = Math.min(nextStart, displayEnd);

      if (gapEnd > gapStart && gapStart < displayEnd && gapEnd > displayStart) {
        periods.push({ startMinutes: gapStart, endMinutes: gapEnd });
      }
    }
  }
}

/**
 * Add gap after the last operating period, handling wrap-around days.
 */
function addGapAfterLastPeriod(
  periods: UnavailablePeriod[],
  lastPeriodEnd: number,
  firstPeriodStart: number,
  displayStart: number,
  displayEnd: number
): void {
  if (lastPeriodEnd >= displayEnd) return;

  const MIDNIGHT = 24 * 60;
  const isWrapAround = displayEnd > MIDNIGHT;

  if (isWrapAround) {
    // Gap from last slot to midnight
    if (lastPeriodEnd < MIDNIGHT) {
      periods.push({ startMinutes: lastPeriodEnd, endMinutes: MIDNIGHT });
    }
    // Gap from midnight to first slot next day
    const wrappedFirstSlot = firstPeriodStart + MIDNIGHT;
    if (wrappedFirstSlot > MIDNIGHT) {
      periods.push({
        startMinutes: MIDNIGHT,
        endMinutes: Math.min(wrappedFirstSlot, displayEnd),
      });
    }
  } else {
    periods.push({
      startMinutes: Math.max(lastPeriodEnd, displayStart),
      endMinutes: displayEnd,
    });
  }
}

/**
 * Calculate unavailable periods from operating time slots.
 * Returns periods in minutes since midnight.
 */
function calculateUnavailablePeriods(
  daySchedule: DaySchedule,
  startHour: number,
  hoursToDisplay: number
): UnavailablePeriod[] {
  const displayStart = startHour * 60;
  const displayEnd = displayStart + hoursToDisplay * 60;

  if (!daySchedule.isOperating || daySchedule.slots.length === 0) {
    return [{ startMinutes: displayStart, endMinutes: displayEnd }];
  }

  const operatingPeriods: OperatingPeriod[] = daySchedule.slots
    .map((slot) => ({
      startMinutes: parseTimeToMinutes(slot.start),
      endMinutes: slot.end === '24:00' ? 24 * 60 : parseTimeToMinutes(slot.end),
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const unavailablePeriods: UnavailablePeriod[] = [];

  addGapBeforeFirstPeriod(unavailablePeriods, operatingPeriods[0].startMinutes, displayStart, displayEnd);
  addGapsBetweenPeriods(unavailablePeriods, operatingPeriods, displayStart, displayEnd);
  addGapAfterLastPeriod(
    unavailablePeriods,
    operatingPeriods[operatingPeriods.length - 1].endMinutes,
    operatingPeriods[0].startMinutes,
    displayStart,
    displayEnd
  );

  return unavailablePeriods;
}

/**
 * Convert minutes to Y position in pixels, relative to grid start.
 */
function minutesToYPosition(minutes: number, startHour: number, pixelsPerHour: number = PIXELS_PER_HOUR): number {
  const startMinutes = startHour * 60;
  const relativeMinutes = minutes - startMinutes;
  return (relativeMinutes / 60) * pixelsPerHour;
}

/**
 * UnavailabilityOverlay - Displays hatched pattern overlay for non-operating periods.
 */
export function UnavailabilityOverlay({
  daySchedule,
  startHour,
  hoursToDisplay,
  pixelsPerHour = PIXELS_PER_HOUR,
}: UnavailabilityOverlayProps) {
  const unavailablePeriods = calculateUnavailablePeriods(daySchedule, startHour, hoursToDisplay);

  return (
    <>
      {unavailablePeriods.map((period) => {
        const top = minutesToYPosition(period.startMinutes, startHour, pixelsPerHour);
        const height = ((period.endMinutes - period.startMinutes) / 60) * pixelsPerHour;

        return (
          <div
            key={`${period.startMinutes}-${period.endMinutes}`}
            className="absolute left-0 right-0 bg-stripes-dark pointer-events-none"
            style={{
              top: `${top}px`,
              height: `${height}px`,
            }}
            data-testid="unavailability-overlay"
          />
        );
      })}
    </>
  );
}
