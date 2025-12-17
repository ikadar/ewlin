import { PIXELS_PER_HOUR } from './HourMarker';

/**
 * Calculate Y position from time.
 */
export function timeToYPosition(time: Date, startHour: number): number {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  // Handle wrap-around for times before startHour (e.g., 0h-5h when startHour=6)
  const adjustedHours = hours < startHour ? hours + 24 : hours;
  return (adjustedHours - startHour) * PIXELS_PER_HOUR + (minutes / 60) * PIXELS_PER_HOUR;
}

/**
 * Format time as HH:MM.
 */
export function formatTime(time: Date): string {
  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
