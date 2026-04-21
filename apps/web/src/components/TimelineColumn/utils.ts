import { PIXELS_PER_HOUR } from './HourMarker';
import type { Collapse } from '../SchedulingGrid/collapseConfig';

/**
 * Calculate Y position from time.
 *
 * `collapses` is REQUIRED (not optional) so callers must consciously decide
 * whether the grid they address has collapse bands. Pass `[]` when the target
 * context has none (focus view, minimap, linear tests).
 *
 * Background: this argument used to be optional, which silently downgraded
 * callers to a pure-linear projection whenever forgotten. That caused two
 * bugs in the same week (phantom recalage bleeding into the neighbour tile,
 * scroll-to-date landing in the wrong place). Making it required turns every
 * missed call into a TypeScript error.
 *
 * `startDate` stays optional to preserve the legacy single-day origin (y=0
 * at `startHour`) used by a handful of single-day callers. When absent the
 * function returns the same value it did before this change.
 *
 * @param time - The time to convert
 * @param startHour - The starting hour of the timeline
 * @param pixelsPerHour - Pixels per hour (defaults to PIXELS_PER_HOUR constant)
 * @param startDate - Optional start date for multi-day grid (REQ-14). When
 *   present, y=0 is midnight of `startDate`. When absent, y=0 is `startHour`
 *   of the current day.
 * @param collapses - Sorted list of collapse bands (use `[]` for none).
 *   When non-empty, the mapping becomes piecewise-linear: each band earlier
 *   than `time` contributes exactly its `heightPx` instead of its real
 *   wall-clock height. A `time` that lands inside a band is clamped to the
 *   band's start.
 */
export function timeToYPosition(
  time: Date,
  startHour: number,
  pixelsPerHour: number = PIXELS_PER_HOUR,
  startDate: Date | undefined,
  collapses: readonly Collapse[],
): number {
  const linearY = linearTimeToY(time, startHour, pixelsPerHour, startDate);
  if (collapses.length === 0) return linearY;

  let offset = 0;
  const timeMs = time.getTime();
  for (const c of collapses) {
    const fromMs = c.from.getTime();
    const toMs = c.to.getTime();
    if (timeMs <= fromMs) break;

    if (timeMs >= toMs) {
      // Whole band is before `time` — replace its real height with the band's fixed kind-height.
      const realPx = ((toMs - fromMs) / 3_600_000) * pixelsPerHour;
      offset += c.heightPx - realPx;
    } else {
      // `time` is inside this band — clamp to band start (callers shouldn't ask for this,
      // but lens / scroll-anchor math may hit it). Use linearY of band.from + accumulated offset.
      const bandStartLinearY = linearTimeToY(c.from, startHour, pixelsPerHour, startDate);
      return bandStartLinearY + offset;
    }
  }
  return linearY + offset;
}

function linearTimeToY(
  time: Date,
  startHour: number,
  pixelsPerHour: number,
  startDate?: Date,
): number {
  const hours = time.getHours();
  const minutes = time.getMinutes();

  // Multi-day calculation when startDate is provided
  if (startDate) {
    // Use UTC to avoid DST off-by-one: local midnight gaps differ across DST transitions
    const startDayUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const timeDayUtc = Date.UTC(time.getFullYear(), time.getMonth(), time.getDate());
    const daysDiff = Math.round((timeDayUtc - startDayUtc) / (24 * 60 * 60 * 1000));

    const totalHours = daysDiff * 24 + hours + minutes / 60;
    return totalHours * pixelsPerHour;
  }

  // Single-day calculation (backwards compatible)
  // Handle wrap-around for times before startHour (e.g., 0h-5h when startHour=6)
  const adjustedHours = hours < startHour ? hours + 24 : hours;
  return (adjustedHours - startHour) * pixelsPerHour + (minutes / 60) * pixelsPerHour;
}

/**
 * Format time as HH:MM.
 */
export function formatTime(time: Date): string {
  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
