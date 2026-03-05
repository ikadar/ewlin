/**
 * Date helpers for E2E tests.
 * All dates are generated in CET (Europe/Paris) timezone.
 *
 * The base date can be overridden via E2E_BASE_DATE env var (ISO date string).
 * Default: today's date.
 */

function getBaseDate(): Date {
  const envDate = process.env.E2E_BASE_DATE;
  if (envDate) {
    return new Date(envDate);
  }
  return new Date();
}

function formatCET(date: Date, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const d = new Date(date);
  // Build an ISO string in CET (+01:00)
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  return `${year}-${month}-${day}T${h}:${m}:00+01:00`;
}

/** today('12:00') → '2026-02-17T12:00:00+01:00' */
export function today(time: string): string {
  return formatCET(getBaseDate(), time);
}

/** tomorrow('07:00') → '2026-02-18T07:00:00+01:00' */
export function tomorrow(time: string): string {
  return dayOffset(1, time);
}

/** dayOffset(2, '07:00') → '2026-02-19T07:00:00+01:00' */
export function dayOffset(days: number, time: string): string {
  const base = getBaseDate();
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return formatCET(d, time);
}
