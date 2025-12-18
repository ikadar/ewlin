import type { ReactNode, MouseEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Station, DaySchedule } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { UnavailabilityOverlay } from './UnavailabilityOverlay';
import { PlacementIndicator } from '../PlacementIndicator';
import type { TaskDragData } from '../../App';

/** Data attached to droppable station columns */
export interface StationDropData {
  type: 'station-column';
  stationId: string;
}

export interface StationColumnProps {
  /** Station to display */
  station: Station;
  /** Starting hour of the grid (e.g., 6 for 6:00 AM) */
  startHour?: number;
  /** Number of hours to display */
  hoursToDisplay?: number;
  /** Day of week to show schedule for (0 = Sunday, 1 = Monday, etc.) */
  dayOfWeek?: number;
  /** Children (tiles) to render inside the column */
  children?: ReactNode;
  /** Whether this column is collapsed (during drag to another station) */
  isCollapsed?: boolean;
  /** Whether a valid drop is being hovered over this column */
  isValidDrop?: boolean;
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
  dayOfWeek,
  children,
  isCollapsed = false,
  isValidDrop = false,
  isInvalidDrop = false,
  showBypassWarning = false,
  isQuickPlacementMode = false,
  hasAvailableTask = false,
  placementIndicatorY,
  onQuickPlacementMouseMove,
  onQuickPlacementMouseLeave,
  onQuickPlacementClick,
}: StationColumnProps) {
  // Set up droppable
  const dropData: StationDropData = {
    type: 'station-column',
    stationId: station.id,
  };

  const { setNodeRef, isOver, active } = useDroppable({
    id: `station-${station.id}`,
    data: dropData,
  });

  // Check if the dragged task belongs to this station
  const activeData = active?.data.current as TaskDragData | undefined;
  const isValidDropTarget =
    activeData?.type === 'task' &&
    activeData.task.type === 'Internal' &&
    activeData.task.stationId === station.id;

  // Use current day if not specified
  const effectiveDayOfWeek = dayOfWeek ?? new Date().getDay();
  const daySchedule = getDaySchedule(station, effectiveDayOfWeek);

  // Calculate total height
  const totalHeight = hoursToDisplay * PIXELS_PER_HOUR;

  // Generate hour grid lines
  const gridLines: number[] = [];
  for (let i = 0; i <= hoursToDisplay; i++) {
    gridLines.push(i * PIXELS_PER_HOUR);
  }

  // Determine highlight style based on drag state and validation
  const getHighlightClass = () => {
    // Priority: validation-based highlighting over basic drag state
    if (showBypassWarning) {
      // Alt-key bypass with precedence conflict - amber/orange warning
      return 'ring-2 ring-amber-500 bg-amber-500/10';
    }
    if (isInvalidDrop) {
      // Invalid drop zone - red indicator
      return 'ring-2 ring-red-500 bg-red-500/10';
    }
    if (isValidDrop) {
      // Valid drop zone - green indicator
      return 'ring-2 ring-green-500 bg-green-500/10';
    }
    // Quick Placement Mode highlighting (only when not dragging)
    if (isQuickPlacementMode && !active) {
      if (hasAvailableTask) {
        // Available column - green highlight
        return 'ring-2 ring-green-500 bg-green-500/10';
      } else {
        // Unavailable column - subtle dimming
        return 'opacity-50';
      }
    }
    // Fallback to basic drag state highlighting
    if (!active) return '';
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
      ref={setNodeRef}
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
