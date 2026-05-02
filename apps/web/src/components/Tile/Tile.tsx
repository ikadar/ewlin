import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pin } from 'lucide-react';
import { SaisieIndicator } from './SaisieIndicator';
import { ProgressCaptureModal } from '../ProgressCaptureModal/ProgressCaptureModal';
import type { TaskAssignment, Job, InternalTask, Element, SimilarityScore, StationCategory } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';
import { getStateColorClasses, getStateRgb } from './colorUtils';
import type { TileState } from './colorUtils';
import type { SimilarityResult } from './similarityUtils';
import { SimilarityBadge } from './SimilarityBadge';
import type { PrerequisiteBlockingInfo } from '../../utils';
import { useHoverCrosslink } from '../../hooks';
import { useNow } from '../../hooks/useNow';
import { useProgressTriggers } from '../../hooks/useProgressTriggers';
import { useReportSaisieMutation } from '../../store';
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
  /**
   * V2 — Display name of the machine for the saisie modal header.
   * Falls back to `task.stationId` if not provided. The parent (StationGrid)
   * is best placed to look it up since it has the station registry handy.
   */
  machineName?: string;
  /**
   * V2 — % of the job already delivered by previous fragments. Read from
   * `assignment.cumulativePositionPct` by default ; this prop overrides
   * for tests / playgrounds. Falls back to 0 when neither is set.
   */
  cumulBeforeSlotPct?: number;
  /**
   * V2 — % of the job that this slot delivers. Read from
   * `assignment.slotVolumePct` by default ; this prop overrides for
   * tests / playgrounds. Falls back to 100 when neither is set.
   */
  slotVolumePct?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Time helpers — V2 progress capture (used for the saisie modal). Local to
// Tile because they're tightly coupled to the assignment's scheduledStart/End.
// ─────────────────────────────────────────────────────────────────────────────

function isoToMinFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function applyMinToDate(baseIso: string, minutesFromMidnight: number): string {
  const base = new Date(baseIso);
  const result = new Date(base);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutesFromMidnight);
  return result.toISOString();
}

/**
 * Volume already delivered by this slot at `now`, in job-percentage units.
 * Calage-aware: only the run portion contributes (cf. project_calage_run_ratio).
 */
