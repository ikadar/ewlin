/**
 * Pick Preview Component
 *
 * Ghost tile that follows the cursor during pick & place operations.
 * Uses RAF (requestAnimationFrame) for smooth 60fps positioning.
 *
 * v0.3.54: Initial implementation for sidebar picks.
 * - Includes grid snapping (same as DragLayer)
 *
 * Key features:
 * - Portal-based rendering (renders outside normal DOM hierarchy)
 * - Direct DOM manipulation for position updates (no React re-renders)
 * - Grid snapping when over station columns
 * - Same visual style as DragPreview
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Job } from '@flux/types';
import { hexToTailwindColor, getColorClasses } from '../components/Tile';
import { snapToGrid, ValidationMessage } from '../components/DragPreview';
import { usePickState } from './PickStateContext';

/**
 * Offset from cursor to tile top during pick operations.
 * The cursor should appear 20px inside the tile, not at the top edge.
 * This value is also used in App.tsx for validation calculations.
 */
export const PICK_CURSOR_OFFSET_Y = 20;

export interface PickPreviewInnerProps {
  /** The task being picked */
  task: Task;
  /** The job this task belongs to */
  job: Job;
  /** Validation message to display (French) */
  validationMessage?: string | null;
  /** Debug info for development */
  debugInfo?: {
    ringState: string;
    scheduledStart: string | null;
    conflicts: Array<{ type: string; message?: string }>;
  } | null;
}

export interface PickPreviewProps {
  /** Validation message to display (French) */
  validationMessage?: string | null;
  /** Debug info for development */
  debugInfo?: {
    ringState: string;
    scheduledStart: string | null;
    conflicts: Array<{ type: string; message?: string }>;
  } | null;
}

/**
 * Find station column element under cursor.
 */
function findStationColumnUnderCursor(x: number, y: number): HTMLElement | null {
  const elements = document.elementsFromPoint(x, y);
  return elements.find(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && el.dataset.testid?.startsWith('station-column-') === true
  ) || null;
}

/**
 * Ghost tile preview during pick operation.
 * Uses RAF for smooth cursor following with grid snapping.
 */
function PickPreviewInner({ task, job, validationMessage, debugInfo }: PickPreviewInnerProps) {
  const { ghostPositionRef, state } = usePickState();
  const { pixelsPerHour } = state;
  const previewRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Cache for expensive elementsFromPoint query
  const lastQueryRef = useRef<{ x: number; y: number; column: HTMLElement | null }>({
    x: -1000,
    y: -1000,
    column: null,
  });

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

  // Calculate height based on duration
  const getHeight = (): number => {
    if (task.type === 'Internal') {
      const totalMinutes = task.duration.setupMinutes + task.duration.runMinutes;
      const height = Math.max(40, Math.round((totalMinutes / 60) * 80));
      return Math.min(height, 200);
    }
    return 60;
  };

  const height = getHeight();

  // RAF loop for smooth position updates with grid snapping
  useEffect(() => {
    const updatePosition = () => {
      const preview = previewRef.current;
      if (preview) {
        const { x, y } = ghostPositionRef.current;

        // Only query DOM if cursor moved significantly (> 20px from last query)
        // elementsFromPoint is expensive - avoid calling every frame
        const lastQuery = lastQueryRef.current;
        const dx = Math.abs(x - lastQuery.x);
        const dy = Math.abs(y - lastQuery.y);

        let stationColumn: HTMLElement | null;
        if (dx > 20 || dy > 20) {
          // Cursor moved enough - re-query
          stationColumn = findStationColumnUnderCursor(x, y);
          lastQueryRef.current = { x, y, column: stationColumn };
        } else {
          // Use cached result
          stationColumn = lastQuery.column;
        }

        let tileTopY: number;
        let finalX = x - 10; // Default offset from cursor

        if (stationColumn) {
          // Calculate content Y relative to station column
          const stationRect = stationColumn.getBoundingClientRect();
          const cursorContentY = y - stationRect.top;

          // Calculate tile top from cursor position (cursor is inside the tile)
          const tileTopContentY = cursorContentY - PICK_CURSOR_OFFSET_Y;

          // Snap tile top to grid in content coordinates
          const snappedTileTop = snapToGrid(Math.max(0, tileTopContentY), pixelsPerHour);

          // Convert back to viewport coordinates
          tileTopY = stationRect.top + snappedTileTop;

          // Align X to station column left edge for cleaner appearance
          finalX = stationRect.left;
        } else {
          // Fallback: no snapping when not over station
          tileTopY = y - PICK_CURSOR_OFFSET_Y;
        }

        // Direct DOM manipulation - no React state update
        preview.style.transform = `translate(${finalX}px, ${tileTopY}px)`;
      }
      rafRef.current = requestAnimationFrame(updatePosition);
    };

    // Start the RAF loop
    rafRef.current = requestAnimationFrame(updatePosition);

    // Cleanup on unmount
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [ghostPositionRef, pixelsPerHour]);

  return (
    <div
      ref={previewRef}
      className="fixed top-0 left-0 pointer-events-none z-[9999]"
      data-testid="pick-preview"
    >
      {/* Ghost tile */}
      <div
        className={`w-56 pt-1 px-2 pb-2 text-sm border-l-4 ${colors.border} ${colors.runBg} opacity-80 shadow-lg rounded`}
        style={{ height: `${height}px` }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`font-medium truncate min-w-0 ${colors.text}`}>
            {stationName}
          </span>
          <span className="text-zinc-400 shrink-0">{formatDuration()}</span>
        </div>
        <div className={`text-xs ${colors.text} opacity-70 truncate mt-0.5`}>
          {job.reference} · {job.client}
        </div>
      </div>
      {/* Validation message below ghost tile */}
      {validationMessage && (
        <ValidationMessage message={validationMessage} />
      )}
      {/* Debug overlay */}
      {debugInfo && (
        <div className="mt-2 px-2 py-1 bg-black/90 text-xs text-white font-mono rounded max-w-72">
          <div>ring: <span className={debugInfo.ringState === 'valid' ? 'text-green-400' : debugInfo.ringState === 'invalid' ? 'text-red-400' : 'text-yellow-400'}>{debugInfo.ringState}</span></div>
          <div>start: {debugInfo.scheduledStart ? new Date(debugInfo.scheduledStart).toLocaleTimeString() : 'null'}</div>
          <div>conflicts: {debugInfo.conflicts.length === 0 ? 'none' : debugInfo.conflicts.map(c => c.type).join(', ')}</div>
          {debugInfo.conflicts.map((c, i) => (
            <div key={i} className="text-zinc-400 truncate">{c.type}: {c.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Pick Preview wrapper that handles portal rendering.
 * Only renders when there's an active pick operation.
 */
export function PickPreview({ validationMessage, debugInfo }: PickPreviewProps) {
  const { state } = usePickState();
  const { pickedTask, pickedJob, isPicking } = state;

  // Don't render if not picking or missing task/job
  if (!isPicking || !pickedTask || !pickedJob) {
    return null;
  }

  // Render via portal to ensure it's above all other content
  return createPortal(
    <PickPreviewInner task={pickedTask} job={pickedJob} validationMessage={validationMessage} debugInfo={debugInfo} />,
    document.body
  );
}
