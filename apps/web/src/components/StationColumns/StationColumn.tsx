import { type ReactNode, type MouseEvent, useEffect, useRef, useState, useMemo, memo } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type { Station, DaySchedule } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { UnavailabilityOverlay } from './UnavailabilityOverlay';
import { PlacementIndicator } from '../PlacementIndicator';
import { PrecedenceLines } from '../PrecedenceLines';
import { DryingTimeIndicator } from '../DryingTimeIndicator';
import type { DryingTimeInfo } from '../../utils';
import { useDragStateValue, type TaskDragData, type StationDropData } from '../../dnd';

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
  /** Whether this column is collapsed (during drag to another station) */
  isCollapsed?: boolean;
  /** Whether a valid drop is being hovered over this column */
  isValidDrop?: boolean;
  /** Whether a warning-only drop (non-blocking, like Plates approval) is being hovered */
  isWarningDrop?: boolean;
  /** Whether an invalid drop is being hovered over this column */
  isInvalidDrop?: boolean;
  /** Whether to show bypass warning (Alt key + precedence conflict) */
  showBypassWarning?: boolean;
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
  precedenceConstraints?: { earliestY: number | null; latestY: number | null };
  /** v0.3.51: Drying time visualization info during drag */
  dryingTimeInfo?: DryingTimeInfo;
  /** v0.3.46: Visible day range for virtual scrolling (only render overlays/lines for these days) */
  visibleDayRange?: { start: number; end: number };
  /** v0.3.54: Whether a task is currently picked (Pick & Place mode) */
  isPicking?: boolean;
  /** v0.3.54: Whether this station is the target for the picked task */
  isPickTarget?: boolean;
  /** v0.3.54: Ring color state for pick operation (valid/invalid/warning/bypass) */
  pickRingState?: 'none' | 'valid' | 'invalid' | 'warning' | 'bypass';
  /** v0.3.54: Callback for mouse move during pick (for ghost position and validation) */
  onPickMouseMove?: (stationId: string, clientX: number, clientY: number, relativeY: number) => void;
  /** v0.3.54: Callback for mouse leave during pick */
  onPickMouseLeave?: () => void;
  /** v0.3.54: Callback for click to place during pick */
  onPickClick?: (stationId: string, clientX: number, clientY: number, relativeY: number) => void;
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
  isCollapsed = false,
  isValidDrop = false,
  isWarningDrop = false,
  isInvalidDrop = false,
  showBypassWarning = false,
  isQuickPlacementMode = false,
  hasAvailableTask = false,
  placementIndicatorY,
  onQuickPlacementMouseMove,
  onQuickPlacementMouseLeave,
  onQuickPlacementClick,
  precedenceConstraints,
  dryingTimeInfo,
  visibleDayRange,
  // v0.3.54: Pick & Place props
  isPicking = false,
  isPickTarget = false,
  pickRingState = 'none',
  onPickMouseMove,
  onPickMouseLeave,
  onPickClick,
}: StationColumnProps) {
  // Ref for the drop target element
  const columnRef = useRef<HTMLDivElement>(null);

  // Local state for isOver (replaces useDroppable's isOver)
  const [isOver, setIsOver] = useState(false);

  // Get drag state from context (replaces useDroppable's active)
  const { isDragging, activeTask } = useDragStateValue();

  // Set up drop target using pragmatic-drag-and-drop
  useEffect(() => {
    const element = columnRef.current;
    if (!element) return;

    const dropData: StationDropData = {
      type: 'station-column',
      stationId: station.id,
    };

    return dropTargetForElements({
      element,
      getData: () => dropData,
      canDrop: ({ source }) => {
        // Only accept task drags for this station
        const data = source.data as TaskDragData;
        return (
          data.type === 'task' &&
          data.task.type === 'Internal' &&
          data.task.stationId === station.id
        );
      },
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
  }, [station.id]);

  // Check if the dragged task belongs to this station
  const isValidDropTarget =
    isDragging &&
    activeTask?.type === 'Internal' &&
    activeTask.stationId === station.id;

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

  // Determine highlight style based on drag state and validation
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
    // v0.3.54: Non-target columns during pick are dimmed
    if (isPicking && !isPickTarget) {
      return 'opacity-50';
    }

    // Priority: validation-based highlighting over basic drag state
    if (showBypassWarning) {
      // Alt-key bypass with precedence conflict - amber warning
      return 'ring-2 ring-amber-500 bg-amber-500/10';
    }
    if (isInvalidDrop) {
      // Invalid drop zone - red indicator (blocking conflicts)
      return 'ring-2 ring-red-500 bg-red-500/10';
    }
    if (isWarningDrop) {
      // Warning-only drop zone - orange indicator (non-blocking, like Plates approval)
      return 'ring-2 ring-orange-500 bg-orange-500/10';
    }
    if (isValidDrop) {
      // Valid drop zone - green indicator
      return 'ring-2 ring-green-500 bg-green-500/10';
    }
    // Quick Placement Mode highlighting (only when not dragging)
    if (isQuickPlacementMode && !isDragging) {
      if (hasAvailableTask) {
        // Available column - green highlight
        return 'ring-2 ring-green-500 bg-green-500/10';
      } else {
        // Unavailable column - subtle dimming
        return 'opacity-50';
      }
    }
    // Fallback to basic drag state highlighting
    if (!isDragging) return '';
    if (isValidDropTarget) {
      return isOver ? 'ring-2 ring-green-500/50 bg-green-500/5' : 'ring-1 ring-green-500/30';
    }
    return '';
  };

  // Column width: full (240px / w-60) or collapsed (120px / w-30)
  const widthClass = isCollapsed ? 'w-30' : 'w-60';

  // Quick placement mode handlers
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    // v0.3.54: Pick & Place mouse move handler
    if (isPicking && isPickTarget && onPickMouseMove) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      onPickMouseMove(station.id, e.clientX, e.clientY, relativeY);
      return;
    }
    // Quick placement mode
    if (!isQuickPlacementMode || !onQuickPlacementMouseMove) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    onQuickPlacementMouseMove(station.id, relativeY);
  };

  const handleMouseLeave = () => {
    // v0.3.54: Pick & Place mouse leave handler
    if (isPicking && onPickMouseLeave) {
      onPickMouseLeave();
      return;
    }
    // Quick placement mode
    if (!isQuickPlacementMode || !onQuickPlacementMouseLeave) return;
    onQuickPlacementMouseLeave();
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    // v0.3.54: Pick & Place click handler (place the picked task)
    if (isPicking && isPickTarget && onPickClick) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      onPickClick(station.id, e.clientX, e.clientY, relativeY);
      return;
    }
    // Quick placement mode
    if (!isQuickPlacementMode || !hasAvailableTask || !onQuickPlacementClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    onQuickPlacementClick(station.id, relativeY);
  };

  // Cursor style for quick placement mode and pick mode
  const getCursorClass = () => {
    // v0.3.54: Pick & Place cursor
    if (isPicking) {
      if (isPickTarget) {
        return pickRingState === 'invalid' ? 'cursor-not-allowed' : 'cursor-pointer';
      }
      return 'cursor-not-allowed';
    }
    // Quick placement mode
    if (!isQuickPlacementMode) return '';
    return hasAvailableTask ? 'cursor-pointer' : 'cursor-not-allowed';
  };

  return (
    <div
      ref={columnRef}
      className={`${widthClass} shrink-0 bg-[#0a0a0a] relative transition-all duration-150 ease-out ${getHighlightClass()} ${getCursorClass()}`}
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

      {/* Quick Placement Indicator */}
      {isQuickPlacementMode && hasAvailableTask && placementIndicatorY !== undefined && (
        <PlacementIndicator y={placementIndicatorY} isVisible={true} />
      )}

      {/* REQ-10: Precedence Constraint Lines (during drag, quick placement, or pick) */}
      {precedenceConstraints && (
        <PrecedenceLines
          earliestY={precedenceConstraints.earliestY}
          latestY={precedenceConstraints.latestY}
          isVisible={isDragging || (isQuickPlacementMode && hasAvailableTask) || (isPicking && isPickTarget)}
        />
      )}

      {/* v0.3.51: Drying Time Indicator (during drag or pick) */}
      {/* Note: dryingTimeInfo is only passed when this IS the predecessor station */}
      {dryingTimeInfo && (
        <DryingTimeIndicator
          predecessorEndY={dryingTimeInfo.predecessorEndY}
          dryingEndY={dryingTimeInfo.dryingEndY}
          isVisible={isDragging || isPicking}
        />
      )}

      {/* Tiles (children) */}
      {children}
    </div>
  );
});
