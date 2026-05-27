/**
 * AutoRecomputeContext — app-level provider for the two-phase compute
 * orchestration + unified compute toaster.
 *
 * Lives above the route tree (mounted inside RootLayout) so route
 * transitions don't unmount the useAutoRecompute hook and cancel its
 * debounce / LNS stream in flight. Any page-level component below
 * (App.tsx, OperatorSchedulePage, FluxPage…) can consume the shared
 * orchestration via `useAutoRecomputeCtx()`.
 *
 * Rationale: the previous App-level hook was killed on any navigation
 * that unmounted App (e.g. JCF save from /flux → navigate back to
 * /flux/bat). Lifting to the root keeps the timer alive for the entire
 * session.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ScheduleSnapshot } from '@flux/types';
import {
  useAppDispatch,
  useAppSelector,
  selectCurrentError,
  clearError,
  type ComputeScheduleResult,
} from '../store';
import { useAutoRecompute, useComputeToaster } from '../hooks';
import {
  useComputeReportStream,
  type ComputeReportMode,
} from '../hooks/useComputeReportStream';
import { ComputeToastStack } from '../components/ComputeToastStack';
import { ComputeReportToast } from '../components/ComputeReportToast/ComputeReportToast';
import { registerAutoRecomputeTrigger } from '../store/middleware/autoRecomputeMiddleware';

export type ComputeBarPhase =
  | { type: 'idle' }
  | { type: 'pending'; fireAt: number; remainingS: number }
  | { type: 'computing'; reason?: string }
  | { type: 'succeeded' }
  | { type: 'failed'; error: string }
  | { type: 'optimized'; metrics: Array<{ label: string; value: string; bad?: boolean }> };

interface ContextValue {
  /**
   * Debounced fast-compute trigger. Survives route changes since the
   * hook lives at RootLayout level.
   */
  trigger: (reason?: string) => void;
  /** Re-fire compute immediately (retry). */
  retry: () => void;
  /** True while Phase 1 (fast compute) is in flight. */
  isComputing: boolean;
  /** Last Phase-1 failure — drives the StalenessBadge. */
  hasFailed: boolean;
  lastError: string | null;
  lastRanAt: Date | null;
  /**
   * Emit (or in-place update) a toast through the shared compute
   * toaster stack. Available to pages that want to pipe compute
   * feedback through the same channel (e.g. ComputeModal for the
   * Waze-style improvement notification at lnsDone).
   */
  showToast: (toast: {
    id?: string;
    type: 'info' | 'success' | 'error' | 'progress' | 'waze';
    title: string;
    detail?: string;
    metrics?: Array<{ label: string; value: string; bad?: boolean }>;
    pinned?: boolean;
    progress?: number;
  }) => string;
  /**
   * Start an SSE compute and surface the "pendant / après" info through
   * the ComputeReportToast (replaces ComputeModal for the Ctrl+Alt+P
   * shortcut path — see playground-compute-info-toast.html).
   *
   * `skipLns: true` asks the engine to return as soon as FBI stabilises,
   * leaving the LNS pass for the background auto-recompute runtime —
   * matching the two-phase flow used by post-edit auto-recompute.
   */
  startComputeReport: (input: {
    mode: ComputeReportMode;
    jobId?: string;
    snapshot: ScheduleSnapshot;
    skipLns?: boolean;
    onDone?: (result: ComputeScheduleResult) => void;
  }) => void;
  /** Close the report toast immediately. */
  dismissComputeReport: () => void;
  /** Current phase of the auto-recompute bar. */
  barPhase: ComputeBarPhase;
  /** Flush the pending debounce timer immediately. */
  flush: () => void;
}

const AutoRecomputeContext = createContext<ContextValue | null>(null);

