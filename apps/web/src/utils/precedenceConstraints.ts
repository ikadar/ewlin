/**
 * Precedence Constraint Utilities
 *
 * Calculate Y positions for precedence constraint visualization lines.
 * REQ-10: Precedence Constraint Visualization
 */

import type { ScheduleSnapshot, Task, TaskAssignment } from '@flux/types';
import { getEffectivePredecessorEnd, parseTimestamp } from '@flux/schedule-validator';
import { timeToYPosition } from '../components/TimelineColumn/utils';

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
 * Calculate the Y position for the predecessor constraint line (purple).
 *
 * This represents the earliest possible start time for a task based on
 * its predecessor's end time plus any required dry time for printing tasks.
 *
 * @returns Y position in pixels, or null if no constraint
 */
export function getPredecessorConstraint(
  task: Task,
  snapshot: ScheduleSnapshot,
  startHour: number,
  pixelsPerHour: number,
  gridStartDate?: Date
): number | null {
  // Find predecessor task
  const predecessor = getPredecessorTask(snapshot, task);
  if (!predecessor) {
    return null; // No predecessor = no constraint
  }

  // Find predecessor's assignment
  const predecessorAssignment = findAssignmentByTaskId(snapshot, predecessor.id);
  if (!predecessorAssignment) {
    return null; // Predecessor not scheduled = no constraint
  }

  // Get effective end time (includes dry time for printing tasks)
  const earliestStart = getEffectivePredecessorEnd(snapshot, {
    scheduledEnd: predecessorAssignment.scheduledEnd,
    targetId: predecessorAssignment.targetId,
    isOutsourced: predecessorAssignment.isOutsourced,
  });

  // Convert to Y position
  return timeToYPosition(earliestStart, startHour, pixelsPerHour, gridStartDate);
}

// Dry time in milliseconds (4 hours) - same as in @flux/schedule-validator
const DRY_TIME_MS = 4 * 60 * 60 * 1000;

/** Information about drying time for visualization */
export interface DryingTimeInfo {
  /** Station ID where the predecessor is scheduled (where to show the indicator) */
  predecessorStationId: string;
  /** Y position of predecessor task end */
  predecessorEndY: number;
  /** Y position where drying time ends */
  dryingEndY: number;
}

/**
 * Check if a station is a printing (offset) station that requires dry time.
 */
function isPrintingStation(snapshot: ScheduleSnapshot, stationId: string): boolean {
  const station = snapshot.stations.find((s) => s.id === stationId);
  if (!station) return false;

  const category = snapshot.categories.find((c) => c.id === station.categoryId);
  if (!category) return false;

  // Check if category name contains "offset" (case insensitive)
  return category.name.toLowerCase().includes('offset');
}

/**
 * Calculate the Y position for the successor constraint line (orange).
 *
 * This represents the latest possible start time for a task such that
 * it will finish (including any required dry time) before its successor's scheduled start time.
 *
 * @returns Y position in pixels, or null if no constraint
 */
export function getSuccessorConstraint(
  task: Task,
  snapshot: ScheduleSnapshot,
  startHour: number,
  pixelsPerHour: number,
  gridStartDate?: Date
): number | null {
  // Find successor task
  const successor = getSuccessorTask(snapshot, task);
  if (!successor) {
    return null; // No successor = no constraint
  }

  // Find successor's assignment
  const successorAssignment = findAssignmentByTaskId(snapshot, successor.id);
  if (!successorAssignment) {
    return null; // Successor not scheduled = no constraint
  }

  // Calculate latest start time
  const successorStart = parseTimestamp(successorAssignment.scheduledStart);

  // Get task duration - for internal tasks it's setupMinutes + runMinutes
  const taskDurationMinutes = task.type === 'Internal'
    ? task.duration.setupMinutes + task.duration.runMinutes
    : 0; // Outsourced tasks don't have minute-based duration
  const taskDurationMs = taskDurationMinutes * 60 * 1000; // minutes to ms

  // Check if current task requires dry time after completion
  // Dry time applies if this task is on a printing (offset) station
  let dryTimeMs = 0;
  if (task.type === 'Internal') {
    const requiresDryTime = isPrintingStation(snapshot, task.stationId);
    if (requiresDryTime) {
      dryTimeMs = DRY_TIME_MS;
    }
  }

  // Latest start = successor start - dry time - task duration
  const latestStart = new Date(successorStart.getTime() - dryTimeMs - taskDurationMs);

  // Convert to Y position
  return timeToYPosition(latestStart, startHour, pixelsPerHour, gridStartDate);
}

/**
 * Get drying time visualization info for a task.
 *
 * Returns information needed to render the drying time indicator:
 * - Station ID where predecessor is scheduled
 * - Y position of predecessor end
 * - Y position where drying ends
 *
 * @returns DryingTimeInfo or null if no drying time applies
 */
export function getDryingTimeInfo(
  task: Task,
  snapshot: ScheduleSnapshot,
  startHour: number,
  pixelsPerHour: number,
  gridStartDate?: Date
): DryingTimeInfo | null {
  // Find predecessor task
  const predecessor = getPredecessorTask(snapshot, task);
  if (!predecessor) {
    return null; // No predecessor = no drying time to show
  }

  // Find predecessor's assignment
  const predecessorAssignment = findAssignmentByTaskId(snapshot, predecessor.id);
  if (!predecessorAssignment) {
    return null; // Predecessor not scheduled = no drying time to show
  }

  // Check if predecessor requires dry time
  if (predecessorAssignment.isOutsourced) {
    return null; // Outsourced tasks don't have dry time
  }

  if (!isPrintingStation(snapshot, predecessorAssignment.targetId)) {
    return null; // Not a printing station = no dry time
  }

  // Calculate positions
  const predecessorEnd = parseTimestamp(predecessorAssignment.scheduledEnd);
  const dryingEnd = new Date(predecessorEnd.getTime() + DRY_TIME_MS);

  const predecessorEndY = timeToYPosition(predecessorEnd, startHour, pixelsPerHour, gridStartDate);
  const dryingEndY = timeToYPosition(dryingEnd, startHour, pixelsPerHour, gridStartDate);

  return {
    predecessorStationId: predecessorAssignment.targetId,
    predecessorEndY,
    dryingEndY,
  };
}
