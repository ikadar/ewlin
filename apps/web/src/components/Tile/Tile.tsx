import { memo } from 'react';
import { Circle, CircleCheck, Scissors, Pin } from 'lucide-react';
import type { TaskAssignment, Job, InternalTask, Element } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { SimilarityIndicators } from './SimilarityIndicators';
import { TileTooltip } from './TileTooltip';
import { getStateColorClasses, getStateRgb } from './colorUtils';
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
  /** Whether this tile's job is selected */
  isSelected?: boolean;
  /** Similarity comparison results with previous tile (if any) */
  similarityResults?: SimilarityResult[];
  /** Whether this tile has a conflict (precedence violation - REQ-12) */
  hasConflict?: boolean;
  /** Callback when completion icon is clicked */
  onToggleComplete?: (assignmentId: string) => void;
  /** Callback when pin icon is clicked */
  onTogglePin?: (assignmentId: string) => void;
  /** Pixels per hour for height calculation (default: 80) */
  pixelsPerHour?: number;
  /** v0.3.58: Callback when tile is right-clicked (context menu) */
  onContextMenu?: (x: number, y: number, assignmentId: string, isCompleted: boolean, isPinned: boolean) => void;
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
  /** Comma-separated operator names assigned to this tile */
  operatorNames?: string;
  /** Operator attention value for bottom-right badge (operator view) */
  operatorAttention?: number;
  /** Override left/right/width for side-by-side masked time layout */
  overrideLeft?: string;
  overrideWidth?: string;
  overrideOpacity?: number;
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
  isSelected = false,
  similarityResults,
  hasConflict = false,
  onToggleComplete,
  onTogglePin,
  pixelsPerHour = PIXELS_PER_HOUR,
  onContextMenu,
  isBlocked = false,
  blockingInfo,
  element,
  displayMode,
  tirageLabel,
  tileState = 'default',
  operatorNames,
  operatorAttention,
  overrideLeft,
  overrideWidth,
  overrideOpacity,
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
  const stateRgb = getStateRgb(tileState);

  // Completion state
  const isCompleted = assignment.isCompleted;

  // Handle click — select this job
  const handleClick = () => {
    onSelect?.(job.id);
  };

  // Handle completion toggle (v0.3.33)
  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete?.(assignment.id);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin?.(assignment.id);
  };

  // Handle right-click context menu (v0.3.58)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e.clientX, e.clientY, assignment.id, isCompleted, assignment.isPinned);
  };

  // Determine if we have setup time to show
  const hasSetup = setupMinutes > 0;

  // Selection outline is handled by CSS selector on [data-job-id] (instant, no re-render needed)

  // v0.4.32b: Blocked tiles show dashed border
  const borderStyleClass = isBlocked ? 'border-l-4 border-dashed' : 'border-l-4';

  // Cursor: grab for selected pickable tiles, pointer for all others
  return (
    <div
      className={`absolute text-sm ${borderStyleClass} ${colorClasses.border} group cursor-pointer touch-none select-none transition-[filter,opacity,box-shadow] duration-150 ease-out`}
      style={{
        top: `${top}px`,
        height: `${totalHeight}px`,
        left: overrideLeft ?? 0,
        width: overrideWidth ?? undefined,
        right: overrideWidth ? undefined : 0,
        opacity: overrideOpacity ?? undefined,
        // State color tokens consumed by the folder tab and any future
        // state-aware decorations. Set as CSS custom properties so child
        // layers don't need to know the palette.
        ['--tile-rgb' as string]: stateRgb.tile,
        ['--tile-border-rgb' as string]: stateRgb.border,
        ['--tile-text-rgb' as string]: stateRgb.text,
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
      data-pinned={assignment.isPinned ? 'true' : 'false'}
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

      {/* Folder tab (hover-only): completion + pin actions. Out of the
          label overlay so the tile body stays clean by default. */}
      <div className="folder-tab">
        <button
          onClick={handleToggleComplete}
          title={isCompleted ? 'Marquer non complété' : 'Marquer complété'}
          data-testid="tile-tab-complete"
        >
          {isCompleted ? (
            <CircleCheck className="w-4 h-4 text-emerald-400" />
          ) : (
            <Circle className="w-4 h-4" style={{ color: `rgb(${stateRgb.text})` }} />
          )}
        </button>
        <button
          onClick={handleTogglePin}
          title={assignment.isPinned ? 'Désépingler' : 'Épingler'}
          data-testid="tile-tab-pin"
        >
          <Pin
            className="w-3 h-3"
            style={{ color: assignment.isPinned ? '#f59e0b' : `rgb(${stateRgb.text})` }}
          />
        </button>
      </div>

      {/* Label overlay spanning both sections */}
      <div className="absolute inset-0 z-10 pt-0.5 px-2 pointer-events-none overflow-hidden">
        <div className="flex items-start gap-2">
          <span className="inline-check">
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
          </span>
          <span className="inline-pin">
            <Pin
              className={`w-3 h-3 shrink-0 pointer-events-auto cursor-pointer transition-colors ${
                assignment.isPinned
                  ? 'text-amber-500 hover:text-amber-400'
                  : 'text-zinc-700 hover:text-zinc-400'
              }`}
              onClick={handleTogglePin}
            />
          </span>
          <span
            className={`${colorClasses.text} font-medium break-words min-w-0 leading-tight`}
            data-testid="tile-content"
          >
            {displayMode === 'tirage' && tirageLabel ? tirageLabel : `${job.reference} · ${job.client}`}
          </span>
          {task.splitGroupId && (
            <>
              <Scissors className="w-3 h-3 text-blue-500/40 shrink-0" />
              <span className="text-[9px] text-blue-500 bg-blue-500/[0.15] rounded px-1.5 py-px font-semibold">
                {(task.splitIndex ?? 0) + 1}/{task.splitTotal ?? 1}
              </span>
            </>
          )}
        </div>
        {operatorNames && (
          <div className="text-[9px] text-zinc-400 truncate mt-0.5 leading-tight">
            {operatorNames}
          </div>
        )}
      </div>

      {/* Attention badge (bottom-right, operator view) */}
      {operatorAttention !== undefined && (
        <div className="absolute bottom-1 right-1 z-10 text-[8px] font-semibold text-zinc-200 bg-zinc-800 border border-zinc-600 rounded-sm px-1.5 py-px leading-tight pointer-events-none">
          {operatorAttention}
        </div>
      )}

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
    prev.hasConflict !== next.hasConflict ||
    prev.isBlocked !== next.isBlocked ||
    prev.blockingInfo !== next.blockingInfo ||
    prev.displayMode !== next.displayMode ||
    prev.tirageLabel !== next.tirageLabel ||
    prev.tileState !== next.tileState ||
    prev.operatorNames !== next.operatorNames
  );
}

/**
 * Check if callback props changed.
 * Extracted to reduce cognitive complexity.
 */
function haveCallbackPropsChanged(prev: TileProps, next: TileProps): boolean {
  return (
    prev.onSelect !== next.onSelect ||
    prev.onToggleComplete !== next.onToggleComplete ||
    prev.onTogglePin !== next.onTogglePin ||
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
