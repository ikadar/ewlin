/**
 * Date Formatting Utilities
 *
 * v0.4.32c: Forme Status & Date Tracking
 */

/**
 * Format an ISO timestamp to DD/MM/YYYY format for display.
 *
 * @param isoTimestamp - ISO timestamp string (e.g., "2026-01-15T10:30:00.000Z")
 * @returns Formatted date string (e.g., "15/01/2026") or undefined if input is undefined
 */
export function formatDateDDMMYYYY(isoTimestamp: string | undefined): string | undefined {
  if (!isoTimestamp) return undefined;

  try {
    const date = new Date(isoTimestamp);
    if (isNaN(date.getTime())) return undefined;

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  } catch {
    return undefined;
  }
}
