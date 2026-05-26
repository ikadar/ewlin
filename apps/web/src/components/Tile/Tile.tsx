import { memo, useEffect, useRef, useState } from 'react';
import { Pin } from 'lucide-react';
import type { TaskAssignment, Job, InternalTask, Element, SimilarityScore, StationCategory } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { getStateInlineColors, getStateRgb, isCompletedEffective } from './colorUtils';
import type { TileState } from './colorUtils';
import type { SimilarityResult } from './similarityUtils';
import { SimilarityBadge } from './SimilarityBadge';
import { ProgressFill, computeProgressBgGradient, computeProgressBorderImage } from './ProgressFill';
import { computeOptimisticProgress, computeChunkProgress } from './saisieMath';
import type { PrerequisiteBlockingInfo } from '../../utils';
import { useHoverCrosslink } from '../../hooks';
import { useNow } from '../../contexts/NowContext';
import { useScenarioModeOrNull } from '../../contexts/ScenarioContext';
import { SAW_AMPLITUDE, TILE_BORDER_WIDTH_PX, buildSawtoothSvgPath, buildCssClipPath, computeTeethCount } from './sawtooth';
import type { CalageGeometry } from '../../utils/stationTileData';

export interface TileProps {
  /** Task assignment data */
  assignment: TaskAssignment;
  /** Task data (internal task with duration) */
  task: InternalTask;
  /** Job data */
  job: Job;
  /** Y position in pixels (top) */
  top: number;
  /** Pixel height. Owner-supplied so this stays agnostic of the parent
   *  coordinate system (collapse-aware on the station grid, linear in the
   *  lens / focus view). */
  height: number;
  /** Callback when tile is clicked (select job) */
  onSelect?: (jobId: string) => void;
  /** Whether this tile's job is selected */
  isSelected?: boolean;
  /** Similarity comparison results with previous tile (if any) */
  similarityResults?: SimilarityResult[];
  /** Practicity score vs previous tile on this station (Phase 2). */
  similarityScore?: SimilarityScore;
  /** Station category — drives SimilarityBadge's dynamic reachable-level count. */
  category?: StationCategory;
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
  /**
   * Pre-computed Produit-mode label. Appends the element name after the
   * client for multi-element jobs (e.g. "JOB-123 · ACME · CAH1"); falls back
   * to `{reference} · {client}` when the cache isn't supplying it (tests,
   * older callsites).
   */
  produitLabel?: string;
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
  /**
   * Pre-computed calage overlays (initial setup + recalages) already in
   * tile-local collapse-aware pixel space. Supplied by the station grid;
   * when absent the tile falls back to a linear `setupMinutes` projection
   * for callers that don't yet produce collapse-aware geometries
   * (focus view, tests).
   */
  calageGeometries?: readonly CalageGeometry[];
  /** Whether this tile falls inside the safety zone boundary (derived). */
  inSafetyZone?: boolean;
  /** Whether the user has explicitly released this tile from the freeze. */
  isFrozenOverridden?: boolean;
  /** Callback when the Sky snowflake is clicked. Receives (jobId, sequenceIndex, stationId). */
  onToggleFrozenOverride?: (jobId: string, sequenceIndex: number, stationId: string) => void;
  /** Flat index of this task within its job (0-based, stable across JCF rebuilds). */
  sequenceIndex?: number;
  /** Human-readable station/machine label, surfaced in the saisie modal. */
  stationName?: string;
  /**
   * When this tile is one chunk of an `activeWindows`-split assignment, the
   * caller passes the chunk's own time bounds here. The fond-vert + late
   * detection then run against this window instead of the assignment
   * envelope so each chunk shows its own wallclock progress (past chunks
   * fully green, future chunks blank, the active chunk partially filled).
   * Undefined for normal continuous tiles — the assignment envelope is used.
   */
  windowStart?: string;
  windowEnd?: string;
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
  height,
  onSelect,
  isSelected = false,
  hasConflict = false,
  onTogglePin,
  pixelsPerHour = PIXELS_PER_HOUR,
  onContextMenu,
  isBlocked = false,
  blockingInfo,
  element,
  displayMode,
  tirageLabel,
  produitLabel,
  tileState = 'default',
  operatorNames,
  overrideLeft,
  overrideWidth,
  overrideOpacity,
  sawtoothTop = false,
  sawtoothBottom = false,
  similarityScore,
  category,
  calageGeometries,
  inSafetyZone = false,
  isFrozenOverridden = false,
  onToggleFrozenOverride,
  sequenceIndex,
  stationName,
  windowStart,
  windowEnd,
}: TileProps) {
  const crosslink = useHoverCrosslink(task.id);
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) crosslink.onDoubleClick?.(e);
  };
  const setupMinutes = assignment?.setupInherited ? 0 : task.duration.setupMinutes;
  const hasSetup = setupMinutes > 0;

  const now = useNow();
  // Optimistic, clock-derived green/completion is a Prod-only concept
  // (silence = consent). In Préprod a tile is a hypothesis ; its avancement
  // must come only from a real wall saisie. No provider (isolation tests) =>
  // Prod-equivalent default. Cf. computeOptimisticProgress / isCompletedEffective.
  const optimisticAllowed = useScenarioModeOrNull()?.mode !== 'preprod';

  // Total height comes from the caller — collapse-aware on the station grid,
  // linear in the lens / focus view. The parent owns the coordinate system;
  // Tile only paints.
  const totalHeight = height;

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

  // No-news = good-news auto-completion : a tile whose scheduledEnd is past
  // `now` reads as completed regardless of the explicit `isCompleted` flag.
  // For chunk tiles, a chunk is considered effectively completed once its
  // OWN window has ended — otherwise a future chunk of a partly-past
  // assignment would also flip to completed-green.
  const completionEndIso = windowEnd ?? assignment.scheduledEnd;
  const baseEffectivelyCompleted = isCompletedEffective(
    assignment.isCompleted,
    completionEndIso,
    now.getTime(),
    optimisticAllowed,
  );

  // Compute progress BEFORE effectiveTileState so saisie-driven completion
  // (extrapolation reaches 100 % before scheduledEnd) also flips the tile
  // to completed-green rather than falling into the blue gap between
  // "gradient off (pct >= 100)" and "state still default".
  const rawProgress = baseEffectivelyCompleted
    ? null
    : windowStart && windowEnd
      ? computeChunkProgress(windowStart, windowEnd, now.getTime(), optimisticAllowed)
      : computeOptimisticProgress(
          assignment.scheduledStart,
          assignment.scheduledEnd,
          setupMinutes,
          task.duration.runMinutes ?? 0,
          assignment.recordedProgressPct ?? task.recordedProgressPct,
          assignment.recordedAt ?? task.recordedAt,
          now.getTime(),
          optimisticAllowed,
        );
  const progressCompleted = rawProgress !== null && rawProgress.pct >= 100;

  const effectiveTileState =
    tileState !== 'shipped' && tileState !== 'completed' && (baseEffectivelyCompleted || progressCompleted)
      ? ('completed' as TileState)
      : tileState;

  const inlineColors = getStateInlineColors(effectiveTileState);
  const stateRgb = getStateRgb(effectiveTileState);

  const isCompleted = effectiveTileState === 'completed' || effectiveTileState === 'shipped';
  const progress = isCompleted ? null : rawProgress;

  const showGradient = progress !== null
    && (progress.pct > 0 || progress.isLate)
    && progress.pct < 100;
  const bodyBg = showGradient && progress
    ? computeProgressBgGradient(progress.pct, progress.isLate, 'vertical', inlineColors.bg)
    : undefined;
  const bodyBorderImage = showGradient && progress
    ? computeProgressBorderImage(progress.pct, progress.isLate, 'vertical', inlineColors.border)
    : undefined;

  const completedRgb = getStateRgb('completed');
  const completedInline = getStateInlineColors('completed');
  const progressAwareRgb = showGradient ? completedRgb : stateRgb;
  const lateRgb = getStateRgb('late');
  const bottomTeethRgb = showGradient
    ? (progress?.isLate ? lateRgb : completedRgb)
    : stateRgb;
  const labelTextColor = showGradient ? completedInline.text : inlineColors.text;

  // Handle click — select this job
  const handleClick = () => {
    onSelect?.(job.id);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin?.(assignment.id);
  };

  // Safety zone: frozen = in zone AND user hasn't overridden. Manual pin
  // takes precedence neither visually nor in logic — the engine treats both
  // uniformly (Option A: pin implicite). We keep both widgets displayed side
  // by side so override intent stays addressable independently of the pin.
  const isSafetyFrozen = inSafetyZone && !isFrozenOverridden;
  const handleToggleFrozen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sequenceIndex === undefined) return;
    onToggleFrozenOverride?.(job.id, sequenceIndex, task.stationId);
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
  const safetyZoneClass = isSafetyFrozen
    ? 'safety-zone-frozen'
    : inSafetyZone && isFrozenOverridden
      ? 'safety-zone-overridden'
      : '';

  return (
    <div
      ref={rootRef}
      className={`absolute text-sm group cursor-pointer touch-none select-none transition-[filter,opacity,box-shadow] duration-150 ease-out ${safetyZoneClass}`}
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
      onDoubleClick={handleDoubleClick}
      data-job-id={job.id}
      data-testid={`tile-${assignment.id}`}
      data-scheduled-start={assignment.scheduledStart}
      data-scheduled-end={assignment.scheduledEnd}
      data-task-id={task.id}
      data-flux-task-id={task.id}
      data-station-id={task.stationId}
      data-has-conflict={hasConflict ? 'true' : undefined}
      data-is-blocked={isBlocked ? 'true' : undefined}
      data-tile-state={effectiveTileState}
      data-pinned={assignment.isPinned ? 'true' : 'false'}
      data-safety-frozen={isSafetyFrozen ? 'true' : undefined}
      data-safety-overridden={inSafetyZone && isFrozenOverridden ? 'true' : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick();
      }}
    >
      {similarityScore && category && <SimilarityBadge score={similarityScore} category={category} />}
      {/* Clipped body wrapper. The clip-path is applied here (not on the root)
          so that the folder-tab and other overflow-outside children (label
          overlay, tooltip) are not clipped away on tiles with teeth. The
          left border lives inside the wrapper so it follows the tooth shape. */}
      <div
        className={`absolute inset-0 ${borderStyleClass}`}
        style={{
          clipPath,
          borderLeftWidth: `${TILE_BORDER_WIDTH_PX}px`,
          borderLeftStyle: 'solid',
          borderLeftColor: showGradient ? undefined : inlineColors.border,
          borderImage: showGradient ? bodyBorderImage : undefined,
          background: showGradient ? bodyBg : inlineColors.bg,
        }}
      >
        {/* Calage overlays (initial setup + post-peremption recalages).
            The station grid supplies collapse-aware geometries precomputed
            via `timeToYPosition`, so recalages whose linear minute offset
            would overflow past a collapse (e.g. a 13 h lunch-time
            recalage on an overnight tile) stay clamped inside the tile's
            rendered bounds instead of bleeding into the neighbour below.
            When no geometries are supplied (focus view, tests), fall back
            to the previous linear `setupMinutes` projection so those
            callsites keep working. No fill : the overlay carries only
            the dotted/dashed border-bottom (cf. index.css) so the parent
            gradient shows through — past calage thus reads as done (vert)
            in alignment with `now()`, future calage stays on the base bg. */}
        {calageGeometries && calageGeometries.length > 0 && !assignment?.setupInherited ? (
          calageGeometries.map((geom, idx) => (
            <div
              key={geom.kind === 'setup' ? 'setup' : `recalage-${idx}`}
              className="absolute left-0 right-0"
              style={{ top: `${geom.top}px`, height: `${geom.height}px` }}
              data-testid={geom.kind === 'setup' ? 'tile-setup-section' : 'tile-recalage-section'}
            />
          ))
        ) : (
          hasSetup && (
            <div
              className="absolute left-0 right-0"
              style={{
                top: 0,
                height: `${setupHeight}px`,
              }}
              data-testid="tile-setup-section"
            />
          )
        )}

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
                stroke={`rgb(${progressAwareRgb.border})`}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {sawtoothBottom && (
              <path
                d={buildSawtoothSvgPath(100, renderHeight, 'bottom', teethCount)}
                fill="none"
                stroke={`rgb(${bottomTeethRgb.border})`}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}

        {/* Optimistic fond-vert marker (Q4-Q7 of 2026-05-04 mindmap).
            The visual is painted by the body wrapper above via inline
            `background: linear-gradient(...)` + `borderImage` ; this
            sentinel only carries data attributes for tests + dev tools. */}
        {showGradient && progress && (
          <ProgressFill pct={progress.pct} isLate={progress.isLate} direction="vertical" />
        )}
      </div>

      {/* Label overlay — mirrors TileSegment's content layout so the station
          and operator planning views render identical tiles. Pin is always
          visible; color swap (amber ↔ zinc) communicates the pinned state. */}
      <div
        className="absolute left-0 right-0 z-10 px-2 overflow-hidden pointer-events-none"
        style={{ top: `${extTop + 2}px`, bottom: `${extBottom + 2}px` }}
      >
        <div
          className="text-[11px] font-medium leading-tight truncate"
          style={{ color: labelTextColor }}
          data-testid="tile-content"
        >
          {onTogglePin && (
            <span
              onClick={handleTogglePin}
              className={`pin-toggle p-1 -m-1 rounded shrink-0 cursor-pointer inline-flex items-center align-middle mr-1 pointer-events-auto transition-colors hover:bg-white/5 ${
                assignment.isPinned
                  ? 'text-amber-500 hover:text-amber-400'
                  : 'text-zinc-700 hover:text-zinc-400'
              }`}
              title={assignment.isPinned ? 'Désépingler' : 'Épingler'}
            >
              <Pin className="w-3 h-3 shrink-0" />
            </span>
          )}
          {inSafetyZone && (
            <span
              onClick={handleToggleFrozen}
              className={`snowflake-icon p-1 -m-1 rounded shrink-0 cursor-pointer inline-flex items-center align-middle mr-1 pointer-events-auto transition-colors hover:bg-white/5 ${
                isFrozenOverridden
                  ? 'text-zinc-700 hover:text-zinc-400 opacity-60'
                  : 'text-sky-400 hover:text-sky-300'
              }`}
              aria-label={
                isFrozenOverridden
                  ? 'Override actif — clic pour restaurer le freeze auto'
                  : 'Frozen par safety zone — clic pour libérer'
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                data-testid="tile-safety-flocon"
                className="w-3 h-3 shrink-0"
              >
                <path d="M12 2c.5 0 .9.4.9.9v3.3l2.3-2.3c.4-.4 1-.4 1.3 0 .4.4.4 1 0 1.3L12.9 8.9V11h2.2l3.6-3.6c.4-.4 1-.4 1.3 0 .4.4.4 1 0 1.3L17.7 11H21c.5 0 .9.4.9.9s-.4.9-.9.9h-3.3l2.3 2.3c.4.4.4 1 0 1.3-.4.4-1 .4-1.3 0L15.1 13h-2.2v2.2l3.6 3.6c.4.4.4 1 0 1.3-.4.4-1 .4-1.3 0l-2.3-2.3V21c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-3.2l-2.3 2.3c-.4.4-1 .4-1.3 0-.4-.4-.4-1 0-1.3l3.6-3.6V13H9l-3.6 3.6c-.4.4-1 .4-1.3 0-.4-.4-.4-1 0-1.3L6.3 13H3c-.5 0-.9-.4-.9-.9s.4-.9.9-.9h3.3L4 8.9c-.4-.4-.4-1 0-1.3.4-.4 1-.4 1.3 0L9 11h2.1V8.8L7.4 5.2c-.4-.4-.4-1 0-1.3.4-.4 1-.4 1.3 0l2.3 2.3V2.9c0-.5.4-.9.9-.9z" />
              </svg>
            </span>
          )}
          {displayMode === 'tirage' && tirageLabel
            ? tirageLabel
            : produitLabel ?? `${job.reference} · ${job.client}`}
        </div>
      </div>

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
    prev.height !== next.height ||
    prev.pixelsPerHour !== next.pixelsPerHour
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
    prev.produitLabel !== next.produitLabel ||
    prev.tileState !== next.tileState ||
    prev.operatorNames !== next.operatorNames ||
    prev.sawtoothTop !== next.sawtoothTop ||
    prev.sawtoothBottom !== next.sawtoothBottom ||
    prev.inSafetyZone !== next.inSafetyZone ||
    prev.isFrozenOverridden !== next.isFrozenOverridden ||
    prev.sequenceIndex !== next.sequenceIndex
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
    prev.onContextMenu !== next.onContextMenu ||
    prev.onToggleFrozenOverride !== next.onToggleFrozenOverride
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
