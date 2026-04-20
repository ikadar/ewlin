import { describe, it, expect } from 'vitest';
import { classifyCollapse, MIN_COLLAPSE_HOURS, COLLAPSED_BAND_PX, SNAP_MINUTES } from './collapseConfig';
import { timeToYPosition } from '../TimelineColumn/utils';
import { yPositionToTime } from '../DragPreview/snapUtils';
import type { Collapse } from './collapseConfig';

describe('collapseConfig constants', () => {
  it('exposes the spec-locked values (2026-04-20, threshold revised to 7h)', () => {
    expect(MIN_COLLAPSE_HOURS).toBe(7);
    expect(COLLAPSED_BAND_PX).toBe(60);
    expect(SNAP_MINUTES).toBe(15);
  });
});

describe('classifyCollapse — priority weekend > closure > night > pause', () => {
  it('classifies Fri 17:00 → Mon 08:00 as weekend (contains Sat & Sun)', () => {
    const from = new Date(2026, 3, 17, 17, 0); // Fri Apr 17 2026
    const to = new Date(2026, 3, 20, 8, 0);    // Mon Apr 20 2026
    expect(classifyCollapse(from, to)).toBe('weekend');
  });

  it('classifies Mon 17:00 → Wed 08:00 (Tue holiday) as closure', () => {
    const from = new Date(2026, 3, 20, 17, 0); // Mon
    const to = new Date(2026, 3, 22, 8, 0);    // Wed (skips Tue)
    expect(classifyCollapse(from, to)).toBe('closure');
  });

  it('classifies Thu 17:00 → Fri 08:00 as night (one-midnight jump)', () => {
    const from = new Date(2026, 3, 16, 17, 0); // Thu
    const to = new Date(2026, 3, 17, 8, 0);    // Fri
    expect(classifyCollapse(from, to)).toBe('night');
  });

  it('classifies a 1h gap inside a single weekday as pause', () => {
    const from = new Date(2026, 3, 16, 12, 0); // Thu 12:00
    const to = new Date(2026, 3, 16, 13, 0);   // Thu 13:00
    expect(classifyCollapse(from, to)).toBe('pause');
  });

  it('classifies a stretch wholly inside Saturday as weekend (priority wins)', () => {
    const from = new Date(2026, 3, 18, 10, 0); // Sat 10:00
    const to = new Date(2026, 3, 18, 18, 0);   // Sat 18:00
    expect(classifyCollapse(from, to)).toBe('weekend');
  });
});

// ---------------------------------------------------------------------------
// timeToYPosition <-> yPositionToTime round-trip with collapses
// ---------------------------------------------------------------------------

describe('timeToY / yToTime piecewise round-trip', () => {
  const PX = 80;
  const baseDate = new Date(2026, 3, 13, 0, 0); // Mon Apr 13 2026 00:00
  // One weekend collapse: Fri Apr 17 17:00 → Mon Apr 20 08:00 (63h), 120px rendered
  const collapse: Collapse = {
    id: 'weekend-1',
    from: new Date(2026, 3, 17, 17, 0),
    to: new Date(2026, 3, 20, 8, 0),
    durationHours: 63,
    kind: 'weekend',
    heightPx: 120,
  };
  const collapses: readonly Collapse[] = [collapse];

  it('gives the linear Y when no collapses', () => {
    const t = new Date(2026, 3, 14, 6, 0); // Tue 06:00 → 30h after baseDate
    expect(timeToYPosition(t, 0, PX, baseDate)).toBe(30 * PX);
  });

  it('shrinks Y for times after a band by (realPx - heightPx)', () => {
    // Mon 20 12:00 = 7d * 24h + 12h = 180h after baseDate (linear Y = 14400)
    // Band consumes 63h * 80 = 5040 px in linear terms, replaced by 120 px (weekend) → savings = 4920
    // Expected Y = 14400 - 4920 = 9480
    const t = new Date(2026, 3, 20, 12, 0);
    expect(timeToYPosition(t, 0, PX, baseDate, collapses)).toBe(9480);
  });

  it('clamps a time inside a band to the band start', () => {
    // Sat 18 10:00 = inside the weekend band → clamps to Fri 17 17:00
    // Y of Fri 17:00 = (4d * 24h + 17h) * 80 = 113 * 80 = 9040
    const inside = new Date(2026, 3, 18, 10, 0);
    expect(timeToYPosition(inside, 0, PX, baseDate, collapses)).toBe(9040);
  });

  it('round-trips outside the band', () => {
    const t = new Date(2026, 3, 20, 12, 0); // Mon 20 12:00
    const y = timeToYPosition(t, 0, PX, baseDate, collapses);
    const back = yPositionToTime(y, 0, baseDate, PX, collapses);
    expect(back.getTime()).toBe(t.getTime());
  });

  it('round-trips at the band edge (just before)', () => {
    // 16:45 on Friday = 15 min before band start → still in linear zone
    const t = new Date(2026, 3, 17, 16, 45);
    const y = timeToYPosition(t, 0, PX, baseDate, collapses);
    const back = yPositionToTime(y, 0, baseDate, PX, collapses);
    expect(back.getTime()).toBe(t.getTime());
  });

  it('yToTime resolves to band.from when y lands in the band region', () => {
    // The band's rendered region is [bandStartY, bandStartY + heightPx].
    // bandStartY = 9040 (Y of Fri 17:00). Weekend band is 120px tall. Pick y in the middle.
    const yInBand = 9040 + 60;
    const t = yPositionToTime(yInBand, 0, baseDate, PX, collapses);
    expect(t.getTime()).toBe(collapse.from.getTime());
  });
});
