/**
 * Precedence Validator
 * Checks that task sequence order is respected.
 */

import type { ScheduleSnapshot, ScheduleConflict, ProposedAssignment } from '@flux/types';
import { parseTimestamp } from '../utils/time.js';
import { findTask, getPredecessorTask, findAssignmentByTaskId } from '../utils/helpers.js';

/**
 * Validate that the proposed assignment respects task sequence order.
 * A task can only start after its predecessor has completed.
 */
export function validatePrecedence(
  proposed: ProposedAssignment,
  snapshot: ScheduleSnapshot
): ScheduleConflict | null {
  // If bypass flag is set, skip this validation
  if (proposed.bypassPrecedence === true) {
    return null;
  }

  const task = findTask(snapshot, proposed.taskId);
  if (!task) {
    return null;
  }

  const predecessor = getPredecessorTask(snapshot, task);
  if (!predecessor) {
    // First task in job, no predecessor to check
    return null;
  }

  const predecessorAssignment = findAssignmentByTaskId(snapshot, predecessor.id);
  if (!predecessorAssignment) {
    // Predecessor is not scheduled yet
    return {
      type: 'PrecedenceConflict',
      message: `Predecessor task must be scheduled first`,
      taskId: proposed.taskId,
      relatedTaskId: predecessor.id,
      details: {
        predecessorTaskId: predecessor.id,
        reason: 'unscheduled',
      },
    };
  }

  const proposedStart = parseTimestamp(proposed.scheduledStart);
  const predecessorEnd = parseTimestamp(predecessorAssignment.scheduledEnd);

  if (proposedStart < predecessorEnd) {
    return {
      type: 'PrecedenceConflict',
      message: `Task cannot start before predecessor completes at ${predecessorAssignment.scheduledEnd}`,
      taskId: proposed.taskId,
      relatedTaskId: predecessor.id,
      details: {
        predecessorTaskId: predecessor.id,
        predecessorEnd: predecessorAssignment.scheduledEnd,
        proposedStart: proposed.scheduledStart,
        suggestedStart: predecessorAssignment.scheduledEnd,
      },
    };
  }

  return null;
}

/**
 * Calculate the suggested start time that would satisfy precedence.
 */
export function getSuggestedStartForPrecedence(
  proposed: ProposedAssignment,
  snapshot: ScheduleSnapshot
): string | null {
  const task = findTask(snapshot, proposed.taskId);
  if (!task) {
    return null;
  }

  const predecessor = getPredecessorTask(snapshot, task);
  if (!predecessor) {
    return null;
  }

  const predecessorAssignment = findAssignmentByTaskId(snapshot, predecessor.id);
  if (!predecessorAssignment) {
    return null;
  }

  return predecessorAssignment.scheduledEnd;
}
