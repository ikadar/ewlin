import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { SNAP_INTERVAL_MINUTES } from '../../constants';
import type { Collapse } from '../SchedulingGrid/collapseConfig';

export { SNAP_INTERVAL_MINUTES };

/** Pixels per snap interval (calculated from SNAP_INTERVAL_MINUTES) */
export const PIXELS_PER_SNAP = PIXELS_PER_HOUR * (SNAP_INTERVAL_MINUTES / 60);

/**
 * Calculate pixels per snap based on current pixelsPerHour and SNAP_INTERVAL_MINUTES.
 */
export function getPixelsPerSnap(pixelsPerHour: number = PIXELS_PER_HOUR): number {
  return pixelsPerHour * (SNAP_INTERVAL_MINUTES / 60);
}

/**
 * Snap a Y position to the nearest 30-minute grid line.
 * @param y - Y position in pixels
 * @param pixelsPerHour - Pixels per hour (defaults to PIXELS_PER_HOUR constant)
 * @returns Snapped Y position
 */
export function snapToGrid(y: number, pixelsPerHour: number = PIXELS_PER_HOUR): number {
  const pixelsPerSnap = getPixelsPerSnap(pixelsPerHour);
  return Math.round(y / pixelsPerSnap) * pixelsPerSnap;
}

/**
 * Convert a Y position to a Date, given the start hour of the grid.
 * Supports multi-day grids (REQ-14) where Y position can span multiple days.
 *
 * `collapses` is REQUIRED (pass `[]` when the target context has none). This
 * used to be optional and silently forced callers back to a linear inverse
 * whenever forgotten — same bug family as `timeToYPosition`. Making it
 * required turns a miss into a TypeScript error.
 *
 * @param y - Y position in pixels (relative to grid top)
 * @param startHour - Starting hour of the grid (e.g., 6 for 6:00 AM)
 * @param baseDate - Optional base date (defaults to today). For multi-day grids, this is the grid start date.
 * @param pixelsPerHour - Pixels per hour (defaults to PIXELS_PER_HOUR constant)
 * @param collapses - Sorted list of collapse bands (use `[]` for none).
 *   Inverse of `timeToYPosition`'s piecewise mapping. A `y` that lands
 *   inside a band's rendered range returns the band's `from` time
 *   (matching the timeToY clamp behavior).
 */
export function yPositionToTime(
  y: number,
  startHour: number,
  baseDate: Date | undefined,
  pixelsPerHour: number,
  collapses: readonly Collapse[],
): Date {
  if (collapses.length === 0) {
    // Original linear path — kept verbatim so drag callers don't shift behavior.
    return linearYToTimeStartHour(y, startHour, pixelsPerHour, baseDate);
  }

  // Collapse-aware path. Mirrors timeToYPosition's multi-day convention:
  // y = 0 corresponds to baseDate's exact moment (midnight in production usage).
  // Each band consumes (COLLAPSED_BAND_PX - realPx) of rendered Y vs the linear mapping.
  const baseRef = baseDate ?? new Date();
  let cumulativeOffset = 0;
  for (const c of collapses) {
    const bandStartLinearY = linearTimeToYMultiDay(c.from, baseRef, pixelsPerHour);
    const bandStartRenderedY = bandStartLinearY + cumulativeOffset;
    const bandEndRenderedY = bandStartRenderedY + c.heightPx;

    if (y < bandStartRenderedY) {
      return linearYToTimeMultiDay(y - cumulativeOffset, baseRef, pixelsPerHour);
    }
    if (y < bandEndRenderedY) {
      return new Date(c.from);
    }
    const realPx = ((c.to.getTime() - c.from.getTime()) / 3_600_000) * pixelsPerHour;
    cumulativeOffset += c.heightPx - realPx;
  }
  return linearYToTimeMultiDay(y - cumulativeOffset, baseRef, pixelsPerHour);
}

/** Drag-compatible linear inverse: y=0 is baseDate's day at startHour. */
function linearYToTimeStartHour(y: number, startHour: number, pixelsPerHour: number, baseDate?: Date): Date {
  const date = baseDate ? new Date(baseDate) : new Date();
  const totalHours = y / pixelsPerHour;
  const hoursPerDay = 24;
  const dayOffset = Math.floor(totalHours / hoursPerDay);
  const hoursInDay = totalHours - (dayOffset * hoursPerDay);
  const hours = Math.floor(hoursInDay);
  const minutes = Math.round((hoursInDay - hours) * 60);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(startHour + hours, minutes, 0, 0);
  return date;
}

/** Multi-day inverse matching timeToYPosition: y=0 is baseDate's exact moment. */
function linearYToTimeMultiDay(y: number, baseDate: Date, pixelsPerHour: number): Date {
  const totalMs = (y / pixelsPerHour) * 3_600_000;
  return new Date(baseDate.getTime() + totalMs);
}

/** Multi-day forward matching timeToYPosition: hours since baseDate. */
function linearTimeToYMultiDay(time: Date, baseDate: Date, pixelsPerHour: number): number {
  const startDayUtc = Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const timeDayUtc = Date.UTC(time.getFullYear(), time.getMonth(), time.getDate());
  const daysDiff = Math.round((timeDayUtc - startDayUtc) / (24 * 60 * 60 * 1000));
  const totalHours = daysDiff * 24 + time.getHours() + time.getMinutes() / 60;
  return totalHours * pixelsPerHour;
}

/**
 * Format a time as HH:MM string.
 * @param date - Date to format
 * @returns Formatted time string
 */
export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
