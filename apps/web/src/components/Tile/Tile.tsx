import { useRef, useState, useEffect } from 'react';
import { Circle, CircleCheck } from 'lucide-react';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';
import type { TaskAssignment, Job, InternalTask } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { SwapButtons } from './SwapButtons';
import { SimilarityIndicators } from './SimilarityIndicators';
import { getJobColorClasses } from './colorUtils';
import type { SimilarityResult } from './similarityUtils';
import { useDragState, type TaskDragData } from '../../dnd';

export interface TileProps {
  /** Task assignment data */
  assignment: TaskAssignment;
  /** Task data (internal task with duration) */
  task: InternalTask;
  /** Job data */
  job: Job;
  /** Y position in pixels (top) */
  top: number;
  /** Callback when tile is clicked (select job) */
  onSelect?: (jobId: string) => void;
  /** Callback when tile is double-clicked (recall) */
  onRecall?: (assignmentId: string) => void;
  /** Callback when swap up is clicked */
  onSwapUp?: (assignmentId: string) => void;
  /** Callback when swap down is clicked */
  onSwapDown?: (assignmentId: string) => void;
  /** Whether to show swap up button */
  showSwapUp?: boolean;
  /** Whether to show swap down button */
  showSwapDown?: boolean;
  /** Whether this tile's job is selected */
  isSelected?: boolean;
  /** Similarity comparison results with previous tile (if any) */
  similarityResults?: SimilarityResult[];
  /** ID of the job being dragged (for muting other jobs during drag) */
  activeJobId?: string;
}

/**
 * Calculate height in pixels from duration in minutes.
 */
function minutesToPixels(minutes: number): number {
  return (minutes / 60) * PIXELS_PER_HOUR;
}

/**
 * Tile - Visual representation of a scheduled task assignment.
 * Shows job color, setup/run sections, completion status, and swap buttons.
 * Draggable within its station column for repositioning.
 */
