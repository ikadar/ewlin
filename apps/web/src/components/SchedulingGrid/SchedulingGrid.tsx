import type { Station, Job, TaskAssignment, Task, StationCategory, ScheduleConflict, StationGroup, Element, Operator } from '@flux/types';
import type { DryingTimeInfo, OutsourcingTimeInfo } from '../../utils';
import { getDeadlineDate, DIE_CUTTING_CATEGORY_ID, DIE_CUTTING_KEYWORDS } from '@flux/types';
import { TimelineColumn, PIXELS_PER_HOUR } from '../TimelineColumn';
import { StationHeader, type GroupCapacityInfo } from '../StationHeaders/StationHeader';
import { StationColumn } from '../StationColumns/StationColumn';
import { Tile } from '../Tile';
import { useEffect, useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { timeToYPosition } from '../TimelineColumn';
import { buildGroupCapacityMap } from '../../utils/groupCapacity';
import { useVirtualScroll, isAssignmentVisible } from '../../hooks';
import { isElementBlocked, getPrerequisiteBlockingInfo } from '../../utils';
import { computeTileDataCache, type CachedTileData, type ElementBlockingInfo } from '../../utils/stationTileData';

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
  /** Callback when completion icon is clicked */
  onToggleComplete?: (assignmentId: string) => void;
  /** Callback when pin icon is clicked */
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
      onToggleComplete,
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
    },
    ref
  ) {
    const [now, setNow] = useState(() => new Date());
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // v0.3.46: Track scroll position and viewport for virtual scrolling
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(600);

    // v0.3.46: Calculate day height from pixels per hour
    const dayHeightPx = 24 * pixelsPerHour;

    // v0.3.46: Virtual scroll calculation
    const virtualScroll = useVirtualScroll({
      totalDays,
      bufferDays,
      dayHeightPx,
      scrollTop,
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

  // v0.3.46: Track scroll position and viewport size for virtual scrolling
  // Also REQ-09.2: Notify parent of scroll position for DateStrip sync
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Update viewport height
    setViewportHeight(container.clientHeight);

    const handleScroll = () => {
      const newScrollTop = container.scrollTop;
      setScrollTop(newScrollTop);
      onScroll?.(newScrollTop, container.scrollLeft);
    };

    const handleResize = () => {
      setViewportHeight(container.clientHeight);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // Report initial scroll position
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [onScroll]);

  // v0.3.46: Use virtual scroll total height for proper scrollbar sizing
  const totalHeight = virtualScroll.totalHeight;

  // Calculate now line position (multi-day aware)
  const nowPosition = timeToYPosition(now, startHour, pixelsPerHour, startDate);

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

  // Step 1d: Pre-compute per-tile render data (independent of selectedJobId)
  const tileDataCache = useMemo(() => computeTileDataCache({
    assignmentsByStation, taskMap, jobMap, elementMap, elementBlockingCache,
    elementsByJobId, stationMap, categoryMap, assemblyStationIds,
    operatorNameMap, conflictTaskIds, shippedJobIds, lateJobIds,
    startHour, pixelsPerHour, startDate, now,
  }), [assignmentsByStation, taskMap, jobMap, elementMap, elementBlockingCache,
      elementsByJobId, stationMap, categoryMap, assemblyStationIds,
      startHour, pixelsPerHour, startDate, shippedJobIds, lateJobIds,
      conflictTaskIds, now, operatorNameMap]);

  // Calculate departure marker position (if selected job has workshopExitDate)
  // Multi-day: show marker regardless of day (REQ-15)
  const selectedJob = selectedJobId ? jobMap.get(selectedJobId) : null;
  let departurePosition: number | null = null;
  if (selectedJob?.workshopExitDate) {
    const departureDate = getDeadlineDate(selectedJob.workshopExitDate);
    // In multi-day mode (when startDate provided), always show the marker
    // In single-day mode, only show if departure is today
    if (startDate) {
      departurePosition = timeToYPosition(departureDate, startHour, pixelsPerHour, startDate);
    } else {
      const today = new Date();
      if (
        departureDate.getDate() === today.getDate() &&
        departureDate.getMonth() === today.getMonth() &&
        departureDate.getFullYear() === today.getFullYear()
      ) {
        departurePosition = timeToYPosition(departureDate, startHour, pixelsPerHour);
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
            />
          </div>

          {/* Station columns area */}
          <div className="flex gap-3 px-3 bg-zinc-950 relative">
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
                >
                  {stationAssignments.map((assignment) => {
                    const cached = tileDataCache.get(assignment.id);
                    if (!cached) return null;
                    return (
                      <Tile
                        key={assignment.id}
                        assignment={assignment}
                        task={cached.task}
                        job={cached.job}
                        element={cached.element}
                        top={cached.top}
                        isSelected={selectedJobId === cached.jobId}
                        similarityResults={cached.similarityResults}
                        onSelect={onSelectJob}
                        onToggleComplete={onToggleComplete}
                        onTogglePin={onTogglePin}
                        hasConflict={cached.hasConflict}
                        tileState={cached.tileState}
                        pixelsPerHour={cached.pixelsPerHour}
                        onContextMenu={onContextMenu}
                        isBlocked={cached.blocked}
                        blockingInfo={cached.blockingInfo}
                        displayMode={displayMode}
                        tirageLabel={cached.tirageLabel}
                        operatorNames={cached.operatorNames}
                      />
                    );
                  })}
                </StationColumn>
              );
            })}
            {/* v0.3.55: Spacer to allow rightmost column to scroll to left edge */}
            <div className="shrink-0" style={{ width: 'calc(100vw - 300px)' }} aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
  }
);
