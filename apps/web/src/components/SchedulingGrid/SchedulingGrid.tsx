import type { Station, Job, TaskAssignment, Task, StationCategory, ScheduleConflict, StationGroup, Element, Operator } from '@flux/types';
import type { DryingTimeInfo, OutsourcingTimeInfo } from '../../utils';
import { getDeadlineDate, DIE_CUTTING_CATEGORY_ID, DIE_CUTTING_KEYWORDS, isInternalTask } from '@flux/types';
import { TimelineColumn, PIXELS_PER_HOUR } from '../TimelineColumn';
import { StationHeader, type GroupCapacityInfo } from '../StationHeaders/StationHeader';
import { StationColumn } from '../StationColumns/StationColumn';
import { Tile } from '../Tile';
import { useEffect, useState, useMemo, useRef, useImperativeHandle, forwardRef, type MouseEvent as ReactMouseEvent } from 'react';
import { timeToYPosition } from '../TimelineColumn';
import { buildGroupCapacityMap } from '../../utils/groupCapacity';
import { useVirtualScroll, isAssignmentVisible } from '../../hooks';
import { isElementBlocked, getPrerequisiteBlockingInfo } from '../../utils';
import { computeTileDataCache, type CachedTileData, type ElementBlockingInfo } from '../../utils/stationTileData';
import { TimelineLens, useTimelineLens, LENS_PIXELS_PER_HOUR } from '../TimelineLens';
import {
  computeStationUnavailabilitySegments,
  computeStationOvertimeSegments,
} from '../TimelineLens/unavailability';
import { COLLAPSED_BAND_PX, type Collapse } from './collapseConfig';
import { CollapseBand } from './CollapseBand';
import { yPositionToTime } from '../DragPreview/snapUtils';
import { SafetyBand } from '../SafetyBand';
import { makeSafetyKey, isInSafetyZone } from '../../utils/safetyZone';

/** Handle for programmatic grid scrolling */
export interface SchedulingGridHandle {
  /** Scroll to a specific Y position (preserves X) */
  scrollToY: (y: number, behavior?: ScrollBehavior) => void;
  /** Scroll by a delta amount */
  scrollByY: (deltaY: number, behavior?: ScrollBehavior) => void;
  /** Get current scroll position */
  getScrollY: () => number;
  /** Get viewport height */
  getViewportHeight: () => number;
  /** Scroll to a specific X position (preserves Y) */
  scrollToX: (x: number, behavior?: ScrollBehavior) => void;
  /** Get current horizontal scroll position */
  getScrollX: () => number;
  /** Get viewport width */
  getViewportWidth: () => number;
  /** Scroll to both X and Y positions at once */
  scrollTo: (x: number, y: number, behavior?: ScrollBehavior) => void;
  /** Get total scrollable width */
  getScrollWidth: () => number;
  /** Get total scrollable height */
  getScrollHeight: () => number;
}

export interface SchedulingGridProps {
  /** Stations to display */
  stations: Station[];
  /** Station categories (for similarity criteria lookup) */
  categories?: StationCategory[];
  /** All jobs (for looking up job data by ID) */
  jobs?: Job[];
  /** All elements (for task-to-job lookup) */
  elements?: Element[];
  /** All tasks (for looking up task data) */
  tasks?: Task[];
  /** Task assignments to display as tiles */
  assignments?: TaskAssignment[];
  /** Currently selected job ID */
  selectedJobId?: string | null;
  /** Starting hour of the grid (default: 6) */
  startHour?: number;
  /** Number of hours to display (default: 24) */
  hoursToDisplay?: number;
  /** Start date for multi-day grid (REQ-14) */
  startDate?: Date;
  /** Pixels per hour for grid scaling (default: 80) */
  pixelsPerHour?: number;
  /** Callback when a tile is clicked (select job) */
  onSelectJob?: (jobId: string) => void;
  /** Callback when clicking the grid background (deselect) */
  onDeselect?: () => void;
  /** Callback when pin icon is clicked (inline state indicator when pinned) */
  onTogglePin?: (assignmentId: string) => void;
  /** Schedule conflicts for conflict visualization (REQ-12) */
  conflicts?: ScheduleConflict[];
  /** Station groups for capacity visualization (REQ-18) */
  groups?: StationGroup[];
  /** REQ-09.2: Callback when grid scrolls (for DateStrip + Minimap sync) */
  onScroll?: (scrollTop: number, scrollLeft: number) => void;
  /** v0.3.46: Total number of days for virtual scrolling (default: 365) */
  totalDays?: number;
  /** v0.3.46: Number of buffer days to render around focused day (default: 3) */
  bufferDays?: number;
  /** v0.3.58: Callback when tile is right-clicked (context menu) */
  onContextMenu?: (x: number, y: number, assignmentId: string, isCompleted: boolean, isPinned: boolean) => void;
  /** Current display mode (Produit or Tirage) — affects column widths */
  displayMode?: 'produit' | 'tirage';
  /** Set of job IDs that are late (for state-based tile coloring) */
  lateJobIds?: Set<string>;
  /** Set of job IDs that are shipped (highest priority tile coloring) */
  shippedJobIds?: Set<string>;
  /** All operators (for operator name display on tiles) */
  operators?: Operator[];
  /** Collapse bands to render across all columns. Computed by parent from operator schedules. */
  collapses?: readonly Collapse[];
  /** Safety zone duration in working hours (display label only). 0 disables the feature. */
  safetyZoneHours?: number;
  /** Server-computed boundary: ISO timestamp at which `safetyZoneHours`
   * of working time has elapsed. Drives band position and flocon check. */
  safetyZoneFrozenUntil?: string | null;
  /** Active safety overrides from the current snapshot. */
  safetyOverrides?: ReadonlyArray<{
    jobId: string;
    sequenceIndex: number;
    stationId: string;
    isOverridden: boolean;
  }>;
  /** Pre-computed (taskId → flat sequenceIndex) map. Provided by parent to stay in sync with backend. */
  sequenceIndexByTaskId?: ReadonlyMap<string, number>;
  /** Callback when user clicks the Sky snowflake on a tile in the safety zone. */
  onToggleFrozenOverride?: (jobId: string, sequenceIndex: number, stationId: string) => void;
}

