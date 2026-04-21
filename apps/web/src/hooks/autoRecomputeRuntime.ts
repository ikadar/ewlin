/**
 * autoRecomputeRuntime — module-scope singleton backing useAutoRecompute.
 *
 * Rationale: the prior implementation held the debounce timer + LNS
 * AbortController in useRef(s) inside the hook, so their lifetime was
 * tied to the host component. Lifting the hook into RootLayout's
 * AutoRecomputeProvider already made this robust in practice (see
 * commit 9f2bb3e), but any refactor that remounts the provider — or
 * consumers that mistakenly duplicate the hook — would reintroduce the
 * "debounce cancelled by unmount" class of bug.
 *
 * Moving the runtime to module scope makes it true-singleton:
 *   - The debounce timer and LNS stream survive any React tree churn.
 *   - Non-React code (e.g. the RTK listener middleware, a future worker)
 *     could call trigger() directly.
 *   - The hook becomes a thin subscriber: it binds the current RTK
 *     mutation trigger + dispatcher, registers any onEvent handler, and
 *     reads state through useSyncExternalStore.
 *
 * Only one runtime exists app-wide. Mounting the hook is idempotent —
 * the latest (mutation, dispatch) pair always wins.
 */

import type { ComputeScheduleResult } from '../store';

export type AutoRecomputeEvent =
  | 'started'
  | 'succeeded'
  | 'failed'
  | 'lns-started'
  | 'optimized'
  | 'lns-no-change'
  | 'lns-failed';

export interface OptimizedPayload {
  lateJobCountDelta: number;
  calageBonusSumDelta: number;
  calageBonusMeanDelta: number;
  calageBonusMedianDelta: number;
  stats: NonNullable<ComputeScheduleResult['stats']>;
}

export type OnEvent = (
  event: AutoRecomputeEvent,
  reason?: string,
  extra?: { error?: string; optimized?: OptimizedPayload },
) => void;

export interface AutoRecomputeState {
  isComputing: boolean;
  hasFailed: boolean;
  lastError: string | null;
  lastRanAt: Date | null;
}

type RunFastFactory = () => Promise<ComputeScheduleResult>;
type InvalidateSnapshot = () => void;

interface Bindings {
  runFast: RunFastFactory;
  invalidateSnapshot: InvalidateSnapshot;
}

const DEBOUNCE_MS = 300;

let bindings: Bindings | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let lastReason: string | undefined;
let abortCtrl: AbortController | null = null;

const eventListeners = new Set<OnEvent>();
const stateSubscribers = new Set<() => void>();

let state: AutoRecomputeState = {
  isComputing: false,
  hasFailed: false,
  lastError: null,
  lastRanAt: null,
};

function setState(patch: Partial<AutoRecomputeState>): void {
  state = { ...state, ...patch };
  for (const cb of stateSubscribers) cb();
}

function emit(
  event: AutoRecomputeEvent,
  reason?: string,
  extra?: { error?: string; optimized?: OptimizedPayload },
): void {
  for (const h of eventListeners) h(event, reason, extra);
}

/**
 * Bind the React-side factories. Called by the hook on every render
 * where mutation or dispatch identity changes. Last writer wins.
 */
export function bindAutoRecomputeRuntime(b: Bindings | null): void {
  bindings = b;
}

export function addAutoRecomputeEventListener(handler: OnEvent): () => void {
  eventListeners.add(handler);
  return () => eventListeners.delete(handler);
}

export function subscribeAutoRecomputeState(cb: () => void): () => void {
  stateSubscribers.add(cb);
  return () => stateSubscribers.delete(cb);
}

export function getAutoRecomputeState(): AutoRecomputeState {
  return state;
}

/**
 * Debounced trigger. Multiple calls within DEBOUNCE_MS collapse into
 * one. The factory captured at call time is the one bound at the
 * moment the timer fires (not when trigger was called) — that's fine
 * because bindings point to stable RTK Query references.
 */
export function triggerAutoRecompute(reason?: string): void {
  lastReason = reason;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void runPhase1();
  }, DEBOUNCE_MS);
}

/**
 * Immediate retry — bypasses the debounce window. Used by the
 * staleness badge retry button.
 */
export function retryAutoRecompute(): void {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  void runPhase1();
}

async function runPhase1(): Promise<void> {
  if (!bindings) {
    emit('failed', lastReason, { error: 'AutoRecompute runtime not bound' });
    return;
  }
  const { runFast, invalidateSnapshot } = bindings;

  emit('started', lastReason);
  setState({ isComputing: true });

  try {
    const result = await runFast();
    setState({
      isComputing: false,
      hasFailed: false,
      lastError: null,
      lastRanAt: new Date(),
    });
    emit('succeeded', lastReason);
    void runPhase2Lns(result, invalidateSnapshot);
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Recalcul échoué';
    setState({ isComputing: false, hasFailed: true, lastError: message });
    emit('failed', lastReason, { error: message });
  }
}

async function runPhase2Lns(
  baseline: ComputeScheduleResult,
  invalidateSnapshot: InvalidateSnapshot,
): Promise<void> {
  if (abortCtrl) abortCtrl.abort();
  const controller = new AbortController();
  abortCtrl = controller;

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
      emit('lns-failed', lastReason, { error: `HTTP ${response.status}` });
      return;
    }

    emit('lns-started', lastReason);

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
            // Malformed payload — tolerate and move on.
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
        invalidateSnapshot();
        emit('optimized', lastReason, {
          optimized: {
            lateJobCountDelta: lateDelta,
            calageBonusSumDelta: sumDelta,
            calageBonusMeanDelta: meanDelta,
            calageBonusMedianDelta: medianDelta,
            stats: appliedStats,
          },
        });
      } else {
        emit('lns-no-change', lastReason);
      }
    } else {
      emit('lns-no-change', lastReason);
    }
  } catch (err) {
    if (controller.signal.aborted) return;
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'LNS stream échoué';
    emit('lns-failed', lastReason, { error: message });
  }
}
