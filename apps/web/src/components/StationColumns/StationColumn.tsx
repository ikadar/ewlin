import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Station, DaySchedule } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { UnavailabilityOverlay } from './UnavailabilityOverlay';
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

  // Determine highlight style based on drag state
  const getHighlightClass = () => {
    if (!active) return '';
    if (isValidDropTarget) {
      return isOver ? 'ring-2 ring-green-500/50 bg-green-500/5' : 'ring-1 ring-green-500/30';
    }
    return '';
  };

  // Column width: full (240px / w-60) or collapsed (120px / w-30)
  const widthClass = isCollapsed ? 'w-30' : 'w-60';

  return (
    <div
      ref={setNodeRef}
      className={`${widthClass} shrink-0 bg-[#0a0a0a] relative transition-all duration-150 ease-out ${getHighlightClass()}`}
      style={{ height: `${totalHeight}px` }}
      data-testid={`station-column-${station.id}`}
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
          className="absolute left-0 right-0 h-px bg-zinc-700/50"
          style={{ top: `${top}px` }}
          data-testid="hour-grid-line"
        />
      ))}

      {/* Tiles (children) */}
      {children}
    </div>
  );
}
