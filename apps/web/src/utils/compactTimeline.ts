import type { ScheduleSnapshot, TaskAssignment, Task, Station, InternalTask, Element } from '@flux/types';
import { DRY_TIME_MS } from '@flux/types';
import { getJobIdForTask, compareTaskOrder } from './taskHelpers';
import { isPrintingStation } from './precedenceConstraints';
import { snapToNextWorkingTime, roundToNearestQuarterHour } from './workingTime';
import { COMPACT_HORIZONS } from '../constants';
import type { CompactHorizon } from '../constants';

export { COMPACT_HORIZONS };
export type { CompactHorizon };


/**
 * Check if a task is immobile (cannot be moved during compaction).
 * A task is immobile if:
 * - It has already started (scheduledStart < now)
 * - It is currently in progress (scheduledStart <= now && scheduledEnd > now)
 */
function isTaskImmobile(assignment: TaskAssignment, now: Date): boolean {
  const start = new Date(assignment.scheduledStart);
  return start < now;
}

/**
 * Check if a task is within the compaction horizon.
 * A task is within horizon if scheduledStart is between now and now + horizon.
 */
function isWithinHorizon(assignment: TaskAssignment, now: Date, horizonMs: number): boolean {
  const start = new Date(assignment.scheduledStart);
  const horizonEnd = new Date(now.getTime() + horizonMs);
  return start >= now && start <= horizonEnd;
}

/**
 * Find the predecessor task for a given task (positional lookup in sorted element tasks).
 */
function findPredecessorTask(task: Task, allTasks: Task[], _elements: Element[]): Task | undefined {
  const elementTasks = allTasks
    .filter((t) => t.elementId === task.elementId)
    .sort(compareTaskOrder);

  const taskIndex = elementTasks.findIndex((t) => t.id === task.id);
  if (taskIndex > 0) {
    return elementTasks[taskIndex - 1];
  }
  return undefined;
}

/**
 * Get the end time of a single task, considering any updates made during compaction.
 * Includes drying time if the task is at a printing station.
 * Skips drying time when the successor is in the same split group.
 */
function getTaskEndTime(
  task: Task,
  snapshot: ScheduleSnapshot,
  updatedEndTimes: Map<string, Date>,
  successorTask?: Task
): Date | null {
  const assignment = snapshot.assignments.find((a) => a.taskId === task.id);
  if (!assignment) return null;

  const updatedEnd = updatedEndTimes.get(task.id);
  const endTime = updatedEnd ?? new Date(assignment.scheduledEnd);

  // Skip dry time between parts of the same split group
  const sameGroup = successorTask
    && task.type === 'Internal' && successorTask.type === 'Internal'
    && (task as InternalTask).splitGroupId != null
    && (task as InternalTask).splitGroupId === (successorTask as InternalTask).splitGroupId;

  if (isPrintingStation(snapshot, assignment.targetId) && !sameGroup) {
    return new Date(endTime.getTime() + DRY_TIME_MS);
  }

  return endTime;
}

/**
 * Get the end time of predecessor tasks, considering any updates made during compaction.
 * Checks both intra-element (same element, previous sequenceOrder) and cross-element
 * (prerequisiteElementIds → last task of each prerequisite element) predecessors.
 * Returns the latest end time across all scheduled predecessors.
 */