/**
 * SchedulingGrid - Unified grid component with synchronized scrolling.
 * Contains Timeline, Station Headers, and Station Columns in a single scroll container.
 */
export const SchedulingGrid = forwardRef<SchedulingGridHandle, SchedulingGridProps>(
  function SchedulingGrid(
    {
      stations,
      categories = [],
      jobs = [],
      elements = [],
      tasks = [],
      assignments = [],
      selectedJobId,
      startHour = 6,
      hoursToDisplay = 24,
      startDate,
      pixelsPerHour = PIXELS_PER_HOUR,
      onSelectJob,
      onDeselect,
      onTogglePin,
      conflicts = [],
      groups = [],
      onScroll,
      totalDays = 365,
      bufferDays = 7,
      // v0.3.58: Context menu props
      onContextMenu,
      displayMode,
      lateJobIds,
      shippedJobIds,
      operators,
      collapses,
      safetyZoneHours = 0,
      safetyZoneFrozenUntil = null,
      safetyOverrides,
      sequenceIndexByTaskId,
      onToggleFrozenOverride,
    },
    ref
  ) {
    const [now, setNow] = useState(() => new Date());
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // v0.3.46: Track scroll position and viewport for virtual scrolling
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(600);

    // Stable ref for onScroll so the scroll-listener effect doesn't re-attach
    // every time the parent recreates its callback identity.
    const onScrollRef = useRef(onScroll);
    useEffect(() => {
      onScrollRef.current = onScroll;
    }, [onScroll]);

    // v0.3.46: Calculate day height from pixels per hour
    const dayHeightPx = 24 * pixelsPerHour;

    // Normalize: parent may pass undefined.
    const effectiveCollapses = useMemo<readonly Collapse[]>(() => collapses ?? [], [collapses]);

    // useVirtualScroll thinks linearly. After collapse, scrollTop is compressed,
    // so dividing by linear dayHeightPx yields wrong day indices → overlays + grid
    // lines vanish. Convert via yPositionToTime to a linear-equivalent scrollTop.
    const linearScrollTop = useMemo(() => {
      if (effectiveCollapses.length === 0 || !startDate) return scrollTop;
      const t = yPositionToTime(scrollTop, startHour, startDate, pixelsPerHour, effectiveCollapses);
      return ((t.getTime() - startDate.getTime()) / 3_600_000) * pixelsPerHour;
    }, [scrollTop, effectiveCollapses, startDate, startHour, pixelsPerHour]);

    // v0.3.46: Virtual scroll calculation
    const virtualScroll = useVirtualScroll({
      totalDays,
      bufferDays,
      dayHeightPx,
      scrollTop: linearScrollTop,
      viewportHeight,
    });

    // Expose scroll methods via ref
    useImperativeHandle(ref, () => ({
      scrollToY: (y: number, behavior: ScrollBehavior = 'smooth') => {
        // Preserve current X position when scrolling Y
        const currentX = scrollContainerRef.current?.scrollLeft ?? 0;
        scrollContainerRef.current?.scrollTo({ top: y, left: currentX, behavior });
      },
      scrollByY: (deltaY: number, behavior: ScrollBehavior = 'smooth') => {
        scrollContainerRef.current?.scrollBy({ top: deltaY, behavior });
      },
      getScrollY: () => scrollContainerRef.current?.scrollTop ?? 0,
      getViewportHeight: () => scrollContainerRef.current?.clientHeight ?? 0,
      scrollToX: (x: number, behavior: ScrollBehavior = 'smooth') => {
        // Preserve current Y position when scrolling X
        const currentY = scrollContainerRef.current?.scrollTop ?? 0;
        scrollContainerRef.current?.scrollTo({ left: x, top: currentY, behavior });
      },
      getScrollX: () => scrollContainerRef.current?.scrollLeft ?? 0,
      getViewportWidth: () => scrollContainerRef.current?.clientWidth ?? 0,
      scrollTo: (x: number, y: number, behavior: ScrollBehavior = 'smooth') => {
        scrollContainerRef.current?.scrollTo({ left: x, top: y, behavior });
      },
      getScrollWidth: () => scrollContainerRef.current?.scrollWidth ?? 0,
      getScrollHeight: () => scrollContainerRef.current?.scrollHeight ?? 0,
    }));

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // v0.3.46: Track scroll position and viewport size for virtual scrolling.
  // Also REQ-09.2: Notify parent of scroll position for DateStrip sync.
  // Uses ResizeObserver so internal layout shifts (sidebar toggle, panel
  // open/close) keep viewportHeight in sync — window.resize alone misses those,
  // which could collapse visibleDayRange and hide overlays + grid lines.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const syncViewportHeight = () => {
      const h = container.clientHeight;
      if (h > 0) setViewportHeight(h);
    };

    const handleScroll = () => {
      const newScrollTop = container.scrollTop;
      setScrollTop(newScrollTop);
      onScrollRef.current?.(newScrollTop, container.scrollLeft);
    };

    syncViewportHeight();

    const resizeObserver = new ResizeObserver(syncViewportHeight);
    resizeObserver.observe(container);
    container.addEventListener('scroll', handleScroll, { passive: true });

    // Report initial scroll position
    handleScroll();

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // v0.3.46: Use virtual scroll total height for proper scrollbar sizing.
  // Collapse-aware: each band trades its real height for its kind-specific heightPx.
  const totalHeight = useMemo(() => {
    let h = virtualScroll.totalHeight;
    for (const c of effectiveCollapses) {
      const realPx = c.durationHours * pixelsPerHour;
      h -= (realPx - c.heightPx);
    }
    return h;
  }, [virtualScroll.totalHeight, effectiveCollapses, pixelsPerHour]);

  // Calculate now line position (multi-day aware, collapse-aware)
  const nowPosition = timeToYPosition(now, startHour, pixelsPerHour, startDate, effectiveCollapses);

  // Safety zone: lookup structure for O(1) per-tile override check.
  const overrideLookup = useMemo(() => {
    const m = new Map<string, boolean>();
    (safetyOverrides ?? []).forEach((o) => {
      if (o.isOverridden) m.set(makeSafetyKey(o.jobId, o.sequenceIndex, o.stationId), true);
    });
    return m;
  }, [safetyOverrides]);

  // Safety zone band: end Y is mapped from the server-computed
  // `safetyZoneFrozenUntil` instant via `timeToYPosition`, so the band
  // visually stops exactly where the freeze logic does. Working-hours
  // accumulation already happened server-side; here we only translate
  // the boundary instant into collapse-aware pixels.
  const safetyZonePx = useMemo(() => {
    if (!safetyZoneFrozenUntil) return 0;
    const boundaryDate = new Date(safetyZoneFrozenUntil);
    const boundaryY = timeToYPosition(
      boundaryDate, startHour, pixelsPerHour, startDate, effectiveCollapses,
    );
    return Math.max(0, boundaryY - nowPosition);
  }, [safetyZoneFrozenUntil, startHour, pixelsPerHour, startDate, effectiveCollapses, nowPosition]);

  // Create lookup maps for jobs and tasks
  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    jobs.forEach((job) => map.set(job.id, job));
    return map;
  }, [jobs]);

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, StationCategory>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  // Station IDs for assembly categories (Encarteuses-Piqueuses / Assembleuses-Piqueuses).
  // Used by getTirageLabel → detectBrochureOrLeaflet to distinguish brochure from leaflet.
  const assemblyStationIds = useMemo(() => {
    return new Set(
      stations
        .filter((s) => {
          const cat = categoryMap.get(s.categoryId);
          if (!cat) return false;
          const n = cat.name.toLowerCase();
          return n.includes('encarteuse') || (n.includes('assembleuse') && n.includes('piqueuse'));
        })
        .map((s) => s.id),
    );
  }, [stations, categoryMap]);

  // Step 1a: Element lookup by ID
  const elementMap = useMemo(
    () => new Map(elements.map((e) => [e.id, e])),
    [elements]
  );

  // Step 1b: Elements grouped by job ID
  const elementsByJobId = useMemo(() => {
    const map = new Map<string, Element[]>();
    for (const e of elements) {
      const list = map.get(e.jobId) ?? [];
      list.push(e);
      map.set(e.jobId, list);
    }
    return map;
  }, [elements]);

  // Step 1c: Station lookup + pre-compute blocking info per element
  const stationMap = useMemo(
    () => new Map(stations.map((s) => [s.id, s])),
    [stations]
  );

  const elementBlockingCache = useMemo(() => {
    const cache = new Map<string, ElementBlockingInfo>();
    for (const element of elements) {
      const hasOffset = element.taskIds.some((taskId) => {
        const task = taskMap.get(taskId);
        if (!task || task.type !== 'Internal') return false;
        const station = stationMap.get(task.stationId);
        if (!station) return false;
        return categoryMap.get(station.categoryId)?.name.toLowerCase().includes('offset') ?? false;
      });
      const hasDieCutting = element.taskIds.some((taskId) => {
        const task = taskMap.get(taskId);
        if (!task) return false;
        if (task.type === 'Internal') {
          const station = stationMap.get(task.stationId);
          return station?.categoryId === DIE_CUTTING_CATEGORY_ID;
        }
        if (task.type === 'Outsourced') {
          return DIE_CUTTING_KEYWORDS.some((kw) => task.actionType?.toLowerCase().includes(kw));
        }
        return false;
      });
      const job = jobMap.get(element.jobId);
      const blockOpts = { hasOffset, hasDieCutting, batDeadline: job?.batDeadline };
      cache.set(element.id, {
        hasOffset,
        hasDieCutting,
        blocked: isElementBlocked(element, blockOpts),
        blockingInfo: getPrerequisiteBlockingInfo(element, blockOpts),
      });
    }
    return cache;
  }, [elements, taskMap, stationMap, categoryMap, jobMap]);

  // REQ-18: Calculate group capacity info for each station
  const groupCapacityMap = useMemo((): Map<string, GroupCapacityInfo> => {
    if (groups.length === 0) return new Map();
    return buildGroupCapacityMap(stations, groups, assignments, now);
  }, [stations, groups, assignments, now]);

  // REQ-12 & REQ-18: Calculate set of task IDs with conflicts for visual feedback
  const conflictTaskIds = useMemo(() => {
    const taskIds = new Set<string>();
    conflicts.forEach((conflict) => {
      // REQ-12: Precedence conflicts
      if (conflict.type === 'PrecedenceConflict' && conflict.taskId) {
        taskIds.add(conflict.taskId);
      }
      // REQ-18: Group capacity conflicts
      if (conflict.type === 'GroupCapacityConflict' && conflict.taskId) {
        taskIds.add(conflict.taskId);
      }
      // Availability conflicts (tile on unavailable period)
      if (conflict.type === 'AvailabilityConflict' && conflict.taskId) {
        taskIds.add(conflict.taskId);
      }
    });
    return taskIds;
  }, [conflicts]);

  // v0.3.46: Group assignments by station, filtering to only visible ones
  const assignmentsByStation = useMemo(() => {
    const grouped = new Map<string, TaskAssignment[]>();
    stations.forEach((station) => grouped.set(station.id, []));

    // Calculate grid start date for visibility check
    const gridStart = startDate || new Date();

    assignments.forEach((assignment) => {
      // Skip outsourced assignments - they go to providers, not stations
      if (assignment.isOutsourced) return;

      // v0.3.46: Skip assignments outside visible range
      if (!isAssignmentVisible(
        assignment.scheduledStart,
        assignment.scheduledEnd,
        gridStart,
        virtualScroll.visibleRange
      )) {
        return;
      }

      const stationAssignments = grouped.get(assignment.targetId);
      if (stationAssignments) {
        stationAssignments.push(assignment);
      }
    });

    // Sort assignments within each station by scheduled start time
    grouped.forEach((stationAssignments) => {
      stationAssignments.sort(
        (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
      );
    });

    return grouped;
  }, [assignments, stations, startDate, virtualScroll.visibleRange]);

  // Operator name lookup map (for displaying operator names on tiles)
  const operatorNameMap = useMemo(() => {
    if (!operators || operators.length === 0) return new Map<string, string>();
    return new Map(operators.map(op => [op.id, `${op.firstName} ${op.lastName}`]));
  }, [operators]);

  // Task-level interruption map — true if another assignment of the same task
  // exists before (hasPredecessor) or after (hasSuccessor) this one in time.
  // Used to render sawtooth teeth on station tiles, signaling that the task
  // continues elsewhere and distinguishing interrupted from completed tiles.
  const taskInterruption = useMemo(() => {
    const byTask = new Map<string, { start: number; end: number }[]>();
    for (const a of assignments) {
      if (a.isOutsourced) continue;
      const list = byTask.get(a.taskId) ?? [];
      list.push({
        start: new Date(a.scheduledStart).getTime(),
        end: new Date(a.scheduledEnd).getTime(),
      });
      byTask.set(a.taskId, list);
    }
    const result = new Map<string, { top: boolean; bottom: boolean }>();
    for (const a of assignments) {
      if (a.isOutsourced) continue;
      const peers = byTask.get(a.taskId);
      if (!peers || peers.length <= 1) {
        result.set(a.id, { top: false, bottom: false });
        continue;
      }
      const s = new Date(a.scheduledStart).getTime();
      const e = new Date(a.scheduledEnd).getTime();
      const hasBefore = peers.some(p => p.end <= s + 30000 && p.start < s);
      const hasAfter = peers.some(p => p.start >= e - 30000 && p.end > e);
      result.set(a.id, { top: hasBefore, bottom: hasAfter });
    }
    return result;
  }, [assignments]);

  // Step 1d: Pre-compute per-tile render data (independent of selectedJobId)
  const tileDataCache = useMemo(() => computeTileDataCache({
    assignmentsByStation, taskMap, jobMap, elementMap, elementBlockingCache,
    elementsByJobId, stationMap, categoryMap, assemblyStationIds,
    operatorNameMap, conflictTaskIds, shippedJobIds, lateJobIds,
    startHour, pixelsPerHour, startDate, now,
    collapses: effectiveCollapses,
  }), [assignmentsByStation, taskMap, jobMap, elementMap, elementBlockingCache,
      elementsByJobId, stationMap, categoryMap, assemblyStationIds,
      startHour, pixelsPerHour, startDate, shippedJobIds, lateJobIds,
      conflictTaskIds, now, operatorNameMap, effectiveCollapses]);

  // ── Timeline magnifying lens ────────────────────────────────────────────
  // Hook is view-agnostic; we feed it tile/column info via event delegation
  // on the columns container below.
  const lens = useTimelineLens();
  const lastHoveredTileIdRef = useRef<string | null>(null);

  const lensActiveAssignments = lens.state.activeColumnId
    ? assignmentsByStation.get(lens.state.activeColumnId) ?? []
    : [];

  const lensRange = useMemo(() => {
    if (lensActiveAssignments.length === 0) return { gridStartMs: 0, gridEndMs: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (const a of lensActiveAssignments) {
      const s = new Date(a.scheduledStart).getTime();
      const e = new Date(a.scheduledEnd).getTime();
      if (s < min) min = s;
      if (e > max) max = e;
    }
    const PAD_MS = 60 * 60_000; // 1 hour padding around the tile range
    return { gridStartMs: min - PAD_MS, gridEndMs: max + PAD_MS };
  }, [lensActiveAssignments]);

  // Pre-render the actual <Tile> components at LENS_PIXELS_PER_HOUR so the
  // lens shows visually identical tiles to the main grid, just at a
  // magnified time/pixel ratio.
  const lensTileContent = useMemo(() => {
    if (!lens.state.activeColumnId) return null;
    const originMs = lensRange.gridStartMs;
    const noop = () => { /* interactions disabled inside the lens */ };
    return lensActiveAssignments.flatMap((a) => {
      const cached = tileDataCache.get(a.id);
      if (!cached) return [];
      // Station-view tiles are always backed by internal tasks — outsourced
      // assignments are filtered out earlier in assignmentsByStation.
      if (!isInternalTask(cached.task)) return [];
      const interrupt = taskInterruption.get(a.id);
      // Lens is a linear (non-collapsed) magnified view — heights are the raw
      // wall-clock spans at LENS_PIXELS_PER_HOUR. When activeWindows are
      // present, project each window directly (no collapse math).
      const projectLinear = (start: string, end: string) => {
        const top = ((new Date(start).getTime() - originMs) / 3_600_000) * LENS_PIXELS_PER_HOUR;
        const height = ((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000) * LENS_PIXELS_PER_HOUR;
        return { top, height };
      };
      const segments = a.activeWindows && a.activeWindows.length >= 2
        ? a.activeWindows.map((w, i) => ({ key: `lens-${a.id}-chunk-${i}`, ...projectLinear(w.start, w.end) }))
        : [{ key: `lens-${a.id}`, ...projectLinear(a.scheduledStart, a.scheduledEnd) }];
      return segments.map((seg) => (
        <Tile
          key={seg.key}
          assignment={a}
          task={cached.task}
          job={cached.job}
          element={cached.element}
          top={seg.top}
          height={seg.height}
          isSelected={false}
          similarityResults={cached.similarityResults}
          similarityScore={cached.similarityScore}
          category={cached.category}
          onSelect={noop}
          onTogglePin={noop}
          hasConflict={cached.hasConflict}
          tileState={cached.tileState}
          pixelsPerHour={LENS_PIXELS_PER_HOUR}
          isBlocked={cached.blocked}
          blockingInfo={cached.blockingInfo}
          displayMode={displayMode}
          tirageLabel={cached.tirageLabel}
          produitLabel={cached.produitLabel}
          operatorNames={cached.operatorNames}
          sawtoothTop={interrupt?.top}
          sawtoothBottom={interrupt?.bottom}
          overrideLeft={`40px`}
          overrideWidth={`calc(100% - 44px)`}
        />
      ));
    });
  }, [lens.state.activeColumnId, lensActiveAssignments, tileDataCache, taskInterruption, lensRange.gridStartMs, displayMode]);

  const lensUnavailabilitySegments = useMemo(() => {
    if (!lens.state.activeColumnId) return [];
    const station = stationMap.get(lens.state.activeColumnId);
    if (!station) return [];
    return computeStationUnavailabilitySegments(
      station, lensRange.gridStartMs, lensRange.gridEndMs, operators ?? [],
    );
  }, [lens.state.activeColumnId, stationMap, lensRange.gridStartMs, lensRange.gridEndMs, operators]);

  const lensOvertimeSegments = useMemo(() => {
    if (!lens.state.activeColumnId) return [];
    return computeStationOvertimeSegments(
      operators ?? [], lens.state.activeColumnId, lensRange.gridStartMs, lensRange.gridEndMs,
    );
  }, [lens.state.activeColumnId, operators, lensRange.gridStartMs, lensRange.gridEndMs]);

  // Event delegation: a single mouseover on the columns wrapper covers every
  // tile + every non-tile area (hatched unavailability overlay, hour-grid
  // lines, column background). Both paths reach the lens — tiles via
  // handleTileEnter, the rest via handleDeadZoneEnter.
  const handleColumnsMouseOver = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Match only the tile ROOT — its children (`tile-content`,
    // `tile-setup-section`, `tile-recalage-section`) also start with
    // `tile-` in their testid but lack `data-station-id`. Without this
    // compound selector, `closest` returns the child, the handler bails
    // on missing attrs, and the lens never opens.
    const tileEl = target.closest(
      '[data-testid^="tile-"][data-station-id]',
    ) as HTMLElement | null;

    if (!tileEl) {
      // Dead zone — mark a sentinel so we only arm the timer once per
      // continuous non-tile run.
      if (lastHoveredTileIdRef.current !== '__deadzone__') {
        lastHoveredTileIdRef.current = '__deadzone__';
        lens.handlers.handleDeadZoneEnter();
      }
      return;
    }

    const testId = tileEl.getAttribute('data-testid');
    const assignmentId = testId ? testId.slice('tile-'.length) : null;
    if (!assignmentId || assignmentId === lastHoveredTileIdRef.current) return;
    lastHoveredTileIdRef.current = assignmentId;

    const stationId = tileEl.getAttribute('data-station-id');
    const startStr = tileEl.getAttribute('data-scheduled-start');
    const endStr = tileEl.getAttribute('data-scheduled-end');
    if (!stationId || !startStr || !endStr) return;

    const colEl = tileEl.closest('[data-testid^="station-column-"]') as HTMLElement | null;
    if (!colEl) return;

    const colRect = colEl.getBoundingClientRect();
    const tileRect = tileEl.getBoundingClientRect();
    const startMs = new Date(startStr).getTime();
    const endMs = new Date(endStr).getTime();

    lens.handlers.handleTileEnter({
      columnId: stationId,
      tileMidTimeMs: (startMs + endMs) / 2,
      tileHeightPx: tileRect.height,
      anchor: {
        columnLeft: colRect.left,
        columnRight: colRect.right,
        tileCenterY: tileRect.top + tileRect.height / 2,
      },
    });
  };

  const handleColumnsMouseLeave = () => {
    lastHoveredTileIdRef.current = null;
    lens.handlers.handleStationLeave();
  };

  // Follow-cursor: once the lens is visible, track cursor Y continuously
  // (same column only). The initial open still goes through handleTileEnter,
  // so the lens docks on the tile that triggered it; from there it glides
  // with the cursor instead of snapping tile-to-tile.
  const handleColumnsMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!lens.state.visible) return;
    const target = e.target as HTMLElement;
    const colEl = target.closest('[data-testid^="station-column-"]') as HTMLElement | null;
    if (!colEl) return;
    const testId = colEl.getAttribute('data-testid');
    const stationId = testId ? testId.slice('station-column-'.length) : null;
    if (!stationId || stationId !== lens.state.activeColumnId) return;

    const colRect = colEl.getBoundingClientRect();
    const relativeY = e.clientY - colRect.top;
    // Collapse-aware reverse: lands on band.from if cursor is over a band, so the
    // membership check below catches it before the lens chases an empty time range.
    const cursorTime = yPositionToTime(relativeY, startHour, startDate, pixelsPerHour, effectiveCollapses);
    const cursorMs = cursorTime.getTime();
    const inBand = effectiveCollapses.some(c => cursorMs >= c.from.getTime() && cursorMs < c.to.getTime());
    if (inBand) return;

    lens.handlers.handleColumnMouseMove({
      columnId: stationId,
      centerTimeMs: cursorMs,
      anchor: {
        columnLeft: colRect.left,
        columnRight: colRect.right,
        tileCenterY: e.clientY,
      },
    });
  };

  // Calculate departure marker position (if selected job has workshopExitDate)
  // Multi-day: show marker regardless of day (REQ-15)
  const selectedJob = selectedJobId ? jobMap.get(selectedJobId) : null;
  let departurePosition: number | null = null;
  if (selectedJob?.workshopExitDate) {
    const departureDate = getDeadlineDate(selectedJob.workshopExitDate);
    // In multi-day mode (when startDate provided), always show the marker
    // In single-day mode, only show if departure is today
    if (startDate) {
      departurePosition = timeToYPosition(departureDate, startHour, pixelsPerHour, startDate, effectiveCollapses);
    } else {
      const today = new Date();
      if (
        departureDate.getDate() === today.getDate() &&
        departureDate.getMonth() === today.getMonth() &&
        departureDate.getFullYear() === today.getFullYear()
      ) {
        // Single-day mode: no startDate, no collapses. Pass explicit sentinels
        // so this legacy branch compiles against the tightened signature.
        departurePosition = timeToYPosition(departureDate, startHour, pixelsPerHour, undefined, []);
      }
    }
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-auto min-w-0"
      data-testid="scheduling-grid"
    >
      {/* Grid content wrapper - enables horizontal scrolling */}
      <div className="inline-flex flex-col" style={{ minWidth: 'fit-content', minHeight: '100%' }}>
        {/* Header row - sticky top */}
        <div className="flex sticky top-0 z-30 bg-zinc-900">
          {/* Timeline header placeholder - sticky left */}
          <div className="w-12 shrink-0 bg-zinc-900 border-r border-white/5 border-b border-white/10 sticky left-0 z-40" />
          {/* Station headers */}
          <div className="flex gap-3 px-3 border-b border-white/10">
            {stations.map((station) => {
              // v0.3.57: Column collapse removed (was only for drag & drop)
              const isCollapsed = false;
              // Check if station has tiles
              const stationAssignments = assignmentsByStation.get(station.id) || [];
              // REQ-18: Get group capacity info for this station
              const groupCapacity = groupCapacityMap.get(station.id);
              const headerCategory = categoryMap.get(station.categoryId);
              return (
                <StationHeader
                  key={station.id}
                  station={station}
                  isCollapsed={isCollapsed}
                  groupCapacity={groupCapacity}
                  displayMode={displayMode}
                  category={headerCategory}
                />
              );
            })}
            {/* v0.3.55: Spacer to allow rightmost column to scroll to left edge */}
            <div className="shrink-0" style={{ width: 'calc(100vw - 300px)' }} aria-hidden="true" />
          </div>
        </div>

        {/* Content row */}
        <div className="flex relative" style={{ height: `${totalHeight}px` }}>
          {/* Timeline column - sticky left */}
          <div className="sticky left-0 z-20">
            <TimelineColumn
              startHour={startHour}
              hourCount={hoursToDisplay}
              currentTime={now}
              showNowLine={false}
              pixelsPerHour={pixelsPerHour}
              visibleDayRange={virtualScroll.visibleRange}
              gridStartDate={startDate}
              collapses={effectiveCollapses}
            />
          </div>

          {/* Station columns area */}
          <div
            className="flex gap-3 px-3 bg-zinc-950 relative"
            onMouseOver={handleColumnsMouseOver}
            onMouseMove={handleColumnsMouseMove}
            onMouseLeave={handleColumnsMouseLeave}
          >
            {/* Safety Zone band (Sky tint-horizontal), rendered below the now line */}
            {safetyZonePx > 0 && (
              <SafetyBand
                nowPx={nowPosition}
                zoneHeightPx={safetyZonePx}
                boundaryLabel={`+${safetyZoneHours} h`}
              />
            )}

            {/* Now line spanning all station columns */}
            <div
              className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
              style={{ top: `${nowPosition}px` }}
              data-testid="now-line"
            />

            {/* Departure date marker */}
            {departurePosition !== null && (
              <div
                className="absolute left-0 right-0 h-0.5 bg-blue-500 z-10 pointer-events-none"
                style={{ top: `${departurePosition}px` }}
                data-testid="departure-marker"
              />
            )}

            {/* Collapse bands — full-width (across stations area only). The TimelineColumn
                renders its own decorative cover at the same Y range, and skips hour labels
                inside bands. */}
            {effectiveCollapses.map((c) => (
              <CollapseBand
                key={c.id}
                collapse={c}
                topPx={timeToYPosition(c.from, startHour, pixelsPerHour, startDate, effectiveCollapses)}
              />
            ))}

            {/* Station columns */}
            {stations.map((station) => {
              const stationAssignments = assignmentsByStation.get(station.id) || [];
              const category = categoryMap.get(station.categoryId);

              // v0.3.57: Column collapse removed (was only for drag & drop)
              const isCollapsed = false;

              return (
                <StationColumn
                  key={station.id}
                  station={station}
                  startHour={startHour}
                  hoursToDisplay={hoursToDisplay}
                  pixelsPerHour={pixelsPerHour}
                  gridStartDate={startDate}
                  isCollapsed={isCollapsed}
                  visibleDayRange={virtualScroll.visibleRange}
                  displayMode={displayMode}
                  category={category}
                  onDeselect={onDeselect}
                  collapses={effectiveCollapses}
                  operators={operators}
                >
                  {stationAssignments.flatMap((assignment) => {
                    const cached = tileDataCache.get(assignment.id);
                    if (!cached) return [];
                    const interrupt = taskInterruption.get(assignment.id);
                    const sequenceIndex = sequenceIndexByTaskId?.get(cached.task.id);
                    const inZone = isInSafetyZone(
                      assignment.scheduledStart, safetyZoneFrozenUntil, now,
                    );
                    const isOverridden = inZone && sequenceIndex !== undefined
                      && overrideLookup.get(
                        makeSafetyKey(cached.job.id, sequenceIndex, cached.task.stationId),
                      ) === true;
                    // When the engine chunk-split this task to route around an
                    // obstacle (typically a safety-zone-frozen pin), render one
                    // independent <Tile> per active window. All chunks share
                    // the same data-task-id, so hover/selection style propagates
                    // via the existing CSS rule on [data-task-id="..."].
                    const segments = cached.chunks ?? [{
                      top: cached.top,
                      height: cached.height,
                      calageGeometries: cached.calageGeometries,
                    }];
                    return segments.map((seg, i) => (
                      <Tile
                        key={cached.chunks ? `${assignment.id}-chunk-${i}` : assignment.id}
                        assignment={assignment}
                        task={cached.task}
                        job={cached.job}
                        element={cached.element}
                        top={seg.top}
                        height={seg.height}
                        calageGeometries={seg.calageGeometries}
                        isSelected={selectedJobId === cached.jobId}
                        similarityResults={cached.similarityResults}
                        similarityScore={cached.similarityScore}
                        category={cached.category}
                        onSelect={onSelectJob}
                        onTogglePin={onTogglePin}
                        hasConflict={cached.hasConflict}
                        tileState={cached.tileState}
                        pixelsPerHour={cached.pixelsPerHour}
                        onContextMenu={onContextMenu}
                        isBlocked={cached.blocked}
                        blockingInfo={cached.blockingInfo}
                        displayMode={displayMode}
                        tirageLabel={cached.tirageLabel}
                        produitLabel={cached.produitLabel}
                        operatorNames={cached.operatorNames}
                        sawtoothTop={interrupt?.top}
                        sawtoothBottom={interrupt?.bottom}
                        inSafetyZone={inZone}
                        isFrozenOverridden={isOverridden}
                        sequenceIndex={sequenceIndex}
                        onToggleFrozenOverride={onToggleFrozenOverride}
                      />
                    ));
                  })}
                </StationColumn>
              );
            })}
            {/* v0.3.55: Spacer to allow rightmost column to scroll to left edge */}
            <div className="shrink-0" style={{ width: 'calc(100vw - 300px)' }} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Timeline magnifying lens — portaled to document.body */}
      <TimelineLens
        visible={lens.state.visible}
        activeColumnId={lens.state.activeColumnId}
        anchor={lens.state.anchor}
        tileContent={lensTileContent}
        unavailabilitySegments={lensUnavailabilitySegments}
        overtimeSegments={lensOvertimeSegments}
        gridStartMs={lensRange.gridStartMs}
        gridEndMs={lensRange.gridEndMs}
        centerTimeMs={lens.state.centerTimeMs}
        onMouseEnter={lens.handlers.handleLensEnter}
        onMouseLeave={lens.handlers.handleLensLeave}
      />
    </div>
  );
  }
);
