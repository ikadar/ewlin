import { describe, it, expect } from 'vitest';
import { ceilToQuarterHour } from '../../src/timeline.js';

describe('ceilToQuarterHour', () => {
  it('returns unchanged if already on quarter-hour boundary', () => {
    const date = new Date('2026-01-01T10:15:00.000Z');
    const result = ceilToQuarterHour(date);
    expect(result.getMinutes()).toBe(15);
    expect(result.getSeconds()).toBe(0);
  });

  it('rounds up to next quarter-hour', () => {
    const date = new Date('2026-01-01T10:23:45.000Z');
    const result = ceilToQuarterHour(date);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('rounds 10:01 to 10:15', () => {
    const date = new Date('2026-01-01T10:01:00.000Z');
    const result = ceilToQuarterHour(date);
    expect(result.getMinutes()).toBe(15);
  });

  it('rounds 10:00:01 to 10:15', () => {
    const date = new Date('2026-01-01T10:00:01.000Z');
    const result = ceilToQuarterHour(date);
    expect(result.getMinutes()).toBe(15);
    expect(result.getSeconds()).toBe(0);
  });

  it('keeps 10:00:00 unchanged', () => {
    const date = new Date('2026-01-01T10:00:00.000Z');
    const result = ceilToQuarterHour(date);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('rounds 10:45:30 to 11:00', () => {
    const date = new Date('2026-01-01T10:45:30.000Z');
    const result = ceilToQuarterHour(date);
    expect(result.getUTCHours()).toBe(11);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
  });
});
