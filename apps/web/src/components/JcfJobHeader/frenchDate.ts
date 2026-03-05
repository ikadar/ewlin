/**
 * French date parsing and formatting utilities for the JCF Job Header.
 *
 * The JCF uses French date formats (jj/mm HH:mm or jj/mm) for user input,
 * while storing dates internally as ISO 8601 (YYYY-MM-DDTHH:mm).
 */

import { SHIPPING_DEPARTURE_HOUR } from '@flux/types';

/**
 * Parse a French date string to ISO 8601 datetime format.
 *
 * Accepts:
 * - "jj/mm HH:mm" → uses current year, specified time
 * - "jj/mm" → uses current year, default 14:00
 * - "jj/mm/aaaa HH:mm" → uses specified year and time
 * - "jj/mm/aaaa" → uses specified year, default 14:00
 *
 * Returns empty string if input is empty or invalid.
 * Output: "YYYY-MM-DDTHH:mm"
 */
export function parseFrenchDate(input: string): string {
  if (!input.trim()) return '';

  const defaultTime = `${String(SHIPPING_DEPARTURE_HOUR).padStart(2, '0')}:00`;

  const parseComponents = (dayStr: string, monthStr: string, year: number, time: string): string => {
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);

    if (month < 1 || month > 12) return '';
    if (day < 1 || day > 31) return '';

    // Validate time
    const timeParts = time.split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';

    // Use UTC to avoid timezone-related date shifts
    const date = new Date(Date.UTC(year, month - 1, day));

    // Verify the date components match (catches invalid dates like 31/02)
    if (isNaN(date.getTime())) return '';
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';

    const yy = date.getUTCFullYear().toString();
    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = date.getUTCDate().toString().padStart(2, '0');
    const hh = String(hours).padStart(2, '0');
    const min = String(minutes).padStart(2, '0');
    return `${yy}-${mm}-${dd}T${hh}:${min}`;
  };

  // Try jj/mm/aaaa HH:mm format first
  const fullWithTime = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2})$/);
  if (fullWithTime) {
    const [, day, month, year, time] = fullWithTime;
    return parseComponents(day, month, parseInt(year, 10), time);
  }

  // Try jj/mm/aaaa format (default time)
  const fullMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fullMatch) {
    const [, day, month, year] = fullMatch;
    return parseComponents(day, month, parseInt(year, 10), defaultTime);
  }

  // Try jj/mm HH:mm format (current year)
  const shortWithTime = input.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})$/);
  if (shortWithTime) {
    const [, day, month, time] = shortWithTime;
    return parseComponents(day, month, new Date().getFullYear(), time);
  }

  // Try jj/mm format (current year, default time)
  const shortMatch = input.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortMatch) {
    const [, day, month] = shortMatch;
    return parseComponents(day, month, new Date().getFullYear(), defaultTime);
  }

  return '';
}

/**
 * Format an ISO 8601 datetime string to French display format.
 *
 * "YYYY-MM-DDTHH:mm" → "jj/mm HH:mm"
 * "YYYY-MM-DD" → "jj/mm 14:00" (backward compat)
 *
 * Returns empty string for empty input, or input unchanged for invalid dates.
 */
export function formatToFrench(isoDate: string): string {
  if (!isoDate) return '';

  // Try datetime format: YYYY-MM-DDTHH:mm
  const datetimeMatch = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (datetimeMatch) {
    const [, , month, day, hours, minutes] = datetimeMatch;
    return `${day}/${month} ${hours}:${minutes}`;
  }

  // Try date-only format: YYYY-MM-DD (backward compat)
  const dateMatch = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const [, , month, day] = dateMatch;
    return `${day}/${month} ${String(SHIPPING_DEPARTURE_HOUR).padStart(2, '0')}:00`;
  }

  return isoDate;
}
