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

/**
 * Format an ISO timestamp to DD/MM HH:mm format for schedule display.
 *
 * @param isoString - ISO timestamp string (e.g., "2026-01-15T10:30:00.000Z")
 * @returns Formatted string (e.g., "15/01 10:30") or undefined if input is undefined/invalid
 */
const FRENCH_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function formatAutoSaveName(date: Date = new Date()): string {
  const day = date.getDate();
  const dayStr = day === 1 ? '1er' : String(day);
  const month = FRENCH_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `Sauvegarde auto — ${dayStr} ${month} ${year}, ${h}h${m}m${s}s`;
}

export function formatScheduleDateTime(isoString: string | undefined): string | undefined {
  if (!isoString) return undefined;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return undefined;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
  } catch {
    return undefined;
  }
}
