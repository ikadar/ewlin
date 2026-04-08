import { useState, useCallback } from 'react';
import { isInternalTask } from '@flux/types';
import type { ScheduleSnapshot } from '@flux/types';
import { useClearAllAssignmentsMutation, useFuseTaskMutation } from '../store';

export interface MassUnscheduleState {
  count: number;
  includeInProgress: boolean;
  fuseSplits: boolean;
  includePinned: boolean;
}

export function useMassUnschedule(snapshotData: ScheduleSnapshot | undefined) {
  const [clearAllAssignments] = useClearAllAssignmentsMutation();
  const [fuseTask] = useFuseTaskMutation();
  const [confirmState, setConfirmState] = useState<MassUnscheduleState | null>(null);

  const getClearableCount = useCallback((includeInProgress = false, includePinned = false) => {
    if (!snapshotData) return 0;
    const nowStr = new Date().toISOString();
    return snapshotData.assignments.filter((a) => {
      if (a.isCompleted) return false;
      if (!includePinned && a.isPinned) return false;
      if (!includeInProgress && a.scheduledStart <= nowStr && (!a.scheduledEnd || a.scheduledEnd > nowStr)) return false;
      return true;
    }).length;
  }, [snapshotData]);

  const trigger = useCallback(() => {
    const countAll = getClearableCount(true, true);
    if (countAll > 0) {
      setConfirmState({ count: getClearableCount(), includeInProgress: false, fuseSplits: false, includePinned: false });
    }
  }, [getClearableCount]);

  const confirm = useCallback(async () => {
    if (!confirmState) return;
    const { includeInProgress, fuseSplits, includePinned } = confirmState;
    setConfirmState(null);
    const result = await clearAllAssignments({ includeInProgress, fuseSplits, includePinned }).unwrap();

    if (fuseSplits && snapshotData) {
      const nowStr = new Date().toISOString();
      const splitGroups = new Map<string, string[]>();
      for (const task of snapshotData.tasks) {
        if (isInternalTask(task) && task.splitGroupId) {
          const group = splitGroups.get(task.splitGroupId) || [];
          group.push(task.id);
          splitGroups.set(task.splitGroupId, group);
        }
      }
      for (const [, memberIds] of splitGroups) {
        const allCleared = memberIds.every((id) => {
          const a = snapshotData.assignments.find((asn) => asn.taskId === id);
          if (!a) return true;
          if (a.isCompleted) return false;
          if (!includeInProgress && a.scheduledStart <= nowStr
              && (!a.scheduledEnd || a.scheduledEnd > nowStr)) return false;
          return true;
        });
        if (allCleared) {
          try { await fuseTask(memberIds[0]).unwrap(); } catch { /* skip */ }
        }
      }
    }

    return result;
  }, [confirmState, clearAllAssignments, fuseTask, snapshotData]);

  const dismiss = useCallback(() => setConfirmState(null), []);

  return { confirmState, setConfirmState, getClearableCount, trigger, confirm, dismiss };
}
