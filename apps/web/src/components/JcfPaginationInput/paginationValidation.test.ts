import { describe, it, expect } from 'vitest';
import { isValidPagination } from './paginationValidation';

describe('isValidPagination', () => {
  it('returns true for empty string', () => {
    expect(isValidPagination('')).toBe(true);
  });

  it.each(['1', '2', '4', '6', '8', '12', '16', '48', '100'])(
    'returns true for "%s" (1 or even ≥ 2)',
    (value) => {
      expect(isValidPagination(value)).toBe(true);
    },
  );

  it.each(['3', '5', '7', '17'])('returns false for odd > 1 "%s"', (value) => {
    expect(isValidPagination(value)).toBe(false);
  });

  it('returns false for "0"', () => {
    expect(isValidPagination('0')).toBe(false);
  });

  it('returns false for non-numeric string', () => {
    expect(isValidPagination('abc')).toBe(false);
  });

  it('returns false for negative value', () => {
    expect(isValidPagination('-4')).toBe(false);
  });

  it('returns false for decimal value', () => {
    expect(isValidPagination('4.5')).toBe(false);
  });
});
