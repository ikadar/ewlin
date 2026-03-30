import { type ReactNode, type MouseEvent, useRef, useMemo, memo } from 'react';
import type { Station, DaySchedule, StationCategory } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { UnavailabilityOverlay } from './UnavailabilityOverlay';
import { PrecedenceLines } from '../PrecedenceLines';
import { DryingTimeIndicator } from '../DryingTimeIndicator';
import { OutsourcingTimeIndicator } from '../OutsourcingTimeIndicator';
import type { DryingTimeInfo, OutsourcingTimeInfo } from '../../utils';
import { getDefaultCategoryWidth } from '../../utils/tileLabelResolver';

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
  /** REQ-10: Precedence constraint Y positions for visualization */
  precedenceConstraints?: { earliestY: number | null; latestY: number | null };
  /** v0.3.51: Drying time visualization info during drag */
  dryingTimeInfo?: DryingTimeInfo;
  /** v0.5.13: Outsourcing time visualization info during drag */
  outsourcingTimeInfo?: OutsourcingTimeInfo;
  /** v0.3.46: Visible day range for virtual scrolling (only render overlays/lines for these days) */
  visibleDayRange?: { start: number; end: number };
  /** v0.3.54: Whether a task is currently picked (Pick & Place mode) */
  isPicking?: boolean;
  /** v0.3.54: Whether this station is the target for the picked task */
  isPickTarget?: boolean;
  /** v0.3.54: Ring color state for pick operation (valid/invalid/warning/bypass) */
  pickRingState?: 'none' | 'valid' | 'invalid' | 'warning' | 'bypass';
  /** v0.3.55: Source of the pick operation (sidebar vs grid) */
  pickSource?: 'sidebar' | 'grid' | null;
  /** v0.3.54: Callback for mouse move during pick (for ghost position and validation) */
  onPickMouseMove?: (stationId: string, clientX: number, clientY: number, relativeY: number) => void;
  /** v0.3.54: Callback for mouse leave during pick */
  onPickMouseLeave?: () => void;
  /** v0.3.54: Callback for click to place during pick */
  onPickClick?: (stationId: string, clientX: number, clientY: number, relativeY: number) => void;
  /** Current display mode (for dynamic column width) */
  displayMode?: 'produit' | 'tirage';
  /** Station category (for columnWidth lookup) */
  category?: StationCategory;
  /** Callback when clicking the column background (deselect) */
  onDeselect?: () => void;
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
 * Get the day schedule for a specific date.
 * Checks exceptions first, then falls back to the regular weekly schedule.
 */
