import { describe, it, expect } from 'vitest';
import {
  rangesOverlap,
  parseTimestamp,
  formatTimestamp,
  calculateInternalEndTime,
  calculateOutsourcedEndTime,
  getOverlap,
  countActiveAtTime,
  getMaxConcurrent,
  type TimeRange,
} from './time.js';

describe('rangesOverlap', () => {
  it('should detect overlapping ranges', () => {
    const a: TimeRange = {
      start: new Date('2025-01-15T09:00:00Z'),
      end: new Date('2025-01-15T11:00:00Z'),
    };
    const b: TimeRange = {
      start: new Date('2025-01-15T10:00:00Z'),
      end: new Date('2025-01-15T12:00:00Z'),
    };
    expect(rangesOverlap(a, b)).toBe(true);
  });

  it('should detect non-overlapping ranges', () => {
    const a: TimeRange = {
      start: new Date('2025-01-15T09:00:00Z'),
      end: new Date('2025-01-15T10:00:00Z'),
    };
    const b: TimeRange = {
      start: new Date('2025-01-15T11:00:00Z'),
      end: new Date('2025-01-15T12:00:00Z'),
    };
    expect(rangesOverlap(a, b)).toBe(false);
  });

  it('should NOT overlap when adjacent (end equals start)', () => {
    const a: TimeRange = {
      start: new Date('2025-01-15T09:00:00Z'),
      end: new Date('2025-01-15T10:00:00Z'),
    };
    const b: TimeRange = {
      start: new Date('2025-01-15T10:00:00Z'),
      end: new Date('2025-01-15T11:00:00Z'),
    };
    expect(rangesOverlap(a, b)).toBe(false);
  });

  it('should detect when one range contains another', () => {
    const outer: TimeRange = {
      start: new Date('2025-01-15T08:00:00Z'),
      end: new Date('2025-01-15T12:00:00Z'),
    };
    const inner: TimeRange = {
      start: new Date('2025-01-15T09:00:00Z'),
      end: new Date('2025-01-15T11:00:00Z'),
    };
    expect(rangesOverlap(outer, inner)).toBe(true);
    expect(rangesOverlap(inner, outer)).toBe(true);
  });
});

describe('parseTimestamp / formatTimestamp', () => {
  it('should parse ISO timestamp correctly', () => {
    const date = parseTimestamp('2025-01-15T09:30:00Z');
    expect(date.getUTCFullYear()).toBe(2025);
    expect(date.getUTCMonth()).toBe(0); // January
    expect(date.getUTCDate()).toBe(15);
    expect(date.getUTCHours()).toBe(9);
    expect(date.getUTCMinutes()).toBe(30);
  });

  it('should format Date to ISO string', () => {
    const date = new Date('2025-01-15T09:30:00.000Z');
    expect(formatTimestamp(date)).toBe('2025-01-15T09:30:00.000Z');
  });
});

describe('calculateInternalEndTime', () => {
  it('should calculate end time correctly', () => {
    const start = new Date('2025-01-15T09:00:00Z');
    const duration = { setupMinutes: 15, runMinutes: 45 };
    const end = calculateInternalEndTime(start, duration);
    expect(end.toISOString()).toBe('2025-01-15T10:00:00.000Z');
  });

  it('should handle zero setup time', () => {
    const start = new Date('2025-01-15T09:00:00Z');
    const duration = { setupMinutes: 0, runMinutes: 30 };
    const end = calculateInternalEndTime(start, duration);
    expect(end.toISOString()).toBe('2025-01-15T09:30:00.000Z');
  });
});

describe('calculateOutsourcedEndTime', () => {
  it('should calculate end time in days', () => {
    const start = new Date('2025-01-15T09:00:00Z');
    const duration = { openDays: 2 };
    const end = calculateOutsourcedEndTime(start, duration);
    expect(end.toISOString()).toBe('2025-01-17T09:00:00.000Z');
  });
});

describe('getOverlap', () => {
  it('should return overlap range', () => {
    const a: TimeRange = {
      start: new Date('2025-01-15T09:00:00Z'),
      end: new Date('2025-01-15T11:00:00Z'),
    };
    const b: TimeRange = {
      start: new Date('2025-01-15T10:00:00Z'),
      end: new Date('2025-01-15T12:00:00Z'),
    };
    const overlap = getOverlap(a, b);
    expect(overlap).not.toBeNull();
    expect(overlap?.start.toISOString()).toBe('2025-01-15T10:00:00.000Z');
    expect(overlap?.end.toISOString()).toBe('2025-01-15T11:00:00.000Z');
  });

  it('should return null for non-overlapping ranges', () => {
    const a: TimeRange = {
      start: new Date('2025-01-15T09:00:00Z'),
      end: new Date('2025-01-15T10:00:00Z'),
    };
    const b: TimeRange = {
      start: new Date('2025-01-15T11:00:00Z'),
      end: new Date('2025-01-15T12:00:00Z'),
    };
    expect(getOverlap(a, b)).toBeNull();
  });
});

describe('countActiveAtTime', () => {
  it('should count active ranges at a point in time', () => {
    const ranges: TimeRange[] = [
      {
        start: new Date('2025-01-15T09:00:00Z'),
        end: new Date('2025-01-15T11:00:00Z'),
      },
      {
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z'),
      },
      {
        start: new Date('2025-01-15T13:00:00Z'),
        end: new Date('2025-01-15T14:00:00Z'),
      },
    ];
    expect(countActiveAtTime(new Date('2025-01-15T10:30:00Z'), ranges)).toBe(2);
    expect(countActiveAtTime(new Date('2025-01-15T09:30:00Z'), ranges)).toBe(1);
    expect(countActiveAtTime(new Date('2025-01-15T12:30:00Z'), ranges)).toBe(0);
  });
});

describe('getMaxConcurrent', () => {
  it('should return 0 for empty ranges', () => {
    expect(getMaxConcurrent([])).toBe(0);
  });

  it('should return 1 for single range', () => {
    const ranges: TimeRange[] = [
      {
        start: new Date('2025-01-15T09:00:00Z'),
        end: new Date('2025-01-15T10:00:00Z'),
      },
    ];
    expect(getMaxConcurrent(ranges)).toBe(1);
  });

  it('should return max concurrent count', () => {
    const ranges: TimeRange[] = [
      {
        start: new Date('2025-01-15T09:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z'),
      },
      {
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T13:00:00Z'),
      },
      {
        start: new Date('2025-01-15T11:00:00Z'),
        end: new Date('2025-01-15T14:00:00Z'),
      },
    ];
    expect(getMaxConcurrent(ranges)).toBe(3);
  });

  it('should handle adjacent ranges correctly', () => {
    const ranges: TimeRange[] = [
      {
        start: new Date('2025-01-15T09:00:00Z'),
        end: new Date('2025-01-15T10:00:00Z'),
      },
      {
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T11:00:00Z'),
      },
    ];
    // Adjacent ranges should not overlap, max should be 1
    expect(getMaxConcurrent(ranges)).toBe(1);
  });
});
