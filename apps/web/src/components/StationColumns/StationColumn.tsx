import { type ReactNode, type MouseEvent, useRef, useMemo, memo } from 'react';
import type { Station, DaySchedule, StationCategory, Operator } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { timeToYPosition } from '../TimelineColumn/utils';
import { UnavailabilityOverlay } from './UnavailabilityOverlay';
import { OvertimeOverlay } from './OvertimeOverlay';
import type { DryingTimeInfo, OutsourcingTimeInfo } from '../../utils';
import { getDefaultCategoryWidth } from '../../utils/tileLabelResolver';
import {
  aggregateOperatorOvertimePeriodsForStationDay,
  mergeDayScheduleWithOvertimePeriods,
} from '../../utils/operatorTileSlices';
import type { Collapse } from '../SchedulingGrid/collapseConfig';

export interface StationColumnProps {
  /** Station to display */
  station: Station;
  /** Starting hour of the grid (e.g., 6 for 6:00 AM) */
  startHour?: number;
  /** Number of hours to display */
  hoursToDisplay?: number;
  /** Pixels per hour for grid scaling (default: 80) */
  pixelsPerHour?: number;
  /** Day of week to show schedule for (0 = Sunday, 1 = Monday, etc.) - used for single-day mode */
  dayOfWeek?: number;
  /** Start date for multi-day grid (REQ-04) - when provided, enables multi-day overlay rendering */
  gridStartDate?: Date;
  /** Children (tiles) to render inside the column */
  children?: ReactNode;
  /** Whether this column is collapsed (v0.3.57: always false, kept for API compatibility) */
  isCollapsed?: boolean;
  /** v0.3.46: Visible day range for virtual scrolling (only render overlays/lines for these days) */
  visibleDayRange?: { start: number; end: number };
  /** Current display mode (for dynamic column width) */
  displayMode?: 'produit' | 'tirage';
  /** Station category (for columnWidth lookup) */
  category?: StationCategory;
  /** Callback when clicking the column background (deselect) */
  onDeselect?: () => void;
  /** Optional collapse bands — grid lines inside bands are skipped, totalHeight collapses. */
  collapses?: readonly Collapse[];
  /** All operators. The dark hachures shrink and the gray overtime cross-grid
   *  appears only when at least one *qualified* operator (has a skill entry
   *  for this station) has overtime intersecting the day. Omit → station
   *  behaves like it always did (overtime invisible). */
  operators?: readonly Operator[];
}

const DAY_NAMES: (keyof Station['operatingSchedule'])[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Get the effective day schedule for a specific date, after:
 *   1. Union with shop-wide operator overtime (extends availability — by
 *      symmetry with the closure model where shop-wide closure = absences
 *      on every operator).
 *   2. Narrow by station exceptions (machine-specific events, e.g. maintenance —
 *      take precedence over overtime).
 *
 * `overtimePeriods` is the already-aggregated set of overtime ranges across
 * every operator for `date`, in minutes-since-midnight. Caller computes it
 * once per day and reuses for the OvertimeOverlay so stripes line up with
 * the receded dark hachures.
 */
function getDaySchedule(
  station: Station,
  dayOfWeek: number,
  date?: Date,
  overtimePeriods: ReadonlyArray<{ startMinutes: number; endMinutes: number }> = [],
): DaySchedule {
  const dayName = DAY_NAMES[dayOfWeek];
  const baseRaw = station.operatingSchedule[dayName];
  const base = overtimePeriods.length === 0
    ? baseRaw
    : mergeDayScheduleWithOvertimePeriods(baseRaw, overtimePeriods);
  if (!date || !station.exceptions?.length) return base;

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;

  const unavailable: Array<[number, number]> = [];
  for (const ex of station.exceptions) {
    if (ex.startAt > dayEnd || ex.endAt < dayStart) continue;
    const startMin = ex.startAt < dayStart
      ? 0
      : parseInt(ex.startAt.slice(11, 13), 10) * 60 + parseInt(ex.startAt.slice(14, 16), 10);
    const endMin = ex.endAt > dayEnd
      ? 24 * 60
      : parseInt(ex.endAt.slice(11, 13), 10) * 60 + parseInt(ex.endAt.slice(14, 16), 10) + 1;
    unavailable.push([startMin, endMin]);
  }
  if (unavailable.length === 0) return base;

  unavailable.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of unavailable) {
    const last = merged[merged.length - 1];
    if (!last || last[1] < range[0]) merged.push([...range]);
    else last[1] = Math.max(last[1], range[1]);
  }
  if (merged.length === 1 && merged[0][0] <= 0 && merged[0][1] >= 24 * 60) {
    return { isOperating: false, slots: [] };
  }

  const toHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const narrowedSlots: { start: string; end: string }[] = [];
  for (const slot of base.slots) {
    const slotStart = parseInt(slot.start.slice(0, 2), 10) * 60 + parseInt(slot.start.slice(3, 5), 10);
    const slotEnd = parseInt(slot.end.slice(0, 2), 10) * 60 + parseInt(slot.end.slice(3, 5), 10);
    let cursor = slotStart;
    for (const [uStart, uEnd] of merged) {
      if (uEnd <= cursor || uStart >= slotEnd) continue;
      if (uStart > cursor) narrowedSlots.push({ start: toHm(cursor), end: toHm(Math.min(uStart, slotEnd)) });
      cursor = Math.max(cursor, uEnd);
      if (cursor >= slotEnd) break;
    }
    if (cursor < slotEnd) narrowedSlots.push({ start: toHm(cursor), end: toHm(slotEnd) });
  }

  if (narrowedSlots.length === 0) return { isOperating: false, slots: [] };
  return { isOperating: true, slots: narrowedSlots };
}