function getDaySchedule(station: Station, dayOfWeek: number, date?: Date): DaySchedule {
  // Check for a date-specific exception
  if (date && station.exceptions?.length) {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const exception = station.exceptions.find((e) => e.date === dateStr);
    if (exception) {
      return exception.schedule;
    }
  }
  const dayName = DAY_NAMES[dayOfWeek];
  return station.operatingSchedule[dayName];
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
  precedenceConstraints,
  dryingTimeInfo,
  outsourcingTimeInfo,
  visibleDayRange,
  // v0.3.54: Pick & Place props
  isPicking = false,
  isPickTarget = false,
  pickRingState = 'none',
  pickSource,
  onPickMouseMove,
  onPickMouseLeave,
  onPickClick,
  displayMode: _displayMode,
  category,
  onDeselect,
}: StationColumnProps) {
  // Ref for the column element
  const columnRef = useRef<HTMLDivElement>(null);

  // REQ-04: Calculate number of days for multi-day grid
  // When gridStartDate is provided, render overlays for each day
  const numberOfDays = Math.ceil(hoursToDisplay / 24);
  const isMultiDayGrid = gridStartDate !== undefined && numberOfDays > 1;

  // Use current day if not specified (for single-day mode)
  const today = gridStartDate ?? new Date();
  const effectiveDayOfWeek = dayOfWeek ?? today.getDay();
  const daySchedule = getDaySchedule(station, effectiveDayOfWeek, today);

  // Calculate total height
  const totalHeight = hoursToDisplay * pixelsPerHour;

  // v0.3.46: Generate hour grid lines only for visible day range (memoized for performance)
  const gridLines = useMemo(() => {
    const lines: number[] = [];
    if (visibleDayRange) {
      // Virtual scroll mode: only render grid lines for visible days
      const startHourIndex = visibleDayRange.start * 24;
      const endHourIndex = (visibleDayRange.end + 1) * 24;
      for (let i = startHourIndex; i <= endHourIndex; i++) {
        lines.push(i * pixelsPerHour);
      }
    } else {
      // Legacy mode: render all grid lines
      for (let i = 0; i <= hoursToDisplay; i++) {
        lines.push(i * pixelsPerHour);
      }
    }
    return lines;
  }, [visibleDayRange, pixelsPerHour, hoursToDisplay]);

  // Determine highlight style based on pick state
  const getHighlightClass = () => {
    // v0.3.54: Pick & Place ring states (highest priority during pick)
    if (isPicking && isPickTarget) {
      switch (pickRingState) {
        case 'valid':
          return 'ring-2 ring-green-500 bg-green-500/10';
        case 'invalid':
          return 'ring-2 ring-red-500 bg-red-500/10';
        case 'warning':
          return 'ring-2 ring-orange-500 bg-orange-500/10';
        case 'bypass':
          return 'ring-2 ring-amber-500 bg-amber-500/10';
        default:
          // Target column but no specific state - subtle highlight
          return 'ring-1 ring-green-500/30';
      }
    }
    // v0.3.55: Non-target columns during sidebar pick are faded and disabled
    // v0.3.57: Grid picks keep all columns visible
    if (isPicking && !isPickTarget && pickSource === 'sidebar') {
      return 'opacity-15 pointer-events-none';
    }

    return '';
  };

  // Custom width: explicit DB value takes priority, then category-based default, then CSS w-60.
  const customWidth = category?.columnWidth ?? (category ? getDefaultCategoryWidth(category.name) : null);

  // Mouse handlers
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    // v0.3.54: Pick & Place mouse move handler
    if (isPicking && isPickTarget && onPickMouseMove) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      onPickMouseMove(station.id, e.clientX, e.clientY, relativeY);
    }
  };

  const handleMouseLeave = () => {
    // v0.3.54: Pick & Place mouse leave handler
    if (isPicking && onPickMouseLeave) {
      onPickMouseLeave();
    }
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    // v0.3.54: Pick & Place click handler (place the picked task)
    if (isPicking && isPickTarget && onPickClick) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      onPickClick(station.id, e.clientX, e.clientY, relativeY);
      return;
    }
    // Background click → deselect (only if click was directly on column, not on a tile)
    if (e.target === e.currentTarget) {
      onDeselect?.();
    }
  };

  return (
    <div
      ref={columnRef}
      className={`${customWidth === null ? 'w-60' : ''} shrink-0 bg-zinc-950 relative transition-[filter,opacity,box-shadow] duration-150 ease-out outline-none ${getHighlightClass()}`}
      style={{ ...(customWidth !== null ? { width: `${customWidth}px` } : {}), height: `${totalHeight}px` }}
      data-testid={`station-column-${station.id}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
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
      {/* Unavailability overlay - REQ-04: Multi-day support, v0.3.46: virtual scroll optimization */}
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
            const dayScheduleForDay = getDaySchedule(station, dayOfWeekForDay, currentDate);
            const dayYOffset = dayIndex * 24 * pixelsPerHour;

            visibleDays.push(
              <UnavailabilityOverlay
                key={`overlay-day-${dayIndex}`}
                daySchedule={dayScheduleForDay}
                startHour={0}
                hoursToDisplay={24}
                pixelsPerHour={pixelsPerHour}
                yOffset={dayYOffset}
              />
            );
          }

          return visibleDays;
        })()
      ) : (
        // Single-day mode: original behavior
        <UnavailabilityOverlay
          daySchedule={daySchedule}
          startHour={startHour}
          hoursToDisplay={hoursToDisplay}
          pixelsPerHour={pixelsPerHour}
        />
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

      {/* REQ-10: Precedence Constraint Lines (during pick) */}
      {precedenceConstraints && (
        <PrecedenceLines
          earliestY={precedenceConstraints.earliestY}
          latestY={precedenceConstraints.latestY}
          isVisible={isPicking && isPickTarget}
        />
      )}

      {/* v0.3.51: Drying Time Indicator (during pick) */}
      {/* Note: dryingTimeInfo is only passed when this IS the predecessor station */}
      {dryingTimeInfo && (
        <DryingTimeIndicator
          predecessorEndY={dryingTimeInfo.predecessorEndY}
          dryingEndY={dryingTimeInfo.dryingEndY}
          isVisible={isPicking}
        />
      )}

      {/* v0.5.13: Outsourcing Time Indicator (during pick) */}
      {/* Note: outsourcingTimeInfo is only passed when this IS the outsourced predecessor's provider */}
      {outsourcingTimeInfo && (
        <OutsourcingTimeIndicator
          departureY={outsourcingTimeInfo.departureY}
          returnY={outsourcingTimeInfo.returnY}
          isVisible={isPicking}
        />
      )}

      {/* Tiles (children) */}
      {children}
    </div>
  );
});