export function AutoRecomputeProvider({ children }: { children: ReactNode }) {
  const computeToaster = useComputeToaster();
  const reportStream = useComputeReportStream();

  // Bar phase: driven by auto-recompute events instead of toasts.
  // Transient states (succeeded, failed, optimized) are set here and
  // auto-cleared by ComputeBar via its own hide timers.
  const [barPhase, setBarPhase] = useState<ComputeBarPhase>({ type: 'idle' });

  const autoRecompute = useAutoRecompute((event, reason, extra) => {
    if (event === 'started') {
      setBarPhase({ type: 'computing', reason });
    } else if (event === 'succeeded') {
      setBarPhase({ type: 'succeeded' });
    } else if (event === 'failed') {
      setBarPhase({ type: 'failed', error: extra?.error ?? 'Erreur inconnue' });
    } else if (event === 'optimized' && extra?.optimized) {
      const o = extra.optimized;
      const metrics: Array<{ label: string; value: string; bad?: boolean }> = [];
      if (o.lateJobCountDelta !== 0) {
        metrics.push({
          label: 'Retards',
          value: `${o.lateJobCountDelta > 0 ? '+' : ''}${o.lateJobCountDelta}`,
          bad: o.lateJobCountDelta > 0,
        });
      }
      if (o.calageBonusSumDelta !== 0) {
        metrics.push({
          label: 'Calage Σ',
          value: `${o.calageBonusSumDelta > 0 ? '+' : ''}${o.calageBonusSumDelta}`,
          bad: o.calageBonusSumDelta < 0,
        });
      }
      if (o.calageBonusMeanDelta !== 0) {
        metrics.push({
          label: 'Calage x̄',
          value: `${o.calageBonusMeanDelta > 0 ? '+' : ''}${o.calageBonusMeanDelta.toFixed(1)}`,
          bad: o.calageBonusMeanDelta < 0,
        });
      }
      setBarPhase({ type: 'optimized', metrics });
    }
  });

  useEffect(() => {
    registerAutoRecomputeTrigger(autoRecompute.trigger);
    return () => registerAutoRecomputeTrigger(null);
  }, [autoRecompute.trigger]);

  // Pending countdown: drive barPhase from pendingFireAt with 1s ticks.
  const pendingFireAt = autoRecompute.pendingFireAt;
  useEffect(() => {
    if (pendingFireAt === null) {
      setBarPhase((prev) => (prev.type === 'pending' ? { type: 'idle' } : prev));
      return;
    }
    const tick = () => {
      const remainingMs = Math.max(0, pendingFireAt - Date.now());
      const remainingS = Math.ceil(remainingMs / 1000);
      setBarPhase({ type: 'pending', fireAt: pendingFireAt, remainingS });
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [pendingFireAt]);

  const pendingOnDoneRef = useRef<((result: ComputeScheduleResult) => void) | null>(null);

  const startComputeReport = useCallback(
    (input: {
      mode: ComputeReportMode;
      jobId?: string;
      snapshot: ScheduleSnapshot;
      skipLns?: boolean;
      onDone?: (result: ComputeScheduleResult) => void;
    }) => {
      const { onDone, ...rest } = input;
      // One-shot callback fires when the stream's phase flips to 'done'
      // (see effect below). Receives the Phase-1 result so callers can
      // chain a background LNS pass seeded with the same baseline.
      pendingOnDoneRef.current = onDone ?? null;
      reportStream.start(rest);
    },
    [reportStream],
  );

  useEffect(() => {
    if (reportStream.state.phase === 'done' && reportStream.state.result) {
      const cb = pendingOnDoneRef.current;
      pendingOnDoneRef.current = null;
      cb?.(reportStream.state.result);
    }
  }, [reportStream.state.phase, reportStream.state.result]);

  const value: ContextValue = {
    trigger: autoRecompute.trigger,
    retry: autoRecompute.retry,
    isComputing: autoRecompute.isComputing,
    hasFailed: autoRecompute.hasFailed,
    lastError: autoRecompute.lastError,
    lastRanAt: autoRecompute.lastRanAt,
    showToast: computeToaster.show,
    startComputeReport,
    dismissComputeReport: reportStream.clear,
    barPhase,
    flush: autoRecompute.flush,
  };

  return (
    <AutoRecomputeContext.Provider value={value}>
      {children}
      {/* Toast stack — still used for non-auto-recompute feedback
          (Mercure alerts, useToast wrapper, global errors, etc.) */}
      <ComputeToastStack toasts={computeToaster.toasts} onDismiss={computeToaster.dismiss} />
      <ComputeReportToast state={reportStream.state} onDismiss={reportStream.clear} />
      <GlobalErrorBridge />
    </AutoRecomputeContext.Provider>
  );
}

/**
 * Pipes Redux global errors into the compute toaster.
 * Skips 409 (validation — handled inline by forms) and 503 (handled
 * by <MaintenanceState />).
 */
function GlobalErrorBridge() {
  const dispatch = useAppDispatch();
  const currentError = useAppSelector(selectCurrentError);
  const { showToast } = useAutoRecomputeCtx();

  useEffect(() => {
    if (!currentError) return;
    if (currentError.status === 409 || currentError.status === 503) return;
    showToast({ type: 'error', title: currentError.message });
    dispatch(clearError());
  }, [currentError, dispatch, showToast]);

  return null;
}

/**
 * Consumer hook. Throws if used outside the provider so misuse is loud.
 */
export function useAutoRecomputeCtx(): ContextValue {
  const ctx = useContext(AutoRecomputeContext);
  if (!ctx) {
    throw new Error(
      'useAutoRecomputeCtx must be used inside <AutoRecomputeProvider> (mounted in RootLayout)',
    );
  }
  return ctx;
}
