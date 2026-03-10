import type { Station, Job, TaskAssignment, Task, InternalTask, StationCategory, ScheduleConflict, StationGroup, Element } from '@flux/types';
import type { DryingTimeInfo, OutsourcingTimeInfo } from '../../utils';
import { isInternalTask, getDeadlineDate } from '@flux/types';
import { TimelineColumn, PIXELS_PER_HOUR } from '../TimelineColumn';
import { StationHeader, type GroupCapacityInfo } from '../StationHeaders/StationHeader';
import { StationColumn } from '../StationColumns/StationColumn';
import { Tile, compareSimilarity, computeTileState } from '../Tile';
import { useEffect, useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { timeToYPosition } from '../TimelineColumn';
import { buildGroupCapacityMap } from '../../utils/groupCapacity';
import { useVirtualScroll, isAssignmentVisible } from '../../hooks';
import { getJobIdForTask } from '../../utils/taskHelpers';
import { isElementBlocked, getPrerequisiteBlockingInfo, hasDieCuttingAction, hasOffsetAction } from '../../utils';
import { getTirageLabel } from '../../utils/tileLabelResolver';

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
  /** Callback when swap up is clicked */
  onSwapUp?: (assignmentId: string) => void;
  /** Callback when swap down is clicked */
  onSwapDown?: (assignmentId: string) => void;
  /** Callback when completion icon is clicked */
  onToggleComplete?: (assignmentId: string) => void;
  /** Whether quick placement mode is active */
  isQuickPlacementMode?: boolean;
  /** Station IDs that have available tasks for quick placement */
  stationsWithAvailableTasks?: Set<string>;
  /** Y position for placement indicator (snapped) */
  quickPlacementIndicatorY?: number;
  /** Station ID being hovered in quick placement mode */
  quickPlacementHoverStationId?: string | null;
  /** Callback when mouse moves in a station column during quick placement */
  onQuickPlacementMouseMove?: (stationId: string, y: number) => void;
  /** Callback when mouse leaves a station column during quick placement */
  onQuickPlacementMouseLeave?: () => void;
  /** Callback when user clicks to place a task in quick placement mode */
  onQuickPlacementClick?: (stationId: string, y: number) => void;
  /** Quick placement validation result (for green/red border) */
  quickPlacementValidation?: {
    isValid: boolean;
    hasPrecedenceConflict: boolean;
    suggestedStart: string | null;
    hasWarningOnly: boolean;
  };
  /** Whether ALT key is pressed (for precedence bypass in quick placement) */
  isAltPressed?: boolean;
  /** Quick placement precedence constraint Y positions */
  quickPlacementPrecedenceConstraints?: { earliestY: number | null; latestY: number | null };
  /** Station ID currently being compacted (for loading state) */
  compactingStationId?: string | null;
  /** Callback when compact button is clicked */
  onCompact?: (stationId: string) => void;
  /** Schedule conflicts for conflict visualization (REQ-12) */
  conflicts?: ScheduleConflict[];
  /** Station groups for capacity visualization (REQ-18) */
  groups?: StationGroup[];
  /** REQ-09.2: Callback when grid scrolls (for DateStrip sync) */
  onScroll?: (scrollTop: number) => void;
  /** v0.3.46: Total number of days for virtual scrolling (default: 365) */
  totalDays?: number;
  /** v0.3.46: Number of buffer days to render around focused day (default: 3) */
  bufferDays?: number;
  /** v0.3.54: Whether a task is currently picked (Pick & Place mode) */
  isPicking?: boolean;
  /** v0.3.54: Target station ID for the picked task */
  pickTargetStationId?: string | null;
  /** v0.3.54: Ring color state for pick operation */
  pickRingState?: 'none' | 'valid' | 'invalid' | 'warning' | 'bypass';
  /** v0.3.55: Source of the pick operation (sidebar vs grid) */
  pickSource?: 'sidebar' | 'grid' | null;
  /** v0.3.54: Callback for mouse move during pick */
  onPickMouseMove?: (stationId: string, clientX: number, clientY: number, relativeY: number) => void;
  /** v0.3.54: Callback for mouse leave during pick */
  onPickMouseLeave?: () => void;
  /** v0.3.54: Callback for click to place during pick */
  onPickClick?: (stationId: string, clientX: number, clientY: number, relativeY: number) => void;
  /** v0.3.54: Precedence constraint Y positions during pick */
  pickPrecedenceConstraints?: { earliestY: number | null; latestY: number | null };
  /** v0.3.54: Drying time info during pick */
  pickDryingTimeInfo?: DryingTimeInfo | null;
  /** v0.5.13: Outsourcing time info during pick */
  pickOutsourcingTimeInfo?: OutsourcingTimeInfo | null;
  /** v0.3.57: Assignment ID of picked tile (for showing placeholder) */
  pickedAssignmentId?: string | null;
  /** v0.3.57: Callback when tile is clicked to pick from grid */
  onPickFromGrid?: (task: InternalTask, job: Job, assignmentId: string) => void;
  /** v0.3.58: Callback when tile is right-clicked (context menu) */
  onContextMenu?: (x: number, y: number, assignmentId: string, isCompleted: boolean) => void;
  /** Current display mode (Produit or Tirage) — affects column widths */
  displayMode?: 'produit' | 'tirage';
  /** Set of job IDs that are late (for state-based tile coloring) */
  lateJobIds?: Set<string>;
  /** Ghost preview label for quick placement (job reference) */
  quickPlacementGhostLabel?: string;
  /** Ghost preview height in pixels for quick placement */
  quickPlacementGhostHeight?: number;
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
      onSwapUp,
      onSwapDown,
      onToggleComplete,
      isQuickPlacementMode = false,
      stationsWithAvailableTasks = new Set(),
      quickPlacementIndicatorY,
      quickPlacementHoverStationId,
      onQuickPlacementMouseMove,
      onQuickPlacementMouseLeave,
      onQuickPlacementClick,
      quickPlacementValidation,
      isAltPressed = false,
      quickPlacementPrecedenceConstraints,
      compactingStationId,
      onCompact,
      conflicts = [],
      groups = [],
      onScroll,
      totalDays = 365,
      bufferDays = 3,
      // v0.3.54: Pick & Place props
      isPicking = false,
      pickTargetStationId,
      pickRingState = 'none',
      pickSource,
      onPickMouseMove,
      onPickMouseLeave,
      onPickClick,
      pickPrecedenceConstraints,
      pickDryingTimeInfo,
      pickOutsourcingTimeInfo,
      // v0.3.57: Pick from grid props
      pickedAssignmentId,
      onPickFromGrid,
      // v0.3.58: Context menu props
      onContextMenu,
      displayMode,
      lateJobIds,
      quickPlacementGhostLabel,
      quickPlacementGhostHeight,
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
      onScroll?.(newScrollTop);
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
              const hasTiles = stationAssignments.length > 0;
              // Check if this station is being compacted
              const isCompacting = compactingStationId === station.id;
              // REQ-18: Get group capacity info for this station
              const groupCapacity = groupCapacityMap.get(station.id);
              const headerCategory = categoryMap.get(station.categoryId);
              return (
                <StationHeader
                  key={station.id}
                  station={station}
                  isCollapsed={isCollapsed}
                  hasTiles={hasTiles}
                  isCompacting={isCompacting}
                  onCompact={onCompact}
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
          <div className={`flex gap-3 px-3 bg-[#050505] relative ${isQuickPlacementMode ? 'ring-2 ring-inset ring-emerald-500/60' : ''}`}>
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
              const criteria = category?.similarityCriteria || [];

              // v0.3.57: Column collapse removed (was only for drag & drop)
              const isCollapsed = false;

              // Quick placement state for this column
              const isHoveredForQuickPlacement = quickPlacementHoverStationId === station.id;
              const hasAvailableTaskForQuickPlacement = stationsWithAvailableTasks.has(station.id);

              // Quick placement validation
              const isQuickPlacementValid = isHoveredForQuickPlacement &&
                hasAvailableTaskForQuickPlacement &&
                quickPlacementValidation?.isValid;
              const isQuickPlacementBypass = isHoveredForQuickPlacement &&
                hasAvailableTaskForQuickPlacement &&
                !quickPlacementValidation?.isValid &&
                quickPlacementValidation?.hasPrecedenceConflict &&
                isAltPressed;
              const isQuickPlacementInvalid = isHoveredForQuickPlacement &&
                hasAvailableTaskForQuickPlacement &&
                !quickPlacementValidation?.isValid &&
                !isQuickPlacementBypass;

              // Precedence constraints: show for quick placement or pick
              const isPickTarget = isPicking && pickTargetStationId === station.id;
              const showQuickPlacementConstraints = isHoveredForQuickPlacement && hasAvailableTaskForQuickPlacement;
              let effectivePrecedenceConstraints;
              if (showQuickPlacementConstraints) {
                effectivePrecedenceConstraints = quickPlacementPrecedenceConstraints;
              } else if (isPickTarget) {
                effectivePrecedenceConstraints = pickPrecedenceConstraints;
              }

              // v0.3.51: Drying time info - show only on the predecessor's station
              const effectiveDryingTimeInfo = pickDryingTimeInfo?.predecessorStationId === station.id ? pickDryingTimeInfo : undefined;

              // v0.5.13: Outsourcing time info - show on the pick target station
              const effectiveOutsourcingTimeInfo = isPickTarget ? pickOutsourcingTimeInfo : undefined;

              return (
                <StationColumn
                  key={station.id}
                  station={station}
                  startHour={startHour}
                  hoursToDisplay={hoursToDisplay}
                  pixelsPerHour={pixelsPerHour}
                  gridStartDate={startDate}
                  isCollapsed={isCollapsed}
                  isValidDrop={isQuickPlacementValid}
                  isInvalidDrop={isQuickPlacementInvalid}
                  isQuickPlacementBypass={isQuickPlacementBypass}
                  isQuickPlacementMode={isQuickPlacementMode}
                  hasAvailableTask={hasAvailableTaskForQuickPlacement}
                  placementIndicatorY={isHoveredForQuickPlacement ? quickPlacementIndicatorY : undefined}
                  onQuickPlacementMouseMove={onQuickPlacementMouseMove}
                  onQuickPlacementMouseLeave={onQuickPlacementMouseLeave}
                  onQuickPlacementClick={onQuickPlacementClick}
                  precedenceConstraints={effectivePrecedenceConstraints}
                  dryingTimeInfo={effectiveDryingTimeInfo}
                  outsourcingTimeInfo={effectiveOutsourcingTimeInfo ?? undefined}
                  visibleDayRange={virtualScroll.visibleRange}
                  isPicking={isPicking}
                  isPickTarget={isPickTarget}
                  pickRingState={isPickTarget ? pickRingState : 'none'}
                  pickSource={pickSource}
                  onPickMouseMove={onPickMouseMove}
                  onPickMouseLeave={onPickMouseLeave}
                  onPickClick={onPickClick}
                  displayMode={displayMode}
                  category={category}
                  ghostPreviewLabel={isHoveredForQuickPlacement ? quickPlacementGhostLabel : undefined}
                  ghostPreviewHeight={isHoveredForQuickPlacement ? quickPlacementGhostHeight : undefined}
                  onDeselect={onDeselect}
                >
                  {stationAssignments.map((assignment, index) => {
                    const task = taskMap.get(assignment.taskId);
                    const jobId = task ? getJobIdForTask(task, elements) : null;
                    const job = jobId ? jobMap.get(jobId) : null;

                    // Skip if we don't have the task/job data or if task is not internal
                    if (!task || !job || !isInternalTask(task)) return null;

                    // v0.4.32b: Get element for blocking status
                    const element = elements.find((e) => e.id === task.elementId);
                    const hasOffset = element ? hasOffsetAction(element, tasks, stations, categories) : false;
                    const hasDieCutting = element ? hasDieCuttingAction(element, tasks, stations) : false;
                    const blockOpts = { hasOffset, hasDieCutting };
                    const blocked = element ? isElementBlocked(element, blockOpts) : false;
                    const blockingInfo = element ? getPrerequisiteBlockingInfo(element, blockOpts) : undefined;

                    // Calculate top position from assignment.scheduledStart
                    // Use multi-day calculation when startDate is provided (REQ-14)
                    const startTime = new Date(assignment.scheduledStart);
                    const top = timeToYPosition(startTime, startHour, pixelsPerHour, startDate);

                    // Determine swap button visibility (completed tiles cannot be swapped)
                    const isCurrentCompleted = assignment.isCompleted;
                    const adjacentUp = index > 0 ? stationAssignments[index - 1] : null;
                    const adjacentDown = index < stationAssignments.length - 1 ? stationAssignments[index + 1] : null;
                    const showSwapUp = !isCurrentCompleted && index > 0 && !adjacentUp?.isCompleted;
                    const showSwapDown = !isCurrentCompleted && index < stationAssignments.length - 1 && !adjacentDown?.isCompleted;

                    // Calculate similarity results with previous tile (if any)
                    // Compares element specs (papier, format, impression) between consecutive tasks
                    let similarityResults = undefined;
                    if (index > 0 && criteria.length > 0 && element?.spec) {
                      const prevAssignment = stationAssignments[index - 1];
                      const prevTask = taskMap.get(prevAssignment.taskId);
                      const prevElement = prevTask ? elements.find((e) => e.id === prevTask.elementId) : null;
                      if (prevElement?.spec) {
                        similarityResults = compareSimilarity(prevElement.spec, element.spec, criteria);
                      }
                    }

                    // Compute Tirage label for this tile
                    const jobElements = elements.filter((e) => e.jobId === job.id);
                    const rawTirageLabel =
                      category && element
                        ? getTirageLabel(
                            category.name,
                            element,
                            job,
                            jobElements,
                            taskMap,
                            assemblyStationIds,
                          )
                        : '';
                    const tileLabel = rawTirageLabel || undefined;

                    // Compute tile state for state-based coloring
                    const isJobLate = lateJobIds?.has(job.id) ?? false;
                    const isTaskOverdue = !assignment.isCompleted && new Date(assignment.scheduledEnd) < now;
                    const isLate = isJobLate || isTaskOverdue;
                    const hasConflict = conflictTaskIds.has(task.id);
                    const tileState = computeTileState(isLate, hasConflict, blocked, assignment.isCompleted);

                    return (
                      <Tile
                        key={assignment.id}
                        assignment={assignment}
                        task={task}
                        job={job}
                        element={element}
                        top={top}
                        isSelected={selectedJobId === job.id}
                        showSwapUp={showSwapUp}
                        showSwapDown={showSwapDown}
                        similarityResults={similarityResults}
                        onSelect={onSelectJob}
                        onSwapUp={onSwapUp}
                        onSwapDown={onSwapDown}
                        onToggleComplete={onToggleComplete}
                        hasConflict={hasConflict}
                        tileState={tileState}
                        pixelsPerHour={pixelsPerHour}
                        isPicked={pickedAssignmentId === assignment.id}
                        onPickFromGrid={onPickFromGrid}
                        isPickingActive={isPicking}
                        onContextMenu={onContextMenu}
                        isBlocked={blocked}
                        blockingInfo={blockingInfo}
                        displayMode={displayMode}
                        tirageLabel={tileLabel}
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