/**
 * StationColumn - Individual station column with grid lines and unavailability overlay.
 * Acts as a drop target for task tiles.
 * v0.3.46: Memoized to prevent unnecessary re-renders during drag.
 */
export const StationColumn = memo(function StationColumn({
  station,
  startHour = 6,
  hoursToDisplay = 24,
  pixelsPerHour = PIXELS_PER_HOUR,
  dayOfWeek,
  gridStartDate,
  children,
  isCollapsed: _isCollapsed = false,
  visibleDayRange,
  displayMode: _displayMode,
  category,
  onDeselect,
  collapses,
  operators,
}: StationColumnProps) {
  // Ref for the column element
  const columnRef = useRef<HTMLDivElement>(null);

  const effectiveCollapses = collapses ?? [];
  const effectiveOperators = operators ?? [];

  // REQ-04: Calculate number of days for multi-day grid
  // When gridStartDate is provided, render overlays for each day
  const numberOfDays = Math.ceil(hoursToDisplay / 24);
  const isMultiDayGrid = gridStartDate !== undefined && numberOfDays > 1;

  // Use current day if not specified (for single-day mode)
  const today = gridStartDate ?? new Date();
  const effectiveDayOfWeek = dayOfWeek ?? today.getDay();
  const todayOvertimePeriods = useMemo(
    () => aggregateOperatorOvertimePeriodsForStationDay(effectiveOperators, station.id, today),
    [effectiveOperators, station.id, today],
  );
  const daySchedule = getDaySchedule(station, effectiveDayOfWeek, today, todayOvertimePeriods);

  // Calculate total height — collapse-aware: each band trades real height for its heightPx
  const totalHeight = useMemo(() => {
    let h = hoursToDisplay * pixelsPerHour;
    for (const c of effectiveCollapses) {
      h -= (c.durationHours * pixelsPerHour - c.heightPx);
    }
    return h;
  }, [hoursToDisplay, pixelsPerHour, effectiveCollapses]);

  // v0.3.46: Generate hour grid lines only for visible day range (memoized for performance).
  // Collapse-aware: lines whose Y resolves inside a band are skipped (the band cover hides them).
  const gridLines = useMemo(() => {
    const lines: number[] = [];
    const useCollapse = effectiveCollapses.length > 0 && gridStartDate !== undefined;

    const pushLine = (i: number) => {
      if (!useCollapse) {
        lines.push(i * pixelsPerHour);
        return;
      }
      const hourDate = new Date(gridStartDate!.getTime() + i * 3_600_000);
      const ms = hourDate.getTime();
      const inside = effectiveCollapses.some(c => ms > c.from.getTime() && ms < c.to.getTime());
      if (inside) return;
      lines.push(timeToYPosition(hourDate, startHour, pixelsPerHour, gridStartDate, effectiveCollapses));
    };

    if (visibleDayRange) {
      const startHourIndex = visibleDayRange.start * 24;
      const endHourIndex = (visibleDayRange.end + 1) * 24;
      for (let i = startHourIndex; i <= endHourIndex; i++) pushLine(i);
    } else {
      for (let i = 0; i <= hoursToDisplay; i++) pushLine(i);
    }
    return lines;
  }, [visibleDayRange, pixelsPerHour, hoursToDisplay, effectiveCollapses, gridStartDate, startHour]);

  // Custom width: explicit DB value takes priority, then category-based default, then CSS w-60.
  const customWidth = category?.columnWidth ?? (category ? getDefaultCategoryWidth(category.name) : null);

  // Background click → deselect
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onDeselect?.();
    }
  };

  return (
    <div
      ref={columnRef}
      className={`${customWidth === null ? 'w-60' : ''} shrink-0 bg-zinc-950 relative`}
      style={{ ...(customWidth !== null ? { width: `${customWidth}px` } : {}), height: `${totalHeight}px` }}
      data-testid={`station-column-${station.id}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      aria-label={`Station ${station.name}`}
    >
      {/* Unavailability + overtime overlays.
          DOM order: OvertimeOverlay (gray cross-grid) → UnavailabilityOverlay (dark
          hachures) → tiles. Tiles render last so they sit on top normally. The
          two patterns are guaranteed disjoint (overtime is unioned into the
          daySchedule before computing dark hachures), so render order only
          matters for tiles-on-top — not for layering the two patterns. */}
      {isMultiDayGrid ? (
        // Multi-day mode: render overlay for each visible day only
        (() => {
          // v0.3.46: Only render overlays for visible days
          const startDay = visibleDayRange?.start ?? 0;
          const endDay = visibleDayRange?.end ?? (numberOfDays - 1);
          const visibleDays = [];

          for (let dayIndex = startDay; dayIndex <= endDay && dayIndex < numberOfDays; dayIndex++) {
            // Calculate the date for this day
            const currentDate = new Date(gridStartDate.getTime() + dayIndex * 24 * 60 * 60 * 1000);
            const dayOfWeekForDay = currentDate.getDay();
            const overtimePeriods = aggregateOperatorOvertimePeriodsForStationDay(
              effectiveOperators,
              station.id,
              currentDate,
            );
            const dayScheduleForDay = getDaySchedule(
              station,
              dayOfWeekForDay,
              currentDate,
              overtimePeriods,
            );
            const dayYOffset = effectiveCollapses.length === 0
              ? dayIndex * 24 * pixelsPerHour
              : timeToYPosition(currentDate, startHour, pixelsPerHour, gridStartDate, effectiveCollapses);

            if (overtimePeriods.length > 0) {
              visibleDays.push(
                <OvertimeOverlay
                  key={`ot-overlay-day-${dayIndex}`}
                  periods={overtimePeriods}
                  startHour={0}
                  hoursToDisplay={24}
                  pixelsPerHour={pixelsPerHour}
                  yOffset={dayYOffset}
                  collapses={effectiveCollapses}
                  dayDate={currentDate}
                  gridStartDate={gridStartDate}
                />
              );
            }

            visibleDays.push(
              <UnavailabilityOverlay
                key={`overlay-day-${dayIndex}`}
                daySchedule={dayScheduleForDay}
                startHour={0}
                hoursToDisplay={24}
                pixelsPerHour={pixelsPerHour}
                yOffset={dayYOffset}
                collapses={effectiveCollapses}
                dayDate={currentDate}
                gridStartDate={gridStartDate}
              />
            );
          }

          return visibleDays;
        })()
      ) : (
        // Single-day mode: original behavior
        <>
          {todayOvertimePeriods.length > 0 && (
            <OvertimeOverlay
              periods={todayOvertimePeriods}
              startHour={startHour}
              hoursToDisplay={hoursToDisplay}
              pixelsPerHour={pixelsPerHour}
            />
          )}
          <UnavailabilityOverlay
            daySchedule={daySchedule}
            startHour={startHour}
            hoursToDisplay={hoursToDisplay}
            pixelsPerHour={pixelsPerHour}
          />
        </>
      )}

      {/* Hour grid lines */}
      {gridLines.map((top) => (
        <div
          key={top}
          className="absolute left-0 right-0 h-px bg-zinc-700/50 pointer-events-none"
          style={{ top: `${top}px` }}
          data-testid="hour-grid-line"
        />
      ))}

      {/* Tiles (children) */}
      {children}
    </div>
  );
});
