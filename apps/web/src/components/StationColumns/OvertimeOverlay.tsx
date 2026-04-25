import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { timeToYPosition } from '../TimelineColumn/utils';
import type { Collapse } from '../SchedulingGrid/collapseConfig';

export interface OvertimeOverlayProps {
  /** Overtime periods for this day, in minutes-since-midnight. Caller computes
   *  these via `getOperatorOvertimePeriodsForDay()`. Empty array → renders nothing. */
  periods: ReadonlyArray<{ startMinutes: number; endMinutes: number }>;
  /** Starting hour of the grid (e.g. 0 for midnight, 6 for 06:00). */
  startHour: number;
  /** Number of hours to display (typically 24). */
  hoursToDisplay: number;
  /** Pixels per hour for grid scaling. */
  pixelsPerHour?: number;
  /** Y offset in pixels for multi-day rendering. Ignored when `collapses` is set. */
  yOffset?: number;
  /** Optional collapse bands — each overtime stripe is split where it intersects a band. */
  collapses?: readonly Collapse[];
  /** Absolute date this overlay's periods correspond to. Required when `collapses` is set. */
  dayDate?: Date;
  /** Grid origin date. Required when `collapses` is set — used as baseDate for collapse-aware Y. */
  gridStartDate?: Date;
}

/**
 * OvertimeOverlay — yellow 45° hachures marking operator overtime periods
 * (heures supplémentaires).
 *
 * Mirrors `UnavailabilityOverlay` structurally (same SVG-stripe pattern at
 * the same angle, same collapse-aware splitting), but uses `bg-stripes-amber`
 * instead of `bg-stripes-dark`. Crucially: tiles render ON TOP of this overlay
 * normally — overtime is a regular availability slot, the hachures only mark
 * "exceptional time". This is enforced by render order (overlay before tiles).
 *
 * Overtime and absence ranges are guaranteed disjoint by the PHP API, so this
 * overlay never visually conflicts with `UnavailabilityOverlay`.
 */
export function OvertimeOverlay({
  periods,
  startHour,
  hoursToDisplay,
  pixelsPerHour = PIXELS_PER_HOUR,
  yOffset = 0,
  collapses,
  dayDate,
  gridStartDate,
}: OvertimeOverlayProps) {
  if (periods.length === 0) return null;

  const displayStart = startHour * 60;
  const displayEnd = displayStart + hoursToDisplay * 60;
  const clipped = periods
    .map((p) => ({
      startMinutes: Math.max(p.startMinutes, displayStart),
      endMinutes: Math.min(p.endMinutes, displayEnd),
    }))
    .filter((p) => p.endMinutes > p.startMinutes);
  if (clipped.length === 0) return null;

  const useCollapse = collapses && collapses.length > 0 && dayDate && gridStartDate;

  if (!useCollapse) {
    return (
      <>
        {clipped.map((p) => {
          const top = ((p.startMinutes - displayStart) / 60) * pixelsPerHour + yOffset;
          const height = ((p.endMinutes - p.startMinutes) / 60) * pixelsPerHour;
          return (
            <div
              key={`ot-${p.startMinutes}-${p.endMinutes}-${yOffset}`}
              className="absolute left-0 right-0 bg-stripes-amber pointer-events-none"
              style={{ top: `${top}px`, height: `${height}px` }}
              data-testid="overtime-overlay"
            />
          );
        })}
      </>
    );
  }

  const fragments: Array<{ from: Date; to: Date; key: string }> = [];
  const dayBaseMs = dayDate.getTime();
  for (const period of clipped) {
    const startAbs = dayBaseMs + period.startMinutes * 60_000;
    const endAbs = dayBaseMs + period.endMinutes * 60_000;
    let slices: Array<{ from: number; to: number }> = [{ from: startAbs, to: endAbs }];
    for (const c of collapses) {
      const cFrom = c.from.getTime();
      const cTo = c.to.getTime();
      const next: typeof slices = [];
      for (const s of slices) {
        if (cTo <= s.from || cFrom >= s.to) {
          next.push(s);
          continue;
        }
        if (cFrom > s.from) next.push({ from: s.from, to: cFrom });
        if (cTo < s.to) next.push({ from: cTo, to: s.to });
      }
      slices = next;
    }
    slices.forEach((s, idx) => {
      fragments.push({
        from: new Date(s.from),
        to: new Date(s.to),
        key: `ot-${period.startMinutes}-${period.endMinutes}-${idx}`,
      });
    });
  }

  return (
    <>
      {fragments.map((f) => {
        const top = timeToYPosition(f.from, startHour, pixelsPerHour, gridStartDate, collapses);
        const bottom = timeToYPosition(f.to, startHour, pixelsPerHour, gridStartDate, collapses);
        const height = bottom - top;
        if (height < 1) return null;
        return (
          <div
            key={f.key}
            className="absolute left-0 right-0 bg-stripes-amber pointer-events-none"
            style={{ top: `${top}px`, height: `${height}px` }}
            data-testid="overtime-overlay"
          />
        );
      })}
    </>
  );
}
