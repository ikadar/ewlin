import { memo } from 'react';
import { Circle, CircleCheck } from 'lucide-react';
import type { TaskAssignment, Job, InternalTask, Element } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { SwapButtons } from './SwapButtons';
import { SimilarityIndicators } from './SimilarityIndicators';
import { TileTooltip } from './TileTooltip';
import { getStateColorClasses } from './colorUtils';
import type { TileState } from './colorUtils';
import type { SimilarityResult } from './similarityUtils';
import type { PrerequisiteBlockingInfo } from '../../utils';
import { useTooltipDelay } from '../../hooks';

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
  /** Whether this tile has a conflict (precedence violation - REQ-12) */
  hasConflict?: boolean;
  /** Callback when completion icon is clicked */
  onToggleComplete?: (assignmentId: string) => void;
  /** Pixels per hour for height calculation (default: 80) */
  pixelsPerHour?: number;
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
  /** Fázis D: Element data for rich tooltip */
  element?: Element;
  /** Current display mode ('produit' or 'tirage') */
  displayMode?: 'produit' | 'tirage';
  /** Pre-computed Tirage label string (full label including prefix). Empty → Produit fallback. */
  tirageLabel?: string;
  /** State-based tile color */
  tileState?: TileState;
}

/**
 * Calculate height in pixels from duration in minutes.
 */
function minutesToPixels(minutes: number, pixelsPerHour: number = PIXELS_PER_HOUR): number {
  return (minutes / 60) * pixelsPerHour;
}

/**
 * Tile - Visual representation of a scheduled task assignment.
 * Shows state-based color, setup/run sections, completion status, and swap buttons.
 * Draggable within its station column for repositioning.
 * v0.3.46: Memoized to prevent unnecessary re-renders during drag.
 */
