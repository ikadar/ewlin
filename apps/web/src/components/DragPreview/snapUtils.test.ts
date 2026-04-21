import { describe, it, expect } from 'vitest';
import {
  snapToGrid,
  yPositionToTime,
  formatTime,
  SNAP_INTERVAL_MINUTES,
  PIXELS_PER_SNAP,
} from './snapUtils';
// `timeToYPosition` used to live here as a linear-only duplicate. It was
// removed when the canonical (collapse-aware) version was made mandatory to
// use; these tests now exercise the canonical one via `[]` for collapses.
import { PIXELS_PER_HOUR, timeToYPosition } from '../TimelineColumn';

describe('snapUtils', () => {
  describe('constants', () => {
    it('has correct snap interval', () => {
      // v0.3.5x: Changed from 30 to 15 minutes
      expect(SNAP_INTERVAL_MINUTES).toBe(15);
    });

    it('has correct pixels per snap', () => {
      // 15 minutes = quarter hour = 20px at 80px/hour
      expect(PIXELS_PER_SNAP).toBe(PIXELS_PER_HOUR / 4);
      expect(PIXELS_PER_SNAP).toBe(20);
    });
  });

  describe('snapToGrid', () => {
    it('snaps to exact grid positions', () => {
      // 15-minute grid: 0, 20, 40, 60, 80...
      expect(snapToGrid(0)).toBe(0);
      expect(snapToGrid(20)).toBe(20);
      expect(snapToGrid(40)).toBe(40);
      expect(snapToGrid(80)).toBe(80);
    });

    it('rounds to nearest 15-minute boundary', () => {
      // Below midpoint (10px) rounds down
      expect(snapToGrid(5)).toBe(0);
      expect(snapToGrid(9)).toBe(0);

      // At or above midpoint rounds up
      expect(snapToGrid(10)).toBe(20);
      expect(snapToGrid(15)).toBe(20);
      expect(snapToGrid(19)).toBe(20);
    });

    it('handles positions between grid lines', () => {
      // 15-minute grid at 80px/hour: 20px intervals
      expect(snapToGrid(25)).toBe(20);
      expect(snapToGrid(35)).toBe(40);
      expect(snapToGrid(50)).toBe(60);
      expect(snapToGrid(65)).toBe(60);
    });

    it('handles large positions', () => {
      // 10 hours = 800px, 10.25 hours = 820px
      expect(snapToGrid(800)).toBe(800);
      expect(snapToGrid(810)).toBe(820);
      expect(snapToGrid(820)).toBe(820);
    });
  });

  describe('yPositionToTime', () => {
    it('converts Y position to time correctly', () => {
      const startHour = 6;
      const baseDate = new Date('2025-12-16T00:00:00');

      // Y=0 should be 6:00
      const time0 = yPositionToTime(0, startHour, baseDate, PIXELS_PER_HOUR, []);
      expect(time0.getHours()).toBe(6);
      expect(time0.getMinutes()).toBe(0);

      // Y=40 should be 6:30 (30 minutes = 40px)
      const time40 = yPositionToTime(40, startHour, baseDate, PIXELS_PER_HOUR, []);
      expect(time40.getHours()).toBe(6);
      expect(time40.getMinutes()).toBe(30);

      // Y=80 should be 7:00 (1 hour = 80px)
      const time80 = yPositionToTime(80, startHour, baseDate, PIXELS_PER_HOUR, []);
      expect(time80.getHours()).toBe(7);
      expect(time80.getMinutes()).toBe(0);
    });

    it('handles different start hours', () => {
      const baseDate = new Date('2025-12-16T00:00:00');

      // Start at 8:00
      const time = yPositionToTime(80, 8, baseDate, PIXELS_PER_HOUR, []);
      expect(time.getHours()).toBe(9);
      expect(time.getMinutes()).toBe(0);
    });

    it('handles fractional positions', () => {
      const baseDate = new Date('2025-12-16T00:00:00');
      const startHour = 6;

      // Y=20 should be 6:15 (15 minutes = 20px)
      const time = yPositionToTime(20, startHour, baseDate, PIXELS_PER_HOUR, []);
      expect(time.getHours()).toBe(6);
      expect(time.getMinutes()).toBe(15);
    });
  });

  describe('timeToYPosition', () => {
    it('converts time to Y position correctly', () => {
      const startHour = 6;

      // 6:00 -> Y=0
      const date1 = new Date('2025-12-16T06:00:00');
      expect(timeToYPosition(date1, startHour, PIXELS_PER_HOUR, undefined, [])).toBe(0);

      // 6:30 -> Y=40
      const date2 = new Date('2025-12-16T06:30:00');
      expect(timeToYPosition(date2, startHour, PIXELS_PER_HOUR, undefined, [])).toBe(40);

      // 7:00 -> Y=80
      const date3 = new Date('2025-12-16T07:00:00');
      expect(timeToYPosition(date3, startHour, PIXELS_PER_HOUR, undefined, [])).toBe(80);
    });

    // Note: the previous "times before start hour → negative values" case was
    // an artifact of the linear-only duplicate that used to live in this file.
    // The canonical `timeToYPosition` wraps sub-`startHour` times into the
    // next day (hours + 24) instead, so negative Y is not a valid state.
  });

  describe('formatTime', () => {
    it('formats time as HH:MM', () => {
      expect(formatTime(new Date('2025-12-16T06:00:00'))).toBe('06:00');
      expect(formatTime(new Date('2025-12-16T14:30:00'))).toBe('14:30');
      expect(formatTime(new Date('2025-12-16T09:05:00'))).toBe('09:05');
    });

    it('pads single digit hours and minutes', () => {
      expect(formatTime(new Date('2025-12-16T06:05:00'))).toBe('06:05');
      expect(formatTime(new Date('2025-12-16T00:00:00'))).toBe('00:00');
    });
  });

  describe('round-trip conversion', () => {
    it('Y position -> time -> Y position is consistent', () => {
      const startHour = 6;
      const baseDate = new Date('2025-12-16T00:00:00');

      // Test various grid positions
      [0, 40, 80, 120, 200, 400, 800].forEach((y) => {
        const time = yPositionToTime(y, startHour, baseDate, PIXELS_PER_HOUR, []);
        const resultY = timeToYPosition(time, startHour, PIXELS_PER_HOUR, undefined, []);
        expect(resultY).toBe(y);
      });
    });
  });
});
