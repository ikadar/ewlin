import { describe, it, expect } from 'vitest';
import {
  isBusinessDay,
  addBusinessDays,
  subtractBusinessDays,
  getNextBusinessDay,
  getPreviousBusinessDay,
} from './businessDays';

// Helper to get local date string (YYYY-MM-DD) without timezone issues
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('businessDays', () => {
  describe('isBusinessDay', () => {
    it('returns true for Monday', () => {
      // Monday, Feb 3, 2025
      expect(isBusinessDay(new Date(2025, 1, 3))).toBe(true);
    });

    it('returns true for Friday', () => {
      // Friday, Feb 7, 2025
      expect(isBusinessDay(new Date(2025, 1, 7))).toBe(true);
    });

    it('returns false for Saturday', () => {
      // Saturday, Feb 8, 2025
      expect(isBusinessDay(new Date(2025, 1, 8))).toBe(false);
    });

    it('returns false for Sunday', () => {
      // Sunday, Feb 9, 2025
      expect(isBusinessDay(new Date(2025, 1, 9))).toBe(false);
    });
  });

  describe('addBusinessDays', () => {
    it('adds 0 days returns same date', () => {
      const date = new Date(2025, 1, 3); // Monday
      const result = addBusinessDays(date, 0);
      expect(getLocalDateString(result)).toBe('2025-02-03');
    });

    it('adds 1 business day within same week', () => {
      const date = new Date(2025, 1, 3); // Monday
      const result = addBusinessDays(date, 1);
      expect(getLocalDateString(result)).toBe('2025-02-04'); // Tuesday
    });

    it('skips weekend when adding days', () => {
      const date = new Date(2025, 1, 7); // Friday
      const result = addBusinessDays(date, 1);
      expect(getLocalDateString(result)).toBe('2025-02-10'); // Monday
    });

    it('adds multiple days across weekend', () => {
      const date = new Date(2025, 1, 6); // Thursday
      const result = addBusinessDays(date, 3);
      expect(getLocalDateString(result)).toBe('2025-02-11'); // Tuesday (Fri, skip Sat/Sun, Mon, Tue)
    });

    it('throws for negative days', () => {
      expect(() => addBusinessDays(new Date(), -1)).toThrow('days must be non-negative');
    });
  });

  describe('subtractBusinessDays', () => {
    it('subtracts 0 days returns same date', () => {
      const date = new Date(2025, 1, 5); // Wednesday
      const result = subtractBusinessDays(date, 0);
      expect(getLocalDateString(result)).toBe('2025-02-05');
    });

    it('subtracts 1 business day within same week', () => {
      const date = new Date(2025, 1, 5); // Wednesday
      const result = subtractBusinessDays(date, 1);
      expect(getLocalDateString(result)).toBe('2025-02-04'); // Tuesday
    });

    it('skips weekend when subtracting days', () => {
      const date = new Date(2025, 1, 10); // Monday
      const result = subtractBusinessDays(date, 1);
      expect(getLocalDateString(result)).toBe('2025-02-07'); // Friday
    });

    it('subtracts multiple days across weekend', () => {
      const date = new Date(2025, 1, 11); // Tuesday
      const result = subtractBusinessDays(date, 3);
      expect(getLocalDateString(result)).toBe('2025-02-06'); // Thursday (Mon, skip Sun/Sat, Fri, Thu)
    });

    it('throws for negative days', () => {
      expect(() => subtractBusinessDays(new Date(), -1)).toThrow('days must be non-negative');
    });
  });

  describe('getNextBusinessDay', () => {
    it('returns same date if already a business day', () => {
      const date = new Date(2025, 1, 5); // Wednesday
      const result = getNextBusinessDay(date);
      expect(getLocalDateString(result)).toBe('2025-02-05');
    });

    it('returns Monday if date is Saturday', () => {
      const date = new Date(2025, 1, 8); // Saturday
      const result = getNextBusinessDay(date);
      expect(getLocalDateString(result)).toBe('2025-02-10'); // Monday
    });

    it('returns Monday if date is Sunday', () => {
      const date = new Date(2025, 1, 9); // Sunday
      const result = getNextBusinessDay(date);
      expect(getLocalDateString(result)).toBe('2025-02-10'); // Monday
    });
  });

  describe('getPreviousBusinessDay', () => {
    it('returns same date if already a business day', () => {
      const date = new Date(2025, 1, 5); // Wednesday
      const result = getPreviousBusinessDay(date);
      expect(getLocalDateString(result)).toBe('2025-02-05');
    });

    it('returns Friday if date is Saturday', () => {
      const date = new Date(2025, 1, 8); // Saturday
      const result = getPreviousBusinessDay(date);
      expect(getLocalDateString(result)).toBe('2025-02-07'); // Friday
    });

    it('returns Friday if date is Sunday', () => {
      const date = new Date(2025, 1, 9); // Sunday
      const result = getPreviousBusinessDay(date);
      expect(getLocalDateString(result)).toBe('2025-02-07'); // Friday
    });
  });
});
