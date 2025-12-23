import { PIXELS_PER_HOUR } from '../TimelineColumn';

/** Snap interval in minutes */
export const SNAP_INTERVAL_MINUTES = 30;

/** Pixels per snap interval (30 min = half hour = 40px at 80px/hour) */
export const PIXELS_PER_SNAP = PIXELS_PER_HOUR / 2;

/**
 * Calculate pixels per snap based on current pixelsPerHour.
 */
export function getPixelsPerSnap(pixelsPerHour: number = PIXELS_PER_HOUR): number {
  return pixelsPerHour / 2;
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
 * @param y - Y position in pixels (relative to grid top)
 * @param startHour - Starting hour of the grid (e.g., 6 for 6:00 AM)
 * @param baseDate - Optional base date (defaults to today). For multi-day grids, this is the grid start date.
 * @param pixelsPerHour - Pixels per hour (defaults to PIXELS_PER_HOUR constant)
 * @returns Date representing the time at that Y position
 */
export function yPositionToTime(y: number, startHour: number, baseDate?: Date, pixelsPerHour: number = PIXELS_PER_HOUR): Date {
  const date = baseDate ? new Date(baseDate) : new Date();

  // Calculate total hours from Y position
  const totalHours = y / pixelsPerHour;

  // For multi-day support: calculate days and remaining hours
  const hoursPerDay = 24;
  const dayOffset = Math.floor(totalHours / hoursPerDay);
  const hoursInDay = totalHours - (dayOffset * hoursPerDay);
  const hours = Math.floor(hoursInDay);
  const minutes = Math.round((hoursInDay - hours) * 60);

  // Add day offset to base date
  date.setDate(date.getDate() + dayOffset);

  // Set the time (startHour + hours within the day)
  date.setHours(startHour + hours, minutes, 0, 0);

  return date;
}

/**
 * Convert a Date to Y position, given the start hour of the grid.
 * @param time - Date to convert
 * @param startHour - Starting hour of the grid
 * @param pixelsPerHour - Pixels per hour (defaults to PIXELS_PER_HOUR constant)
 * @returns Y position in pixels
 */
export function timeToYPosition(time: Date, startHour: number, pixelsPerHour: number = PIXELS_PER_HOUR): number {
  const hours = time.getHours() - startHour;
  const minutes = time.getMinutes();
  const totalHours = hours + minutes / 60;
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
