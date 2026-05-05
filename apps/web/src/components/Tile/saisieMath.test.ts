import { describe, it, expect } from 'vitest';
import {
  computeChunkProgress,
  computeOptimisticProgress,
  computeUnplacedOptimisticProgress,
} from './saisieMath';

describe('computeChunkProgress (per-window wallclock)', () => {
  const WINDOW_START = '2026-05-05T11:15:00.000Z';
  const WINDOW_END = '2026-05-05T12:30:00.000Z';
  const WINDOW_LEN_MS = 75 * 60_000;
  const startMs = new Date(WINDOW_START).getTime();

  it('returns 0% before the window starts', () => {
    const now = startMs - 60_000;
    expect(computeChunkProgress(WINDOW_START, WINDOW_END, now)).toEqual({
      pct: 0,
      isLate: false,
    });
  });

  it('returns 0% exactly at the start', () => {
    expect(computeChunkProgress(WINDOW_START, WINDOW_END, startMs)).toEqual({
      pct: 0,
      isLate: false,
    });
  });

  it('returns linear pct mid-window', () => {
    const now = startMs + WINDOW_LEN_MS / 2;
    const out = computeChunkProgress(WINDOW_START, WINDOW_END, now);
    expect(out.pct).toBeCloseTo(50, 5);
    expect(out.isLate).toBe(false);
  });

  it('returns 100% exactly at the end', () => {
    const endMs = new Date(WINDOW_END).getTime();
    expect(computeChunkProgress(WINDOW_START, WINDOW_END, endMs)).toEqual({
      pct: 100,
      isLate: false,
    });
  });

  it('returns 100% past the window end (no isLate fires in wallclock-pure mode)', () => {
    const now = new Date(WINDOW_END).getTime() + 30 * 60_000;
    expect(computeChunkProgress(WINDOW_START, WINDOW_END, now)).toEqual({
      pct: 100,
      isLate: false,
    });
  });

  it('clamps zero-length windows to 100%', () => {
    expect(computeChunkProgress(WINDOW_START, WINDOW_START, startMs - 1000)).toEqual({
      pct: 100,
      isLate: false,
    });
  });

  it('two adjacent stints of the same task report independently — past stint full, future stint empty', () => {
    // Reproduces the FUZEAU/Duplo 10P bug : at 12:25 stint1 should be near
    // 100% and stint2 (13:00-13:15) should be 0%, not the same task-level
    // value mirrored on both rows.
    const now = new Date('2026-05-05T12:25:00.000Z').getTime();
    const stint1 = computeChunkProgress(
      '2026-05-05T11:15:00.000Z',
      '2026-05-05T12:30:00.000Z',
      now,
    );
    const stint2 = computeChunkProgress(
      '2026-05-05T13:00:00.000Z',
      '2026-05-05T13:15:00.000Z',
      now,
    );
    expect(stint1.pct).toBeGreaterThan(90);
    expect(stint1.pct).toBeLessThan(100);
    expect(stint2.pct).toBe(0);
  });
});

describe('computeOptimisticProgress (geometric fill, smooth across calage + run)', () => {
  // The pct returned is the fraction of the WHOLE tile that should render
  // as fond-vert : it lands the green/base boundary at the now-line when
  // wallclock-aligned, both during calage AND during run.
  const start = '2026-05-05T10:00:00.000Z';
  const end = '2026-05-05T11:00:00.000Z'; // 60 min total
  // setup = 15 min ⇒ setupFraction = 0.25
  // run   = 45 min ⇒ runFraction   = 0.75

  it('returns 0 before tileStart', () => {
    const now = new Date('2026-05-05T09:55:00.000Z').getTime();
    const out = computeOptimisticProgress(start, end, 15, 45, null, null, now);
    expect(out.pct).toBe(0);
  });

  it('fills proportionally through calage at wallclock pace', () => {
    // 5 min into a 15 min calage = 1/3 through setup zone.
    // setup zone occupies 25% of the tile, so fillFraction = 1/3 × 0.25 ≈ 0.0833.
    const now = new Date('2026-05-05T10:05:00.000Z').getTime();
    const out = computeOptimisticProgress(start, end, 15, 45, null, null, now);
    expect(out.pct).toBeCloseTo(8.33, 1);
  });

  it('reaches exactly setupFraction at the calage/run boundary', () => {
    // setupEnd : calage fully filled, run still 0%.
    // fillFraction = 0.25, pct = 25%.
    const now = new Date('2026-05-05T10:15:00.000Z').getTime();
    const out = computeOptimisticProgress(start, end, 15, 45, null, null, now);
    expect(out.pct).toBeCloseTo(25, 5);
  });

  it('aligns the green/base boundary with the now-line during run (wallclock)', () => {
    // 22.5 min into 45 min run = 50% run progress.
    // fillFraction = 0.25 + 0.5 × 0.75 = 0.625, pct = 62.5%.
    // (now - tileStart) / totalMs = (15 + 22.5) / 60 = 0.625 ✓
    const now = new Date('2026-05-05T10:37:30.000Z').getTime();
    const out = computeOptimisticProgress(start, end, 15, 45, null, null, now);
    expect(out.pct).toBeCloseTo(62.5, 5);
  });

  it('returns 100 once now ≥ scheduledEnd with no saisie', () => {
    const now = new Date('2026-05-05T11:30:00.000Z').getTime();
    const out = computeOptimisticProgress(start, end, 15, 45, null, null, now);
    expect(out.pct).toBe(100);
    expect(out.isLate).toBe(false);
  });

  it('handles tiles without calage (setupMin = 0) — pure run-zone fill', () => {
    // Pas de calage → setupFraction = 0, runFraction = 1.
    // fillFraction = 0 + rPct/100 × 1 = rPct/100.
    const noCalageEnd = '2026-05-05T10:45:00.000Z'; // 45 min run only
    // 22.5 min in = 50% run → fillFraction = 0.5
    const now = new Date('2026-05-05T10:22:30.000Z').getTime();
    const out = computeOptimisticProgress(start, noCalageEnd, 0, 45, null, null, now);
    expect(out.pct).toBeCloseTo(50, 5);
  });

  it('saisie anchor extrapolates from recordedProgressPct, restricted to run zone', () => {
    // Saisie at 10:30 reports 50% run done.
    // 5 min later (10:35), wallclock delta on a 45-min run window = 11.1%.
    // rPct = 50 + 11.1 = 61.1, fillFraction = 0.25 + 0.611 × 0.75 ≈ 0.708.
    const now = new Date('2026-05-05T10:35:00.000Z').getTime();
    const out = computeOptimisticProgress(
      start,
      end,
      15,
      45,
      50,
      '2026-05-05T10:30:00.000Z',
      now,
    );
    expect(out.pct).toBeCloseTo(70.83, 1);
  });
});

