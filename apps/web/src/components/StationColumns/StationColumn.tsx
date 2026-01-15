import { type ReactNode, type MouseEvent, useRef, useMemo, memo } from 'react';
import type { Station, DaySchedule } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { UnavailabilityOverlay } from './UnavailabilityOverlay';
import { PlacementIndicator } from '../PlacementIndicator';
import { PrecedenceLines } from '../PrecedenceLines';
import { DryingTimeIndicator } from '../DryingTimeIndicator';
import type { DryingTimeInfo } from '../../utils';

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
  /** Whether quick placement mode is active */
  isQuickPlacementMode?: boolean;
  /** Whether there's an available task for this station in quick placement mode */
  hasAvailableTask?: boolean;
  /** Y position for placement indicator (snapped) */
  placementIndicatorY?: number;
  /** Callback when mouse moves in the column (for tracking position) */
  onQuickPlacementMouseMove?: (stationId: string, y: number) => void;
  /** Callback when mouse leaves the column */
  onQuickPlacementMouseLeave?: () => void;
  /** Callback when user clicks to place a task */
  onQuickPlacementClick?: (stationId: string, y: number) => void;
  /** REQ-10: Precedence constraint Y positions for visualization */
  /** v0.3.56: Extended with label info for contextual display */
  precedenceConstraints?: {
    earliestY: number | null;
    latestY: number | null;
    earliestLabel?: { taskName: string; time: string } | null;
    latestLabel?: { taskName: string; time: string } | null;
  };
  /** v0.3.51: Drying time visualization info during drag */
  dryingTimeInfo?: DryingTimeInfo;
  /** v0.3.46: Visible day range for virtual scrolling (only render overlays/lines for these days) */
  visibleDayRange?: { start: number; end: number };
  /** v0.3.54: Whether pick mode is active (Pick & Place) */
  isPickMode?: boolean;
  /** v0.3.61: Source of pick (sidebar = new, grid = reschedule) - controls column hiding */
  pickSource?: 'sidebar' | 'grid' | null;
  /** v0.3.54: Whether this is the target station for the picked task */
  isPickTargetStation?: boolean;
  /** v0.3.54: Callback when mouse moves in the column during pick mode */
  onPickMouseMove?: (stationId: string, y: number) => void;
  /** v0.3.54: Callback when mouse leaves the column during pick mode */
  onPickMouseLeave?: () => void;
  /** v0.3.55: Pick mode validation state for real-time ring color feedback */
  pickValidation?: {
    isValid: boolean;
    hasPrecedenceConflict: boolean;
    suggestedStart: string | null;
    hasWarningOnly: boolean;
  };
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
 * Get the day schedule for a specific day of week.
 */
function getDaySchedule(station: Station, dayOfWeek: number): DaySchedule {
  const dayName = DAY_NAMES[dayOfWeek];
  return station.operatingSchedule[dayName];
}

/**
 * StationColumn - Individual station column with grid lines and unavailability overlay.
 * Supports Pick & Place and Quick Placement modes for task positioning.
 * v0.3.46: Memoized to prevent unnecessary re-renders.
 */
