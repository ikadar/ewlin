import { describe, it, expect } from 'vitest';
import { parseFrenchDate, formatToFrench } from './frenchDate';

describe('parseFrenchDate', () => {
  describe('jj/mm format (short — uses current year, default 14:00)', () => {
    it('parses valid date with default time', () => {
      const result = parseFrenchDate('15/06');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-06-15T14:00`);
    });

    it('parses single-digit day and month', () => {
      const result = parseFrenchDate('3/1');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-01-03T14:00`);
    });

    it('parses 01/01', () => {
      const result = parseFrenchDate('01/01');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-01-01T14:00`);
    });

    it('parses 31/12', () => {
      const result = parseFrenchDate('31/12');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-12-31T14:00`);
    });
  });

  describe('jj/mm HH:mm format (short with time)', () => {
    it('parses date with custom time', () => {
      const result = parseFrenchDate('15/06 09:30');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-06-15T09:30`);
    });

    it('parses midnight', () => {
      const result = parseFrenchDate('01/01 00:00');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-01-01T00:00`);
    });

    it('parses end of day', () => {
      const result = parseFrenchDate('31/12 23:59');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-12-31T23:59`);
    });
  });

  describe('jj/mm/aaaa format (full, default 14:00)', () => {
    it('parses valid full date', () => {
      expect(parseFrenchDate('25/12/2026')).toBe('2026-12-25T14:00');
    });

    it('parses first day of year', () => {
      expect(parseFrenchDate('01/01/2025')).toBe('2025-01-01T14:00');
    });

    it('parses leap year date', () => {
      expect(parseFrenchDate('29/02/2024')).toBe('2024-02-29T14:00');
    });
  });

  describe('jj/mm/aaaa HH:mm format (full with time)', () => {
    it('parses full date with custom time', () => {
      expect(parseFrenchDate('25/12/2026 09:30')).toBe('2026-12-25T09:30');
    });

    it('parses full date with midnight', () => {
      expect(parseFrenchDate('01/01/2025 00:00')).toBe('2025-01-01T00:00');
    });
  });

  describe('invalid inputs', () => {
    it('returns empty for empty string', () => {
      expect(parseFrenchDate('')).toBe('');
    });

    it('returns empty for whitespace', () => {
      expect(parseFrenchDate('   ')).toBe('');
    });

    it('returns empty for invalid month (13)', () => {
      expect(parseFrenchDate('15/13')).toBe('');
    });

    it('returns empty for invalid month (0)', () => {
      expect(parseFrenchDate('15/0')).toBe('');
    });

    it('returns empty for invalid day (0)', () => {
      expect(parseFrenchDate('0/06')).toBe('');
    });

    it('returns empty for invalid day (32)', () => {
      expect(parseFrenchDate('32/06')).toBe('');
    });

    it('returns empty for 31/02 (impossible date)', () => {
      expect(parseFrenchDate('31/02/2026')).toBe('');
    });

    it('returns empty for 29/02 on non-leap year', () => {
      expect(parseFrenchDate('29/02/2025')).toBe('');
    });

    it('returns empty for random text', () => {
      expect(parseFrenchDate('hello')).toBe('');
    });

    it('returns empty for ISO format input', () => {
      expect(parseFrenchDate('2026-01-15')).toBe('');
    });

    it('returns empty for partial input', () => {
      expect(parseFrenchDate('15/')).toBe('');
    });

    it('returns empty for invalid time (25:00)', () => {
      expect(parseFrenchDate('15/06 25:00')).toBe('');
    });

    it('returns empty for invalid time (12:60)', () => {
      expect(parseFrenchDate('15/06 12:60')).toBe('');
    });
  });
});

describe('formatToFrench', () => {
  describe('datetime format (YYYY-MM-DDTHH:mm)', () => {
    it('formats datetime to jj/mm HH:mm', () => {
      expect(formatToFrench('2026-06-15T09:30')).toBe('15/06 09:30');
    });

    it('formats midnight', () => {
      expect(formatToFrench('2025-01-01T00:00')).toBe('01/01 00:00');
    });

    it('formats default departure time', () => {
      expect(formatToFrench('2026-12-31T14:00')).toBe('31/12 14:00');
    });
  });

  describe('date-only format (YYYY-MM-DD) — backward compat', () => {
    it('formats date-only with default 14:00', () => {
      expect(formatToFrench('2026-06-15')).toBe('15/06 14:00');
    });

    it('formats first day of year', () => {
      expect(formatToFrench('2025-01-01')).toBe('01/01 14:00');
    });

    it('formats last day of year', () => {
      expect(formatToFrench('2026-12-31')).toBe('31/12 14:00');
    });
  });

  it('returns empty for empty string', () => {
    expect(formatToFrench('')).toBe('');
  });

  it('returns input unchanged for non-ISO string', () => {
    expect(formatToFrench('not-a-date')).toBe('not-a-date');
  });

  it('pads single-digit day and month', () => {
    expect(formatToFrench('2026-03-05T14:00')).toBe('05/03 14:00');
  });
});
