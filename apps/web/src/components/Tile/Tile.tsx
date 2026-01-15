import { useRef, useState, useEffect, memo } from 'react';
import { Square, CheckSquare } from 'lucide-react';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';
import type { TaskAssignment, Job, InternalTask } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { TileContextMenu } from './TileContextMenu';
import { TileTooltip } from './TileTooltip';
import { SimilarityIndicators } from './SimilarityIndicators';
import { getJobColorClasses } from './colorUtils';
import type { SimilarityResult } from './similarityUtils';
import { useDragState, type TaskDragData } from '../../dnd';
import type { SubcolumnLayout } from '../../utils/subcolumnLayout';

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
  /** ID of the currently selected job (for muting non-selected jobs - REQ-01) */
  selectedJobId?: string;
  /** Whether this tile has a conflict (precedence violation - REQ-12) */
  hasConflict?: boolean;
  /** Callback when completion icon is clicked */
  onToggleComplete?: (assignmentId: string) => void;
  /** Pixels per hour for height calculation (default: 80) */
  pixelsPerHour?: number;
  /** Whether this is an outsourced assignment (REQ-19) */
  isOutsourced?: boolean;
  /** Subcolumn layout for provider columns (REQ-19) */
  subcolumnLayout?: SubcolumnLayout;
  /** v0.3.57: Callback when tile is picked for placement */
  onPick?: (assignmentId: string, task: InternalTask, job: Job) => void;
  /** v0.3.57: Whether this tile is currently picked (in pick mode) */
  isPicked?: boolean;
  /** v0.3.57: Callback when info button is clicked (opens job details) */
  onInfoClick?: (jobId: string) => void;
}

/**
 * Calculate height in pixels from duration in minutes.
 */
function minutesToPixels(minutes: number, pixelsPerHour: number = PIXELS_PER_HOUR): number {
  return (minutes / 60) * pixelsPerHour;
}

/**
 * Tile - Visual representation of a scheduled task assignment.
 * Shows job color, setup/run sections, completion status, and swap buttons.
 * Draggable within its station column for repositioning.
 * v0.3.46: Memoized to prevent unnecessary re-renders during drag.
 */
