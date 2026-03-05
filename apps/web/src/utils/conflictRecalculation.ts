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
export function recalculatePrecedenceConflicts(snapshot: ScheduleSnapshot): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Validate each assignment for precedence conflicts
  for (const assignment of snapshot.assignments) {
    const proposedAssignment: ProposedAssignment = {
      taskId: assignment.taskId,
      targetId: assignment.targetId,
      isOutsourced: assignment.isOutsourced,
      scheduledStart: assignment.scheduledStart,
      bypassPrecedence: false,
    };

    const validationResult = validateAssignment(proposedAssignment, snapshot);
    const precedenceConflicts = validationResult.conflicts.filter(
      (c) => c.type === 'PrecedenceConflict'
    );
    conflicts.push(...precedenceConflicts);
  }

  // Deduplicate conflicts (same taskId + relatedTaskId combination)
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    const key = `${conflict.taskId}-${conflict.relatedTaskId ?? ''}`;
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
  // Keep non-precedence conflicts
  const nonPrecedenceConflicts = snapshot.conflicts.filter(
    (c) => c.type !== 'PrecedenceConflict'
  );

  // Recalculate precedence conflicts
  const precedenceConflicts = recalculatePrecedenceConflicts(snapshot);

  return {
    ...snapshot,
    conflicts: [...nonPrecedenceConflicts, ...precedenceConflicts],
  };
}
