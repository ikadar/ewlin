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

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { ScheduleSnapshot } from '@flux/types';
import type { ComputeScheduleResult } from '../store';
import { useAutoRecompute, useComputeToaster } from '../hooks';
import {
  useComputeReportStream,
  type ComputeReportMode,
} from '../hooks/useComputeReportStream';
import type { ComputeToastMetric } from '../hooks/useComputeToaster';
import { ComputeToastStack } from '../components/ComputeToastStack';
import { ComputeReportToast } from '../components/ComputeReportToast/ComputeReportToast';
import { registerAutoRecomputeTrigger } from '../store/middleware/autoRecomputeMiddleware';

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
}

const AutoRecomputeContext = createContext<ContextValue | null>(null);

export function AutoRecomputeProvider({ children }: { children: ReactNode }) {
  const computeToaster = useComputeToaster();
  const reportStream = useComputeReportStream();

  const autoRecompute = useAutoRecompute((event, reason, extra) => {
    const toastId = 'auto-recompute';
    if (event === 'started') {
      computeToaster.show({
        id: toastId,
        type: 'progress',
        title: 'Recalcul du planning',
        detail: reason,
        progress: -1,
        pinned: true,
      });
    } else if (event === 'succeeded') {
      computeToaster.show({
        id: toastId,
        type: 'success',
        title: 'Planning à jour',
        detail: 'Optimisation en arrière-plan en cours…',
      });
    } else if (event === 'failed') {
      computeToaster.show({
        id: toastId,
        type: 'error',
        title: 'Recalcul échoué',
        detail: extra?.error ?? 'Erreur inconnue',
      });
    } else if (event === 'optimized' && extra?.optimized) {
      const o = extra.optimized;
      const metrics: ComputeToastMetric[] = [];
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
      computeToaster.show({
        type: 'waze',
        title: 'Optimisation auto appliquée',
        detail: 'Le LNS a trouvé une meilleure organisation.',
        metrics,
      });
    }
  });

  // Expose this trigger to the RTK middleware so every mutation in the
  // auto-recompute allow-list (see autoRecomputeMiddleware) can call
  // trigger() without importing React state. The debounce inside the
  // hook absorbs chained mutations into a single compute run.
  useEffect(() => {
    registerAutoRecomputeTrigger(autoRecompute.trigger);
    return () => registerAutoRecomputeTrigger(null);
  }, [autoRecompute.trigger]);

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
  };

  return (
    <AutoRecomputeContext.Provider value={value}>
      {children}
      {/* Toast stack rendered at root so it survives route changes. */}
      <ComputeToastStack toasts={computeToaster.toasts} onDismiss={computeToaster.dismiss} />
      <ComputeReportToast state={reportStream.state} onDismiss={reportStream.clear} />
    </AutoRecomputeContext.Provider>
  );
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
