import { type ReactNode, type MouseEvent, useEffect, useRef, useState } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type { Station, DaySchedule } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { UnavailabilityOverlay } from './UnavailabilityOverlay';
import { PlacementIndicator } from '../PlacementIndicator';
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
  /** Day of week to show schedule for (0 = Sunday, 1 = Monday, etc.) */
  dayOfWeek?: number;
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
 */
export function StationColumn({
  station,
  startHour = 6,
  hoursToDisplay = 24,
  pixelsPerHour = PIXELS_PER_HOUR,
  dayOfWeek,
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

  // Use current day if not specified
  const effectiveDayOfWeek = dayOfWeek ?? new Date().getDay();
  const daySchedule = getDaySchedule(station, effectiveDayOfWeek);

  // Calculate total height
  const totalHeight = hoursToDisplay * pixelsPerHour;

  // Generate hour grid lines
  const gridLines: number[] = [];
  for (let i = 0; i <= hoursToDisplay; i++) {
    gridLines.push(i * pixelsPerHour);
  }

  // Determine highlight style based on drag state and validation
  const getHighlightClass = () => {
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
    if (!isQuickPlacementMode || !onQuickPlacementMouseMove) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    onQuickPlacementMouseMove(station.id, relativeY);
  };

  const handleMouseLeave = () => {
    if (!isQuickPlacementMode || !onQuickPlacementMouseLeave) return;
    onQuickPlacementMouseLeave();
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!isQuickPlacementMode || !hasAvailableTask || !onQuickPlacementClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    onQuickPlacementClick(station.id, relativeY);
  };

  // Cursor style for quick placement mode
  const getCursorClass = () => {
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
      {/* Unavailability overlay */}
      <UnavailabilityOverlay
        daySchedule={daySchedule}
        startHour={startHour}
        hoursToDisplay={hoursToDisplay}
        pixelsPerHour={pixelsPerHour}
      />

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

      {/* Tiles (children) */}
      {children}
    </div>
  );
}
