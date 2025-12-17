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
 * Tiles that overlap with the new tile are shifted to start at the new tile's end.
 * Subsequent tiles are cascaded to avoid overlaps.
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

  // Get assignments on this station, sorted by start time
  const stationAssignments = assignments
    .filter(
      (a) => !a.isOutsourced && a.targetId === stationId && a.taskId !== excludeTaskId
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
    );

  const shiftedIds: string[] = [];
  const shiftMap = new Map<string, { newStart: number; newEnd: number }>();

  // Track the "earliest available time" - initially the end of the new tile
  let earliestAvailable = newEndTime;

  for (const assignment of stationAssignments) {
    const startTime = new Date(assignment.scheduledStart).getTime();
    const endTime = new Date(assignment.scheduledEnd).getTime();
    const duration = endTime - startTime;

    // Check if this assignment overlaps with the new tile
    const overlapWithNewTile = startTime < newEndTime && endTime > newStartTime;

    // Only consider cascade shifting for tiles that start at or after the new tile's position
    const startsAtOrAfterNewTile = startTime >= newStartTime;

    // Check if this tile would overlap with previously shifted tiles (cascade effect)
    const wouldOverlapWithShifted = startsAtOrAfterNewTile && startTime < earliestAvailable;

    if (overlapWithNewTile || wouldOverlapWithShifted) {
      // Need to shift this tile to start at earliest available slot
      const newShiftedStart = earliestAvailable;
      const newShiftedEnd = newShiftedStart + duration;

      shiftedIds.push(assignment.id);
      shiftMap.set(assignment.id, { newStart: newShiftedStart, newEnd: newShiftedEnd });

      // Update earliest available for cascading shifts
      earliestAvailable = newShiftedEnd;
    } else if (startsAtOrAfterNewTile) {
      // This tile doesn't need to shift, but update tracking for later tiles
      // Only update if this tile is after the new tile position
      earliestAvailable = Math.max(earliestAvailable, endTime);
    }
    // Tiles before the new tile position are ignored for cascade tracking
  }

  // Apply shifts to all assignments
  const updatedAssignments = assignments.map((assignment) => {
    const shift = shiftMap.get(assignment.id);
    if (shift) {
      return {
        ...assignment,
        scheduledStart: new Date(shift.newStart).toISOString(),
        scheduledEnd: new Date(shift.newEnd).toISOString(),
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
