/**
 * Collapse-empty-periods feature config + types.
 * Spec validated 2026-04-20 in playground-collapse-empty-periods.html.
 */

export type CollapseKind = 'night' | 'weekend' | 'closure' | 'pause';

/** Minimum span (hours) of empty time before it becomes a collapse band. */
export const MIN_COLLAPSE_HOURS = 7;

/**
 * Pixel height of a rendered collapse band per category.
 * Weekend is 2× taller than a night — visual weight matches the "big interruption"
 * feel the user gave us on 2026-04-20 (weekend-as-rhythm-marker).
 */
export const COLLAPSED_BAND_PX_BY_KIND: Record<CollapseKind, number> = {
  night: 60,
  weekend: 120,
  closure: 60,
  pause: 60,
};

/** Default band height — kept for anything that isn't kind-aware yet. */
export const COLLAPSED_BAND_PX = COLLAPSED_BAND_PX_BY_KIND.night;

/** Snap collapse boundaries to this grid (in minutes) — avoids "17:02 → 08:01" bands. */
export const SNAP_MINUTES = 15;

export interface Collapse {
  /** Stable id: `${fromISO}-${toISO}`. Used for expansion-state tracking. */
  id: string;
  from: Date;
  to: Date;
  /** Duration in hours (cached so callers don't redo the math). */
  durationHours: number;
  kind: CollapseKind;
  /** Pixel height of this band when rendered — pre-computed from kind. */
  heightPx: number;
}

/**
 * Classify a candidate collapse range by *what's inside it*, not its length.
 * Priority: weekend > closure > night > pause.
 *
 * - weekend : overlaps a Saturday or Sunday
 * - night   : crosses exactly one midnight (Mon→Tue overnight rhythm)
 * - pause   : entirely inside one calendar day
 * - closure : multi-day, no weekend (holiday / vacation)
 */
export function classifyCollapse(from: Date, to: Date): CollapseKind {
  for (let d = new Date(from); d.getTime() < to.getTime(); d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return 'weekend';
  }

  const fromDay = startOfDay(from).getTime();
  const toDay = startOfDay(new Date(to.getTime() - 1)).getTime();
  const dayDiff = Math.round((toDay - fromDay) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return 'pause';
  if (dayDiff === 1) return 'night';
  return 'closure';
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
