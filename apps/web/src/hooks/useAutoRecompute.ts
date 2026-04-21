/**
 * useAutoRecompute Hook
 *
 * Debounced wrapper around the schedule compute mutation that keeps the
 * planning fresh after any edit. Full-mode is the only honest option —
 * selective recompute breaks down whenever jobs share stations, have
 * `requiredJobIds` chains, or the edit changes a priority that reorders
 * the global FBI pass. Calling full compute keeps the model consistent
 * and piggy-backs on the safety zone to avoid disturbing cards
 * currently in preparation.
 *
 * Contract:
 *  - trigger(reason?) fires a debounced compute. Multiple calls within
 *    the debounce window collapse into a single compute.
 *  - isComputing reflects the RTK mutation's in-flight state.
 *  - hasFailed surfaces the last failure so the UI can show a stale
 *    badge + retry. Cleared by the next successful compute.
 *  - retry() re-attempts immediately, skipping the debounce.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useComputeScheduleMutation } from '../store';

const DEBOUNCE_MS = 300;

interface UseAutoRecomputeReturn {
  trigger: (reason?: string) => void;
  retry: () => void;
  isComputing: boolean;
  hasFailed: boolean;
  lastError: string | null;
  lastRanAt: Date | null;
}

export function useAutoRecompute(
  onEvent?: (event: 'started' | 'succeeded' | 'failed', reason?: string, error?: string) => void,
): UseAutoRecomputeReturn {
  const [computeSchedule, { isLoading: isComputing }] = useComputeScheduleMutation();
  const [hasFailed, setHasFailed] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastRanAt, setLastRanAt] = useState<Date | null>(null);

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReasonRef = useRef<string | undefined>(undefined);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const runCompute = useCallback(
    async (reason: string | undefined) => {
      onEventRef.current?.('started', reason);
      try {
        await computeSchedule({ mode: 'full' }).unwrap();
        setHasFailed(false);
        setLastError(null);
        setLastRanAt(new Date());
        onEventRef.current?.('succeeded', reason);
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Recalcul échoué';
        setHasFailed(true);
        setLastError(message);
        onEventRef.current?.('failed', reason, message);
      }
    },
    [computeSchedule],
  );

  const trigger = useCallback(
    (reason?: string) => {
      lastReasonRef.current = reason;
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null;
        void runCompute(lastReasonRef.current);
      }, DEBOUNCE_MS);
    },
    [runCompute],
  );

  const retry = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    void runCompute(lastReasonRef.current);
  }, [runCompute]);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, []);

  return { trigger, retry, isComputing, hasFailed, lastError, lastRanAt };
}
