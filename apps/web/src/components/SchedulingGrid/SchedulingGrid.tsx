import type { Station, Job, TaskAssignment, Task, StationCategory, ScheduleConflict, StationGroup, OutsourcedProvider } from '@flux/types';
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
      compactingStationId,
      onCompact,
      isRescheduleDrag = false,
      conflicts = [],
      groups = [],
      providers = [],
    },
    ref
  ) {
    const [now, setNow] = useState(() => new Date());
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Calculate total height
  const totalHeight = hoursToDisplay * pixelsPerHour;

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

  // Group assignments by station (internal assignments only, not outsourced)
  const assignmentsByStation = useMemo(() => {
    const grouped = new Map<string, TaskAssignment[]>();
    stations.forEach((station) => grouped.set(station.id, []));

    assignments.forEach((assignment) => {
      // Skip outsourced assignments - they go to providers, not stations
      if (assignment.isOutsourced) return;

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
  }, [assignments, stations]);

  // REQ-19: Group outsourced assignments by provider
  const assignmentsByProvider = useMemo(() => {
    const grouped = new Map<string, TaskAssignment[]>();
    providers.forEach((provider) => grouped.set(provider.id, []));

    assignments.forEach((assignment) => {
      // Only include outsourced assignments
      if (!assignment.isOutsourced) return;

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
  }, [assignments, providers]);

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

              return (
                <StationColumn
                  key={station.id}
                  station={station}
                  startHour={startHour}
                  hoursToDisplay={hoursToDisplay}
                  pixelsPerHour={pixelsPerHour}
                  isCollapsed={isCollapsed}
                  isValidDrop={isValidDrop}
                  isWarningDrop={isWarningDrop}
                  isInvalidDrop={isInvalidDrop}
                  showBypassWarning={showBypassWarning}
                  isQuickPlacementMode={isQuickPlacementMode}
                  hasAvailableTask={hasAvailableTaskForQuickPlacement}
                  placementIndicatorY={isHoveredForQuickPlacement ? quickPlacementIndicatorY : undefined}
                  onQuickPlacementMouseMove={onQuickPlacementMouseMove}
                  onQuickPlacementMouseLeave={onQuickPlacementMouseLeave}
                  onQuickPlacementClick={onQuickPlacementClick}
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
                      />
                    );
                  })}
                </ProviderColumn>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
  }
);
