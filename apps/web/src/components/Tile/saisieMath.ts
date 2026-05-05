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
 * Geometric fond-vert fill fraction over the WHOLE tile (calage + run).
 * Returned as a percentage 0–100, designed to feed the 2-stop vertical
 * gradient `linear-gradient(green 0% → green pct% | base pct% → base 100%)`
 * without any further math at the call-site.
 *
 * Why geometric and not run-only :
 *
 * The user-facing % (cf. `computeTaskProgressPct`) is run-only by design —
 * calage is fixed-duration and the productivity ratio scales runMinutes
 * only. But the planning tile's vertical extent encodes both calage AND
 * run (calage is the top `setupMs/totalMs` slice of the tile). If the
 * gradient consumes the run-only pct directly, the green/base boundary
 * lands at `runPct%` of the TOTAL height instead of at the now-line, and
 * the gap between green and now-line is pinned to the calage height when
 * `runPct ≈ 0` — exactly what the user observed.
 *
 * Geometric fill solves this : we paint the calage zone wallclock-style
 * (cPct = wallclock progress through setup) and the run zone via the
 * task's run-only pct (rPct, optionally extrapolated from a saisie),
 * then combine into a single fraction of total tile filled :
 *
 *   - In calage  : fillFraction = s × cPct/100
 *   - In run     : fillFraction = s + r × rPct/100   (calage fully filled)
 *
 * where s = setupMs / totalMs, r = 1 - s. Because tile height is linear
 * in time, a 2-stop gradient with `pct = fillFraction × 100` lands the
 * green/base boundary at the now-line exactly when wallclock-aligned,
 * and follows the saisie anchor when one is present.
 *
 * Two operating modes for the run-zone pct :
 *
 * 1. **No saisie ever** (`recordedProgressPct == null`) — pure clock-driven
 *    extrapolation across the run window.
 *
 * 2. **Saisie present** — extrapolate from the anchor :
 *    `rPct = recordedProgressPct + (now - recordedAt) / runWindowMs × 100`,
 *    clamped to [0, 100]. Sticky past `scheduledEnd` to honour
 *    silence-is-consent (no fresh contradiction → optimistic projection
 *    holds).
 *
 * `isLate` flags the R1 visualization : when the tile's theoretical end
 * has passed but fill hasn't reached 100, the un-filled complement
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
  const totalMs = Math.max(0, endMs - startMs);
  const setupMs = setupMin * 60_000;
  const runWindowMs = Math.max(0, endMs - setupEndMs);

  // Geometric structure of the tile : calage occupies the top `setupFraction`,
  // run occupies the rest. Both are time-linear so pixel/ms ratios are equal.
  const setupFraction = totalMs > 0 ? Math.min(1, setupMs / totalMs) : 0;
  const runFraction = 1 - setupFraction;

  let fillFraction: number; // 0..1, share of the WHOLE tile painted green
  let isLate = false;

  if (totalMs === 0) {
    fillFraction = 1;
  } else if (nowMs <= startMs) {
    fillFraction = 0;
  } else if (nowMs < setupEndMs) {
    // In calage : wallclock fraction through setup × setup proportion.
    const setupProgress = setupMs > 0 ? (nowMs - startMs) / setupMs : 1;
    fillFraction = Math.min(setupFraction, setupProgress * setupFraction);
  } else {
    // In run (or past it) : calage fully filled, run zone fills with run pct.
    let runPct: number;
    if (recordedProgressPct == null || recordedAt == null) {
      if (runWindowMs === 0) {
        runPct = 100;
      } else if (nowMs >= endMs) {
        runPct = 100;
      } else {
        runPct = ((nowMs - setupEndMs) / runWindowMs) * 100;
      }
    } else {
      // Anchor-driven : extrapolate the saisie pct by the wallclock
      // fraction since the anchor — same denominator as the clock case so
      // the post-saisie green also can't overshoot the now-line.
      const anchorMs = new Date(recordedAt).getTime();
      if (runWindowMs === 0) {
        runPct = 100;
      } else {
        const delta = ((nowMs - anchorMs) / runWindowMs) * 100;
        runPct = recordedProgressPct + delta;
      }
    }
    runPct = Math.min(100, Math.max(0, runPct));
    fillFraction = setupFraction + (runPct / 100) * runFraction;

    // R1 : theoretical end past but fill < 100 → un-filled complement red.
    // Theoretical end uses the JCF-immutable runMin so saisie-extended
    // scheduledEnd doesn't suppress the late signal.
    const theoreticalEndMs = setupEndMs + runMin * 60_000;
    isLate = fillFraction < 1 && nowMs > theoreticalEndMs;
  }

  const pct = Math.min(100, Math.max(0, fillFraction * 100));
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
