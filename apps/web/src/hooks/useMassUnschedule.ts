import { useState, useCallback } from 'react';
import { isInternalTask } from '@flux/types';
import type { ScheduleSnapshot } from '@flux/types';
import { useClearAllAssignmentsMutation, useClearRecordedProgressMutation } from '../store';
import {
  buildOverrideLookup,
  buildSequenceIndexLookup,
  isInSafetyZone,
  makeSafetyKey,
} from '../utils/safetyZone';

export interface MassUnscheduleState {
  phase: 'options' | 'working' | 'result';
  count: number;
  includeInProgress: boolean;
  includePinned: boolean;
  includeFrozen: boolean;
  resetRecordedProgress: boolean;
  includeCompleted: boolean;
  unassignedCount?: number;
  clearedProgress?: boolean;
  error?: string;
}

export function useMassUnschedule(snapshotData: ScheduleSnapshot | undefined) {
  const [clearAllAssignments] = useClearAllAssignmentsMutation();
  const [clearRecordedProgress] = useClearRecordedProgressMutation();
  const [confirmState, setConfirmState] = useState<MassUnscheduleState | null>(null);

  const getClearableCount = useCallback((
    includeInProgress = false,
    includePinned = false,
    includeFrozen = false,
    includeCompleted = false,
  ) => {
    if (!snapshotData) return 0;
    const now = new Date();
    const nowStr = now.toISOString();
    const frozenUntil = snapshotData.safetyZoneFrozenUntil ?? null;
    const overrides = buildOverrideLookup(snapshotData);
    const seqByTask = frozenUntil ? buildSequenceIndexLookup(snapshotData) : null;
    const jobByTask = new Map<string, string>();
    if (seqByTask) {
      for (const job of snapshotData.jobs) {
        for (const tid of job.taskIds ?? []) jobByTask.set(tid, job.id);
      }
    }
    const tasksById = new Map(snapshotData.tasks.map((t) => [t.id, t]));
    return snapshotData.assignments.filter((a) => {
      if (!includeCompleted && a.isCompleted) return false;
      if (!includePinned && a.isPinned) return false;
      if (!includeInProgress && a.scheduledStart <= nowStr && (!a.scheduledEnd || a.scheduledEnd > nowStr)) return false;
      if (!includeFrozen && seqByTask && isInSafetyZone(a.scheduledStart, frozenUntil, now)) {
        const jobId = jobByTask.get(a.taskId);
        const seqIdx = seqByTask.get(a.taskId);
        const task = tasksById.get(a.taskId);
        if (jobId !== undefined && seqIdx !== undefined && task && isInternalTask(task)) {
          const overridden = overrides.get(makeSafetyKey(jobId, seqIdx, a.targetId)) === true;
          if (!overridden) return false;
        }
      }
      return true;
    }).length;
  }, [snapshotData]);

  const trigger = useCallback(() => {
    setConfirmState({
      phase: 'options',
      count: getClearableCount(true, true, true, false),
      includeInProgress: true,
      includePinned: true,
      includeFrozen: true,
      resetRecordedProgress: false,
      includeCompleted: false,
    });
  }, [getClearableCount]);

  const confirm = useCallback(async () => {
    if (!confirmState || confirmState.phase !== 'options') return;
    const { includeInProgress, includePinned, includeFrozen, resetRecordedProgress, includeCompleted } = confirmState;

    setConfirmState((prev) => prev ? { ...prev, phase: 'working' } : prev);

    try {
      const result = await clearAllAssignments({
        includeInProgress,
        includePinned,
        includeFrozen,
        includeCompleted,
      }).unwrap();

      let didClearProgress = false;
      if (resetRecordedProgress) {
        await clearRecordedProgress().unwrap();
        didClearProgress = true;
      }

      setConfirmState((prev) => prev ? {
        ...prev,
        phase: 'result',
        unassignedCount: result.unassignedCount,
        clearedProgress: didClearProgress,
      } : prev);
    } catch (err) {
      const message = err && typeof err === 'object' && 'data' in err
        ? String((err as { data?: { error?: string } }).data?.error ?? 'Erreur inconnue')
        : 'Erreur réseau';
      setConfirmState((prev) => prev ? {
        ...prev,
        phase: 'result',
        error: message,
      } : prev);
    }
  }, [confirmState, clearAllAssignments, clearRecordedProgress]);

  const dismiss = useCallback(() => setConfirmState(null), []);

  return { confirmState, setConfirmState, getClearableCount, trigger, confirm, dismiss };
}