function getPredecessorEndTime(
  task: Task,
  snapshot: ScheduleSnapshot,
  updatedEndTimes: Map<string, Date>
): Date | null {
  // Intra-element predecessor (same element, sequenceOrder - 1)
  const intraElementPred = findPredecessorTask(task, snapshot.tasks, snapshot.elements);
  if (intraElementPred) {
    return getTaskEndTime(intraElementPred, snapshot, updatedEndTimes, task);
  }

  // Cross-element predecessors (first task of element → check prerequisiteElementIds)
  if (task.sequenceOrder > 0) return null;

  const element = snapshot.elements.find((e) => e.id === task.elementId);
  if (!element || element.prerequisiteElementIds.length === 0) return null;

  const taskById = new Map(snapshot.tasks.map((t) => [t.id, t]));
  let latestEnd: Date | null = null;

  for (const prereqElemId of element.prerequisiteElementIds) {
    const prereqElem = snapshot.elements.find((e) => e.id === prereqElemId);
    if (!prereqElem) continue;

    // Find the last task of the prerequisite element (highest sequenceOrder)
    const prereqTasks = prereqElem.taskIds
      .map((id) => taskById.get(id))
      .filter((t): t is Task => t !== undefined)
      .sort(compareTaskOrder);
    const lastTask = prereqTasks[prereqTasks.length - 1];
    if (!lastTask) continue;

    const endTime = getTaskEndTime(lastTask, snapshot, updatedEndTimes);
    if (endTime && (!latestEnd || endTime > latestEnd)) {
      latestEnd = endTime;
    }
  }

  return latestEnd;
}

/**
 * Calculate the new end time for an assignment during compaction.
 * Uses the provided calculateEndTime function for internal tasks,
 * or preserves original duration for other task types.
 */
function calculateCompactedEndTime(
  task: Task | undefined,
  assignment: TaskAssignment,
  newStart: Date,
  station: Station | undefined,
  calculateEndTimeFn: (task: InternalTask, start: string, station: Station | undefined) => string
): string {
  if (task?.type === 'Internal') {
    return calculateEndTimeFn(task as InternalTask, newStart.toISOString(), station);
  }
  // Preserve original duration for non-internal tasks
  const originalDuration = new Date(assignment.scheduledEnd).getTime() - new Date(assignment.scheduledStart).getTime();
  return new Date(newStart.getTime() + originalDuration).toISOString();
}

export interface CompactTimelineOptions {
  /** The schedule snapshot to compact */
  snapshot: ScheduleSnapshot;
  /** Compaction horizon in hours */
  horizonHours: CompactHorizon;
  /** Current time (defaults to now) */
  now?: Date;
  /** Function to calculate end time considering station operating hours */
  calculateEndTime: (task: InternalTask, start: string, station: Station | undefined) => string;
}

export interface CompactTimelineResult {
  /** Updated snapshot with compacted assignments */
  snapshot: ScheduleSnapshot;
  /** Number of assignments that were moved */
  movedCount: number;
  /** Number of assignments that were skipped (immobile) */
  skippedCount: number;
}

interface ProcessAssignmentContext {
  assignment: TaskAssignment;
  task: Task | undefined;
  now: Date;
  horizonMs: number;
  nextAvailableTime: Date;
  snapshot: ScheduleSnapshot;
  updatedEndTimes: Map<string, Date>;
  station: Station;
  stationMap: Map<string, Station>;
  calculateEndTimeFn: (task: InternalTask, start: string, station: Station | undefined) => string;
}

interface ProcessAssignmentResult {
  nextAvailableTime: Date;
  update?: { scheduledStart: string; scheduledEnd: string };
  moved: boolean;
  skipped: boolean;
}

/**
 * Process a single assignment during compaction.
 * Extracted to reduce cognitive complexity.
 */
