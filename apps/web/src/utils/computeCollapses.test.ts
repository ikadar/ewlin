import { describe, it, expect } from 'vitest';
import type { Operator, OperatingSchedule, DaySchedule } from '@flux/types';
import { computeCollapses } from './computeCollapses';

const FULL_DAY: DaySchedule = { isOperating: true, slots: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '17:00' }] };
const OFF: DaySchedule = { isOperating: false, slots: [] };

const standardWeek: OperatingSchedule = {
  monday: FULL_DAY,
  tuesday: FULL_DAY,
  wednesday: FULL_DAY,
  thursday: FULL_DAY,
  friday: FULL_DAY,
  saturday: OFF,
  sunday: OFF,
};

function makeOperator(id: string, schedule: OperatingSchedule = standardWeek): Operator {
  return {
    id,
    firstName: 'Op',
    lastName: id,
    role: null,
    operatingSchedules: [schedule],
    scheduleRotationReferenceWeek: null,
    scheduleNames: null,
    absences: null,
  } as unknown as Operator;
}

describe('computeCollapses', () => {
  it('returns [] when no operators are provided', () => {
    const start = new Date(2026, 3, 13, 0, 0);
    const end = new Date(2026, 3, 20, 0, 0);
    expect(computeCollapses([], start, end)).toEqual([]);
  });

  it('produces a single weekend band over Sat + Sun (≥ 8h)', () => {
    const op = makeOperator('A');
    const start = new Date(2026, 3, 13, 0, 0); // Mon Apr 13
    const end = new Date(2026, 3, 27, 0, 0);   // 2 weeks
    const collapses = computeCollapses([op], start, end);

    // Inside the 14-day window we expect: 4 nights (Mon→Tue, Tue→Wed, Wed→Thu, Thu→Fri × 2 weeks),
    // 2 weekends, plus end-of-period folds. Just verify there is at least one weekend.
    const weekends = collapses.filter(c => c.kind === 'weekend');
    expect(weekends.length).toBeGreaterThanOrEqual(2);
  });

  it('produces a night band that crosses one midnight between two working days', () => {
    const op = makeOperator('A');
    const start = new Date(2026, 3, 13, 0, 0); // Mon Apr 13
    const end = new Date(2026, 3, 17, 0, 0);   // through end of Thu
    const collapses = computeCollapses([op], start, end);

    const nights = collapses.filter(c => c.kind === 'night');
    // Mon→Tue, Tue→Wed, Wed→Thu — at least one
    expect(nights.length).toBeGreaterThanOrEqual(1);
    // Each night band should be ≥ 8h (it's actually 15h: 17:00 → 08:00)
    nights.forEach(n => expect(n.durationHours).toBeGreaterThanOrEqual(8));
  });

  it('intersects across operators — only collapses when ALL operators are off', () => {
    const opA = makeOperator('A');
    // opB is in 24/7: never has gaps inside operating hours
    const allOpen: DaySchedule = { isOperating: true, slots: [{ start: '00:00', end: '24:00' }] };
    const opB = makeOperator('B', {
      monday: allOpen, tuesday: allOpen, wednesday: allOpen, thursday: allOpen, friday: allOpen,
      saturday: allOpen, sunday: allOpen,
    });
    const start = new Date(2026, 3, 13, 0, 0);
    const end = new Date(2026, 3, 27, 0, 0);
    const collapses = computeCollapses([opA, opB], start, end);
    // opB is always available → intersection of unavailability is empty → no bands
    expect(collapses).toEqual([]);
  });

  it('snaps boundaries to the 15-min grid', () => {
    const op = makeOperator('A');
    const start = new Date(2026, 3, 13, 0, 0);
    const end = new Date(2026, 3, 27, 0, 0);
    const collapses = computeCollapses([op], start, end);
    for (const c of collapses) {
      expect(c.from.getMinutes() % 15).toBe(0);
      expect(c.to.getMinutes() % 15).toBe(0);
    }
  });

  it('drops gaps shorter than MIN_COLLAPSE_HOURS', () => {
    // Lunch (12:00-13:00) is 1h — well below 8h threshold → no band for lunch
    const op = makeOperator('A');
    const start = new Date(2026, 3, 13, 0, 0);
    const end = new Date(2026, 3, 14, 0, 0); // single Monday
    const collapses = computeCollapses([op], start, end);
    // There may still be the leading "before 08:00" band if it spans ≥ 8h.
    // What matters: NO band starts at 12:00.
    const lunchBand = collapses.find(
      c => c.from.getHours() === 12 && c.from.getMinutes() === 0,
    );
    expect(lunchBand).toBeUndefined();
  });

  it('returns sorted, classified, durationHours-bearing collapses', () => {
    const op = makeOperator('A');
    const start = new Date(2026, 3, 13, 0, 0);
    const end = new Date(2026, 3, 27, 0, 0);
    const collapses = computeCollapses([op], start, end);
    for (let i = 1; i < collapses.length; i++) {
      expect(collapses[i].from.getTime()).toBeGreaterThanOrEqual(collapses[i - 1].from.getTime());
    }
    for (const c of collapses) {
      expect(['night', 'weekend', 'closure', 'pause']).toContain(c.kind);
      expect(c.durationHours).toBeGreaterThan(0);
      expect(c.id).toBe(`${c.from.toISOString()}-${c.to.toISOString()}`);
    }
  });
});
