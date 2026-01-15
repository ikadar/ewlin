/**
 * PickPreview - Preview component for Pick & Place mode
 *
 * WYSIWYG ghost tile: shows exactly where and how the tile will be placed.
 * When hovering over a compatible station, the ghost tile is rendered inside
 * the station column at the snap position with effective height.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Job, Station, InternalTask } from '@flux/types';
import { hexToTailwindColor, getColorClasses } from '../components/Tile';
import { ValidationMessage, snapToGrid, yPositionToTime } from '../components/DragPreview';
import { calculateEndTime } from '../utils';

export interface PickPreviewProps {
  /** The task being picked */
  task: Task;
  /** The job this task belongs to */
  job: Job;
  /** Current pixels per hour (for zoom-aware snapping) */
  pixelsPerHour: number;
  /** Start hour of the grid (for time calculations) */
  startHour: number;
  /** Grid start date (for multi-day calculations) */
  gridStartDate: Date;
  /** Available stations (for effective height calculation) */
  stations: Station[];
  /** Validation message to display (French) */
  validationMessage?: string | null;
}

interface CursorPosition {
  x: number;
  y: number;
}

/**
 * PickPreview component that renders a WYSIWYG ghost tile.
 * When over a compatible station, the tile is rendered IN the grid at the snap position.
 * When not over a station, a small cursor indicator is shown.
 */
export function PickPreview({
  task,
  job,
  pixelsPerHour,
  startHour,
  gridStartDate,
  stations,
  validationMessage
}: PickPreviewProps) {
  const [position, setPosition] = useState<CursorPosition | null>(null);

  // Track cursor position via mousemove
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Don't render until we have a position
  if (!position) {
    return null;
  }

  // Get color classes from job color
  const tailwindColor = hexToTailwindColor(job.color);
  const colors = getColorClasses(tailwindColor);

  // Get station name for internal tasks
  const stationName = task.type === 'Internal' ? task.stationId : 'Outsourced';

  // Format duration
  const formatDuration = (): string => {
    if (task.type === 'Internal') {
      const totalMinutes = task.duration.setupMinutes + task.duration.runMinutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}h${minutes.toString().padStart(2, '0')}`;
    }
    return `${task.duration.openDays}j`;
  };

  // Find station column under cursor
  const elements = document.elementsFromPoint(position.x, position.y);
  const stationColumnEl = elements.find(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && el.dataset.testid?.startsWith('station-column-') === true
  );

  // Check if we're over a compatible station (task's designated station)
  const isCompatibleStation =
    stationColumnEl &&
    task.type === 'Internal' &&
    stationColumnEl.dataset.testid === `station-column-${task.stationId}`;

  if (isCompatibleStation && stationColumnEl) {
    // WYSIWYG mode: render ghost tile IN the station column
    const stationRect = stationColumnEl.getBoundingClientRect();
    const contentY = position.y - stationRect.top;
    const snappedY = snapToGrid(Math.max(0, contentY), pixelsPerHour);

    // Calculate effective height using station's working hours
    const station = stations.find((s) => s.id === (task as InternalTask).stationId);
    const scheduledStart = yPositionToTime(snappedY, startHour, gridStartDate, pixelsPerHour);
    const scheduledEnd = calculateEndTime(task as InternalTask, scheduledStart.toISOString(), station);

    // Calculate height from start to end times
    const startMs = scheduledStart.getTime();
    const endMs = new Date(scheduledEnd).getTime();
    const durationHours = (endMs - startMs) / (1000 * 60 * 60);
    const effectiveHeight = Math.max(40, durationHours * pixelsPerHour);

    // Position ghost tile inside the station column
    const ghostStyle: React.CSSProperties = {
      position: 'fixed',
      left: stationRect.left + 4, // Small inset from column edge
      top: stationRect.top + snappedY,
      width: stationRect.width - 8, // Full column width minus padding
      pointerEvents: 'none',
      zIndex: 9999,
    };

    return createPortal(
      <div style={ghostStyle}>
        <div
          className={`pt-1 px-2 pb-2 text-sm border-l-4 ${colors.border} ${colors.runBg} opacity-80 shadow-lg rounded pointer-events-none`}
          style={{ height: `${effectiveHeight}px` }}
          data-testid="pick-preview"
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`font-medium truncate min-w-0 ${colors.text}`}>{stationName}</span>
            <span className="text-zinc-400 shrink-0">{formatDuration()}</span>
          </div>
          <div className={`text-xs ${colors.text} opacity-70 truncate mt-0.5`}>
            {job.reference} · {job.client}
          </div>
        </div>
        {/* Validation message below preview */}
        {validationMessage && <ValidationMessage message={validationMessage} />}
      </div>,
      document.body
    );
  }

  // Not over compatible station: show small indicator following cursor
  const indicatorStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x + 16,
    top: position.y,
    pointerEvents: 'none',
    zIndex: 9999,
  };

  // Determine cursor state indicator
  const isOverIncompatibleStation =
    stationColumnEl &&
    task.type === 'Internal' &&
    stationColumnEl.dataset.testid !== `station-column-${task.stationId}`;

  return createPortal(
    <div style={indicatorStyle}>
      <div
        className={`w-48 pt-1 px-2 pb-2 text-sm border-l-4 ${colors.border} ${colors.runBg} ${isOverIncompatibleStation ? 'opacity-40' : 'opacity-70'} shadow-lg rounded pointer-events-none`}
        style={{ height: '48px' }}
        data-testid="pick-preview-indicator"
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`font-medium truncate min-w-0 ${colors.text}`}>{stationName}</span>
          <span className="text-zinc-400 shrink-0">{formatDuration()}</span>
        </div>
        <div className={`text-xs ${colors.text} opacity-70 truncate mt-0.5`}>
          {isOverIncompatibleStation ? 'Station incompatible' : 'Cliquez sur la grille'}
        </div>
      </div>
    </div>,
    document.body
  );
}
