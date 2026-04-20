import { PIXELS_PER_HOUR } from './HourMarker';
import type { Collapse } from '../SchedulingGrid/collapseConfig';

/**
 * Calculate Y position from time.
 * @param time - The time to convert
 * @param startHour - The starting hour of the timeline
 * @param pixelsPerHour - Pixels per hour (defaults to PIXELS_PER_HOUR constant)
 * @param startDate - Optional start date for multi-day grid (REQ-14)
 * @param collapses - Optional sorted list of collapse bands. When present, the
 *   mapping becomes piecewise-linear: each band earlier than `time` contributes
 *   exactly COLLAPSED_BAND_PX (instead of its real height in pixels). A `time`
 *   that lands inside a band is clamped to the band's start.
 */
export function timeToYPosition(
  time: Date,
  startHour: number,
  pixelsPerHour: number = PIXELS_PER_HOUR,
  startDate?: Date,
  collapses?: readonly Collapse[],
): number {
  const linearY = linearTimeToY(time, startHour, pixelsPerHour, startDate);
  if (!collapses || collapses.length === 0) return linearY;

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