export const Tile = memo(function Tile({
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
  selectedJobId,
  hasConflict = false,
  onToggleComplete,
  pixelsPerHour = PIXELS_PER_HOUR,
  isOutsourced = false,
  subcolumnLayout,
  onPick,
  isPicked = false,
  onInfoClick,
}: TileProps) {
  const { setupMinutes, runMinutes } = task.duration;
  const originalTotalMinutes = setupMinutes + runMinutes;

  // Ref for the draggable element
  const tileRef = useRef<HTMLDivElement>(null);

  // Local state for isDragging (replaces useDraggable's isDragging)
  const [isDragging, setIsDragging] = useState(false);

  // v0.3.63: Context menu state
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

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
  const totalHeight = minutesToPixels(spanMinutes, pixelsPerHour);

  // Calculate setup/run heights proportionally based on original duration ratio
  // This maintains visual distinction even when tile is stretched
  const setupRatio = originalTotalMinutes > 0 ? setupMinutes / originalTotalMinutes : 0;
  const setupHeight = totalHeight * setupRatio;
  const runHeight = totalHeight * (1 - setupRatio);

  // Get color classes
  const colorClasses = getJobColorClasses(job.color);

  // v0.3.63: Content visibility thresholds (in pixels)
  // These determine what content to show based on tile height
  const SHOW_FULL_CONTENT_THRESHOLD = 32; // Show checkbox + full text
  const SHOW_MINIMAL_CONTENT_THRESHOLD = 16; // Show truncated text only
  const SHOW_BAR_ONLY_THRESHOLD = 8; // Show colored bar only

  // Determine content visibility level
  const showFullContent = totalHeight >= SHOW_FULL_CONTENT_THRESHOLD;
  const showMinimalContent = totalHeight >= SHOW_MINIMAL_CONTENT_THRESHOLD && !showFullContent;
  const showBarOnly = totalHeight < SHOW_MINIMAL_CONTENT_THRESHOLD;
  const needsTooltip = !showFullContent; // Tooltip needed when content is truncated

  // Completion state
  const isCompleted = assignment.isCompleted;

  // Muting state: tile is muted during drag if it belongs to a different job
  // REQ-01: Also mute when a job is selected (not just during drag)
  const isMutedByDrag = activeJobId !== undefined && activeJobId !== job.id;
  const isMutedBySelection = selectedJobId !== undefined && selectedJobId !== job.id;
  const isMuted = isMutedByDrag || isMutedBySelection;

  // During any drag operation, make tiles non-interactive so drops can pass through
  // to the StationColumn droppable underneath (enables dropping onto existing tiles)
  const isDragActive = activeJobId !== undefined;

  // Completed gradient style
  const completedGradient = isCompleted
    ? 'linear-gradient(to right, rgba(34,197,94,0.6) 0%, rgba(34,197,94,0.2) 50%, transparent 100%)'
    : undefined;

  // v0.3.57: Handle click - pick for placement (if not completed and onPick provided)
  // Falls back to select if onPick not provided
  const handleClick = () => {
    // Don't pick if completed
    if (isCompleted) {
      onSelect?.(job.id);
      return;
    }
    // If pick is available, use it; otherwise fallback to select
    if (onPick) {
      onPick(assignment.id, task, job);
    } else {
      onSelect?.(job.id);
    }
  };

  // Handle double click (recall)
  const handleDoubleClick = () => {
    onRecall?.(assignment.id);
  };

  // v0.3.63: Handle context menu (right-click)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  // v0.3.63: Handle view details (from context menu)
  const handleViewDetails = () => {
    if (onInfoClick) {
      onInfoClick(job.id);
    } else {
      onSelect?.(job.id);
    }
  };

  // v0.3.63: Handle toggle complete (from context menu, without event)
  const handleToggleCompleteFromMenu = () => {
    onToggleComplete?.(assignment.id);
  };

  // Handle swap
  const handleSwapUp = () => {
    onSwapUp?.(assignment.id);
  };

  const handleSwapDown = () => {
    onSwapDown?.(assignment.id);
  };

  // Handle completion toggle (v0.3.33)
  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger job selection
    onToggleComplete?.(assignment.id);
  };

  // Determine if we have setup time to show
  const hasSetup = setupMinutes > 0;

  // REQ-12: Conflict glow (amber) overrides selection glow (job color)
  // Selected state styling - glow effect using job color at 60% opacity
  const getGlowStyle = () => {
    if (hasConflict) {
      // Amber glow for conflict tiles (overrides selection glow)
      return { boxShadow: '0 0 12px 4px #F59E0B99' }; // amber-500 at ~60% opacity
    }
    if (isSelected) {
      // Job color glow for selected tiles
      return { boxShadow: `0 0 12px 4px ${job.color}99` }; // 99 hex = ~60% opacity
    }
    return undefined;
  };
  const glowStyle = getGlowStyle();

  // Muting style: desaturate and reduce opacity for other jobs during drag or selection
  // REQ-06: Keep tiles clickable when muted by selection - only disable pointer events during active drag
  // Disable pointer events during drag so drops pass through to StationColumn
  // But NOT for the tile being dragged itself (it needs to remain the drag source)
  const getMutingStyle = () => {
    // During active drag: disable pointer events on non-dragging tiles (for drop-through)
    if (isDragActive && !isDragging) {
      // If muted, also apply visual muting
      if (isMuted) return { filter: 'saturate(0.2)', opacity: 0.6, pointerEvents: 'none' as const };
      return { pointerEvents: 'none' as const };
    }
    // When just muted by selection (not during drag): visual muting only, keep clickable
    if (isMuted) return { filter: 'saturate(0.2)', opacity: 0.6 };
    return undefined;
  };
  const mutingStyle = getMutingStyle();

  // REQ-19: Subcolumn layout for outsourced tiles
  const getSubcolumnStyle = (): React.CSSProperties => {
    if (!subcolumnLayout) return {};
    return {
      left: `${subcolumnLayout.leftPercent}%`,
      width: `${subcolumnLayout.widthPercent}%`,
    };
  };
  const subcolumnStyle = getSubcolumnStyle();

  // REQ-19: Outsourced tile styling
  const outsourcedBorderClass = isOutsourced ? 'border-2 border-dashed' : 'border-l-4';
  // v0.3.57: Cursor grab for pickable tiles (non-completed, non-outsourced)
  const isPickable = !isOutsourced && !isCompleted && onPick;
  const cursorClass = isOutsourced ? 'cursor-default' : isPickable ? 'cursor-grab' : 'cursor-default';

  // Ghost placeholder shown at original position when tile is being dragged or picked
  if (isDragging) {
    return (
      <div
        ref={tileRef}
        className="absolute left-0 right-0 border-2 border-dashed border-zinc-600 bg-zinc-800/30 rounded pointer-events-none"
        style={{ top: `${top}px`, height: `${totalHeight}px`, ...subcolumnStyle }}
        data-testid={`tile-ghost-${assignment.id}`}
      />
    );
  }

  // v0.3.57: Show ghost placeholder when picked (similar to drag)
  if (isPicked) {
    return (
      <div
        className="absolute left-0 right-0 border-2 border-dashed border-zinc-500 bg-zinc-700/40 rounded pointer-events-none animate-pulse-opacity"
        style={{ top: `${top}px`, height: `${totalHeight}px`, ...subcolumnStyle }}
        data-testid={`tile-picked-${assignment.id}`}
      />
    );
  }

  // v0.3.63: Wrap with tooltip for small tiles
  const tileContent = (
    <div
      ref={isOutsourced ? undefined : tileRef}
      className={`absolute text-sm ${outsourcedBorderClass} ${colorClasses.border} group ${cursorClass} touch-none select-none transition-[filter,opacity,box-shadow] duration-150 ease-out`}
      style={{
        top: `${top}px`,
        height: `${totalHeight}px`,
        ...glowStyle,
        ...mutingStyle,
        // Apply subcolumn layout for outsourced tiles, or full width for station tiles
        ...(subcolumnLayout ? subcolumnStyle : { left: 0, right: 0 }),
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      data-testid={`tile-${assignment.id}`}
      data-scheduled-start={assignment.scheduledStart}
      data-scheduled-end={assignment.scheduledEnd}
      data-task-id={task.id}
      data-station-id={task.stationId}
      data-has-conflict={hasConflict ? 'true' : undefined}
      data-is-outsourced={isOutsourced ? 'true' : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick();
      }}
    >
      {/* Similarity indicators (shown at top of tile, overlapping junction with previous tile) */}
      {similarityResults && similarityResults.length > 0 && !showBarOnly && (
        <SimilarityIndicators results={similarityResults} />
      )}

      {/* v0.3.63: Content rendering based on tile height */}
      {showBarOnly ? (
        /* Very small tile: colored bar only (setup + run as single block) */
        <div
          className={`absolute inset-0 ${colorClasses.runBg}`}
          style={{ backgroundImage: completedGradient }}
          data-testid="tile-bar-only"
        />
      ) : (
        /* Normal rendering with optional content based on height */
        <>
          {/* Setup section (if has setup time) */}
          {hasSetup && (
            <div
              className={`absolute left-0 right-0 ${colorClasses.setupBg} border-b ${colorClasses.setupBorder} ${showFullContent ? 'pt-0.5 px-2' : ''}`}
              style={{
                top: 0,
                height: `${setupHeight}px`,
                backgroundImage: completedGradient,
              }}
              data-testid="tile-setup-section"
            >
              {/* Full content: checkbox + reference + client */}
              {showFullContent && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-1 -m-1 shrink-0 cursor-pointer"
                    onClick={handleToggleComplete}
                    data-testid={isCompleted ? 'tile-completed-icon' : 'tile-incomplete-icon'}
                  >
                    {isCompleted ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500 hover:text-emerald-400 transition-colors" />
                    ) : (
                      <Square className="w-5 h-5 text-zinc-500 hover:text-zinc-300 transition-colors" />
                    )}
                  </button>
                  <span
                    className={`${colorClasses.text} font-medium truncate min-w-0`}
                    data-testid="tile-content"
                  >
                    {job.reference} · {job.client}
                  </span>
                </div>
              )}
              {/* Minimal content: reference only, no checkbox */}
              {showMinimalContent && (
                <div className="px-1 pt-0.5 overflow-hidden">
                  <span
                    className={`${colorClasses.text} text-xs font-medium truncate block`}
                    data-testid="tile-content-minimal"
                  >
                    {job.reference}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Run section */}
          <div
            className={`absolute left-0 right-0 ${colorClasses.runBg} ${!hasSetup && showFullContent ? 'pt-0.5 px-2' : ''}`}
            style={{
              top: hasSetup ? `${setupHeight}px` : 0,
              height: hasSetup ? `${runHeight}px` : `${totalHeight}px`,
              backgroundImage: completedGradient,
            }}
            data-testid="tile-run-section"
          >
            {/* Content only if no setup section */}
            {!hasSetup && showFullContent && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-1 -m-1 shrink-0 cursor-pointer"
                  onClick={handleToggleComplete}
                  data-testid={isCompleted ? 'tile-completed-icon' : 'tile-incomplete-icon'}
                >
                  {isCompleted ? (
                    <CheckSquare className="w-5 h-5 text-emerald-500 hover:text-emerald-400 transition-colors" />
                  ) : (
                    <Square className="w-5 h-5 text-zinc-500 hover:text-zinc-300 transition-colors" />
                  )}
                </button>
                <span
                  className={`${colorClasses.text} font-medium truncate min-w-0`}
                  data-testid="tile-content"
                >
                  {job.reference} · {job.client}
                </span>
              </div>
            )}
            {/* Minimal content: reference only, no checkbox */}
            {!hasSetup && showMinimalContent && (
              <div className="px-1 pt-0.5 overflow-hidden">
                <span
                  className={`${colorClasses.text} text-xs font-medium truncate block`}
                  data-testid="tile-content-minimal"
                >
                  {job.reference}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* v0.3.63: Context menu (replaces swap buttons and view button) */}
      {contextMenuPosition && (
        <TileContextMenu
          position={contextMenuPosition}
          onClose={() => setContextMenuPosition(null)}
          onViewDetails={handleViewDetails}
          onToggleComplete={handleToggleCompleteFromMenu}
          onMoveUp={handleSwapUp}
          onMoveDown={handleSwapDown}
          isCompleted={isCompleted}
          showMoveUp={showSwapUp}
          showMoveDown={showSwapDown}
        />
      )}
    </div>
  );

  // v0.3.63: Wrap with tooltip when content is truncated
  return (
    <TileTooltip
      job={job}
      task={task}
      assignment={assignment}
      enabled={needsTooltip}
    >
      {tileContent}
    </TileTooltip>
  );
}, (prevProps, nextProps) => {
  // v0.3.46: Custom comparison to prevent unnecessary re-renders
  // For selectedJobId/activeJobId, compare the computed mute state, not raw values
  const prevMutedBySelection = prevProps.selectedJobId !== undefined && prevProps.selectedJobId !== prevProps.job.id;
  const nextMutedBySelection = nextProps.selectedJobId !== undefined && nextProps.selectedJobId !== nextProps.job.id;
  const prevMutedByDrag = prevProps.activeJobId !== undefined && prevProps.activeJobId !== prevProps.job.id;
  const nextMutedByDrag = nextProps.activeJobId !== undefined && nextProps.activeJobId !== nextProps.job.id;

  // Check if mute state changed
  if (prevMutedBySelection !== nextMutedBySelection) return false;
  if (prevMutedByDrag !== nextMutedByDrag) return false;

  // Compare other props normally (shallow comparison)
  if (prevProps.assignment !== nextProps.assignment) return false;
  if (prevProps.task !== nextProps.task) return false;
  if (prevProps.job !== nextProps.job) return false;
  if (prevProps.top !== nextProps.top) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.showSwapUp !== nextProps.showSwapUp) return false;
  if (prevProps.showSwapDown !== nextProps.showSwapDown) return false;
  if (prevProps.hasConflict !== nextProps.hasConflict) return false;
  if (prevProps.pixelsPerHour !== nextProps.pixelsPerHour) return false;
  if (prevProps.isOutsourced !== nextProps.isOutsourced) return false;
  if (prevProps.similarityResults !== nextProps.similarityResults) return false;
  if (prevProps.subcolumnLayout !== nextProps.subcolumnLayout) return false;

  // v0.3.57: Check pick-related props
  if (prevProps.isPicked !== nextProps.isPicked) return false;

  // Callbacks - compare by reference
  if (prevProps.onSelect !== nextProps.onSelect) return false;
  if (prevProps.onRecall !== nextProps.onRecall) return false;
  if (prevProps.onSwapUp !== nextProps.onSwapUp) return false;
  if (prevProps.onSwapDown !== nextProps.onSwapDown) return false;
  if (prevProps.onToggleComplete !== nextProps.onToggleComplete) return false;
  if (prevProps.onPick !== nextProps.onPick) return false;
  if (prevProps.onInfoClick !== nextProps.onInfoClick) return false;

  return true; // Props are equal, skip re-render
});
