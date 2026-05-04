/**
 * Time + volume helpers shared by Tile (station grid) and TileSegment
 * (operator column / focus). They derive the props the saisie modal +
 * VolumeGauge consume from a raw assignment.
 */

export function isoToMinFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function applyMinToDate(baseIso: string, minutesFromMidnight: number): string {
  const base = new Date(baseIso);
  const result = new Date(base);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutesFromMidnight);
  return result.toISOString();
}

/**
 * % of the active TASK done at `now` (0–100). Task-scoped, run-only:
 *   - 0% during calage (setup)
 *   - linear 0→100 across the run window
 *   - 100% once `now` ≥ scheduled end
 *
 * Calage neutral by design — the productivity ratio scales runMinutes only
 * (cf. project_calage_run_ratio).
 */
export function computeTaskProgressPct(
  scheduledStart: string,
  scheduledEnd: string,
  setupMin: number,
  runMin: number,
  nowMs: number,
): number {
  const startMs = new Date(scheduledStart).getTime();
  const setupEndMs = startMs + setupMin * 60_000;
  if (nowMs <= setupEndMs) return 0;
  const endMs = new Date(scheduledEnd).getTime();
  if (nowMs >= endMs) return 100;
  if (runMin === 0) return 100;
  const runElapsedMin = (nowMs - setupEndMs) / 60_000;
  return Math.min(100, (runElapsedMin / runMin) * 100);
}

/**
 * Optimistic fond-vert progress at `now`, anchored on the last firm saisie
 * when one exists. Two operating modes :
 *
 * 1. **No saisie ever** (`recordedProgressPct == null`) — pure clock-driven
 *    extrapolation : 0 during setup, linear 0→100 across the run window,
 *    100 once `now ≥ scheduledEnd`. Identical to `computeTaskProgressPct`.
 *
 * 2. **Saisie present** — extrapolate from the anchor :
 *    `pct = recordedProgressPct + (now - recordedAt) / runMin × 100`,
 *    clamped to [0, 100]. The anchor is sticky : even when `now` walks past
 *    `scheduledEnd`, the FE keeps growing the fill from the latest declared
 *    truth rather than snapping to 100 immediately. This matches the
 *    silence-is-consent philosophy : without a fresh contradiction, the
 *    optimistic projection holds.
 *
 * `isLate` flags the R1 visualization : when the tile's wall-clock end
 * has passed but the fill hasn't reached 100, the un-filled complement
 * should render in red rather than the default tile background.
 *
 * Cf. `project_progress_visualization.md` for the locked decisions
 * (Q4 task-level storage, Q5 R1 rouge complément, Q7 pull/derived).
 */
export function computeOptimisticProgress(
  scheduledStart: string,
  scheduledEnd: string,
  setupMin: number,
  runMin: number,
  recordedProgressPct: number | null | undefined,
  recordedAt: string | null | undefined,
  nowMs: number,
): { pct: number; isLate: boolean } {
  const endMs = new Date(scheduledEnd).getTime();

  let pct: number;
  if (recordedProgressPct == null || recordedAt == null) {
    pct = computeTaskProgressPct(scheduledStart, scheduledEnd, setupMin, runMin, nowMs);
  } else {
    const anchorMs = new Date(recordedAt).getTime();
    if (runMin <= 0) {
      pct = 100;
    } else {
      const elapsedSinceAnchorMin = (nowMs - anchorMs) / 60_000;
      const delta = (elapsedSinceAnchorMin / runMin) * 100;
      pct = Math.min(100, Math.max(0, recordedProgressPct + delta));
    }
  }

  const isLate = pct < 100 && nowMs > endMs;
  return { pct, isLate };
}