export const StationColumn = memo(function StationColumn({
  station,
  startHour = 6,
  hoursToDisplay = 24,
  pixelsPerHour = PIXELS_PER_HOUR,
  dayOfWeek,
  gridStartDate,
  children,
  isQuickPlacementMode = false,
  hasAvailableTask = false,
  placementIndicatorY,
  onQuickPlacementMouseMove,
  onQuickPlacementMouseLeave,
  onQuickPlacementClick,
  precedenceConstraints,
  dryingTimeInfo,
  visibleDayRange,
  isPickMode = false,
  pickSource = null,
  isPickTargetStation = false,
  onPickMouseMove,
  onPickMouseLeave,
  pickValidation,
}: StationColumnProps) {
  // Ref for the column element
  const columnRef = useRef<HTMLDivElement>(null);

  // REQ-04: Calculate number of days for multi-day grid
  // When gridStartDate is provided, render overlays for each day
  const numberOfDays = Math.ceil(hoursToDisplay / 24);
  const isMultiDayGrid = gridStartDate !== undefined && numberOfDays > 1;

  // Use current day if not specified (for single-day mode)
  const effectiveDayOfWeek = dayOfWeek ?? new Date().getDay();
  const daySchedule = getDaySchedule(station, effectiveDayOfWeek);

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

  // Determine highlight style based on pick mode and validation (memoized for performance)
  const highlightClass = useMemo(() => {
    // v0.3.55: Pick mode styling with validation-based ring color
    if (isPickMode) {
      if (isPickTargetStation) {
        // Target station - ring color based on validation
        if (pickValidation?.hasWarningOnly) {
          return 'ring-2 ring-orange-500 bg-orange-500/10';
        }
        if (pickValidation?.hasPrecedenceConflict && !pickValidation.isValid) {
          return 'ring-2 ring-red-500 bg-red-500/10';
        }
        if (pickValidation?.isValid) {
          return 'ring-2 ring-green-500 bg-green-500/10';
        }
        // Default: green ring when hovering (no validation yet or valid)
        return 'ring-2 ring-green-500 bg-green-500/10';
      } else {
        // v0.3.55: Non-target stations fade out during pick mode (sidebar only)
        // v0.3.61: When picking from grid (reschedule), keep all columns visible
        if (pickSource === 'sidebar') {
          return 'opacity-15 pointer-events-none';
        }
        return '';
      }
    }

    // Quick Placement Mode highlighting
    if (isQuickPlacementMode) {
      if (hasAvailableTask) {
        // Available column - green highlight
        return 'ring-2 ring-green-500 bg-green-500/10';
      } else {
        // Unavailable column - subtle dimming
        return 'opacity-50';
      }
    }

    return '';
  }, [
    isPickMode, pickSource, isPickTargetStation, pickValidation,
    isQuickPlacementMode, hasAvailableTask
  ]);

  // Quick placement mode and pick mode handlers
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;

    // Quick placement mode
    if (isQuickPlacementMode && onQuickPlacementMouseMove) {
      onQuickPlacementMouseMove(station.id, relativeY);
    }

    // v0.3.54: Pick mode - only track on target station
    if (isPickMode && isPickTargetStation && onPickMouseMove) {
      onPickMouseMove(station.id, relativeY);
    }
  };

  const handleMouseLeave = () => {
    // Quick placement mode
    if (isQuickPlacementMode && onQuickPlacementMouseLeave) {
      onQuickPlacementMouseLeave();
    }

    // v0.3.54: Pick mode
    if (isPickMode && onPickMouseLeave) {
      onPickMouseLeave();
    }
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!isQuickPlacementMode || !hasAvailableTask || !onQuickPlacementClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    onQuickPlacementClick(station.id, relativeY);
  };

  // Cursor style for quick placement mode or pick mode
  const getCursorClass = () => {
    if (isPickMode) {
      return isPickTargetStation ? 'cursor-pointer' : 'cursor-not-allowed';
    }
    if (!isQuickPlacementMode) return '';
    return hasAvailableTask ? 'cursor-pointer' : 'cursor-not-allowed';
  };

  return (
    <div
      ref={columnRef}
      className={`w-60 shrink-0 bg-[#0a0a0a] relative transition-all duration-150 ease-out transition-[box-shadow,background-color] duration-100 ${highlightClass} ${getCursorClass()}`}
      style={{ height: `${totalHeight}px` }}
      data-testid={`station-column-${station.id}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
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
            const dayScheduleForDay = getDaySchedule(station, dayOfWeekForDay);
            const dayYOffset = dayIndex * 24 * pixelsPerHour;

            visibleDays.push(
              <UnavailabilityOverlay
                key={`overlay-day-${dayIndex}`}
                daySchedule={dayScheduleForDay}
                startHour={startHour}
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

      {/* Quick Placement / Pick Mode Indicator (white snap bar) */}
      {((isQuickPlacementMode && hasAvailableTask) || (isPickMode && isPickTargetStation)) && placementIndicatorY !== undefined && (
        <PlacementIndicator y={placementIndicatorY} isVisible={true} />
      )}

      {/* REQ-10: Precedence Constraint Lines (during quick placement or pick mode) */}
      {/* v0.3.56: Now includes contextual labels */}
      {precedenceConstraints && (
        <PrecedenceLines
          earliestY={precedenceConstraints.earliestY}
          latestY={precedenceConstraints.latestY}
          earliestLabel={precedenceConstraints.earliestLabel}
          latestLabel={precedenceConstraints.latestLabel}
          isVisible={(isQuickPlacementMode && hasAvailableTask) || (isPickMode && isPickTargetStation)}
        />
      )}

      {/* v0.3.51: Drying Time Indicator (during pick mode) */}
      {dryingTimeInfo && (
        <DryingTimeIndicator
          predecessorEndY={dryingTimeInfo.predecessorEndY}
          dryingEndY={dryingTimeInfo.dryingEndY}
          isVisible={isPickMode && isPickTargetStation}
        />
      )}

      {/* Tiles (children) */}
      {children}
    </div>
  );
});
