/**
 * useAutoRecompute Hook — thin React adapter over autoRecomputeRuntime.
 *
 * The compute orchestration (debounce, Phase-1 fast, Phase-2 LNS
 * stream, state, pub/sub) lives in hooks/autoRecomputeRuntime.ts as a
 * module-scope singleton. This hook:
 *   - Binds the current RTK mutation trigger + dispatcher into the
 *     runtime on every render where their identity changes.
 *   - Registers any onEvent handler for the mount's lifetime.
 *   - Exposes state through useSyncExternalStore so React re-renders
 *     on changes.
 *
 * Contract unchanged from the pre-singleton version, consumers keep
 * working without modification.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { scheduleApi, useComputeScheduleMutation } from '../store';
import { useAppDispatch } from '../store';
import {
  addAutoRecomputeEventListener,
  bindAutoRecomputeRuntime,
  getAutoRecomputeState,
  retryAutoRecompute,
  subscribeAutoRecomputeState,
  triggerAutoRecompute,
  type AutoRecomputeEvent,
  type OnEvent,
} from './autoRecomputeRuntime';

export type { AutoRecomputeEvent } from './autoRecomputeRuntime';

interface UseAutoRecomputeReturn {
  trigger: (reason?: string) => void;
  retry: () => void;
  isComputing: boolean;
  hasFailed: boolean;
  lastError: string | null;
  lastRanAt: Date | null;
}

export function useAutoRecompute(onEvent?: OnEvent): UseAutoRecomputeReturn {
  const [computeSchedule] = useComputeScheduleMutation();
  const dispatch = useAppDispatch();

  // Refresh the runtime bindings whenever the RTK-provided identities
  // change. Both functions are stable in practice, so this binds once
  // per provider lifetime.
  useEffect(() => {
    bindAutoRecomputeRuntime({
      runFast: () => computeSchedule({ mode: 'full' }).unwrap(),
      invalidateSnapshot: () => {
        dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
      },
    });
    // Intentionally don't unbind on unmount: leaving the last binding
    // in place means a superseding mount (if any) will rewrite it, and
    // a non-React caller that fires trigger() mid-transition still has
    // a live factory to invoke.
  }, [computeSchedule, dispatch]);

  useEffect(() => {
    if (!onEvent) return undefined;
    return addAutoRecomputeEventListener(onEvent);
  }, [onEvent]);

  const snapshot = useSyncExternalStore(
    subscribeAutoRecomputeState,
    getAutoRecomputeState,
    getAutoRecomputeState,
  );

  return {
    trigger: triggerAutoRecompute,
    retry: retryAutoRecompute,
    isComputing: snapshot.isComputing,
    hasFailed: snapshot.hasFailed,
    lastError: snapshot.lastError,
    lastRanAt: snapshot.lastRanAt,
  };
}
