import type { Station, Job, TaskAssignment, Task, InternalTask, StationCategory, ScheduleConflict, StationGroup, OutsourcedProvider } from '@flux/types';
import type { DryingTimeInfo } from '../../utils';
import { isInternalTask } from '@flux/types';
import { TimelineColumn, PIXELS_PER_HOUR } from '../TimelineColumn';
import { StationHeader, type GroupCapacityInfo } from '../StationHeaders/StationHeader';
import { StationColumn } from '../StationColumns/StationColumn';
import { ProviderColumn } from '../ProviderColumn/ProviderColumn';
import { ProviderHeader } from '../ProviderColumn/ProviderHeader';
import { Tile, compareSimilarity } from '../Tile';
import { useEffect, useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { timeToYPosition } from '../TimelineColumn';
import { buildGroupCapacityMap } from '../../utils/groupCapacity';
import { calculateSubcolumnLayout, getSubcolumnLayout } from '../../utils/subcolumnLayout';
import { useVirtualScroll, isAssignmentVisible } from '../../hooks';

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

/** Validation state during drag */
export interface ValidationState {
  /** Target station ID being hovered */
  targetStationId: string | null;
  /** Whether the current drop position is valid */
  isValid: boolean;
  /** Whether there's a precedence conflict */
  hasPrecedenceConflict: boolean;
  /** Suggested start time if precedence conflict exists */
  suggestedStart: string | null;
  /** Whether Alt key is pressed (bypass precedence) */
  isAltPressed: boolean;
  /** Whether there are only warning conflicts (non-blocking, like Plates approval) */
  hasWarningOnly: boolean;
  /** Whether there's a group capacity conflict (REQ-18) */
  hasGroupCapacityConflict?: boolean;
}

export interface SchedulingGridProps {
  /** Stations to display */
  stations: Station[];
  /** Station categories (for similarity criteria lookup) */
  categories?: StationCategory[];
  /** All jobs (for looking up job data by ID) */
  jobs?: Job[];
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
  /** Callback when a tile is double-clicked (recall) */
  onRecallAssignment?: (assignmentId: string) => void;
  /** Callback when swap up is clicked */
  onSwapUp?: (assignmentId: string) => void;
  /** Callback when swap down is clicked */
  onSwapDown?: (assignmentId: string) => void;
  /** Callback when completion icon is clicked */
  onToggleComplete?: (assignmentId: string) => void;
  /** Currently dragged task (for column focus) */
  activeTask?: Task | null;
  /** Job of the currently dragged task (for tile muting) */
  activeJob?: Job | null;
  /** Validation state during drag */
  validationState?: ValidationState;
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
  /** Quick placement precedence constraint Y positions */
  quickPlacementPrecedenceConstraints?: { earliestY: number | null; latestY: number | null };
  /** Station ID currently being compacted (for loading state) */
  compactingStationId?: string | null;
  /** Callback when compact button is clicked */
  onCompact?: (stationId: string) => void;
  /** Whether current drag is a reschedule (existing tile) - disables column collapse */
  isRescheduleDrag?: boolean;
  /** Schedule conflicts for conflict visualization (REQ-12) */
  conflicts?: ScheduleConflict[];
  /** Station groups for capacity visualization (REQ-18) */
  groups?: StationGroup[];
  /** Outsourced providers for provider columns (REQ-19) */
  providers?: OutsourcedProvider[];
  /** REQ-09.2: Callback when grid scrolls (for DateStrip sync) */
  onScroll?: (scrollTop: number) => void;
  /** REQ-10: Precedence constraint Y positions for visualization */
  precedenceConstraints?: { earliestY: number | null; latestY: number | null };
  /** v0.3.51: Drying time visualization info during drag */
  dryingTimeInfo?: DryingTimeInfo | null;
  /** v0.3.46: Total number of days for virtual scrolling (default: 365) */
  totalDays?: number;
  /** v0.3.46: Number of buffer days to render around focused day (default: 3) */
  bufferDays?: number;
  /** v0.3.54: Whether pick mode is active (Pick & Place) */
  isPickMode?: boolean;
  /** v0.3.61: Source of pick (sidebar = new, grid = reschedule) - controls column hiding */
  pickSource?: 'sidebar' | 'grid' | null;
  /** v0.3.54: Station ID that the picked task belongs to (compatible station) */
  pickTargetStationId?: string | null;
  /** v0.3.54: Station ID currently being hovered in pick mode */
  pickHoverStationId?: string | null;
  /** v0.3.54: Y position for pick mode placement indicator */
  pickIndicatorY?: number;
  /** v0.3.54: Callback when mouse moves in a station column during pick mode */
  onPickMouseMove?: (stationId: string, y: number) => void;
  /** v0.3.54: Callback when mouse leaves a station column during pick mode */
  onPickMouseLeave?: () => void;
  /** v0.3.55: Pick mode validation state for real-time ring color feedback */
  pickValidation?: {
    isValid: boolean;
    hasPrecedenceConflict: boolean;
    suggestedStart: string | null;
    hasWarningOnly: boolean;
  };
  /** v0.3.57: Callback when a tile is picked from the grid (for reschedule) */
  onPickTile?: (assignmentId: string, task: InternalTask, job: Job) => void;
  /** v0.3.57: Assignment ID of the currently picked tile (for visual state) */
  pickedAssignmentId?: string | null;
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
      tasks = [],
      assignments = [],
      selectedJobId,
      startHour = 6,
      hoursToDisplay = 24,
      startDate,
      pixelsPerHour = PIXELS_PER_HOUR,
      onSelectJob,
      onRecallAssignment,
      onSwapUp,
      onSwapDown,
      onToggleComplete,
      activeTask,
      activeJob,
      validationState,
      isQuickPlacementMode = false,
      stationsWithAvailableTasks = new Set(),
      quickPlacementIndicatorY,
      quickPlacementHoverStationId,
      onQuickPlacementMouseMove,
      onQuickPlacementMouseLeave,
      onQuickPlacementClick,
      quickPlacementValidation,
      quickPlacementPrecedenceConstraints,
      compactingStationId,
      onCompact,
      isRescheduleDrag = false,
      conflicts = [],
      groups = [],
      providers = [],
      onScroll,
      precedenceConstraints,
      dryingTimeInfo,
      totalDays = 365,
      bufferDays = 3,
      isPickMode = false,
      pickSource = null,
      pickTargetStationId,
      pickHoverStationId,
      pickIndicatorY,
      onPickMouseMove,
      onPickMouseLeave,
      pickValidation,
      onPickTile,
      pickedAssignmentId,
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

  // REQ-19: Group outsourced assignments by provider, v0.3.46: filtered to visible range
  const assignmentsByProvider = useMemo(() => {
    const grouped = new Map<string, TaskAssignment[]>();
    providers.forEach((provider) => grouped.set(provider.id, []));

    // Calculate grid start date for visibility check
    const gridStart = startDate || new Date();

    assignments.forEach((assignment) => {
      // Only include outsourced assignments
      if (!assignment.isOutsourced) return;

      // v0.3.46: Skip assignments outside visible range
      if (!isAssignmentVisible(
        assignment.scheduledStart,
        assignment.scheduledEnd,
        gridStart,
        virtualScroll.visibleRange
      )) {
        return;
      }

      const providerAssignments = grouped.get(assignment.targetId);
      if (providerAssignments) {
        providerAssignments.push(assignment);
      }
    });

    // Sort assignments within each provider by scheduled start time
    grouped.forEach((providerAssignments) => {
      providerAssignments.sort(
        (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
      );
    });

    return grouped;
  }, [assignments, providers, startDate, virtualScroll.visibleRange]);

  // REQ-19: Calculate subcolumn layouts for each provider
  const providerSubcolumnLayouts = useMemo(() => {
    const layouts = new Map<string, Map<string, ReturnType<typeof getSubcolumnLayout>>>();
    providers.forEach((provider) => {
      const providerAssignments = assignmentsByProvider.get(provider.id) || [];
      layouts.set(provider.id, calculateSubcolumnLayout(providerAssignments));
    });
    return layouts;
  }, [providers, assignmentsByProvider]);

  // Calculate departure marker position (if selected job has workshopExitDate)
  // Multi-day: show marker regardless of day (REQ-15)
  const selectedJob = selectedJobId ? jobMap.get(selectedJobId) : null;
  let departurePosition: number | null = null;
  if (selectedJob?.workshopExitDate) {
    const departureDate = new Date(selectedJob.workshopExitDate);
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
              // Determine if this header should be collapsed during drag
              // Don't collapse during reschedule (existing tile repositioning)
              const targetStationId =
                activeTask?.type === 'Internal' ? activeTask.stationId : null;
              const isCollapsed = !isRescheduleDrag && targetStationId !== null && targetStationId !== station.id;
              // Check if station has tiles
              const stationAssignments = assignmentsByStation.get(station.id) || [];
              const hasTiles = stationAssignments.length > 0;
              // Check if this station is being compacted
              const isCompacting = compactingStationId === station.id;
              // REQ-18: Get group capacity info for this station
              const groupCapacity = groupCapacityMap.get(station.id);
              return (
                <StationHeader
                  key={station.id}
                  station={station}
                  isCollapsed={isCollapsed}
                  hasTiles={hasTiles}
                  isCompacting={isCompacting}
                  onCompact={onCompact}
                  groupCapacity={groupCapacity}
                />
              );
            })}
            {/* REQ-19: Provider headers */}
            {providers.map((provider) => (
              <ProviderHeader
                key={provider.id}
                provider={provider}
              />
            ))}

            {/* v0.3.55: Matching padding for header row */}
            <div
              className="shrink-0"
              style={{ minWidth: 'calc(100vw - 400px)' }}
              aria-hidden="true"
            />
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
          <div className="flex gap-3 px-3 bg-[#050505] relative">
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

              // Determine if this column should be collapsed during drag
              // Target station stays full width, others collapse
              // Don't collapse during reschedule (existing tile repositioning)
              const targetStationId =
                activeTask?.type === 'Internal' ? activeTask.stationId : null;
              const isCollapsed = !isRescheduleDrag && targetStationId !== null && targetStationId !== station.id;

              // Determine validation visual state for this column
              const isValidationTarget = validationState?.targetStationId === station.id;
              const isValidDrop = isValidationTarget && validationState?.isValid && !validationState?.hasWarningOnly;
              const isWarningDrop = isValidationTarget && validationState?.hasWarningOnly;
              const isInvalidDrop = isValidationTarget && !validationState?.isValid && !validationState?.hasWarningOnly;
              // Bypass warning only shows when:
              // 1. Hovering over this column
              // 2. Has precedence conflict
              // 3. Alt is pressed
              // 4. Station is otherwise valid (compatible) - amber only for valid station with precedence issue
              const showBypassWarning = isValidationTarget &&
                validationState?.hasPrecedenceConflict &&
                validationState?.isAltPressed &&
                validationState?.isValid;

              // Quick placement state for this column
              const isHoveredForQuickPlacement = quickPlacementHoverStationId === station.id;
              const hasAvailableTaskForQuickPlacement = stationsWithAvailableTasks.has(station.id);

              // Quick placement validation (similar to drag validation)
              const isQuickPlacementValid = isHoveredForQuickPlacement &&
                hasAvailableTaskForQuickPlacement &&
                quickPlacementValidation?.isValid;
              const isQuickPlacementInvalid = isHoveredForQuickPlacement &&
                hasAvailableTaskForQuickPlacement &&
                !quickPlacementValidation?.isValid;

              // v0.3.54: Pick mode state for this column
              const isPickTargetStation = isPickMode && pickTargetStationId === station.id;
              const isHoveredForPick = isPickMode && pickHoverStationId === station.id;

              // Combine drag and quick placement validation for border display
              const effectiveIsValidDrop = isValidDrop || isQuickPlacementValid;
              const effectiveIsInvalidDrop = isInvalidDrop || isQuickPlacementInvalid;

              // Precedence constraints: show for drag, quick placement, OR pick mode
              const effectivePrecedenceConstraints = isValidationTarget
                ? precedenceConstraints
                : (isHoveredForQuickPlacement && hasAvailableTaskForQuickPlacement
                    ? quickPlacementPrecedenceConstraints
                    : (isHoveredForPick && isPickTargetStation
                        ? precedenceConstraints
                        : undefined));

              // v0.3.51: Drying time info - show only on the predecessor's station
              const effectiveDryingTimeInfo = dryingTimeInfo?.predecessorStationId === station.id
                ? dryingTimeInfo
                : undefined;

              return (
                <StationColumn
                  key={station.id}
                  station={station}
                  startHour={startHour}
                  hoursToDisplay={hoursToDisplay}
                  pixelsPerHour={pixelsPerHour}
                  gridStartDate={startDate}
                  isCollapsed={isCollapsed}
                  isValidDrop={effectiveIsValidDrop}
                  isWarningDrop={isWarningDrop}
                  isInvalidDrop={effectiveIsInvalidDrop}
                  showBypassWarning={showBypassWarning}
                  isQuickPlacementMode={isQuickPlacementMode}
                  hasAvailableTask={hasAvailableTaskForQuickPlacement}
                  placementIndicatorY={
                    isHoveredForQuickPlacement ? quickPlacementIndicatorY
                    : (isHoveredForPick && isPickTargetStation ? pickIndicatorY : undefined)
                  }
                  onQuickPlacementMouseMove={onQuickPlacementMouseMove}
                  onQuickPlacementMouseLeave={onQuickPlacementMouseLeave}
                  onQuickPlacementClick={onQuickPlacementClick}
                  isPickMode={isPickMode}
                  pickSource={pickSource}
                  isPickTargetStation={isPickTargetStation}
                  onPickMouseMove={onPickMouseMove}
                  onPickMouseLeave={onPickMouseLeave}
                  pickValidation={isPickTargetStation ? pickValidation : undefined}
                  precedenceConstraints={effectivePrecedenceConstraints}
                  dryingTimeInfo={effectiveDryingTimeInfo}
                  visibleDayRange={virtualScroll.visibleRange}
                >
                  {stationAssignments.map((assignment, index) => {
                    const task = taskMap.get(assignment.taskId);
                    const job = task ? jobMap.get(task.jobId) : null;

                    // Skip if we don't have the task/job data or if task is not internal
                    if (!task || !job || !isInternalTask(task)) return null;

                    // Calculate top position from assignment.scheduledStart
                    // Use multi-day calculation when startDate is provided (REQ-14)
                    const startTime = new Date(assignment.scheduledStart);
                    const top = timeToYPosition(startTime, startHour, pixelsPerHour, startDate);

                    // Determine swap button visibility
                    const showSwapUp = index > 0;
                    const showSwapDown = index < stationAssignments.length - 1;

                    // Calculate similarity results with previous tile (if any)
                    let similarityResults = undefined;
                    if (index > 0 && criteria.length > 0) {
                      const prevAssignment = stationAssignments[index - 1];
                      const prevTask = taskMap.get(prevAssignment.taskId);
                      const prevJob = prevTask ? jobMap.get(prevTask.jobId) : null;
                      if (prevJob) {
                        similarityResults = compareSimilarity(prevJob, job, criteria);
                      }
                    }

                    return (
                      <Tile
                        key={assignment.id}
                        assignment={assignment}
                        task={task}
                        job={job}
                        top={top}
                        isSelected={selectedJobId === job.id}
                        showSwapUp={showSwapUp}
                        showSwapDown={showSwapDown}
                        similarityResults={similarityResults}
                        onSelect={onSelectJob}
                        onRecall={onRecallAssignment}
                        onSwapUp={onSwapUp}
                        onSwapDown={onSwapDown}
                        onToggleComplete={onToggleComplete}
                        activeJobId={activeJob?.id}
                        selectedJobId={selectedJobId ?? undefined}
                        hasConflict={conflictTaskIds.has(task.id)}
                        pixelsPerHour={pixelsPerHour}
                        onPick={onPickTile}
                        isPicked={pickedAssignmentId === assignment.id}
                        onInfoClick={onSelectJob}
                      />
                    );
                  })}
                </StationColumn>
              );
            })}

            {/* REQ-19: Provider columns */}
            {providers.map((provider) => {
              const providerAssignments = assignmentsByProvider.get(provider.id) || [];
              const subcolumnLayoutMap = providerSubcolumnLayouts.get(provider.id) || new Map();

              return (
                <ProviderColumn
                  key={provider.id}
                  provider={provider}
                  startHour={startHour}
                  hoursToDisplay={hoursToDisplay}
                  pixelsPerHour={pixelsPerHour}
                >
                  {providerAssignments.map((assignment) => {
                    const task = taskMap.get(assignment.taskId);
                    const job = task ? jobMap.get(task.jobId) : null;

                    // Skip if we don't have the task/job data or if task is not internal
                    if (!task || !job || !isInternalTask(task)) return null;

                    // Calculate top position from assignment.scheduledStart
                    const startTime = new Date(assignment.scheduledStart);
                    const top = timeToYPosition(startTime, startHour, pixelsPerHour, startDate);

                    // Get subcolumn layout for this assignment
                    const layout = getSubcolumnLayout(assignment.id, subcolumnLayoutMap);

                    return (
                      <Tile
                        key={assignment.id}
                        assignment={assignment}
                        task={task}
                        job={job}
                        top={top}
                        isSelected={selectedJobId === job.id}
                        showSwapUp={false}
                        showSwapDown={false}
                        onSelect={onSelectJob}
                        onRecall={onRecallAssignment}
                        activeJobId={activeJob?.id}
                        selectedJobId={selectedJobId ?? undefined}
                        hasConflict={conflictTaskIds.has(task.id)}
                        pixelsPerHour={pixelsPerHour}
                        isOutsourced={true}
                        subcolumnLayout={layout}
                        onInfoClick={onSelectJob}
                      />
                    );
                  })}
                </ProviderColumn>
              );
            })}

            {/* v0.3.55: Dynamic padding to allow scrolling any column to a fixed position */}
            <div
              className="shrink-0"
              style={{ minWidth: 'calc(100vw - 400px)' }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
  }
);
