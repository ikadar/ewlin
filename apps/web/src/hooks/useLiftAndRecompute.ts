import { useCallback } from 'react';
import type { ScheduleSnapshot } from '@flux/types';
import { useClearAllAssignmentsMutation } from '../store';
import type { ComputeScheduleResult } from '../store';
import { useAutoRecomputeCtx } from '../contexts/AutoRecomputeContext';

/**
 * Lift all non-pinned, non-frozen placed tiles and chain an incremental
 * compute. Drives Ctrl+Alt+P — makes the shortcut behave as if the user
 * had manually lifted every movable tile before re-running the engine.
 *
 * "Preserved" (not lifted): completed, pinned, in-progress, or
 * safety-zone-frozen (without active override). The backend's
 * clearAllAssignments endpoint enforces all four exclusions by default.
 */
export function useLiftAndRecompute() {
  const { startComputeReport } = useAutoRecomputeCtx();
  const [clearAllAssignments] = useClearAllAssignmentsMutation();

  return useCallback(
    async (input: {
      snapshot: ScheduleSnapshot;
      onDone?: (result: ComputeScheduleResult) => void;
    }) => {
      try {
        await clearAllAssignments({
          includeInProgress: false,
          includePinned: false,
        }).unwrap();
      } catch {
        // Empty schedule or race with a concurrent mutation — proceed to compute anyway.
      }
      startComputeReport({
        mode: 'incremental',
        snapshot: input.snapshot,
        skipLns: true,
        onDone: input.onDone,
      });
    },
    [clearAllAssignments, startComputeReport],
  );
}
