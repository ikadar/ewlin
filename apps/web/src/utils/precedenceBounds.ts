/**
 * Precedence Bounds Utilities
 *
 * v0.3.54: Precalculate precedence bounds at drag start for O(1) validation.
 *
 * Instead of running full validation on every drag frame (O(n)),
 * we calculate bounds once at drag start and compare against them (O(1)).
 */

import type { ScheduleSnapshot, Task, TaskAssignment, Station } from '@flux/types';
import { parseTimestamp } from '@flux/schedule-validator';

/** Dry time in milliseconds (4 hours) - same as @flux/schedule-validator */
const DRY_TIME_MS = 4 * 60 * 60 * 1000;

/**
 * Precedence bounds for a dragged task.
 * Used for O(1) validation during drag.
 */
export interface PrecedenceBounds {
  /** Earliest valid start time (predecessor end + dry time). Null if no predecessor. */
  minStart: Date | null;
  /** Latest valid end time (successor start). Null if no successor. */
  maxEnd: Date | null;
  /** Task duration in ms (for calculating end from start) */
  taskDurationMs: number;
}

/**
 * Get all tasks for a job in sequence order.
 */
function getJobTasks(snapshot: ScheduleSnapshot, jobId: string): Task[] {
  return snapshot.tasks
    .filter((t) => t.jobId === jobId)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

/**
 * Get the predecessor task (if any) for a given task.
 */
function getPredecessorTask(snapshot: ScheduleSnapshot, task: Task): Task | undefined {
  const jobTasks = getJobTasks(snapshot, task.jobId);
  const taskIndex = jobTasks.findIndex((t) => t.id === task.id);
  if (taskIndex > 0) {
    return jobTasks[taskIndex - 1];
  }
  return undefined;
}

/**
 * Get the successor task (if any) for a given task.
 */
function getSuccessorTask(snapshot: ScheduleSnapshot, task: Task): Task | undefined {
  const jobTasks = getJobTasks(snapshot, task.jobId);
  const taskIndex = jobTasks.findIndex((t) => t.id === task.id);
  if (taskIndex >= 0 && taskIndex < jobTasks.length - 1) {
    return jobTasks[taskIndex + 1];
  }
  return undefined;
}

/**
 * Find an assignment by task ID.
 */
function findAssignmentByTaskId(
  snapshot: ScheduleSnapshot,
  taskId: string
): TaskAssignment | undefined {
  return snapshot.assignments.find((a) => a.taskId === taskId);
}

/**
 * Check if a station is a printing (offset) station that requires dry time.
 */
function isPrintingStation(snapshot: ScheduleSnapshot, stationId: string): boolean {
  const station = snapshot.stations.find((s) => s.id === stationId);
  if (!station) return false;

  const category = snapshot.categories.find((c) => c.id === station.categoryId);
  if (!category) return false;

  return category.name.toLowerCase().includes('offset');
}

/**
 * Calculate precedence bounds for a task at drag start.
 *
 * This is called ONCE when drag starts, then used for O(1) validation
 * on every drag frame.
 *
 * @param task - The task being dragged
 * @param snapshot - Current schedule snapshot
 * @returns Precedence bounds for O(1) validation
 */
export function calculatePrecedenceBounds(
  task: Task,
  snapshot: ScheduleSnapshot
): PrecedenceBounds {
  // Calculate task duration
  const taskDurationMs =
    task.type === 'Internal'
      ? (task.duration.setupMinutes + task.duration.runMinutes) * 60 * 1000
      : 0;

  // Find predecessor and calculate minStart
  let minStart: Date | null = null;
  const predecessor = getPredecessorTask(snapshot, task);
  if (predecessor) {
    const predecessorAssignment = findAssignmentByTaskId(snapshot, predecessor.id);
    if (predecessorAssignment) {
      const predecessorEnd = parseTimestamp(predecessorAssignment.scheduledEnd);

      // Check if predecessor requires dry time
      const requiresDryTime =
        !predecessorAssignment.isOutsourced &&
        isPrintingStation(snapshot, predecessorAssignment.targetId);

      if (requiresDryTime) {
        minStart = new Date(predecessorEnd.getTime() + DRY_TIME_MS);
      } else {
        minStart = predecessorEnd;
      }
    }
  }

  // Find successor and calculate maxEnd
  let maxEnd: Date | null = null;
  const successor = getSuccessorTask(snapshot, task);
  if (successor) {
    const successorAssignment = findAssignmentByTaskId(snapshot, successor.id);
    if (successorAssignment) {
      maxEnd = parseTimestamp(successorAssignment.scheduledStart);
    }
  }

  return { minStart, maxEnd, taskDurationMs };
}

/**
 * O(1) precedence validation using precalculated bounds.
 *
 * @param scheduledStart - Proposed start time (ISO string or Date)
 * @param bounds - Precalculated bounds from calculatePrecedenceBounds
 * @returns Object with validation result and conflict type
 */
export function validatePrecedenceBounds(
  scheduledStart: string | Date,
  bounds: PrecedenceBounds
): {
  isValid: boolean;
  hasPredecessorConflict: boolean;
  hasSuccessorConflict: boolean;
} {
  const startTime =
    typeof scheduledStart === 'string' ? parseTimestamp(scheduledStart) : scheduledStart;
  const endTime = new Date(startTime.getTime() + bounds.taskDurationMs);

  // Check predecessor constraint (minStart)
  const hasPredecessorConflict = bounds.minStart !== null && startTime < bounds.minStart;

  // Check successor constraint (maxEnd)
  const hasSuccessorConflict = bounds.maxEnd !== null && endTime > bounds.maxEnd;

  return {
    isValid: !hasPredecessorConflict && !hasSuccessorConflict,
    hasPredecessorConflict,
    hasSuccessorConflict,
  };
}
