import { useState, useCallback } from 'react';
import { isInternalTask } from '@flux/types';
import type { ScheduleSnapshot } from '@flux/types';
import { useClearAllAssignmentsMutation } from '../store';
import { useClearRecordedProgressMutation } from '../store/api/saisieApi';
import {
  buildOverrideLookup,
  buildSequenceIndexLookup,
  isInSafetyZone,
  makeSafetyKey,
} from '../utils/safetyZone';

export interface MassUnscheduleState {
  count: number;
  /** Default true on every modal open (opt-out). Uncheck to preserve. */
  includeInProgress: boolean;
  /** Default true on every modal open (opt-out). Uncheck to preserve. */
  includePinned: boolean;
  /** Default true on every modal open (opt-out). Uncheck to preserve.
   *  Mirrors the `includeFrozen` flag on the clearAllAssignments endpoint. */
  includeFrozen: boolean;
  /**
   * Default **false** on every modal open (opt-IN). Saisies d'avancement
   * represent real recorded work ; the chef must explicitly tick this box
   * to discard them. When true, the confirm action also fires the
   * clear-recorded-progress endpoint after the mass unschedule resolves.
   */
  resetRecordedProgress: boolean;
}

export function useMassUnschedule(snapshotData: ScheduleSnapshot | undefined) {
  const [clearAllAssignments] = useClearAllAssignmentsMutation();
  const [clearRecordedProgress] = useClearRecordedProgressMutation();
  const [confirmState, setConfirmState] = useState<MassUnscheduleState | null>(null);

  const getClearableCount = useCallback((
    includeInProgress = false,
    includePinned = false,
    includeFrozen = false,
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
      if (a.isCompleted) return false;
      if (!includePinned && a.isPinned) return false;
      if (!includeInProgress && a.scheduledStart <= nowStr && (!a.scheduledEnd || a.scheduledEnd > nowStr)) return false;
      // Safety-zone filter: skipped entirely when `includeFrozen` is on
      // (the user opted in to lift active-flocon tiles).
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
    // Always open the modal — even when nothing is currently clearable.
    // The user explicitly wants the entry point to be unconditional;
    // the dialog just shows "0 tuile(s) à effacer" in that case.
    setConfirmState({
      count: getClearableCount(true, true, true),
      includeInProgress: true,
      includePinned: true,
      includeFrozen: true,
      resetRecordedProgress: false, // opt-in : never on by default.
    });
  }, [getClearableCount]);

  const confirm = useCallback(async () => {
    if (!confirmState) return;
    const { includeInProgress, includePinned, includeFrozen, resetRecordedProgress } = confirmState;
    setConfirmState(null);
    await clearAllAssignments({
      includeInProgress,
      includePinned,
      includeFrozen,
    }).unwrap();
    if (resetRecordedProgress) {
      await clearRecordedProgress().unwrap();
    }
  }, [confirmState, clearAllAssignments, clearRecordedProgress]);

  const dismiss = useCallback(() => setConfirmState(null), []);

  return { confirmState, setConfirmState, getClearableCount, trigger, confirm, dismiss };
}