function computeExpectedAtNowPct(
  scheduledStart: string,
  scheduledEnd: string,
  setupMin: number,
  runMin: number,
  nowMs: number,
  slotVolumePct: number,
): number {
  const startMs = new Date(scheduledStart).getTime();
  const setupEndMs = startMs + setupMin * 60_000;
  if (nowMs <= setupEndMs) return 0;
  const endMs = new Date(scheduledEnd).getTime();
  if (nowMs >= endMs) return slotVolumePct;
  if (runMin === 0) return slotVolumePct;
  const runElapsedMin = (nowMs - setupEndMs) / 60_000;
  return Math.min(slotVolumePct, (runElapsedMin / runMin) * slotVolumePct);
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
  machineName,
  cumulBeforeSlotPct: cumulBeforeSlotPctProp,
  slotVolumePct: slotVolumePctProp,
}: TileProps) {
  // V2 progress capture — prefer the snapshot-derived value (computed by
  // SnapshotBuilder from the parent job's run-volume distribution). Props
  // remain available so tests / playgrounds can pin specific values.
  const cumulBeforeSlotPct = cumulBeforeSlotPctProp
    ?? assignment.cumulativePositionPct
    ?? 0;
  const slotVolumePct = slotVolumePctProp
    ?? assignment.slotVolumePct
    ?? 100;
  const crosslink = useHoverCrosslink(task.id);
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) crosslink.onDoubleClick?.(e);
  };
  const { setupMinutes } = task.duration;
  const hasSetup = setupMinutes > 0;

  // ────────────────────────────────────────────────────────────────────────
  // Progress-capture wiring. useNow ticks every 60 s ; useProgressTriggers
  // is a memoized derivation.
  // ────────────────────────────────────────────────────────────────────────
  const [pmIsOpen, setPmIsOpen] = useState(false);
  const now = useNow(60_000);
  const singleAssignmentArr = useMemo(() => [assignment], [assignment]);
  const triggers = useProgressTriggers(singleAssignmentArr, now);
  const saisieState = triggers[assignment.taskId] ?? 'inactive';
  const [reportSaisie] = useReportSaisieMutation();

  const handleSaisieSave = async (estimatedEndMin: number) => {
    const iso = applyMinToDate(assignment.scheduledStart, estimatedEndMin);
    await reportSaisie({ taskId: assignment.taskId, estimatedEndTime: iso }).unwrap();
  };

  const slotStartMin = isoToMinFromMidnight(assignment.scheduledStart);
  const slotEndMin = isoToMinFromMidnight(assignment.scheduledEnd);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const expectedAtNowPct = computeExpectedAtNowPct(
    assignment.scheduledStart,
    assignment.scheduledEnd,
    setupMinutes,
    task.duration.runMinutes ?? 0,
    now.getTime(),
    slotVolumePct,
  );

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
  const effectiveTileState =
    tileState !== 'shipped' &&
    tileState !== 'completed' &&
    new Date(assignment.scheduledEnd).getTime() < now.getTime()
      ? ('completed' as TileState)
      : tileState;

  // Get state-based color classes
  const colorClasses = getStateColorClasses(effectiveTileState);
  const stateRgb = getStateRgb(effectiveTileState);

  // Completion is the modal-driven, derived state. The explicit
  // `assignment.isCompleted` flag still feeds `tileState` upstream.
  const isCompleted = effectiveTileState === 'completed' || effectiveTileState === 'shipped';

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
        className={`absolute inset-0 ${borderStyleClass} ${colorClasses.border} ${colorClasses.runBg}`}
        style={{ clipPath, borderLeftWidth: `${TILE_BORDER_WIDTH_PX}px` }}
      >
        {/* Calage overlays (initial setup + post-peremption recalages).
            The station grid supplies collapse-aware geometries precomputed
            via `timeToYPosition`, so recalages whose linear minute offset
            would overflow past a collapse (e.g. a 13 h lunch-time
            recalage on an overnight tile) stay clamped inside the tile's
            rendered bounds instead of bleeding into the neighbour below.
            When no geometries are supplied (focus view, tests), fall back
            to the previous linear `setupMinutes` projection so those
            callsites keep working. */}
        {calageGeometries && calageGeometries.length > 0 ? (
          calageGeometries.map((geom, idx) => (
            <div
              key={geom.kind === 'setup' ? 'setup' : `recalage-${idx}`}
              className={`absolute left-0 right-0 ${colorClasses.runBg}`}
              style={{ top: `${geom.top}px`, height: `${geom.height}px` }}
              data-testid={geom.kind === 'setup' ? 'tile-setup-section' : 'tile-recalage-section'}
            />
          ))
        ) : (
          hasSetup && (
            <div
              className={`absolute left-0 right-0 ${colorClasses.runBg}`}
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

      {/* Label overlay — mirrors TileSegment's content layout so the station
          and operator planning views render identical tiles. Pin is always
          visible; color swap (amber ↔ zinc) communicates the pinned state. */}
      <div
        className="absolute left-0 right-0 z-10 px-2 overflow-hidden pointer-events-none"
        style={{ top: `${extTop + 2}px`, bottom: `${extBottom + 2}px` }}
      >
        <div
          className={`${colorClasses.text} text-[11px] font-medium leading-tight truncate`}
          data-testid="tile-content"
        >
          {assignment.taskId && (
            <SaisieIndicator
              state={saisieState}
              onClick={() => setPmIsOpen(true)}
            />
          )}
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
        {operatorNames && (
          <div className="text-[9px] text-zinc-400 truncate leading-tight mt-0.5">
            {operatorNames}
          </div>
        )}
      </div>

      {/* Progress-capture modal — opens from the SaisieIndicator click. */}
      <ProgressCaptureModal
        isOpen={pmIsOpen}
        onClose={() => setPmIsOpen(false)}
        onSave={handleSaisieSave}
        job={{ reference: job.reference, client: job.client }}
        machineName={machineName ?? task.stationId}
        slotStartMin={slotStartMin}
        slotEndMin={slotEndMin}
        cumulBeforeSlotPct={cumulBeforeSlotPct}
        slotVolumePct={slotVolumePct}
        expectedAtNowPct={expectedAtNowPct}
        nowMin={nowMin}
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
