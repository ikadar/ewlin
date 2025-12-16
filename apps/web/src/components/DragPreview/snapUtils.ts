import { PIXELS_PER_HOUR } from '../TimelineColumn';

/** Snap interval in minutes */
export const SNAP_INTERVAL_MINUTES = 30;

/** Pixels per snap interval (30 min = half hour = 40px at 80px/hour) */
export const PIXELS_PER_SNAP = PIXELS_PER_HOUR / 2;

/**
 * Snap a Y position to the nearest 30-minute grid line.
 * @param y - Y position in pixels
 * @returns Snapped Y position
 */
export function snapToGrid(y: number): number {
  return Math.round(y / PIXELS_PER_SNAP) * PIXELS_PER_SNAP;
}

/**
 * Convert a Y position to a Date, given the start hour of the grid.
 * Assumes the grid represents "today" and the Y position is relative to startHour.
 * @param y - Y position in pixels (relative to grid top)
 * @param startHour - Starting hour of the grid (e.g., 6 for 6:00 AM)
 * @param baseDate - Optional base date (defaults to today)
 * @returns Date representing the time at that Y position
 */
export function yPositionToTime(y: number, startHour: number, baseDate?: Date): Date {
  const date = baseDate ? new Date(baseDate) : new Date();

  // Calculate hours and minutes from Y position
  const totalMinutes = (y / PIXELS_PER_HOUR) * 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);

  // Set the time
  date.setHours(startHour + hours, minutes, 0, 0);

  return date;
}

/**
 * Convert a Date to Y position, given the start hour of the grid.
 * @param time - Date to convert
 * @param startHour - Starting hour of the grid
 * @returns Y position in pixels
 */
export function timeToYPosition(time: Date, startHour: number): number {
  const hours = time.getHours() - startHour;
  const minutes = time.getMinutes();
  const totalHours = hours + minutes / 60;
  return totalHours * PIXELS_PER_HOUR;
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
