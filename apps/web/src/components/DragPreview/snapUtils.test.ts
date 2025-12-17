import { describe, it, expect } from 'vitest';
import {
  snapToGrid,
  yPositionToTime,
  timeToYPosition,
  formatTime,
  SNAP_INTERVAL_MINUTES,
  PIXELS_PER_SNAP,
} from './snapUtils';
import { PIXELS_PER_HOUR } from '../TimelineColumn';

describe('snapUtils', () => {
  describe('constants', () => {
    it('has correct snap interval', () => {
      expect(SNAP_INTERVAL_MINUTES).toBe(30);
    });

    it('has correct pixels per snap', () => {
      // 30 minutes = half hour = 40px at 80px/hour
      expect(PIXELS_PER_SNAP).toBe(PIXELS_PER_HOUR / 2);
      expect(PIXELS_PER_SNAP).toBe(40);
    });
  });

  describe('snapToGrid', () => {
    it('snaps to exact grid positions', () => {
      expect(snapToGrid(0)).toBe(0);
      expect(snapToGrid(40)).toBe(40);
      expect(snapToGrid(80)).toBe(80);
      expect(snapToGrid(120)).toBe(120);
    });

    it('rounds to nearest 30-minute boundary', () => {
      // Below midpoint (20px) rounds down
      expect(snapToGrid(10)).toBe(0);
      expect(snapToGrid(19)).toBe(0);

      // At or above midpoint rounds up
      expect(snapToGrid(20)).toBe(40);
      expect(snapToGrid(30)).toBe(40);
      expect(snapToGrid(39)).toBe(40);
    });

    it('handles positions between grid lines', () => {
      expect(snapToGrid(45)).toBe(40);
      expect(snapToGrid(55)).toBe(40);
      expect(snapToGrid(60)).toBe(80);
      expect(snapToGrid(65)).toBe(80);
    });

    it('handles large positions', () => {
      // 10 hours = 800px, 10.5 hours = 840px
      expect(snapToGrid(800)).toBe(800);
      expect(snapToGrid(820)).toBe(840);
      expect(snapToGrid(840)).toBe(840);
    });
  });

  describe('yPositionToTime', () => {
    it('converts Y position to time correctly', () => {
      const startHour = 6;
      const baseDate = new Date('2025-12-16T00:00:00');

      // Y=0 should be 6:00
      const time0 = yPositionToTime(0, startHour, baseDate);
      expect(time0.getHours()).toBe(6);
      expect(time0.getMinutes()).toBe(0);

      // Y=40 should be 6:30 (30 minutes = 40px)
      const time40 = yPositionToTime(40, startHour, baseDate);
      expect(time40.getHours()).toBe(6);
      expect(time40.getMinutes()).toBe(30);

      // Y=80 should be 7:00 (1 hour = 80px)
      const time80 = yPositionToTime(80, startHour, baseDate);
      expect(time80.getHours()).toBe(7);
      expect(time80.getMinutes()).toBe(0);
    });

    it('handles different start hours', () => {
      const baseDate = new Date('2025-12-16T00:00:00');

      // Start at 8:00
      const time = yPositionToTime(80, 8, baseDate);
      expect(time.getHours()).toBe(9);
      expect(time.getMinutes()).toBe(0);
    });

    it('handles fractional positions', () => {
      const baseDate = new Date('2025-12-16T00:00:00');
      const startHour = 6;

      // Y=20 should be 6:15 (15 minutes = 20px)
      const time = yPositionToTime(20, startHour, baseDate);
      expect(time.getHours()).toBe(6);
      expect(time.getMinutes()).toBe(15);
    });
  });

  describe('timeToYPosition', () => {
    it('converts time to Y position correctly', () => {
      const startHour = 6;

      // 6:00 -> Y=0
      const date1 = new Date('2025-12-16T06:00:00');
      expect(timeToYPosition(date1, startHour)).toBe(0);

      // 6:30 -> Y=40
      const date2 = new Date('2025-12-16T06:30:00');
      expect(timeToYPosition(date2, startHour)).toBe(40);

      // 7:00 -> Y=80
      const date3 = new Date('2025-12-16T07:00:00');
      expect(timeToYPosition(date3, startHour)).toBe(80);
    });

    it('handles times before start hour with negative values', () => {
      const startHour = 8;
      const date = new Date('2025-12-16T06:00:00');
      expect(timeToYPosition(date, startHour)).toBe(-160); // -2 hours * 80px
    });
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
        const time = yPositionToTime(y, startHour, baseDate);
        const resultY = timeToYPosition(time, startHour);
        expect(resultY).toBe(y);
      });
    });
  });
});
