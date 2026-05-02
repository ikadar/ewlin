/**
 * Time helpers for the progress-capture modal — minutes-from-midnight ↔ "HhMM" / "HH:MM".
 * Co-located here because the operator UI uses a French-style format that
 * doesn't appear elsewhere in the app (and would clutter the shared utils).
 */

/** Format minutes-from-midnight as "HhMM" (e.g., 720 → "12h00"). */
export function fmtTimeMin(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h}h${String(rest).padStart(2, '0')}`;
}

/**
 * Parse a flexible time string ("HhMM", "HH:MM", "Hh", "H:M") to
 * minutes-from-midnight. Returns null if the string can't be parsed
 * or if the resulting time is out of range [00:00, 23:59].
 */
export function parseTimeStr(s: string): number | null {
  const m = String(s).match(/^\s*(\d{1,2})\s*[h:]\s*(\d{0,2})\s*$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2] || '0', 10);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/** Snap a minute count to the nearest 15-minute granularity. */
export function snapTo15(min: number): number {
  return Math.round(min / 15) * 15;
}

/** Clamp a minute count between [lower, upper], inclusive. */
export function clampMin(min: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, min));
}
