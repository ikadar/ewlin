import { describe, it, expect } from 'vitest';
import {
  parseTime,
  setTimeOnDate,
  calculateDepartureDate,
  calculateReturnDate,
  calculateOutsourcingDates,
  formatOutsourcingDateTime,
  parseOutsourcingDateTime,
} from './outsourcingCalculation';

describe('outsourcingCalculation', () => {
  describe('parseTime', () => {
    it('parses valid time string', () => {
      expect(parseTime('14:30')).toEqual({ hours: 14, minutes: 30 });
    });

    it('parses time with leading zeros', () => {
      expect(parseTime('09:05')).toEqual({ hours: 9, minutes: 5 });
    });

    it('handles empty string', () => {
      expect(parseTime('')).toEqual({ hours: 0, minutes: 0 });
    });
  });

  describe('setTimeOnDate', () => {
    it('sets time on date', () => {
      const date = new Date(2025, 1, 5, 8, 0); // Feb 5, 2025 08:00
      const result = setTimeOnDate(date, '14:30');
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getDate()).toBe(5);
    });
  });

  describe('calculateDepartureDate', () => {
    it('returns same day if predecessor ends before latest departure time', () => {
      // Wednesday Feb 5, 2025 at 11:00 (before 14:00)
      const predecessorEnd = new Date(2025, 1, 5, 11, 0);
      const result = calculateDepartureDate(predecessorEnd, '14:00');

      expect(result.getDate()).toBe(5);
      expect(result.getMonth()).toBe(1);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(0);
    });

    it('returns same day if predecessor ends exactly at latest departure time', () => {
      // Wednesday Feb 5, 2025 at 14:00 (equal to 14:00)
      const predecessorEnd = new Date(2025, 1, 5, 14, 0);
      const result = calculateDepartureDate(predecessorEnd, '14:00');

      expect(result.getDate()).toBe(5);
    });

    it('returns next business day if predecessor ends after latest departure time', () => {
      // Wednesday Feb 5, 2025 at 16:00 (after 14:00)
      const predecessorEnd = new Date(2025, 1, 5, 16, 0);
      const result = calculateDepartureDate(predecessorEnd, '14:00');

      // Next day is Thursday Feb 6
      expect(result.getDate()).toBe(6);
      expect(result.getMonth()).toBe(1);
      expect(result.getHours()).toBe(14);
    });

    it('skips weekend for next business day', () => {
      // Friday Feb 7, 2025 at 16:00 (after 14:00)
      const predecessorEnd = new Date(2025, 1, 7, 16, 0);
      const result = calculateDepartureDate(predecessorEnd, '14:00');

      // Next business day is Monday Feb 10
      expect(result.getDate()).toBe(10);
      expect(result.getMonth()).toBe(1);
    });

    it('accepts ISO string for predecessor end time', () => {
      const predecessorEnd = '2025-02-05T11:00:00.000Z';
      const result = calculateDepartureDate(predecessorEnd, '14:00');

      // Should parse correctly (note: time zone handling)
      expect(result instanceof Date).toBe(true);
    });
  });

  describe('calculateReturnDate', () => {
    it('calculates return date with transit and work days', () => {
      // Departure: Wednesday Feb 5, 2025
      const departure = new Date(2025, 1, 5, 14, 0);
      const result = calculateReturnDate(departure, {
        workDays: 2,
        transitDays: 1,
        receptionTime: '09:00',
      });

      // Timeline: Wed (dep) -> Thu (transit out) -> Fri (work 1) -> Mon (work 2) -> Tue (transit back)
      // Total: 1 + 2 + 1 = 4 business days from departure
      // Result should be Tuesday Feb 11, 2025 at 09:00
      expect(result.getDate()).toBe(11);
      expect(result.getMonth()).toBe(1);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
    });

    it('handles zero transit days', () => {
      const departure = new Date(2025, 1, 5, 14, 0);
      const result = calculateReturnDate(departure, {
        workDays: 3,
        transitDays: 0,
        receptionTime: '10:00',
      });

      // Total: 0 + 3 + 0 = 3 business days
      // Wed -> Thu -> Fri -> Mon = Monday Feb 10
      expect(result.getDate()).toBe(10);
    });
  });

  describe('calculateOutsourcingDates', () => {
    it('returns null if predecessor end time is undefined', () => {
      const result = calculateOutsourcingDates(undefined, {
        workDays: 2,
        latestDepartureTime: '14:00',
        receptionTime: '09:00',
        transitDays: 1,
      });

      expect(result).toBeNull();
    });

    it('calculates both departure and return dates', () => {
      const predecessorEnd = new Date(2025, 1, 5, 11, 0); // Wed 11:00

      const result = calculateOutsourcingDates(predecessorEnd, {
        workDays: 2,
        latestDepartureTime: '14:00',
        receptionTime: '09:00',
        transitDays: 1,
      });

      expect(result).not.toBeNull();
      expect(result!.departure.getDate()).toBe(5); // Same day
      expect(result!.return.getDate()).toBe(11); // Tuesday
    });
  });

  describe('formatOutsourcingDateTime', () => {
    it('formats date correctly', () => {
      const date = new Date(2025, 1, 5, 14, 30); // Feb 5, 2025 14:30
      expect(formatOutsourcingDateTime(date)).toBe('05/02 14:30');
    });

    it('handles ISO string', () => {
      const result = formatOutsourcingDateTime('2025-02-05T14:30:00.000Z');
      // Note: actual output depends on timezone
      expect(result).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    });

    it('returns empty string for undefined', () => {
      expect(formatOutsourcingDateTime(undefined)).toBe('');
    });

    it('returns empty string for invalid date', () => {
      expect(formatOutsourcingDateTime('invalid')).toBe('');
    });
  });

  describe('parseOutsourcingDateTime', () => {
    it('parses short format DD/MM HH:MM', () => {
      const result = parseOutsourcingDateTime('05/02 14:30', 2025);
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(5);
      expect(result!.getMonth()).toBe(1); // February (0-indexed)
      expect(result!.getFullYear()).toBe(2025);
      expect(result!.getHours()).toBe(14);
      expect(result!.getMinutes()).toBe(30);
    });

    it('parses long format DD/MM/YYYY HH:MM', () => {
      const result = parseOutsourcingDateTime('05/02/2025 14:30');
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(5);
      expect(result!.getMonth()).toBe(1);
      expect(result!.getFullYear()).toBe(2025);
    });

    it('returns null for empty string', () => {
      expect(parseOutsourcingDateTime('')).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(parseOutsourcingDateTime('invalid')).toBeNull();
    });

    it('uses current year if not provided', () => {
      const result = parseOutsourcingDateTime('05/02 14:30');
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(new Date().getFullYear());
    });
  });
});
