import { describe, it, expect } from 'vitest';
import { parseFrenchDate, formatToFrench } from './frenchDate';

describe('parseFrenchDate', () => {
  describe('jj/mm format (short — uses current year)', () => {
    it('parses valid date', () => {
      const result = parseFrenchDate('15/06');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-06-15`);
    });

    it('parses single-digit day and month', () => {
      const result = parseFrenchDate('3/1');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-01-03`);
    });

    it('parses 01/01', () => {
      const result = parseFrenchDate('01/01');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-01-01`);
    });

    it('parses 31/12', () => {
      const result = parseFrenchDate('31/12');
      const year = new Date().getFullYear();
      expect(result).toBe(`${year}-12-31`);
    });
  });

  describe('jj/mm/aaaa format (full)', () => {
    it('parses valid full date', () => {
      expect(parseFrenchDate('25/12/2026')).toBe('2026-12-25');
    });

    it('parses first day of year', () => {
      expect(parseFrenchDate('01/01/2025')).toBe('2025-01-01');
    });

    it('parses leap year date', () => {
      expect(parseFrenchDate('29/02/2024')).toBe('2024-02-29');
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
  });
});

describe('formatToFrench', () => {
  it('formats valid ISO date', () => {
    expect(formatToFrench('2026-06-15')).toBe('15/06/2026');
  });

  it('formats first day of year', () => {
    expect(formatToFrench('2025-01-01')).toBe('01/01/2025');
  });

  it('formats last day of year', () => {
    expect(formatToFrench('2026-12-31')).toBe('31/12/2026');
  });

  it('returns empty for empty string', () => {
    expect(formatToFrench('')).toBe('');
  });

  it('returns input unchanged for non-ISO string', () => {
    expect(formatToFrench('not-a-date')).toBe('not-a-date');
  });

  it('pads single-digit day and month', () => {
    expect(formatToFrench('2026-03-05')).toBe('05/03/2026');
  });
});
