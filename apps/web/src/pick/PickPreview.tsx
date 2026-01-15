/**
 * PickPreview - Preview component for Pick & Place mode
 *
 * WYSIWYG ghost tile: shows exactly where and how the tile will be placed.
 * When hovering over a compatible station, the ghost tile is rendered inside
 * the station column at the snap position with effective height.
 *
 * v0.3.58: Refactored to use RAF for real-time cursor tracking (no React state updates).
 * The ghost position is read from ghostPositionRef for smooth 60fps rendering.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Job, Station } from '@flux/types';
import { hexToTailwindColor, getColorClasses } from '../components/Tile';
import { ValidationMessage, snapToGrid, yPositionToTime } from '../components/DragPreview';
import { calculateEndTime } from '../utils';
import { usePickGhostPosition } from './PickStateContext';

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
 *
 * v0.3.58: Uses RAF for smooth real-time cursor tracking without React re-renders.
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
  // v0.3.58: Ref for real-time cursor position (no setState = no re-renders)
  const cursorPositionRef = useRef<CursorPosition>({ x: 0, y: 0 });

  // v0.3.58: Access shared ghost position ref from context
  const ghostPositionRef = usePickGhostPosition();

  // Ref to the ghost element for direct DOM manipulation
  const ghostElementRef = useRef<HTMLDivElement>(null);
  const indicatorElementRef = useRef<HTMLDivElement>(null);


  // v0.3.58: Track cursor position via RAF (no setState on every move)
  useEffect(() => {
    let rafId: number;
    let lastX = 0;
    let lastY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      cursorPositionRef.current = { x: e.clientX, y: e.clientY };
    };

    // Calculate effective height for ghost based on snapped position
    const calculateHeight = (snappedY: number): number => {
      if (task.type !== 'Internal') return 48;

      const station = stations.find((s) => s.id === task.stationId);
      const scheduledStart = yPositionToTime(snappedY, startHour, gridStartDate, pixelsPerHour);
      const scheduledEnd = calculateEndTime(task, scheduledStart.toISOString(), station);

      const startMs = scheduledStart.getTime();
      const endMs = new Date(scheduledEnd).getTime();
      const durationHours = (endMs - startMs) / (1000 * 60 * 60);
      return Math.max(40, durationHours * pixelsPerHour);
    };

    const updateGhostPosition = () => {
      const { x, y } = cursorPositionRef.current;

      // Skip if position hasn't changed
      if (x === lastX && y === lastY) {
        rafId = requestAnimationFrame(updateGhostPosition);
        return;
      }
      lastX = x;
      lastY = y;

      // Find station column under cursor
      const elements = document.elementsFromPoint(x, y);
      const stationColumnEl = elements.find(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && el.dataset.testid?.startsWith('station-column-') === true
      );

      // Check if we're over a compatible station
      const isCompatibleStation =
        stationColumnEl &&
        task.type === 'Internal' &&
        stationColumnEl.dataset.testid === `station-column-${task.stationId}`;

      // Update ghost element position directly (DOM manipulation, no React)
      if (ghostElementRef.current) {
        if (isCompatibleStation && stationColumnEl) {
          const stationRect = stationColumnEl.getBoundingClientRect();
          const contentY = y - stationRect.top;
          const snappedY = snapToGrid(Math.max(0, contentY), pixelsPerHour);

          // Calculate effective height based on position
          const effectiveHeight = calculateHeight(snappedY);

          // Position ghost inside station column
          ghostElementRef.current.style.display = 'block';
          ghostElementRef.current.style.left = `${stationRect.left + 4}px`;
          ghostElementRef.current.style.top = `${stationRect.top + snappedY}px`;
          ghostElementRef.current.style.width = `${stationRect.width - 8}px`;

          // Update ghost inner height
          const innerDiv = ghostElementRef.current.firstElementChild as HTMLElement;
          if (innerDiv) {
            innerDiv.style.height = `${effectiveHeight}px`;
          }

          // Update ghostPositionRef for validation (used by App.tsx)
          ghostPositionRef.current = { stationId: task.stationId, y: snappedY };

          // Hide indicator
          if (indicatorElementRef.current) {
            indicatorElementRef.current.style.display = 'none';
          }
        } else {
          // Hide ghost, show indicator
          ghostElementRef.current.style.display = 'none';

          if (indicatorElementRef.current) {
            indicatorElementRef.current.style.display = 'block';
            indicatorElementRef.current.style.left = `${x + 16}px`;
            indicatorElementRef.current.style.top = `${y}px`;

            // Update opacity based on station compatibility
            const isOverIncompatibleStation =
              stationColumnEl &&
              task.type === 'Internal' &&
              stationColumnEl.dataset.testid !== `station-column-${task.stationId}`;

            const innerDiv = indicatorElementRef.current.firstElementChild as HTMLElement;
            if (innerDiv) {
              innerDiv.style.opacity = isOverIncompatibleStation ? '0.4' : '0.7';
            }
          }

          // Clear ghost position when not over valid station
          ghostPositionRef.current = { stationId: null, y: 0 };
        }
      }

      rafId = requestAnimationFrame(updateGhostPosition);
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Start RAF loop
    rafId = requestAnimationFrame(updateGhostPosition);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [task, pixelsPerHour, ghostPositionRef, stations, startHour, gridStartDate]);

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

  // Default height for ghost (actual height is updated dynamically in RAF loop)
  const defaultHeight = task.type === 'Internal'
    ? Math.max(40, ((task.duration.setupMinutes + task.duration.runMinutes) / 60) * pixelsPerHour)
    : 48;

  return createPortal(
    <>
      {/* Ghost tile (shown when over compatible station) */}
      <div
        ref={ghostElementRef}
        style={{
          position: 'fixed',
          display: 'none',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        <div
          className={`pt-1 px-2 pb-2 text-sm border-l-4 ${colors.border} ${colors.runBg} opacity-80 shadow-lg rounded pointer-events-none`}
          style={{ height: `${defaultHeight}px` }}
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
      </div>

      {/* Cursor indicator (shown when not over compatible station) */}
      <div
        ref={indicatorElementRef}
        style={{
          position: 'fixed',
          display: 'none',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        <div
          className={`w-48 pt-1 px-2 pb-2 text-sm border-l-4 ${colors.border} ${colors.runBg} shadow-lg rounded pointer-events-none transition-opacity duration-100`}
          style={{ height: '48px', opacity: 0.7 }}
          data-testid="pick-preview-indicator"
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`font-medium truncate min-w-0 ${colors.text}`}>{stationName}</span>
            <span className="text-zinc-400 shrink-0">{formatDuration()}</span>
          </div>
          <div className={`text-xs ${colors.text} opacity-70 truncate mt-0.5`}>
            Cliquez sur la grille
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