function processAssignment(ctx: ProcessAssignmentContext): ProcessAssignmentResult {
  const { assignment, task, now, horizonMs, snapshot, updatedEndTimes, station, stationMap, calculateEndTimeFn } = ctx;
  let nextAvailableTime = ctx.nextAvailableTime;

  // Skip immobile tasks (already started)
  if (isTaskImmobile(assignment, now)) {
    const endTime = new Date(assignment.scheduledEnd);
    if (endTime > nextAvailableTime) {
      nextAvailableTime = endTime;
    }
    updatedEndTimes.set(assignment.taskId, endTime);
    return { nextAvailableTime, skipped: true, moved: false };
  }

  // Skip tasks outside the horizon
  if (!isWithinHorizon(assignment, now, horizonMs)) {
    return { nextAvailableTime, skipped: false, moved: false };
  }

  // Calculate earliest possible start time
  let earliestStart = nextAvailableTime;

  // Check precedence constraint (includes drying time for printing stations)
  if (task) {
    const predecessorEnd = getPredecessorEndTime(task, snapshot, updatedEndTimes);
    if (predecessorEnd && predecessorEnd > earliestStart) {
      earliestStart = predecessorEnd;
    }
  }

  // Snap to station operating hours (e.g., predecessor ends at 15:00 but station opens 07:00-14:00 → next day 07:00)
  earliestStart = snapToNextWorkingTime(earliestStart, station);

  // Calculate new end time
  const newEnd = calculateCompactedEndTime(task, assignment, earliestStart, stationMap.get(station.id), calculateEndTimeFn);

  // Check if the assignment actually moved
  const originalStart = new Date(assignment.scheduledStart);
  const moved = earliestStart.getTime() !== originalStart.getTime();

  // Store the update
  const update = { scheduledStart: earliestStart.toISOString(), scheduledEnd: newEnd };
  updatedEndTimes.set(assignment.taskId, new Date(newEnd));

  return { nextAvailableTime: new Date(newEnd), update, moved, skipped: false };
}

/**
 * Compact all assignments across all stations within the specified time horizon.
 *
 * Algorithm:
 * 1. For each station (in display order):
 *    a. Get assignments within time horizon (movable tasks)
 *    b. Sort by scheduled start time
 *    c. For each assignment:
 *       - Calculate earliest start: max(previousTaskEnd, predecessorEnd, now)
 *       - Update the assignment times
 * 2. Return the updated snapshot
 *
 * Rules:
 * - Tasks that have already started (scheduledStart < now) are immobile
 * - Tasks outside the horizon are not affected
 * - Precedence rules are respected (task cannot start before predecessor ends)
 */
export function compactTimeline(options: CompactTimelineOptions): CompactTimelineResult {
  const { snapshot, horizonHours, calculateEndTime: calculateEndTimeFn } = options;
  const now = roundToNearestQuarterHour(options.now ?? new Date());
  const horizonMs = horizonHours * 60 * 60 * 1000;

  const taskMap = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const stationMap = new Map(snapshot.stations.map((s) => [s.id, s]));
  const updatedEndTimes = new Map<string, Date>();
  const updatedAssignmentsMap = new Map<string, { scheduledStart: string; scheduledEnd: string }>();

  let movedCount = 0;
  let skippedCount = 0;

  for (const station of snapshot.stations) {
    const stationAssignments = snapshot.assignments
      .filter((a) => a.targetId === station.id && !a.isOutsourced)
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

    if (stationAssignments.length === 0) continue;

    let nextAvailableTime = now;

    for (const assignment of stationAssignments) {
      const result = processAssignment({
        assignment,
        task: taskMap.get(assignment.taskId),
        now,
        horizonMs,
        nextAvailableTime,
        snapshot,
        updatedEndTimes,
        station,
        stationMap,
        calculateEndTimeFn,
      });

      nextAvailableTime = result.nextAvailableTime;
      if (result.skipped) skippedCount++;
      if (result.moved) movedCount++;
      if (result.update) updatedAssignmentsMap.set(assignment.id, result.update);
    }
  }

  const newAssignments = snapshot.assignments.map((assignment) => {
    const updated = updatedAssignmentsMap.get(assignment.id);
    return updated
      ? { ...assignment, scheduledStart: updated.scheduledStart, scheduledEnd: updated.scheduledEnd, updatedAt: new Date().toISOString() }
      : assignment;
  });

  console.log('Timeline compacted:', { horizonHours, movedCount, skippedCount, totalProcessed: updatedAssignmentsMap.size });

  return { snapshot: { ...snapshot, assignments: newAssignments }, movedCount, skippedCount };
}