export function Tile({
  assignment,
  task,
  job,
  top,
  onSelect,
  onRecall,
  onSwapUp,
  onSwapDown,
  showSwapUp = true,
  showSwapDown = true,
  isSelected = false,
  similarityResults,
  activeJobId,
}: TileProps) {
  const { setupMinutes, runMinutes } = task.duration;
  const originalTotalMinutes = setupMinutes + runMinutes;

  // Ref for the draggable element
  const tileRef = useRef<HTMLDivElement>(null);

  // Local state for isDragging (replaces useDraggable's isDragging)
  const [isDragging, setIsDragging] = useState(false);

  // Get drag state methods from context
  const { startDrag, endDrag } = useDragState();

  // Set up draggable using pragmatic-drag-and-drop
  useEffect(() => {
    const element = tileRef.current;
    if (!element) return;

    const dragData: TaskDragData = {
      type: 'task',
      task,
      job,
      assignmentId: assignment.id, // Include assignment ID for reschedule detection
    };

    return draggable({
      element,
      getInitialData: () => dragData,
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        // Use pragmatic-dnd's official API to disable native drag preview
        disableNativeDragPreview({ nativeSetDragImage });
      },
      onDragStart: ({ location }) => {
        setIsDragging(true);
        // Calculate grab offset (where user grabbed within the tile)
        const rect = element.getBoundingClientRect();
        const grabOffset = {
          x: location.initial.input.clientX - rect.left,
          y: location.initial.input.clientY - rect.top,
        };
        startDrag(task, job, assignment.id, grabOffset);
      },
      onDrop: () => {
        setIsDragging(false);
        endDrag();
      },
    });
  }, [task, job, assignment.id, startDrag, endDrag]);

  // Calculate total height from scheduled time span (downtime-aware)
  // This reflects actual time on grid, including stretching across non-operating periods
  const startTime = new Date(assignment.scheduledStart);
  const endTime = new Date(assignment.scheduledEnd);
  const spanMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  const totalHeight = minutesToPixels(spanMinutes);

  // Calculate setup/run heights proportionally based on original duration ratio
  // This maintains visual distinction even when tile is stretched
  const setupRatio = originalTotalMinutes > 0 ? setupMinutes / originalTotalMinutes : 0;
  const setupHeight = totalHeight * setupRatio;
  const runHeight = totalHeight * (1 - setupRatio);

  // Get color classes
  const colorClasses = getJobColorClasses(job.color);

  // Completion state
  const isCompleted = assignment.isCompleted;

  // Muting state: tile is muted during drag if it belongs to a different job
  const isMuted = activeJobId !== undefined && activeJobId !== job.id;

  // During any drag operation, make tiles non-interactive so drops can pass through
  // to the StationColumn droppable underneath (enables dropping onto existing tiles)
  const isDragActive = activeJobId !== undefined;

  // Completed gradient style
  const completedGradient = isCompleted
    ? 'linear-gradient(to right, rgba(34,197,94,0.6) 0%, rgba(34,197,94,0.2) 50%, transparent 100%)'
    : undefined;

  // Handle click (select job)
  const handleClick = () => {
    onSelect?.(job.id);
  };

  // Handle double click (recall)
  const handleDoubleClick = () => {
    onRecall?.(assignment.id);
  };

  // Handle swap
  const handleSwapUp = () => {
    onSwapUp?.(assignment.id);
  };

  const handleSwapDown = () => {
    onSwapDown?.(assignment.id);
  };

  // Determine if we have setup time to show
  const hasSetup = setupMinutes > 0;

  // Selected state styling - glow effect using job color at 60% opacity
  const selectedStyle = isSelected
    ? { boxShadow: `0 0 12px 4px ${job.color}99` } // 99 hex = ~60% opacity
    : undefined;

  // Muting style: desaturate and reduce opacity for other jobs during drag
  // Also disable pointer events during drag so drops pass through to StationColumn
  // But NOT for the tile being dragged itself (it needs to remain the drag source)
  const getMutingStyle = () => {
    if (isMuted) return { filter: 'saturate(0.2)', opacity: 0.6, pointerEvents: 'none' as const };
    if (isDragActive && !isDragging) return { pointerEvents: 'none' as const };
    return undefined;
  };
  const mutingStyle = getMutingStyle();

  // Ghost placeholder shown at original position when tile is being dragged
  if (isDragging) {
    return (
      <div
        ref={tileRef}
        className="absolute left-0 right-0 border-2 border-dashed border-zinc-600 bg-zinc-800/30 rounded pointer-events-none"
        style={{ top: `${top}px`, height: `${totalHeight}px` }}
        data-testid={`tile-ghost-${assignment.id}`}
      />
    );
  }

  return (
    <div
      ref={tileRef}
      className={`absolute left-0 right-0 text-sm border-l-4 ${colorClasses.border} group cursor-grab touch-none select-none transition-[filter,opacity,box-shadow] duration-150 ease-out`}
      style={{ top: `${top}px`, height: `${totalHeight}px`, ...selectedStyle, ...mutingStyle }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      data-testid={`tile-${assignment.id}`}
      data-scheduled-start={assignment.scheduledStart}
      data-scheduled-end={assignment.scheduledEnd}
      data-task-id={task.id}
      data-station-id={task.stationId}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick();
      }}
    >
      {/* Similarity indicators (shown at top of tile, overlapping junction with previous tile) */}
      {similarityResults && similarityResults.length > 0 && (
        <SimilarityIndicators results={similarityResults} />
      )}

      {/* Setup section (if has setup time) - contains the label */}
      {hasSetup && (
        <div
          className={`absolute left-0 right-0 ${colorClasses.setupBg} border-b ${colorClasses.setupBorder} pt-0.5 px-2`}
          style={{
            top: 0,
            height: `${setupHeight}px`,
            backgroundImage: completedGradient,
          }}
          data-testid="tile-setup-section"
        >
          {/* Content: completion icon + reference + client */}
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <CircleCheck
                className="w-4 h-4 text-emerald-500 shrink-0"
                data-testid="tile-completed-icon"
              />
            ) : (
              <Circle
                className="w-4 h-4 text-zinc-600 shrink-0"
                data-testid="tile-incomplete-icon"
              />
            )}
            <span
              className={`${colorClasses.text} font-medium truncate min-w-0`}
              data-testid="tile-content"
            >
              {job.reference} · {job.client}
            </span>
          </div>
        </div>
      )}

      {/* Run section */}
      <div
        className={`absolute left-0 right-0 ${colorClasses.runBg} ${!hasSetup ? 'pt-0.5 px-2' : ''}`}
        style={{
          top: hasSetup ? `${setupHeight}px` : 0,
          height: hasSetup ? `${runHeight}px` : `${totalHeight}px`,
          backgroundImage: completedGradient,
        }}
        data-testid="tile-run-section"
      >
        {/* Content only if no setup section */}
        {!hasSetup && (
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <CircleCheck
                className="w-4 h-4 text-emerald-500 shrink-0"
                data-testid="tile-completed-icon"
              />
            ) : (
              <Circle
                className="w-4 h-4 text-zinc-600 shrink-0"
                data-testid="tile-incomplete-icon"
              />
            )}
            <span
              className={`${colorClasses.text} font-medium truncate min-w-0`}
              data-testid="tile-content"
            >
              {job.reference} · {job.client}
            </span>
          </div>
        )}
      </div>

      {/* Swap buttons (visible on hover) */}
      <SwapButtons
        onSwapUp={handleSwapUp}
        onSwapDown={handleSwapDown}
        showUp={showSwapUp}
        showDown={showSwapDown}
      />
    </div>
  );
}
