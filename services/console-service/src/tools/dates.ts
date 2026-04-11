/**
 * Date / time helpers shared by tool handlers.
 *
 * The LLM is allowed to send dates as either ISO (YYYY-MM-DD), ISO
 * datetime (YYYY-MM-DDTHH:MM[:SS]), or French shorthand ("le 13 avril",
 * "fin de journée"). For simplicity we expect the LLM to ALWAYS pass
 * ISO to the tools — the system prompt instructs Gemma to do the
 * French→ISO conversion before calling tools, using `today` as anchor.
 *
 * These helpers validate ISO strings and compute simple shifts.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export function isIsoDate(s: string): boolean {
  return ISO_DATE.test(s);
}

export function isIsoDateTime(s: string): boolean {
  return ISO_DATETIME.test(s);
}

/** Combine YYYY-MM-DD + HH:MM into an ISO datetime (no timezone suffix). */
export function combineDateAndTime(date: string, time: string): string {
  if (!ISO_DATE.test(date)) {
    throw new Error(`Invalid ISO date: ${date}`);
  }
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    throw new Error(`Invalid HH:MM time: ${time}`);
  }
  const tt = time.length === 5 ? `${time}:00` : time;
  return `${date}T${tt}`;
}

/** Add `days` to YYYY-MM-DD, returning YYYY-MM-DD. Negative values shift backward. */
export function shiftDateByDays(date: string, days: number): string {
  if (!ISO_DATE.test(date)) {
    throw new Error(`Invalid ISO date: ${date}`);
  }
  const [yStr, mStr, dStr] = date.split('-');
  const y = parseInt(yStr!, 10);
  const m = parseInt(mStr!, 10);
  const d = parseInt(dStr!, 10);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yyyy = dt.getUTCFullYear().toString().padStart(4, '0');
  const mm = (dt.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = dt.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function todayIsoUtc(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
