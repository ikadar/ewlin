import { PIXELS_PER_HOUR } from './HourMarker';

/**
 * Calculate Y position from time.
 * @param time - The time to convert
 * @param startHour - The starting hour of the timeline
 * @param pixelsPerHour - Pixels per hour (defaults to PIXELS_PER_HOUR constant)
 * @param startDate - Optional start date for multi-day grid (REQ-14)
 */
export function timeToYPosition(
  time: Date,
  startHour: number,
  pixelsPerHour: number = PIXELS_PER_HOUR,
  startDate?: Date
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
