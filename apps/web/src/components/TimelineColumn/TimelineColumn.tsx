import { useMemo } from 'react';
import { HourMarker, PIXELS_PER_HOUR } from './HourMarker';
import { NowLine } from './NowLine';
import { timeToYPosition } from './utils';
import type { Collapse } from '../SchedulingGrid/collapseConfig';

export interface TimelineColumnProps {
  /** Start hour (default: 6) */
  startHour?: number;
  /** Number of hours to display (default: 24) */
  hourCount?: number;
  /** Current time for now line (default: new Date()) */
  currentTime?: Date;
  /** Whether to show the now line (default: true) */
  showNowLine?: boolean;
  /** Pixels per hour (default: 80) */
  pixelsPerHour?: number;
  /** v0.3.46: Visible day range for virtual scrolling */
  visibleDayRange?: { start: number; end: number };
  /** Multi-day grid start (REQ-14) — required when collapses is set. */
  gridStartDate?: Date;
  /** Optional collapse bands — labels skip Y ranges inside bands; band overlays render at their Y. */
  collapses?: readonly Collapse[];
}

/**
 * TimelineColumn - Displays hour markers and now line.
 * Used alongside station columns in the scheduling grid.
 * v0.3.46: Supports virtual scrolling to only render visible hour markers.
 * Collapse-aware: hour labels inside a band are skipped; a decorative cover is
 * rendered for each band so the timeline column visually matches the main band.
 */
export function TimelineColumn({
  startHour = 6,
  hourCount = 24,
  currentTime = new Date(),
  showNowLine = true,
  pixelsPerHour = PIXELS_PER_HOUR,
  visibleDayRange,
  gridStartDate,
  collapses,
}: TimelineColumnProps) {
  const effectiveCollapses = collapses ?? [];

  // Total height — collapse-aware: each band trades real height for its heightPx.
  const totalHeight = useMemo(() => {
    let h = hourCount * pixelsPerHour;
    for (const c of effectiveCollapses) {
      h -= (c.durationHours * pixelsPerHour - c.heightPx);
    }
    return h;
  }, [hourCount, pixelsPerHour, effectiveCollapses]);

  // v0.3.46: Only generate hours for visible day range (performance optimization)
  const visibleHours = useMemo(() => {
    const hours: Array<{ hour: number; index: number }> = [];
    if (visibleDayRange) {
      const startHourIndex = visibleDayRange.start * 24;
      const endHourIndex = (visibleDayRange.end + 1) * 24;
      for (let i = startHourIndex; i < endHourIndex && i < hourCount; i++) {
        hours.push({ hour: (startHour + i) % 24, index: i });
      }
    } else {
      for (let i = 0; i < hourCount; i++) {
        hours.push({ hour: (startHour + i) % 24, index: i });
      }
    }
    return hours;
  }, [visibleDayRange, startHour, hourCount]);

  // For each visible hour, compute its collapse-aware Y. Skip hours that resolve inside a band.
  const renderableHours = useMemo(() => {
    if (effectiveCollapses.length === 0 || !gridStartDate) {
      return visibleHours.map(({ hour, index }) => ({
        hour,
        index,
        yPosition: index * pixelsPerHour,
      }));
    }
    const out: Array<{ hour: number; index: number; yPosition: number }> = [];
    for (const { hour, index } of visibleHours) {
      const hourDate = new Date(gridStartDate.getTime() + index * 3_600_000);
      const ms = hourDate.getTime();
      const insideBand = effectiveCollapses.some(c => ms > c.from.getTime() && ms < c.to.getTime());
      if (insideBand) continue;
      const yPosition = timeToYPosition(hourDate, startHour, pixelsPerHour, gridStartDate, effectiveCollapses);
      out.push({ hour, index, yPosition });
    }
    return out;
  }, [visibleHours, effectiveCollapses, gridStartDate, pixelsPerHour, startHour]);

  // Decorative cover divs over each band's Y range — keeps the timeline column
  // visually consistent with the CollapseBand on the right.
  const bandCovers = useMemo(() => {
    if (effectiveCollapses.length === 0 || !gridStartDate) return [];
    return effectiveCollapses.map((c) => ({
      id: c.id,
      top: timeToYPosition(c.from, startHour, pixelsPerHour, gridStartDate, effectiveCollapses),
      height: c.heightPx,
    }));
  }, [effectiveCollapses, gridStartDate, pixelsPerHour, startHour]);

  return (
    <div className="w-12 shrink-0 border-r border-white/5 sticky left-0 z-10 bg-zinc-950">
      <div
        className="relative bg-zinc-900/50"
        style={{ height: totalHeight }}
      >
        {renderableHours.map(({ hour, index, yPosition }) => (
          <HourMarker
            key={`hour-${index}`}
            hour={hour}
            yPosition={yPosition}
            pixelsPerHour={pixelsPerHour}
          />
        ))}
        {bandCovers.map(({ id, top, height }) => (
          <div
            key={`band-cover-${id}`}
            aria-hidden
            className="absolute left-0 right-0 bg-zinc-900 border-y border-white/5 pointer-events-none"
            style={{ top, height }}
          />
        ))}
        {showNowLine && (
          <NowLine currentTime={currentTime} startHour={startHour} pixelsPerHour={pixelsPerHour} />
        )}
      </div>
    </div>
  );
}
