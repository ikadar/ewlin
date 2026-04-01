/**
 * Conflict Recalculation Utility
 * Centralized conflict detection for all assignment changes.
 */

import type { ScheduleSnapshot, ScheduleConflict, ProposedAssignment } from '@flux/types';
import { validateAssignment } from '@flux/schedule-validator';

/**
 * Recalculates all precedence conflicts for the current snapshot.
 * This should be called whenever assignments change to ensure
 * the conflicts array is always up-to-date.
 *
 * @param snapshot - The current schedule snapshot
 * @returns Array of all current precedence conflicts
 */
const RECALCULATED_TYPES: Set<string> = new Set(['PrecedenceConflict', 'AvailabilityConflict']);

export function recalculatePrecedenceConflicts(snapshot: ScheduleSnapshot): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Validate each assignment for precedence and availability conflicts
  for (const assignment of snapshot.assignments) {
    const proposedAssignment: ProposedAssignment = {
      taskId: assignment.taskId,
      targetId: assignment.targetId,
      isOutsourced: assignment.isOutsourced,
      scheduledStart: assignment.scheduledStart,
      bypassPrecedence: false,
    };

    const validationResult = validateAssignment(proposedAssignment, snapshot);
    const relevantConflicts = validationResult.conflicts.filter(
      (c) => RECALCULATED_TYPES.has(c.type)
    );
    conflicts.push(...relevantConflicts);
  }

  // Deduplicate conflicts (same type + taskId + relatedTaskId combination)
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    const key = `${conflict.type}-${conflict.taskId}-${conflict.relatedTaskId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Updates the snapshot's conflicts array with recalculated precedence conflicts.
 * Preserves non-precedence conflicts that may have been set by other means.
 *
 * @param snapshot - The current schedule snapshot
 * @returns Updated snapshot with recalculated conflicts
 */
export function updateSnapshotConflicts(snapshot: ScheduleSnapshot): ScheduleSnapshot {
  // Keep conflicts that are not recalculated by us
  const preservedConflicts = snapshot.conflicts.filter(
    (c) => !RECALCULATED_TYPES.has(c.type)
  );

  // Recalculate precedence + availability conflicts
  const recalculated = recalculatePrecedenceConflicts(snapshot);

  return {
    ...snapshot,
    conflicts: [...preservedConflicts, ...recalculated],
  };
}
