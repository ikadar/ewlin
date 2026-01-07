import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVirtualScroll, isAssignmentVisible, getVisibleDates } from './useVirtualScroll';

describe('useVirtualScroll', () => {
  const defaultConfig = {
    totalDays: 365,
    bufferDays: 3,
    dayHeightPx: 1920, // 24 hours * 80 pixels
    scrollTop: 0,
    viewportHeight: 600,
  };

  describe('basic calculations', () => {
    it('should calculate total height correctly', () => {
      const { result } = renderHook(() => useVirtualScroll(defaultConfig));
      expect(result.current.totalHeight).toBe(365 * 1920);
    });

    it('should return correct visible range at scroll position 0', () => {
      const { result } = renderHook(() => useVirtualScroll(defaultConfig));
      // At scrollTop 0, viewport center is at 300px
      // focusedDayIndex = Math.floor(300 / 1920) = 0
      expect(result.current.focusedDayIndex).toBe(0);
      expect(result.current.visibleRange.start).toBe(0);
      expect(result.current.visibleRange.end).toBe(3); // 0 + bufferDays
    });

    it('should return correct visible range in the middle', () => {
      // Scroll to day 100 (center of viewport at day 100's center)
      const scrollTop = 100 * 1920 + 960 - 300; // Day 100 center - viewport half
      const { result } = renderHook(() =>
        useVirtualScroll({ ...defaultConfig, scrollTop })
      );

      expect(result.current.focusedDayIndex).toBe(100);
      expect(result.current.visibleRange.start).toBe(97); // 100 - 3
      expect(result.current.visibleRange.end).toBe(103); // 100 + 3
    });

    it('should clamp visible range at the end', () => {
      // Scroll to the very end (day 364 centered)
      const scrollTop = 364 * 1920; // Day 364 centered
      const { result } = renderHook(() =>
        useVirtualScroll({ ...defaultConfig, scrollTop })
      );

      expect(result.current.visibleRange.end).toBe(364); // totalDays - 1
      expect(result.current.visibleRange.start).toBe(361); // 364 - 3
    });
  });

  describe('offset calculation', () => {
    it('should calculate offsetY correctly at scroll position 0', () => {
      const { result } = renderHook(() => useVirtualScroll(defaultConfig));
      expect(result.current.offsetY).toBe(0); // start = 0, so offsetY = 0
    });

    it('should calculate offsetY correctly in the middle', () => {
      const scrollTop = 100 * 1920;
      const { result } = renderHook(() =>
        useVirtualScroll({ ...defaultConfig, scrollTop })
      );

      // visibleRange.start should be around 97-100
      const expectedOffsetY = result.current.visibleRange.start * 1920;
      expect(result.current.offsetY).toBe(expectedOffsetY);
    });
  });

  describe('rendered day count', () => {
    it('should render 2*bufferDays+1 days in the middle', () => {
      const scrollTop = 100 * 1920;
      const { result } = renderHook(() =>
        useVirtualScroll({ ...defaultConfig, scrollTop })
      );

      expect(result.current.renderedDayCount).toBe(7); // 3 + 1 + 3
    });

    it('should render fewer days at the start', () => {
      const { result } = renderHook(() => useVirtualScroll(defaultConfig));
      // At start: focusedDay=0, start=0, end=3
      expect(result.current.renderedDayCount).toBe(4); // 0 to 3 inclusive
    });
  });

  describe('hour range calculation', () => {
    it('should calculate visible hours correctly', () => {
      const scrollTop = 100 * 1920;
      const { result } = renderHook(() =>
        useVirtualScroll({ ...defaultConfig, scrollTop })
      );

      const startHour = result.current.visibleRange.start * 24;
      const endHour = (result.current.visibleRange.end + 1) * 24;

      expect(result.current.visibleStartHour).toBe(startHour);
      expect(result.current.visibleEndHour).toBe(endHour);
    });
  });
});

describe('isAssignmentVisible', () => {
  const gridStartDate = new Date('2026-01-01T06:00:00');

  it('should return true for assignment within visible range', () => {
    const visibleRange = { start: 5, end: 10 };
    const result = isAssignmentVisible(
      '2026-01-08T10:00:00', // Day 7
      '2026-01-08T12:00:00',
      gridStartDate,
      visibleRange
    );
    expect(result).toBe(true);
  });

  it('should return false for assignment before visible range', () => {
    const visibleRange = { start: 10, end: 15 };
    const result = isAssignmentVisible(
      '2026-01-03T10:00:00', // Day 2
      '2026-01-03T12:00:00',
      gridStartDate,
      visibleRange
    );
    expect(result).toBe(false);
  });

  it('should return false for assignment after visible range', () => {
    const visibleRange = { start: 5, end: 10 };
    const result = isAssignmentVisible(
      '2026-01-20T10:00:00', // Day 19
      '2026-01-20T12:00:00',
      gridStartDate,
      visibleRange
    );
    expect(result).toBe(false);
  });

  it('should return true for assignment spanning multiple days crossing visible range', () => {
    const visibleRange = { start: 5, end: 10 };
    const result = isAssignmentVisible(
      '2026-01-04T10:00:00', // Day 3 (before range)
      '2026-01-08T12:00:00', // Day 7 (within range)
      gridStartDate,
      visibleRange
    );
    expect(result).toBe(true);
  });

  it('should return true for assignment at the edge of visible range', () => {
    const visibleRange = { start: 5, end: 10 };
    // Assignment on day 5 (start of range)
    const result = isAssignmentVisible(
      '2026-01-06T10:00:00',
      '2026-01-06T12:00:00',
      gridStartDate,
      visibleRange
    );
    expect(result).toBe(true);
  });
});

describe('getVisibleDates', () => {
  const startDate = new Date('2026-01-01T06:00:00');

  it('should return correct dates for visible range', () => {
    const visibleRange = { start: 0, end: 2 };
    const dates = getVisibleDates(startDate, visibleRange);

    expect(dates).toHaveLength(3);
    expect(dates[0].getDate()).toBe(1);
    expect(dates[1].getDate()).toBe(2);
    expect(dates[2].getDate()).toBe(3);
  });

  it('should handle range in the middle of the month', () => {
    const visibleRange = { start: 10, end: 12 };
    const dates = getVisibleDates(startDate, visibleRange);

    expect(dates).toHaveLength(3);
    expect(dates[0].getDate()).toBe(11);
    expect(dates[1].getDate()).toBe(12);
    expect(dates[2].getDate()).toBe(13);
  });

  it('should handle month boundary', () => {
    const visibleRange = { start: 30, end: 32 };
    const dates = getVisibleDates(startDate, visibleRange);

    expect(dates).toHaveLength(3);
    expect(dates[0].getDate()).toBe(31); // Jan 31
    expect(dates[1].getDate()).toBe(1); // Feb 1
    expect(dates[2].getDate()).toBe(2); // Feb 2
    expect(dates[1].getMonth()).toBe(1); // February
  });
});
