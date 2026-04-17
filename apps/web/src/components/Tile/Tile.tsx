import { memo, useEffect, useRef, useState } from 'react';
import { Scissors, Pin } from 'lucide-react';
import type { TaskAssignment, Job, InternalTask, Element } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { SimilarityIndicators } from './SimilarityIndicators';
import { TileTooltip } from './TileTooltip';
import { getStateColorClasses, getStateRgb } from './colorUtils';
import type { TileState } from './colorUtils';
import type { SimilarityResult } from './similarityUtils';
import type { PrerequisiteBlockingInfo } from '../../utils';
import { useTooltipDelay } from '../../hooks';
import { SAW_AMPLITUDE, TILE_BORDER_WIDTH_PX, buildSawtoothSvgPath, buildCssClipPath, computeTeethCount } from './sawtooth';

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
  /** Callback when pin icon is clicked (inline state indicator when pinned) */
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
  /** Override left/right/width for side-by-side masked time layout */
  overrideLeft?: string;
  overrideWidth?: string;
  overrideOpacity?: number;
  /** Task interruption indicator — another assignment of the same task exists earlier */
  sawtoothTop?: boolean;
  /** Task interruption indicator — another assignment of the same task exists later */
  sawtoothBottom?: boolean;
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
  overrideLeft,
  overrideWidth,
  overrideOpacity,
  sawtoothTop = false,
  sawtoothBottom = false,
}: TileProps) {
  // Unified tooltip delay (500ms show, 0ms hide)
  const { isVisible: showTooltip, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave } = useTooltipDelay();
  const { setupMinutes } = task.duration;
  const hasSetup = setupMinutes > 0;

  // Calculate total height from scheduled time span (downtime-aware)
  // This reflects actual time on grid, including stretching across non-operating periods
  const startTime = new Date(assignment.scheduledStart);
  const endTime = new Date(assignment.scheduledEnd);
  const spanMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  const totalHeight = minutesToPixels(spanMinutes, pixelsPerHour);

  // Setup height = real wall-clock duration, projected from scheduledStart.
  // Matches TileSegment's calage-overlay model on the operator view so both
  // planning views render the calage zone at its real temporal size.
  const setupHeight = hasSetup ? minutesToPixels(setupMinutes, pixelsPerHour) : 0;

  // Task interruption teeth — rendered INWARD so adjacent tiles never overlap
  // visually. The rendered box matches the tile's time span exactly; the
  // clip-path carves the teeth out of the body, and content is offset by
  // extTop/extBottom to stay clear of the tooth zone.
  const extTop = sawtoothTop ? SAW_AMPLITUDE : 0;
  const extBottom = sawtoothBottom ? SAW_AMPLITUDE : 0;
  const renderHeight = totalHeight;
  const hasSaw = sawtoothTop || sawtoothBottom;

  // Measure the rendered pixel width so the teeth count adapts to it:
  // each tooth keeps a roughly constant px size instead of stretching.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  useEffect(() => {
    if (!hasSaw) return;
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setMeasuredWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasSaw]);
  const teethCount = computeTeethCount(measuredWidth);
  const clipPath = buildCssClipPath(renderHeight, sawtoothTop, sawtoothBottom, teethCount);

  // Get state-based color classes
  const colorClasses = getStateColorClasses(tileState);
  const stateRgb = getStateRgb(tileState);

  // Completion state
  const isCompleted = assignment.isCompleted;

  // Handle click — select this job
  const handleClick = () => {
    onSelect?.(job.id);
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

  // Selection outline is handled by CSS selector on [data-job-id] (instant, no re-render needed)

  // v0.4.32b: Blocked tiles show dashed border. Border width is driven by
  // TILE_BORDER_WIDTH_PX (inline style below) so it stays identical to
  // TileSegment's left-border div on the operator view.
  const borderStyleClass = isBlocked ? 'border-dashed' : '';

  // Cursor: grab for selected pickable tiles, pointer for all others
  return (
    <div
      ref={rootRef}
      className={`absolute text-sm group cursor-pointer touch-none select-none transition-[filter,opacity,box-shadow] duration-150 ease-out`}
      style={{
        // 1px inset top + bottom (when no sawtooth) to expose the separation
        // between consecutive tiles — matches the operator view's TileSegment.
        top: `${top + (sawtoothTop ? 0 : 1)}px`,
        height: `${renderHeight - (sawtoothTop ? 0 : 1) - (sawtoothBottom ? 0 : 1)}px`,
        left: overrideLeft ?? 0,
        width: overrideWidth ?? undefined,
        right: overrideWidth ? undefined : 0,
        opacity: overrideOpacity ?? undefined,
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

      {/* Clipped body wrapper. The clip-path is applied here (not on the root)
          so that the folder-tab and other overflow-outside children (label
          overlay, tooltip) are not clipped away on tiles with teeth. The
          left border lives inside the wrapper so it follows the tooth shape. */}
      <div
        className={`absolute inset-0 ${borderStyleClass} ${colorClasses.border} ${colorClasses.runBg}`}
        style={{ clipPath, borderLeftWidth: `${TILE_BORDER_WIDTH_PX}px` }}
      >
        {/* Setup overlay (if has setup time). Same background as the tile —
            only the CSS border from data-testid="tile-setup-section" (dotted
            black) marks the calage zone. Mirrors TileSegment's overlay model. */}
        {hasSetup && (
          <div
            className="absolute left-0 right-0"
            style={{
              top: 0,
              height: `${setupHeight}px`,
            }}
            data-testid="tile-setup-section"
          />
        )}

        {/* Re-calage overlays (post-peremption setup reruns reported by the
            engine). Same background as the tile — styled via
            data-testid="tile-recalage-section" in index.css (dashed red
            border-bottom) to flag the zone as a re-calage. */}
        {(assignment.recalages ?? []).map((rc, idx) => {
          const rcStartMs = new Date(rc.start).getTime();
          const rcEndMs = new Date(rc.end).getTime();
          const offsetMinutes = (rcStartMs - startTime.getTime()) / 60000;
          const durationMinutes = (rcEndMs - rcStartMs) / 60000;
          if (durationMinutes <= 0) return null;
          const rcTop = minutesToPixels(offsetMinutes, pixelsPerHour);
          const rcHeight = minutesToPixels(durationMinutes, pixelsPerHour);
          return (
            <div
              key={`recalage-${idx}`}
              className="absolute left-0 right-0"
              style={{ top: `${rcTop}px`, height: `${rcHeight}px` }}
              data-testid="tile-recalage-section"
            />
          );
        })}

        {/* Sawtooth stroke lines for interrupted tiles */}
        {hasSaw && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height={renderHeight}
            viewBox={`0 0 100 ${renderHeight}`}
            preserveAspectRatio="none"
          >
            {sawtoothTop && (
              <path
                d={buildSawtoothSvgPath(100, 0, 'top', teethCount)}
                fill="none"
                stroke={`rgb(${stateRgb.border})`}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {sawtoothBottom && (
              <path
                d={buildSawtoothSvgPath(100, renderHeight, 'bottom', teethCount)}
                fill="none"
                stroke={`rgb(${stateRgb.border})`}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}
      </div>

      {/* Label overlay spanning both sections */}
      <div
        className="absolute left-0 right-0 z-10 pt-0.5 px-2 pointer-events-none overflow-hidden"
        style={{ top: `${extTop}px`, bottom: `${extBottom}px` }}
      >
        <div className="flex items-start gap-2">
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
    prev.operatorNames !== next.operatorNames ||
    prev.sawtoothTop !== next.sawtoothTop ||
    prev.sawtoothBottom !== next.sawtoothBottom
  );
}

/**
 * Check if callback props changed.
 * Extracted to reduce cognitive complexity.
 */
function haveCallbackPropsChanged(prev: TileProps, next: TileProps): boolean {
  return (
    prev.onSelect !== next.onSelect ||
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
