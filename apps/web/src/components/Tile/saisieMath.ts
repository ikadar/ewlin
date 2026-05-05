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
  const startMs = new Date(scheduledStart).getTime();
  const setupEndMs = startMs + setupMin * 60_000;
  const endMs = new Date(scheduledEnd).getTime();
  // Wallclock-based fraction : the fond-vert reaches the now-line exactly,
  // never beyond it. The earlier formula divided by `runMin` (theoretical)
  // which can be smaller than the realistic run window when scheduledEnd
  // reflects a saisie-extended end ; in that case pct grew faster than
  // wallclock and the green spilled past the now-line on the planning view.
  // Using `endMs - setupEndMs` (the actual run window in ms) keeps the
  // visual aligned with where now() lies in the tile.
  const runWindowMs = Math.max(0, endMs - setupEndMs);

  let pct: number;
  if (recordedProgressPct == null || recordedAt == null) {
    if (nowMs <= setupEndMs || runWindowMs === 0) {
      pct = 0;
    } else if (nowMs >= endMs) {
      pct = 100;
    } else {
      pct = Math.min(100, Math.max(0, ((nowMs - setupEndMs) / runWindowMs) * 100));
    }
  } else {
    // Anchor-driven : extrapolate the saisie's recorded pct forward by
    // the wallclock fraction since the anchor — same denominator as the
    // pure clock case so the post-saisie green also can't overshoot now.
    const anchorMs = new Date(recordedAt).getTime();
    if (runWindowMs === 0) {
      pct = 100;
    } else {
      const delta = ((nowMs - anchorMs) / runWindowMs) * 100;
      pct = Math.min(100, Math.max(0, recordedProgressPct + delta));
    }
  }

  // R1 : "rouge complément" when the theoretical end is past but the work
  // hasn't reached 100. Theoretical end uses the JCF-immutable runMin so
  // saisie-extended scheduledEnd doesn't suppress the late signal.
  const theoreticalEndMs = setupEndMs + runMin * 60_000;
  const isLate = pct < 100 && nowMs > theoreticalEndMs;
  return { pct, isLate };
}

/**
 * Per-window (chunk or operator stint) wallclock progress at `now`.
 *
 * Why a separate helper from `computeOptimisticProgress` :
 *
 * - `computeOptimisticProgress` is task-scoped : it returns a single pct
 *   for the whole task envelope, blending wallclock + saisie anchor
 *   extrapolation. Mirroring that single value across every chunk / sub-row
 *   makes a future stint look partially-green (the envelope's wallclock has
 *   elapsed into it from above) and a past stint look partially-green
 *   (the envelope's wallclock hasn't reached the task's end yet) — both
 *   wrong from the chef's POV : he wants "this stint is done / running /
 *   hasn't started" per row.
 *
 * - This helper is window-scoped : each chunk / sub-row has its own
 *   start..end and computes from `(now - start) / (end - start)`. Past
 *   windows clamp to 100, future windows to 0, the active window grows
 *   linearly. Same shape as `computeOptimisticProgress` (returns
 *   `{ pct, isLate }`) so callsites can swap calls trivially.
 *
 * Saisie (`recordedProgressPct`) deliberately doesn't enter the per-window
 * computation : it's a task-level fact that already shapes the engine's
 * re-estimation (productivity ratio → realisticRunMinutes → reshuffled
 * window boundaries). Folding it back here would double-count — the
 * window timestamps after a recompute already encode the saisie-aware
 * truth. `isLate` is structurally false in pure wallclock mode (we clamp
 * to 100 the moment `now ≥ end`), kept in the return shape only for API
 * symmetry with `computeOptimisticProgress`.
 */
export function computeChunkProgress(
  windowStartIso: string,
  windowEndIso: string,
  nowMs: number,
): { pct: number; isLate: boolean } {
  const startMs = new Date(windowStartIso).getTime();
  const endMs = new Date(windowEndIso).getTime();
  const windowMs = Math.max(0, endMs - startMs);
  let pct: number;
  if (windowMs === 0 || nowMs >= endMs) {
    pct = 100;
  } else if (nowMs <= startMs) {
    pct = 0;
  } else {
    pct = ((nowMs - startMs) / windowMs) * 100;
  }
  return { pct, isLate: false };
}
