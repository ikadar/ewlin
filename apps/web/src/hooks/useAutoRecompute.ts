/**
 * useAutoRecompute Hook
 *
 * Two-phase compute orchestration:
 *   1. Fast compute: debounced, hits /api/v1/schedule/compute which now
 *      routes to the Rust /compute-fast endpoint (FBI + Moore, no LNS).
 *      Keeps the planning fresh after any edit.
 *   2. LNS stream: opens an EventSource to /api/v1/schedule/compute-lns/stream
 *      that runs the Rust LNS for up to 60 s seeded with the Phase-1
 *      result. When an improvement lands (lateness decrease OR any-of-
 *      strict calage gain), the backend auto-persists it; the hook
 *      surfaces a Waze-style recap toast via onEvent('optimized').
 *
 * The Rust engine serialises a single LNS at a time (mono-user
 * deployment), so opening a new stream while another is running
 * cancels the previous one server-side. The FE abort is performed by
 * calling EventSource.close on unmount or on a new trigger.
 *
 * Contract:
 *  - trigger(reason?): debounced fast compute + starts LNS stream on success.
 *  - retry(): immediate fast compute, bypassing debounce.
 *  - isComputing: Phase-1 in flight (RTK mutation).
 *  - hasFailed / lastError: Phase-1 failure (staleness badge driver).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { scheduleApi, useComputeScheduleMutation, type ComputeScheduleResult } from '../store';
import { useAppDispatch } from '../store';

const DEBOUNCE_MS = 300;

export type AutoRecomputeEvent =
  | 'started'
  | 'succeeded'
  | 'failed'
  | 'lns-started'
  | 'optimized'
  | 'lns-no-change'
  | 'lns-failed';

interface OptimizedPayload {
  lateJobCountDelta: number;
  calageBonusSumDelta: number;
  calageBonusMeanDelta: number;
  calageBonusMedianDelta: number;
  stats: NonNullable<ComputeScheduleResult['stats']>;
}

interface UseAutoRecomputeReturn {
  trigger: (reason?: string) => void;
  retry: () => void;
  isComputing: boolean;
  hasFailed: boolean;
  lastError: string | null;
  lastRanAt: Date | null;
}

type OnEvent = (
  event: AutoRecomputeEvent,
  reason?: string,
  extra?: { error?: string; optimized?: OptimizedPayload },
) => void;

export function useAutoRecompute(onEvent?: OnEvent): UseAutoRecomputeReturn {
  const [computeSchedule, { isLoading: isComputing }] = useComputeScheduleMutation();
  const dispatch = useAppDispatch();
  const [hasFailed, setHasFailed] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastRanAt, setLastRanAt] = useState<Date | null>(null);

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReasonRef = useRef<string | undefined>(undefined);
  const onEventRef = useRef(onEvent);
  const lnsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const startLnsStream = useCallback(
    async (reason: string | undefined, baseline: ComputeScheduleResult) => {
      // Abort any previous stream before starting a new one.
      if (lnsAbortRef.current) {
        lnsAbortRef.current.abort();
      }
      const controller = new AbortController();
      lnsAbortRef.current = controller;

      try {
        const response = await fetch('/api/v1/schedule/compute-lns/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ mode: 'full' }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          onEventRef.current?.('lns-failed', reason, {
            error: `HTTP ${response.status}`,
          });
          return;
        }

        onEventRef.current?.('lns-started', reason);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let appliedStats: ComputeScheduleResult['stats'] | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIdx: number;
          while ((sepIdx = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            let eventName = 'message';
            let data = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:')) data += line.slice(5).trim();
            }
            if (!data) continue;
            if (eventName === 'applied') {
              try {
                const parsed = JSON.parse(data) as { stats?: ComputeScheduleResult['stats'] };
                appliedStats = parsed.stats ?? null;
              } catch {
                // ignore malformed payload
              }
            }
          }
        }

        if (appliedStats) {
          const base = baseline.stats;
          const lateDelta = (appliedStats.lateJobCount ?? 0) - (base?.lateJobCount ?? 0);
          const sumDelta =
            (appliedStats.calageBonusSum ?? 0) - (base?.calageBonusSum ?? 0);
          const meanDelta =
            (appliedStats.calageBonusMean ?? 0) - (base?.calageBonusMean ?? 0);
          const medianDelta =
            (appliedStats.calageBonusMedian ?? 0) - (base?.calageBonusMedian ?? 0);

          const changed =
            lateDelta !== 0 ||
            sumDelta !== 0 ||
            meanDelta !== 0 ||
            medianDelta !== 0;

          if (changed) {
            // Refresh snapshot so the planning picks up the new
            // auto-persisted schedule.
            dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
            onEventRef.current?.('optimized', reason, {
              optimized: {
                lateJobCountDelta: lateDelta,
                calageBonusSumDelta: sumDelta,
                calageBonusMeanDelta: meanDelta,
                calageBonusMedianDelta: medianDelta,
                stats: appliedStats,
              },
            });
          } else {
            onEventRef.current?.('lns-no-change', reason);
          }
        } else {
          onEventRef.current?.('lns-no-change', reason);
        }
      } catch (err) {
        if (controller.signal.aborted) return; // superseded, silent
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'LNS stream échoué';
        onEventRef.current?.('lns-failed', reason, { error: message });
      }
    },
    [dispatch],
  );

  const runCompute = useCallback(
    async (reason: string | undefined) => {
      onEventRef.current?.('started', reason);
      try {
        const result = await computeSchedule({ mode: 'full' }).unwrap();
        setHasFailed(false);
        setLastError(null);
        setLastRanAt(new Date());
        onEventRef.current?.('succeeded', reason);
        // Phase 2: kick off background LNS with the Phase-1 result as
        // the baseline for delta computation.
        void startLnsStream(reason, result);
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Recalcul échoué';
        setHasFailed(true);
        setLastError(message);
        onEventRef.current?.('failed', reason, { error: message });
      }
    },
    [computeSchedule, startLnsStream],
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
      if (lnsAbortRef.current) lnsAbortRef.current.abort();
    };
  }, []);

  return { trigger, retry, isComputing, hasFailed, lastError, lastRanAt };
}
