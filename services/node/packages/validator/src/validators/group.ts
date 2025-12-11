/**
 * Group Capacity Validator
 * Checks that station group MaxConcurrent is not exceeded.
 */

import type { ScheduleSnapshot, ScheduleConflict, ProposedAssignment } from '@flux/types';
import { parseTimestamp, getMaxConcurrent, type TimeRange } from '../utils/time.js';
import { findStation, findGroup, getGroupAssignments, findTask } from '../utils/helpers.js';
import { calculateEndTime } from './shared.js';

/**
 * Validate that the proposed assignment doesn't exceed group capacity.
 */
export function validateGroupCapacity(
  proposed: ProposedAssignment,
  snapshot: ScheduleSnapshot
): ScheduleConflict | null {
  // Outsourced tasks have unlimited capacity
  if (proposed.isOutsourced) {
    return null;
  }

  const station = findStation(snapshot, proposed.targetId);
  if (!station) {
    return null;
  }

  const group = findGroup(snapshot, station.groupId);
  if (!group) {
    return null;
  }

  // Unlimited capacity
  if (group.maxConcurrent === null) {
    return null;
  }

  const task = findTask(snapshot, proposed.taskId);
  if (!task) {
    return null;
  }

  const proposedStart = parseTimestamp(proposed.scheduledStart);
  const proposedEnd = calculateEndTime(task, proposedStart);

  // Get all current assignments in the group (excluding the proposed task)
  const groupAssignments = getGroupAssignments(snapshot, station.groupId).filter(
    (a) => a.taskId !== proposed.taskId
  );

  // Convert to time ranges
  const existingRanges: TimeRange[] = groupAssignments.map((a) => ({
    start: parseTimestamp(a.scheduledStart),
    end: parseTimestamp(a.scheduledEnd),
  }));

  // Add the proposed assignment
  const allRanges: TimeRange[] = [...existingRanges, { start: proposedStart, end: proposedEnd }];

  // Check maximum concurrent
  const maxConcurrent = getMaxConcurrent(allRanges);

  if (maxConcurrent > group.maxConcurrent) {
    return {
      type: 'GroupCapacityConflict',
      message: `Group "${group.name}" capacity (${String(group.maxConcurrent)}) would be exceeded`,
      taskId: proposed.taskId,
      targetId: proposed.targetId,
      details: {
        groupId: group.id,
        groupName: group.name,
        maxAllowed: group.maxConcurrent,
        wouldBe: maxConcurrent,
      },
    };
  }

  return null;
}
