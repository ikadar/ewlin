import { describe, it, expect } from 'vitest';
import { computeChunkProgress, computeOptimisticProgress } from './saisieMath';

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

describe('computeOptimisticProgress (task-scoped, regression guard)', () => {
  // Sanity check that the existing task-level helper still behaves as
  // documented after the chunk helper sat next to it. Light coverage —
  // the per-window helper above is the new addition.
  it('returns 0 during setup', () => {
    const start = '2026-05-05T10:00:00.000Z';
    const end = '2026-05-05T11:00:00.000Z';
    const now = new Date('2026-05-05T10:05:00.000Z').getTime();
    const out = computeOptimisticProgress(start, end, 15, 45, null, null, now);
    expect(out.pct).toBe(0);
  });

  it('returns 100 once now ≥ scheduledEnd with no saisie', () => {
    const start = '2026-05-05T10:00:00.000Z';
    const end = '2026-05-05T11:00:00.000Z';
    const now = new Date('2026-05-05T11:30:00.000Z').getTime();
    const out = computeOptimisticProgress(start, end, 15, 45, null, null, now);
    expect(out.pct).toBe(100);
    expect(out.isLate).toBe(false);
  });
});
