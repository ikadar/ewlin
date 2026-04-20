import type { Operator } from '@flux/types';
import { findOperatorGaps } from './operatorTileSlices';
import {
  COLLAPSED_BAND_PX_BY_KIND,
  MIN_COLLAPSE_HOURS,
  SNAP_MINUTES,
  classifyCollapse,
  type Collapse,
} from '../components/SchedulingGrid/collapseConfig';

interface Range {
  from: Date;
  to: Date;
}

/**
 * Build the list of collapse bands for the timeline.
 *
 * Algorithm:
 *  1. For each operator, compute their unavailability gaps via findOperatorGaps.
 *  2. Intersect all per-operator gap lists — only fold when *every* operator is off.
 *  3. Snap boundaries inward to a 15-min grid (avoids "17:02 → 08:01" labels).
 *  4. Drop runs shorter than MIN_COLLAPSE_HOURS.
 *  5. Classify each surviving range (weekend > closure > night > pause).
 */
export function computeCollapses(
  operators: readonly Operator[],
  gridStart: Date,
  gridEnd: Date,
): Collapse[] {
  // Skip operators without a real schedule — `getOperatorDaySchedule` falls back
  // to "available 24/7" for null `operatingSchedules`, which would wipe the
  // intersection (one null-schedule operator → no bands ever). Those operators
  // are typically placeholders / contractors with no defined hours; they don't
  // express a constraint, so they shouldn't dominate the collapse logic.
  const scheduledOps = operators.filter(
    op => op.operatingSchedules != null && op.operatingSchedules.length > 0,
  );
  if (scheduledOps.length === 0) return [];

  let candidates: Range[] = findOperatorGaps(scheduledOps[0], gridStart, gridEnd)
    .map(g => ({ from: g.gapStart, to: g.gapEnd }));

  for (let i = 1; i < scheduledOps.length; i++) {
    if (candidates.length === 0) break;
    const opGaps: Range[] = findOperatorGaps(scheduledOps[i], gridStart, gridEnd)
      .map(g => ({ from: g.gapStart, to: g.gapEnd }));
    candidates = intersectRanges(candidates, opGaps);
  }

  const snapMs = SNAP_MINUTES * 60_000;
  const minMs = MIN_COLLAPSE_HOURS * 60 * 60_000;

  // Merge adjacent ranges before filtering — `findOperatorGaps` splits at
  // midnight per day, so a Mon 17:00 → Tue 08:00 night arrives as two halves
  // that individually fall under MIN_COLLAPSE_HOURS.
  return mergeAdjacent(candidates)
    .map(r => snapInward(r, snapMs))
    .filter(r => r.to.getTime() - r.from.getTime() >= minMs)
    .map(r => {
      const fromIso = r.from.toISOString();
      const toIso = r.to.toISOString();
      const durationHours = (r.to.getTime() - r.from.getTime()) / (60 * 60_000);
      const kind = classifyCollapse(r.from, r.to);
      return {
        id: `${fromIso}-${toIso}`,
        from: r.from,
        to: r.to,
        durationHours,
        kind,
        heightPx: COLLAPSED_BAND_PX_BY_KIND[kind],
      } satisfies Collapse;
    })
    .sort((a, b) => a.from.getTime() - b.from.getTime());
}

/** Intersect two range lists. Both must be sorted by `from`. */
function intersectRanges(a: Range[], b: Range[]): Range[] {
  const out: Range[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].from.getTime(), b[j].from.getTime());
    const end = Math.min(a[i].to.getTime(), b[j].to.getTime());
    if (start < end) out.push({ from: new Date(start), to: new Date(end) });
    if (a[i].to.getTime() < b[j].to.getTime()) i++; else j++;
  }
  return out;
}

/** Snap from up, to down — band shrinks slightly so labels read on the 15-min grid. */
function snapInward(r: Range, snapMs: number): Range {
  const fromMs = Math.ceil(r.from.getTime() / snapMs) * snapMs;
  const toMs = Math.floor(r.to.getTime() / snapMs) * snapMs;
  return { from: new Date(fromMs), to: new Date(toMs) };
}

/** Merge adjacent / touching ranges (a.to === b.from). Inputs assumed sorted by `from`. */
function mergeAdjacent(ranges: Range[]): Range[] {
  if (ranges.length === 0) return ranges;
  const out: Range[] = [{ from: ranges[0].from, to: ranges[0].to }];
  for (let i = 1; i < ranges.length; i++) {
    const last = out[out.length - 1];
    const next = ranges[i];
    if (next.from.getTime() <= last.to.getTime()) {
      // Overlap or touch — extend the last range
      if (next.to.getTime() > last.to.getTime()) last.to = next.to;
    } else {
      out.push({ from: next.from, to: next.to });
    }
  }
  return out;
}
