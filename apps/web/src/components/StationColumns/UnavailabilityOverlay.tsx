import type { DaySchedule } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { timeToYPosition } from '../TimelineColumn/utils';
import type { Collapse } from '../SchedulingGrid/collapseConfig';

export interface UnavailabilityOverlayProps {
  /** Day schedule containing operating time slots */
  daySchedule: DaySchedule;
  /** Starting hour of the grid (e.g., 6 for 6:00 AM) */
  startHour: number;
  /** Number of hours to display (e.g., 24) */
  hoursToDisplay: number;
  /** Pixels per hour for grid scaling (default: 80) */
  pixelsPerHour?: number;
  /** Y offset in pixels for multi-day rendering (REQ-04). Ignored when collapses is set. */
  yOffset?: number;
  /** Optional collapse bands — each unavailability stripe is split where it intersects a band. */
  collapses?: readonly Collapse[];
  /** Absolute date this overlay's day-schedule corresponds to. Required when collapses is set. */
  dayDate?: Date;
  /** Grid origin date. Required when collapses is set — used as the baseDate for collapse-aware timeToY. */
  gridStartDate?: Date;
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
    if (lastPeriodEnd < MIDNIGHT) {
      periods.push({ startMinutes: lastPeriodEnd, endMinutes: MIDNIGHT });
    }
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

function minutesToYPosition(minutes: number, startHour: number, pixelsPerHour: number = PIXELS_PER_HOUR): number {
  const startMinutes = startHour * 60;
  const relativeMinutes = minutes - startMinutes;
  return (relativeMinutes / 60) * pixelsPerHour;
}

/**
 * UnavailabilityOverlay - Displays hatched pattern overlay for non-operating periods.
 * REQ-04: Supports yOffset for multi-day grid rendering.
 * Collapse-aware: when `collapses` + `dayDate` are provided, each stripe is split where
 * it intersects a band (band's pixel range stays empty so the CollapseBand sits there).
 */
export function UnavailabilityOverlay({
  daySchedule,
  startHour,
  hoursToDisplay,
  pixelsPerHour = PIXELS_PER_HOUR,
  yOffset = 0,
  collapses,
  dayDate,
  gridStartDate,
}: UnavailabilityOverlayProps) {
  const unavailablePeriods = calculateUnavailablePeriods(daySchedule, startHour, hoursToDisplay);
  const useCollapse = collapses && collapses.length > 0 && dayDate && gridStartDate;

  if (!useCollapse) {
    return (
      <>
        {unavailablePeriods.map((period) => {
          const top = minutesToYPosition(period.startMinutes, startHour, pixelsPerHour) + yOffset;
          const height = ((period.endMinutes - period.startMinutes) / 60) * pixelsPerHour;
          return (
            <div
              key={`${period.startMinutes}-${period.endMinutes}-${yOffset}`}
              className="absolute left-0 right-0 bg-stripes-dark pointer-events-none"
              style={{ top: `${top}px`, height: `${height}px` }}
              data-testid="unavailability-overlay"
            />
          );
        })}
      </>
    );
  }

  // Collapse-aware path: split each unavailable period at every band boundary,
  // then position each remaining slice via the collapse-aware timeToYPosition.
  const fragments: Array<{ from: Date; to: Date; key: string }> = [];
  const dayBaseMs = dayDate.getTime();
  for (const period of unavailablePeriods) {
    const startAbs = dayBaseMs + period.startMinutes * 60_000;
    const endAbs = dayBaseMs + period.endMinutes * 60_000;
    let slices: Array<{ from: number; to: number }> = [{ from: startAbs, to: endAbs }];
    for (const c of collapses) {
      const cFrom = c.from.getTime();
      const cTo = c.to.getTime();
      const next: typeof slices = [];
      for (const s of slices) {
        if (cTo <= s.from || cFrom >= s.to) {
          next.push(s);
          continue;
        }
        if (cFrom > s.from) next.push({ from: s.from, to: cFrom });
        if (cTo < s.to) next.push({ from: cTo, to: s.to });
      }
      slices = next;
    }
    slices.forEach((s, idx) => {
      fragments.push({
        from: new Date(s.from),
        to: new Date(s.to),
        key: `${period.startMinutes}-${period.endMinutes}-${idx}`,
      });
    });
  }

  // Compute Y from gridStartDate (the column's true origin). This gives the same
  // collapse-aware Y as every other consumer, so fragments line up with tiles + grid lines.
  return (
    <>
      {fragments.map((f) => {
        const top = timeToYPosition(f.from, startHour, pixelsPerHour, gridStartDate, collapses);
        const bottom = timeToYPosition(f.to, startHour, pixelsPerHour, gridStartDate, collapses);
        const height = bottom - top;
        if (height < 1) return null;
        return (
          <div
            key={f.key}
            className="absolute left-0 right-0 bg-stripes-dark pointer-events-none"
            style={{ top: `${top}px`, height: `${height}px` }}
            data-testid="unavailability-overlay"
          />
        );
      })}
    </>
  );
}
