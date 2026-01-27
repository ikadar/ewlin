import { describe, it, expect } from 'vitest';
import { isValidPagination } from './paginationValidation';

describe('isValidPagination', () => {
  it('returns true for empty string', () => {
    expect(isValidPagination('')).toBe(true);
  });

  it('returns true for "2" (feuillet)', () => {
    expect(isValidPagination('2')).toBe(true);
  });

  it.each(['4', '8', '12', '16', '20', '24', '100'])(
    'returns true for "%s" (multiple of 4)',
    (value) => {
      expect(isValidPagination(value)).toBe(true);
    },
  );

  it.each(['1', '3', '5', '6', '7', '9', '10', '11', '13', '14', '15'])(
    'returns false for "%s" (invalid)',
    (value) => {
      expect(isValidPagination(value)).toBe(false);
    },
  );

  it('returns false for "0"', () => {
    expect(isValidPagination('0')).toBe(false);
  });

  it('returns false for non-numeric string', () => {
    expect(isValidPagination('abc')).toBe(false);
  });

  it('returns false for negative value', () => {
    expect(isValidPagination('-4')).toBe(false);
  });
});
