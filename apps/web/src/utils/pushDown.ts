/**
 * Push-Down Logic
 * When inserting a tile that would overlap with existing tiles on a capacity-1 station,
 * subsequent tiles are pushed down (later in time).
 */

import type { TaskAssignment } from '@flux/types';

export interface PushDownResult {
  /** Updated assignments (with shifted times) */
  updatedAssignments: TaskAssignment[];
  /** IDs of assignments that were shifted */
  shiftedIds: string[];
}

/**
 * Calculate push-down shifts for assignments on a station.
 * All assignments that start at or after the new tile's start time
 * are shifted by the new tile's duration.
 *
 * @param assignments - All current assignments
 * @param stationId - Station where the new tile is being placed
 * @param newStart - Start time of the new tile (ISO timestamp)
 * @param newEnd - End time of the new tile (ISO timestamp)
 * @param excludeTaskId - Task ID to exclude (the task being assigned)
 * @returns Updated assignments with push-down applied
 */
export function applyPushDown(
  assignments: TaskAssignment[],
  stationId: string,
  newStart: string,
  newEnd: string,
  excludeTaskId: string
): PushDownResult {
  const newStartTime = new Date(newStart).getTime();
  const newEndTime = new Date(newEnd).getTime();
  const shiftDuration = newEndTime - newStartTime;

  const shiftedIds: string[] = [];

  const updatedAssignments = assignments.map((assignment) => {
    // Skip if not on the same station
    if (assignment.isOutsourced || assignment.targetId !== stationId) {
      return assignment;
    }

    // Skip the task being assigned (in case it's a reschedule)
    if (assignment.taskId === excludeTaskId) {
      return assignment;
    }

    const assignmentStart = new Date(assignment.scheduledStart).getTime();
    const assignmentEnd = new Date(assignment.scheduledEnd).getTime();

    // Check if this assignment overlaps with or comes after the new tile
    // We shift if the assignment starts at or after the new tile's start
    // OR if the assignment overlaps with the new tile
    const overlaps =
      (assignmentStart >= newStartTime && assignmentStart < newEndTime) ||
      (assignmentEnd > newStartTime && assignmentEnd <= newEndTime) ||
      (assignmentStart <= newStartTime && assignmentEnd >= newEndTime);

    const startsAfter = assignmentStart >= newStartTime;

    if (overlaps || startsAfter) {
      // Shift this assignment by the new tile's duration
      const newAssignmentStart = new Date(assignmentStart + shiftDuration);
      const newAssignmentEnd = new Date(assignmentEnd + shiftDuration);

      shiftedIds.push(assignment.id);

      return {
        ...assignment,
        scheduledStart: newAssignmentStart.toISOString(),
        scheduledEnd: newAssignmentEnd.toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return assignment;
  });

  return {
    updatedAssignments,
    shiftedIds,
  };
}

/**
 * Check if inserting a tile at a given position would cause overlaps.
 *
 * @param assignments - All current assignments
 * @param stationId - Station where the tile would be placed
 * @param newStart - Start time of the new tile (ISO timestamp)
 * @param newEnd - End time of the new tile (ISO timestamp)
 * @param excludeTaskId - Task ID to exclude
 * @returns True if there would be overlaps requiring push-down
 */
export function wouldCauseOverlap(
  assignments: TaskAssignment[],
  stationId: string,
  newStart: string,
  newEnd: string,
  excludeTaskId: string
): boolean {
  const newStartTime = new Date(newStart).getTime();
  const newEndTime = new Date(newEnd).getTime();

  return assignments.some((assignment) => {
    // Skip if not on the same station
    if (assignment.isOutsourced || assignment.targetId !== stationId) {
      return false;
    }

    // Skip the task being assigned
    if (assignment.taskId === excludeTaskId) {
      return false;
    }

    const assignmentStart = new Date(assignment.scheduledStart).getTime();
    const assignmentEnd = new Date(assignment.scheduledEnd).getTime();

    // Check for overlap
    return assignmentStart < newEndTime && assignmentEnd > newStartTime;
  });
}
