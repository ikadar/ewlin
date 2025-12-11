/**
 * Station Conflict Validator
 * Checks for double-booking of stations.
 */

import type {
  ScheduleSnapshot,
  ScheduleConflict,
  ProposedAssignment,
  TaskAssignment,
} from '@flux/types';
import { rangesOverlap, parseTimestamp, type TimeRange } from '../utils/time.js';
import { getStationAssignments, findTask } from '../utils/helpers.js';
import { calculateEndTime } from './shared.js';

/**
 * Validate that the proposed assignment doesn't conflict with existing assignments on the station.
 */
export function validateStationConflict(
  proposed: ProposedAssignment,
  snapshot: ScheduleSnapshot
): ScheduleConflict | null {
  // Outsourced tasks don't have station conflicts (unlimited capacity)
  if (proposed.isOutsourced) {
    return null;
  }

  const task = findTask(snapshot, proposed.taskId);
  if (!task) {
    return null;
  }

  const proposedStart = parseTimestamp(proposed.scheduledStart);
  const proposedEnd = calculateEndTime(task, proposedStart);

  const proposedRange: TimeRange = {
    start: proposedStart,
    end: proposedEnd,
  };

  // Get existing assignments for this station (excluding current task if reassigning)
  const existingAssignments = getStationAssignments(snapshot, proposed.targetId).filter(
    (a) => a.taskId !== proposed.taskId
  );

  for (const existing of existingAssignments) {
    const existingRange = getAssignmentRange(existing);

    if (rangesOverlap(proposedRange, existingRange)) {
      const existingTask = findTask(snapshot, existing.taskId);
      return {
        type: 'StationConflict',
        message: `Station is already booked from ${existing.scheduledStart} to ${existing.scheduledEnd}`,
        taskId: proposed.taskId,
        relatedTaskId: existing.taskId,
        targetId: proposed.targetId,
        details: {
          existingTaskId: existing.taskId,
          existingJobId: existingTask?.jobId,
          conflictStart: existing.scheduledStart,
          conflictEnd: existing.scheduledEnd,
        },
      };
    }
  }

  return null;
}

/**
 * Get time range from an existing assignment.
 */
function getAssignmentRange(assignment: TaskAssignment): TimeRange {
  return {
    start: parseTimestamp(assignment.scheduledStart),
    end: parseTimestamp(assignment.scheduledEnd),
  };
}
