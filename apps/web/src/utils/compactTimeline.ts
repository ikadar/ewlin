import type { ScheduleSnapshot, TaskAssignment, Task, Station, InternalTask } from '@flux/types';

/** Compact horizon options in hours */
export const COMPACT_HORIZONS = [
  { label: '4h', hours: 4 },
  { label: '8h', hours: 8 },
  { label: '24h', hours: 24 },
] as const;

export type CompactHorizon = (typeof COMPACT_HORIZONS)[number]['hours'];

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
 * Find the predecessor task for a given task (by sequenceOrder within the same job).
 */
function findPredecessorTask(task: Task, allTasks: Task[]): Task | undefined {
  if (task.sequenceOrder <= 1) return undefined;
  return allTasks.find(
    (t) => t.jobId === task.jobId && t.sequenceOrder === task.sequenceOrder - 1
  );
}

/**
 * Get the end time of a predecessor task, considering any updates made during compaction.
 */
function getPredecessorEndTime(
  task: Task,
  allTasks: Task[],
  assignments: TaskAssignment[],
  updatedEndTimes: Map<string, Date>
): Date | null {
  const predecessorTask = findPredecessorTask(task, allTasks);
  if (!predecessorTask) return null;

  // Check if predecessor was already updated during this compaction
  const updatedEnd = updatedEndTimes.get(predecessorTask.id);
  if (updatedEnd) return updatedEnd;

  // Otherwise, look up the original assignment
  const predecessorAssignment = assignments.find((a) => a.taskId === predecessorTask.id);
  return predecessorAssignment ? new Date(predecessorAssignment.scheduledEnd) : null;
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
  const now = options.now ?? new Date();
  const horizonMs = horizonHours * 60 * 60 * 1000;

  // Build lookup maps
  const taskMap = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const stationMap = new Map(snapshot.stations.map((s) => [s.id, s]));

  // Track updated end times for precedence checks
  const updatedEndTimes = new Map<string, Date>();
  // Track all assignment updates
  const updatedAssignmentsMap = new Map<string, { scheduledStart: string; scheduledEnd: string }>();

  let movedCount = 0;
  let skippedCount = 0;

  // Process each station
  for (const station of snapshot.stations) {
    // Get all assignments for this station, sorted by start time
    const stationAssignments = snapshot.assignments
      .filter((a) => a.targetId === station.id && !a.isOutsourced)
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

    if (stationAssignments.length === 0) continue;

    // Track the next available start time for this station
    let nextAvailableTime = now;

    for (const assignment of stationAssignments) {
      const task = taskMap.get(assignment.taskId);

      // Skip immobile tasks (already started)
      if (isTaskImmobile(assignment, now)) {
        skippedCount++;
        // Update next available time to after this task ends
        const endTime = new Date(assignment.scheduledEnd);
        if (endTime > nextAvailableTime) {
          nextAvailableTime = endTime;
        }
        // Track the end time for precedence
        updatedEndTimes.set(assignment.taskId, endTime);
        continue;
      }

      // Skip tasks outside the horizon
      if (!isWithinHorizon(assignment, now, horizonMs)) {
        continue;
      }

      // Calculate earliest possible start time
      let earliestStart = nextAvailableTime;

      // Check precedence constraint
      if (task) {
        const predecessorEnd = getPredecessorEndTime(
          task,
          snapshot.tasks,
          snapshot.assignments,
          updatedEndTimes
        );
        if (predecessorEnd && predecessorEnd > earliestStart) {
          earliestStart = predecessorEnd;
        }
      }

      // Calculate new end time
      const newEnd = calculateCompactedEndTime(
        task,
        assignment,
        earliestStart,
        stationMap.get(station.id),
        calculateEndTimeFn
      );

      // Check if the assignment actually moved
      const originalStart = new Date(assignment.scheduledStart);
      if (earliestStart.getTime() !== originalStart.getTime()) {
        movedCount++;
      }

      // Store the update
      updatedAssignmentsMap.set(assignment.id, {
        scheduledStart: earliestStart.toISOString(),
        scheduledEnd: newEnd,
      });

      // Track updated end time for precedence
      updatedEndTimes.set(assignment.taskId, new Date(newEnd));

      // Update next available time
      nextAvailableTime = new Date(newEnd);
    }
  }

  // Apply all updates to create new assignments array
  const newAssignments = snapshot.assignments.map((assignment) => {
    const updated = updatedAssignmentsMap.get(assignment.id);
    return updated
      ? {
          ...assignment,
          scheduledStart: updated.scheduledStart,
          scheduledEnd: updated.scheduledEnd,
          updatedAt: new Date().toISOString(),
        }
      : assignment;
  });

  console.log('Timeline compacted:', {
    horizonHours,
    movedCount,
    skippedCount,
    totalProcessed: updatedAssignmentsMap.size,
  });

  return {
    snapshot: { ...snapshot, assignments: newAssignments },
    movedCount,
    skippedCount,
  };
}