export const Tile = memo(function Tile({
  assignment,
  task,
  job,
  top,
  onSelect,
  onSwapUp,
  onSwapDown,
  showSwapUp = true,
  showSwapDown = true,
  isSelected = false,
  similarityResults,
  hasConflict = false,
  onToggleComplete,
  pixelsPerHour = PIXELS_PER_HOUR,
  isPicked = false,
  onPickFromGrid,
  isPickingActive = false,
  onContextMenu,
  isBlocked = false,
  blockingInfo,
  element,
  displayMode,
  tirageLabel,
  tileState = 'default',
}: TileProps) {
  // Unified tooltip delay (500ms show, 0ms hide)
  const { isVisible: showTooltip, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave } = useTooltipDelay();
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

  // Get state-based color classes
  const colorClasses = getStateColorClasses(tileState);

  // Completion state
  const isCompleted = assignment.isCompleted;

  // Handle click - "Select Then Act": click to select, click selected tile to pick
  const handleClick = () => {
    if (isPickingActive) return;

    if (isSelected && !isCompleted && onPickFromGrid) {
      // Already-selected job's tile → pick for repositioning
      onPickFromGrid(task, job, assignment.id);
    } else {
      // Select (or switch to) this job
      onSelect?.(job.id);
    }
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

  // Selection outline is handled by CSS selector on [data-job-id] (instant, no re-render needed)

  // During pick mode, disable pointer events on non-picked tiles
  const pickStyle = isPickingActive && !isPicked
    ? { pointerEvents: 'none' as const }
    : undefined;

  // v0.4.32b: Blocked tiles show dashed border
  const borderStyleClass = isBlocked ? 'border-l-4 border-dashed' : 'border-l-4';

  // Cursor: grab for selected pickable tiles, pointer for all others
  const cursorClass = isSelected && !isCompleted && onPickFromGrid
    ? 'cursor-grab'
    : 'cursor-pointer';

  // v0.3.57: Pulsating placeholder shown at original position when tile is picked
  if (isPicked) {
    return (
      <div
        className="absolute left-0 right-0 border-2 border-dashed border-zinc-500 bg-zinc-800/30 rounded pointer-events-none animate-pulse-opacity"
        style={{ top: `${top}px`, height: `${totalHeight}px` }}
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
        left: 0,
        right: 0,
        ...pickStyle,
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-job-id={job.id}
      data-testid={`tile-${assignment.id}`}
      data-scheduled-start={assignment.scheduledStart}
      data-scheduled-end={assignment.scheduledEnd}
      data-task-id={task.id}
      data-station-id={task.stationId}
      data-has-conflict={hasConflict ? 'true' : undefined}
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

      {/* Setup section (if has setup time) - background only */}
      {hasSetup && (
        <div
          className={`absolute left-0 right-0 ${colorClasses.setupBg} border-b ${colorClasses.setupBorder}`}
          style={{
            top: 0,
            height: `${setupHeight}px`,
          }}
          data-testid="tile-setup-section"
        />
      )}

      {/* Run section - background only */}
      <div
        className={`absolute left-0 right-0 ${colorClasses.runBg}`}
        style={{
          top: hasSetup ? `${setupHeight}px` : 0,
          height: hasSetup ? `${runHeight}px` : `${totalHeight}px`,
        }}
        data-testid="tile-run-section"
      />

      {/* Label overlay spanning both sections */}
      <div className="absolute inset-0 z-10 pt-0.5 px-2 pointer-events-none overflow-hidden">
        <div className="flex items-start gap-2">
          {isCompleted ? (
            <CircleCheck
              className="w-4 h-4 text-emerald-500 shrink-0 pointer-events-auto cursor-pointer hover:text-emerald-400 transition-colors"
              onClick={handleToggleComplete}
              data-testid="tile-completed-icon"
            />
          ) : (
            <Circle
              className="w-4 h-4 text-zinc-600 shrink-0 pointer-events-auto cursor-pointer hover:text-zinc-400 transition-colors"
              onClick={handleToggleComplete}
              data-testid="tile-incomplete-icon"
            />
          )}
          <span
            className={`${colorClasses.text} font-medium break-words min-w-0 leading-tight`}
            data-testid="tile-content"
          >
            {displayMode === 'tirage' && tirageLabel ? tirageLabel : `${job.reference} · ${job.client}`}
          </span>
        </div>
      </div>

      {/* Swap buttons (visible on hover) */}
      <SwapButtons
        onSwapUp={handleSwapUp}
        onSwapDown={handleSwapDown}
        showUp={showSwapUp}
        showDown={showSwapDown}
      />

      {/* Fázis D: Rich tooltip (shown after 500ms hover on all tiles) */}
      <TileTooltip
        isVisible={showTooltip}
        job={job}
        element={element}
        task={task}
        assignment={assignment}
        blockingInfo={blockingInfo}
        isBlocked={isBlocked}
      />
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
    prev.element !== next.element ||
    prev.top !== next.top ||
    prev.pixelsPerHour !== next.pixelsPerHour ||
    prev.similarityResults !== next.similarityResults
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
    prev.blockingInfo !== next.blockingInfo ||
    prev.displayMode !== next.displayMode ||
    prev.tirageLabel !== next.tirageLabel ||
    prev.tileState !== next.tileState
  );
}

/**
 * Check if callback props changed.
 * Extracted to reduce cognitive complexity.
 */
function haveCallbackPropsChanged(prev: TileProps, next: TileProps): boolean {
  return (
    prev.onSelect !== next.onSelect ||
    prev.onSwapUp !== next.onSwapUp ||
    prev.onSwapDown !== next.onSwapDown ||
    prev.onToggleComplete !== next.onToggleComplete ||
    prev.onPickFromGrid !== next.onPickFromGrid ||
    prev.onContextMenu !== next.onContextMenu
  );
}

/**
 * Custom comparison function for memo to prevent unnecessary re-renders.
 */
function arePropsEqual(prevProps: TileProps, nextProps: TileProps): boolean {
  if (haveDataPropsChanged(prevProps, nextProps)) return false;
  if (haveStatePropsChanged(prevProps, nextProps)) return false;
  if (haveCallbackPropsChanged(prevProps, nextProps)) return false;

  return true; // Props are equal, skip re-render
}
