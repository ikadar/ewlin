import type { Station, Job, TaskAssignment, Task, StationCategory } from '@flux/types';
import { isInternalTask } from '@flux/types';
import { TimelineColumn, PIXELS_PER_HOUR } from '../TimelineColumn';
import { StationHeader } from '../StationHeaders/StationHeader';
import { StationColumn } from '../StationColumns/StationColumn';
import { Tile, compareSimilarity } from '../Tile';
import { useEffect, useState, useMemo } from 'react';
import { timeToYPosition } from '../TimelineColumn';

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
  /** Callback when a tile is clicked (select job) */
  onSelectJob?: (jobId: string) => void;
  /** Callback when a tile is double-clicked (recall) */
  onRecallAssignment?: (assignmentId: string) => void;
  /** Callback when swap up is clicked */
  onSwapUp?: (assignmentId: string) => void;
  /** Callback when swap down is clicked */
  onSwapDown?: (assignmentId: string) => void;
  /** Currently dragged task (for column focus) */
  activeTask?: Task | null;
  /** Job of the currently dragged task (for tile muting) */
  activeJob?: Job | null;
  /** Validation state during drag */
  validationState?: ValidationState;
}

/**
 * SchedulingGrid - Unified grid component with synchronized scrolling.
 * Contains Timeline, Station Headers, and Station Columns in a single scroll container.
 */
export function SchedulingGrid({
  stations,
  categories = [],
  jobs = [],
  tasks = [],
  assignments = [],
  selectedJobId,
  startHour = 6,
  hoursToDisplay = 24,
  onSelectJob,
  onRecallAssignment,
  onSwapUp,
  onSwapDown,
  activeTask,
  activeJob,
  validationState,
}: SchedulingGridProps) {
  const [now, setNow] = useState(() => new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate total height
  const totalHeight = hoursToDisplay * PIXELS_PER_HOUR;

  // Calculate now line position
  const nowPosition = timeToYPosition(now, startHour);

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

  // Calculate departure marker position (if selected job has workshopExitDate)
  const selectedJob = selectedJobId ? jobMap.get(selectedJobId) : null;
  let departurePosition: number | null = null;
  if (selectedJob?.workshopExitDate) {
    const departureDate = new Date(selectedJob.workshopExitDate);
    const today = new Date();
    if (
      departureDate.getDate() === today.getDate() &&
      departureDate.getMonth() === today.getMonth() &&
      departureDate.getFullYear() === today.getFullYear()
    ) {
      departurePosition = timeToYPosition(departureDate, startHour);
    }
  }

  return (
    <div className="flex-1 overflow-auto min-w-0" data-testid="scheduling-grid">
      {/* Grid content wrapper - enables horizontal scrolling */}
      <div className="inline-flex flex-col" style={{ minWidth: 'fit-content', minHeight: '100%' }}>
        {/* Header row - sticky top */}
        <div className="flex sticky top-0 z-30 bg-zinc-900">
          {/* Timeline header placeholder - sticky left */}
          <div className="w-12 shrink-0 bg-zinc-900 border-r border-white/5 border-b border-white/10 sticky left-0 z-40" />
          {/* Station headers */}
          <div className="flex gap-3 px-3 border-b border-white/10">
            {stations.map((station) => (
              <StationHeader key={station.id} station={station} />
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
              const targetStationId =
                activeTask?.type === 'Internal' ? activeTask.stationId : null;
              const isCollapsed = targetStationId !== null && targetStationId !== station.id;

              // Determine validation visual state for this column
              const isValidationTarget = validationState?.targetStationId === station.id;
              const isValidDrop = isValidationTarget && validationState?.isValid;
              const isInvalidDrop = isValidationTarget && !validationState?.isValid;
              const showBypassWarning = isValidationTarget &&
                validationState?.hasPrecedenceConflict &&
                validationState?.isAltPressed;

              return (
                <StationColumn
                  key={station.id}
                  station={station}
                  startHour={startHour}
                  hoursToDisplay={hoursToDisplay}
                  isCollapsed={isCollapsed}
                  isValidDrop={isValidDrop}
                  isInvalidDrop={isInvalidDrop}
                  showBypassWarning={showBypassWarning}
                >
                  {stationAssignments.map((assignment, index) => {
                    const task = taskMap.get(assignment.taskId);
                    const job = task ? jobMap.get(task.jobId) : null;

                    // Skip if we don't have the task/job data or if task is not internal
                    if (!task || !job || !isInternalTask(task)) return null;

                    // Calculate top position from assignment.scheduledStart
                    const startTime = new Date(assignment.scheduledStart);
                    const top = timeToYPosition(startTime, startHour);

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
                        activeJobId={activeJob?.id}
                      />
                    );
                  })}
                </StationColumn>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