describe('computeUnplacedOptimisticProgress (cross-scenario, no assignment)', () => {
  // The Préprod-tile-lifted use case : the task has an anchor + ratio on
  // its own row, but no scheduledStart/End in the current scenario. The
  // helper extrapolates purely from task fields.

  it('returns 0 when no anchor exists', () => {
    const now = new Date('2026-05-05T10:30:00.000Z').getTime();
    expect(
      computeUnplacedOptimisticProgress(null, null, null, 60, now),
    ).toBe(0);
  });

  it('returns the recorded value verbatim when no recordedAt yet', () => {
    const now = new Date('2026-05-05T10:30:00.000Z').getTime();
    expect(
      computeUnplacedOptimisticProgress(50, null, 1, 60, now),
    ).toBe(50);
  });

  it('extrapolates linearly from anchor at productivity 1.0', () => {
    // Saisie at 10:00 reports 50% on a 60-min nominal run. 30 min later,
    // 30/60 × 100 = +50 → 100% at productivity 1.0. We clamp at 100.
    const now = new Date('2026-05-05T10:30:00.000Z').getTime();
    expect(
      computeUnplacedOptimisticProgress(
        50,
        '2026-05-05T10:00:00.000Z',
        1,
        60,
        now,
      ),
    ).toBeCloseTo(100, 5);
  });

  it('slows extrapolation when productivity ratio > 1 (operator slower)', () => {
    // Same as above but ratio = 2 → realistic run = 120 min. 30 min on 120
    // = 25% delta → recordedPct + 25 = 75.
    const now = new Date('2026-05-05T10:30:00.000Z').getTime();
    expect(
      computeUnplacedOptimisticProgress(
        50,
        '2026-05-05T10:00:00.000Z',
        2,
        60,
        now,
      ),
    ).toBeCloseTo(75, 5);
  });

  it('defaults productivity to 1.0 when null', () => {
    const now = new Date('2026-05-05T10:15:00.000Z').getTime();
    // 15 min on 60 min nominal = 25% delta from anchor.
    expect(
      computeUnplacedOptimisticProgress(
        50,
        '2026-05-05T10:00:00.000Z',
        null,
        60,
        now,
      ),
    ).toBeCloseTo(75, 5);
  });

  it('clamps at 100 when extrapolation overshoots', () => {
    const now = new Date('2026-05-05T15:00:00.000Z').getTime();
    expect(
      computeUnplacedOptimisticProgress(
        50,
        '2026-05-05T10:00:00.000Z',
        1,
        60,
        now,
      ),
    ).toBe(100);
  });

  it('clamps at 0 when anchor is post-now (clock skew)', () => {
    const now = new Date('2026-05-05T10:00:00.000Z').getTime();
    // Saisie at 10:30 (in the future relative to now). Delta is negative.
    // recordedPct=10 + (-30/60)*100 = 10 - 50 = -40 → clamp 0.
    expect(
      computeUnplacedOptimisticProgress(
        10,
        '2026-05-05T10:30:00.000Z',
        1,
        60,
        now,
      ),
    ).toBe(0);
  });

  it('returns recorded pct when runMinutes is 0 (no denominator)', () => {
    const now = new Date('2026-05-05T10:30:00.000Z').getTime();
    expect(
      computeUnplacedOptimisticProgress(
        42,
        '2026-05-05T10:00:00.000Z',
        1,
        0,
        now,
      ),
    ).toBe(42);
  });

  it('treats non-positive productivity as default 1.0 (defensive)', () => {
    const now = new Date('2026-05-05T10:30:00.000Z').getTime();
    // ratio = 0 would div-by-zero ; 1.0 fallback gives 30/60 = +50 → 100.
    expect(
      computeUnplacedOptimisticProgress(
        50,
        '2026-05-05T10:00:00.000Z',
        0,
        60,
        now,
      ),
    ).toBe(100);
  });
});
