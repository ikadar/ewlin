import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Circle, CircleCheck } from 'lucide-react';
import type { TaskAssignment, Job, InternalTask } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { SwapButtons } from './SwapButtons';
import { SimilarityIndicators } from './SimilarityIndicators';
import { PrerequisiteTooltip } from './PrerequisiteTooltip';
import { getJobColorClasses } from './colorUtils';
import type { SimilarityResult } from './similarityUtils';
import type { SubcolumnLayout } from '../../utils/subcolumnLayout';
import type { PrerequisiteBlockingInfo } from '../../utils';

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
  /** v0.3.57: Whether this tile is currently picked (shows placeholder) */
  isPicked?: boolean;
  /** v0.3.57: Callback when tile is clicked to pick for reschedule */
  onPickFromGrid?: (task: InternalTask, job: Job, assignmentId: string) => void;
  /** v0.3.57: Whether picking is active (for muting other tiles) */
  isPickingActive?: boolean;
  /** v0.3.58: Callback when tile is right-clicked (context menu) */
  onContextMenu?: (x: number, y: number, assignmentId: string, isCompleted: boolean) => void;
  /** v0.4.32b: Whether this element is blocked due to missing prerequisites */
  isBlocked?: boolean;
  /** v0.4.32b: Prerequisite blocking info for tooltip display */
  blockingInfo?: PrerequisiteBlockingInfo;
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
  selectedJobId,
  hasConflict = false,
  onToggleComplete,
  pixelsPerHour = PIXELS_PER_HOUR,
  isOutsourced = false,
  subcolumnLayout,
  isPicked = false,
  onPickFromGrid,
  isPickingActive = false,
  onContextMenu,
  isBlocked = false,
  blockingInfo,
}: TileProps) {
  // v0.4.32b: Tooltip visibility state with 2-second hover delay
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // v0.4.32b: Handle mouse enter - start 2s timer for tooltip
  const handleMouseEnter = useCallback(() => {
    if (isBlocked && blockingInfo) {
      hoverTimeoutRef.current = setTimeout(() => {
        setShowTooltip(true);
      }, 2000);
    }
  }, [isBlocked, blockingInfo]);

  // v0.4.32b: Handle mouse leave - cancel timer and hide tooltip
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowTooltip(false);
  }, []);
  const { setupMinutes, runMinutes } = task.duration;
  const originalTotalMinutes = setupMinutes + runMinutes;

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

  // Completion state
  const isCompleted = assignment.isCompleted;

  // Muting state: tile is muted when a job is selected (REQ-01)
  const isMutedBySelection = selectedJobId !== undefined && selectedJobId !== job.id;
  const isMuted = isMutedBySelection;

  // Completed gradient style
  const completedGradient = isCompleted
    ? 'linear-gradient(to right, rgba(34,197,94,0.6) 0%, rgba(34,197,94,0.2) 50%, transparent 100%)'
    : undefined;

  // Handle click - v0.3.57: Pick for reschedule or select job
  const handleClick = () => {
    // If picking is active, this tile might be the target for placement (handled by StationColumn)
    // Don't start a new pick from a tile while picking is active
    if (isPickingActive) return;

    // If not completed and not outsourced, pick for reschedule
    if (!isCompleted && !isOutsourced && onPickFromGrid) {
      onPickFromGrid(task, job, assignment.id);
      return;
    }

    // Otherwise just select the job
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

  // Handle completion toggle (v0.3.33)
  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger job selection
    onToggleComplete?.(assignment.id);
  };

  // Handle right-click context menu (v0.3.58)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e.clientX, e.clientY, assignment.id, isCompleted);
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

  // Muting style: desaturate and reduce opacity for other jobs during selection
  // v0.3.57: During pick, non-picked tiles remain clickable but placement goes to StationColumn
  const getMutingStyle = () => {
    // v0.3.57: During active pick, disable pointer events on non-picked tiles
    // so clicks pass through to StationColumn for placement
    if (isPickingActive && !isPicked) {
      if (isMuted) return { filter: 'saturate(0.2)', opacity: 0.6, pointerEvents: 'none' as const };
      return { pointerEvents: 'none' as const };
    }
    // When just muted by selection: visual muting only, keep clickable
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
  // v0.4.32b: Blocked tiles show dashed border
  const getBorderClass = () => {
    if (isOutsourced) {
      return 'border-2 border-dashed';
    }
    // Internal tiles: dashed when blocked, solid when ready
    return isBlocked ? 'border-l-4 border-dashed' : 'border-l-4';
  };
  const borderStyleClass = getBorderClass();
  // v0.3.57: Cursor is pointer for pickable tiles (not completed, not outsourced)
  const cursorClass = !isCompleted && !isOutsourced && onPickFromGrid ? 'cursor-pointer' : 'cursor-default';

  // v0.3.57: Pulsating placeholder shown at original position when tile is picked
  if (isPicked) {
    return (
      <div
        className="absolute left-0 right-0 border-2 border-dashed border-zinc-500 bg-zinc-800/30 rounded pointer-events-none animate-pulse-opacity"
        style={{ top: `${top}px`, height: `${totalHeight}px`, ...subcolumnStyle }}
        data-testid={`tile-placeholder-${assignment.id}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`absolute text-sm ${borderStyleClass} ${colorClasses.border} group ${cursorClass} touch-none select-none transition-[filter,opacity,box-shadow] duration-150 ease-out`}
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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid={`tile-${assignment.id}`}
      data-scheduled-start={assignment.scheduledStart}
      data-scheduled-end={assignment.scheduledEnd}
      data-task-id={task.id}
      data-station-id={task.stationId}
      data-has-conflict={hasConflict ? 'true' : undefined}
      data-is-outsourced={isOutsourced ? 'true' : undefined}
      data-is-blocked={isBlocked ? 'true' : undefined}
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
                className="w-4 h-4 text-emerald-500 shrink-0 cursor-pointer hover:text-emerald-400 transition-colors"
                onClick={handleToggleComplete}
                data-testid="tile-completed-icon"
              />
            ) : (
              <Circle
                className="w-4 h-4 text-zinc-600 shrink-0 cursor-pointer hover:text-zinc-400 transition-colors"
                onClick={handleToggleComplete}
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
                className="w-4 h-4 text-emerald-500 shrink-0 cursor-pointer hover:text-emerald-400 transition-colors"
                onClick={handleToggleComplete}
                data-testid="tile-completed-icon"
              />
            ) : (
              <Circle
                className="w-4 h-4 text-zinc-600 shrink-0 cursor-pointer hover:text-zinc-400 transition-colors"
                onClick={handleToggleComplete}
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

      {/* v0.4.32b: Prerequisite tooltip (shown after 2s hover on blocked tiles) */}
      {isBlocked && blockingInfo && (
        <PrerequisiteTooltip
          blockingInfo={blockingInfo}
          isVisible={showTooltip}
        />
      )}
    </div>
  );
}, arePropsEqual);

/**
 * Check if data props changed.
 * Extracted to reduce cognitive complexity.
 */
function haveDataPropsChanged(prev: TileProps, next: TileProps): boolean {
  return (
    prev.assignment !== next.assignment ||
    prev.task !== next.task ||
    prev.job !== next.job ||
    prev.top !== next.top ||
    prev.pixelsPerHour !== next.pixelsPerHour ||
    prev.isOutsourced !== next.isOutsourced ||
    prev.similarityResults !== next.similarityResults ||
    prev.subcolumnLayout !== next.subcolumnLayout
  );
}

/**
 * Check if state props changed.
 * Extracted to reduce cognitive complexity.
 */
function haveStatePropsChanged(prev: TileProps, next: TileProps): boolean {
  return (
    prev.isSelected !== next.isSelected ||
    prev.showSwapUp !== next.showSwapUp ||
    prev.showSwapDown !== next.showSwapDown ||
    prev.hasConflict !== next.hasConflict ||
    prev.isPicked !== next.isPicked ||
    prev.isPickingActive !== next.isPickingActive ||
    prev.isBlocked !== next.isBlocked ||
    prev.blockingInfo !== next.blockingInfo
  );
}

/**
 * Check if callback props changed.
 * Extracted to reduce cognitive complexity.
 */
function haveCallbackPropsChanged(prev: TileProps, next: TileProps): boolean {
  return (
    prev.onSelect !== next.onSelect ||
    prev.onRecall !== next.onRecall ||
    prev.onSwapUp !== next.onSwapUp ||
    prev.onSwapDown !== next.onSwapDown ||
    prev.onToggleComplete !== next.onToggleComplete ||
    prev.onPickFromGrid !== next.onPickFromGrid ||
    prev.onContextMenu !== next.onContextMenu
  );
}

/**
 * Custom comparison function for memo to prevent unnecessary re-renders.
 * v0.3.46: Initial implementation
 * v0.3.57: Updated for pick instead of drag
 * v0.4.32b: Added blocking state
 * v0.4.39: Refactored to reduce cognitive complexity
 */
function arePropsEqual(prevProps: TileProps, nextProps: TileProps): boolean {
  // For selectedJobId, compare the computed mute state, not raw values
  const prevMutedBySelection = prevProps.selectedJobId !== undefined && prevProps.selectedJobId !== prevProps.job.id;
  const nextMutedBySelection = nextProps.selectedJobId !== undefined && nextProps.selectedJobId !== nextProps.job.id;

  if (prevMutedBySelection !== nextMutedBySelection) return false;
  if (haveDataPropsChanged(prevProps, nextProps)) return false;
  if (haveStatePropsChanged(prevProps, nextProps)) return false;
  if (haveCallbackPropsChanged(prevProps, nextProps)) return false;

  return true; // Props are equal, skip re-render
}
