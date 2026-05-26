/**
 * Préprod freshness counter — clock-brut drift indicator showing how
 * stale the user's view is relative to the last wall re-photo.
 *
 * Shown only in Préprod (the planning workbench). In Prod the planning
 * advances live with reality so a freshness counter is meaningless.
 *
 * Reset behavior:
 * - Every business trigger that goes through AutoRecompute (saisie, JCF
 *   modif, add job, gate flip, etc.) bumps `lastRanAt` and the counter
 *   resets automatically — no per-site wiring needed.
 * - The "Rafraîchir maintenant" button calls `retry()` which fires
 *   the compute immediately (no debounce). The local anchor is also
 *   optimistically reset for instant UI feedback before the compute
 *   round-trips.
 *
 * Thresholds (clock-brut, not working hours — intentional to surface
 * weekend/overnight drift):
 * - < 15 min: fresh (emerald)
 * - 15–30 min: aging (amber)
 * - > 30 min: stale (red)
 */

import { useCallback, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useScenarioMode } from '../../contexts/ScenarioContext';
import { useAutoRecomputeCtx } from '../../contexts/AutoRecomputeContext';
import { useNow } from '../../contexts/NowContext';

type FreshnessState = 'fresh' | 'aging' | 'stale';

function formatFreshness(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${String(rem).padStart(2, '0')}min`;
}

function stateFor(mins: number): FreshnessState {
  if (mins < 15) return 'fresh';
  if (mins <= 30) return 'aging';
  return 'stale';
}

const STATE_CLASSES: Record<FreshnessState, string> = {
  fresh: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  aging: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  stale: 'bg-red-500/15 border-red-500/40 text-red-300',
};

export function PreprodFreshnessBanner() {
  const { mode } = useScenarioMode();
  const { retry, lastRanAt, isComputing } = useAutoRecomputeCtx();
  const now = useNow();

  // Anchor = most recent of:
  //   - remoteAnchor: lastRanAt from AutoRecompute (bumps on every
  //     business trigger that runs a compute)
  //   - localAnchor: optimistic stamp set when the user clicks
  //     "Rafraîchir maintenant" — gives immediate UI feedback before
  //     the compute completes.
  // Falls back to mount time so the counter starts at 0 in a session
  // with no compute yet.
  const [mountMs] = useState<number>(() => Date.now());
  const [localAnchor, setLocalAnchor] = useState<number | null>(null);
  const remoteAnchor = lastRanAt?.getTime() ?? null;
  const anchorMs = Math.max(localAnchor ?? 0, remoteAnchor ?? 0) || mountMs;

  const handleRefresh = useCallback(() => {
    setLocalAnchor(Date.now());
    retry();
  }, [retry]);

  if (mode !== 'preprod') return null;

  const minutes = Math.max(0, Math.floor((now.getTime() - anchorMs) / 60_000));
  const state = stateFor(minutes);

  return (
    <div
      className={`block border-b transition-colors ${STATE_CLASSES[state]}`}
      role="status"
      aria-live="polite"
    >
      <div className="px-4 py-1.5 text-[11.5px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">Préprod</strong>
            {' · '}Fraîcheur :{' '}
            <span className="font-mono tabular-nums">{formatFreshness(minutes)}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isComputing}
          className="border border-current px-2 py-0.5 text-[11px] flex items-center gap-1.5 hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          title="Re-photographier le mur et recalculer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Rafraîchir maintenant</span>
        </button>
      </div>
    </div>
  );
}
