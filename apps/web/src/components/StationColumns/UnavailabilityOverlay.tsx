import type { DaySchedule } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';

export interface UnavailabilityOverlayProps {
  /** Day schedule containing operating time slots */
  daySchedule: DaySchedule;
  /** Starting hour of the grid (e.g., 6 for 6:00 AM) */
  startHour: number;
  /** Number of hours to display (e.g., 24) */
  hoursToDisplay: number;
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

/**
 * Calculate unavailable periods from operating time slots.
 * Returns periods in minutes since midnight.
 */
function calculateUnavailablePeriods(
  daySchedule: DaySchedule,
  startHour: number,
  hoursToDisplay: number
): UnavailablePeriod[] {
  const displayStartMinutes = startHour * 60;
  const displayEndMinutes = displayStartMinutes + hoursToDisplay * 60;

  // If station is not operating at all, entire display period is unavailable
  if (!daySchedule.isOperating || daySchedule.slots.length === 0) {
    return [{ startMinutes: displayStartMinutes, endMinutes: displayEndMinutes }];
  }

  // Convert slots to minutes and sort by start time
  const operatingPeriods = daySchedule.slots
    .map((slot) => ({
      startMinutes: parseTimeToMinutes(slot.start),
      endMinutes: slot.end === '24:00' ? 24 * 60 : parseTimeToMinutes(slot.end),
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  // Calculate unavailable periods (gaps between operating periods)
  const unavailablePeriods: UnavailablePeriod[] = [];

  // Start of display window to first operating period
  if (operatingPeriods[0].startMinutes > displayStartMinutes) {
    unavailablePeriods.push({
      startMinutes: displayStartMinutes,
      endMinutes: Math.min(operatingPeriods[0].startMinutes, displayEndMinutes),
    });
  }

  // Gaps between operating periods
  for (let i = 0; i < operatingPeriods.length - 1; i++) {
    const currentEnd = operatingPeriods[i].endMinutes;
    const nextStart = operatingPeriods[i + 1].startMinutes;

    if (nextStart > currentEnd) {
      // There's a gap
      const gapStart = Math.max(currentEnd, displayStartMinutes);
      const gapEnd = Math.min(nextStart, displayEndMinutes);

      if (gapEnd > gapStart && gapStart < displayEndMinutes && gapEnd > displayStartMinutes) {
        unavailablePeriods.push({
          startMinutes: gapStart,
          endMinutes: gapEnd,
        });
      }
    }
  }

  // Last operating period to end of display window
  const lastPeriod = operatingPeriods[operatingPeriods.length - 1];
  if (lastPeriod.endMinutes < displayEndMinutes) {
    // For wrap-around days (e.g., display from 6:00 to 6:00 next day)
    // The unavailability from last slot to midnight, then midnight to first slot next morning
    if (displayEndMinutes > 24 * 60) {
      // We're wrapping around midnight
      // Unavailable from last slot end to midnight
      if (lastPeriod.endMinutes < 24 * 60) {
        unavailablePeriods.push({
          startMinutes: lastPeriod.endMinutes,
          endMinutes: 24 * 60,
        });
      }
      // Unavailable from midnight (as 24*60) to either first slot or start hour
      const wrappedStart = 24 * 60;
      const wrappedFirstSlot = operatingPeriods[0].startMinutes + 24 * 60;
      if (wrappedFirstSlot > wrappedStart) {
        unavailablePeriods.push({
          startMinutes: wrappedStart,
          endMinutes: Math.min(wrappedFirstSlot, displayEndMinutes),
        });
      }
    } else {
      unavailablePeriods.push({
        startMinutes: Math.max(lastPeriod.endMinutes, displayStartMinutes),
        endMinutes: displayEndMinutes,
      });
    }
  }

  return unavailablePeriods;
}

/**
 * Convert minutes to Y position in pixels, relative to grid start.
 */
function minutesToYPosition(minutes: number, startHour: number): number {
  const startMinutes = startHour * 60;
  const relativeMinutes = minutes - startMinutes;
  return (relativeMinutes / 60) * PIXELS_PER_HOUR;
}

/**
 * UnavailabilityOverlay - Displays hatched pattern overlay for non-operating periods.
 */
export function UnavailabilityOverlay({
  daySchedule,
  startHour,
  hoursToDisplay,
}: UnavailabilityOverlayProps) {
  const unavailablePeriods = calculateUnavailablePeriods(daySchedule, startHour, hoursToDisplay);

  return (
    <>
      {unavailablePeriods.map((period, index) => {
        const top = minutesToYPosition(period.startMinutes, startHour);
        const height = ((period.endMinutes - period.startMinutes) / 60) * PIXELS_PER_HOUR;

        return (
          <div
            key={index}
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
