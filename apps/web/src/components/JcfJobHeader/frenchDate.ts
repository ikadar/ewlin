/**
 * French date parsing and formatting utilities for the JCF Job Header.
 *
 * The JCF uses French date formats (jj/mm or jj/mm/aaaa) for user input,
 * while storing dates internally as ISO 8601 (YYYY-MM-DD).
 */

/**
 * Parse a French date string to ISO 8601 format.
 *
 * Accepts:
 * - "jj/mm" → uses current year
 * - "jj/mm/aaaa" → uses specified year
 *
 * Returns empty string if input is empty or invalid.
 */
export function parseFrenchDate(input: string): string {
  if (!input.trim()) return '';

  const parseComponents = (dayStr: string, monthStr: string, year: number): string => {
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);

    if (month < 1 || month > 12) return '';
    if (day < 1 || day > 31) return '';

    // Use UTC to avoid timezone-related date shifts
    const date = new Date(Date.UTC(year, month - 1, day));

    // Verify the date components match (catches invalid dates like 31/02)
    if (isNaN(date.getTime())) return '';
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';

    const yy = date.getUTCFullYear().toString();
    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = date.getUTCDate().toString().padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  // Try jj/mm/aaaa format first
  const fullMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fullMatch) {
    const [, day, month, year] = fullMatch;
    return parseComponents(day, month, parseInt(year, 10));
  }

  // Try jj/mm format (current year)
  const shortMatch = input.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortMatch) {
    const [, day, month] = shortMatch;
    return parseComponents(day, month, new Date().getFullYear());
  }

  return '';
}

/**
 * Format an ISO 8601 date string to French display format (jj/mm/aaaa).
 *
 * Returns empty string for empty input, or input unchanged for invalid dates.
 */
export function formatToFrench(isoDate: string): string {
  if (!isoDate) return '';

  // Parse ISO string directly to avoid timezone shifts
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
