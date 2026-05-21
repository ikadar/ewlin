import { describe, it, expect } from 'vitest';
import {
  parseInking,
  isValidInking,
  countColors,
  formatInking,
  InkingDslError,
} from './inkingDsl';

describe('parseInking — valid', () => {
  it('returns null for null', () => {
    expect(parseInking(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseInking('')).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(parseInking('   ')).toBeNull();
  });

  it('parses Q/Q (quadri R/V)', () => {
    expect(parseInking('Q/Q')).toEqual({ recto: ['Q'], verso: ['Q'] });
  });

  it('parses Q/ (quadri recto only)', () => {
    expect(parseInking('Q/')).toEqual({ recto: ['Q'], verso: [] });
  });

  it('parses /Q (quadri verso only)', () => {
    expect(parseInking('/Q')).toEqual({ recto: [], verso: ['Q'] });
  });

  it('parses N/N (noir R/V)', () => {
    expect(parseInking('N/N')).toEqual({ recto: ['N'], verso: ['N'] });
  });

  it('parses mixed named colors and shortcodes', () => {
    expect(parseInking('pantone 123, N/pantone 456')).toEqual({
      recto: ['pantone 123', 'N'],
      verso: ['pantone 456'],
    });
  });

  it('parses the user spec example verbatim', () => {
    expect(
      parseInking('pantone bidule, couleur truc/pantone machin, pantone truc, pantone zobi'),
    ).toEqual({
      recto: ['pantone bidule', 'couleur truc'],
      verso: ['pantone machin', 'pantone truc', 'pantone zobi'],
    });
  });

  it('trims whitespace around tokens', () => {
    expect(parseInking('  Q  ,   N  /  pantone 1  ')).toEqual({
      recto: ['Q', 'N'],
      verso: ['pantone 1'],
    });
  });
});

describe('parseInking — invalid', () => {
  it.each([
    ['no slash', 'Q'],
    ['two slashes', 'Q/N/V'],
    ['three slashes', 'Q//N/'],
    ['empty token leading comma', ',Q/N'],
    ['empty token trailing comma', 'Q,/N'],
    ['consecutive commas', 'Q,,N/'],
    ['comma only between slashes', ',/,'],
  ])('throws on %s (%s)', (_label, input) => {
    expect(() => parseInking(input)).toThrow(InkingDslError);
  });
});

describe('isValidInking', () => {
  it('returns true for grammar-valid inputs', () => {
    expect(isValidInking(null)).toBe(true);
    expect(isValidInking('')).toBe(true);
    expect(isValidInking('Q/Q')).toBe(true);
    expect(isValidInking('pantone 123, N/')).toBe(true);
  });

  it('returns false for malformed inputs', () => {
    expect(isValidInking('no-slash')).toBe(false);
    expect(isValidInking('Q/N/extra')).toBe(false);
    expect(isValidInking(',Q/')).toBe(false);
  });
});

describe('countColors', () => {
  it('returns 0 for empty side', () => {
    expect(countColors([])).toBe(0);
  });

  it('counts Q as 4 (quadri = CMJN)', () => {
    expect(countColors(['Q'])).toBe(4);
  });

  it('counts N as 1', () => {
    expect(countColors(['N'])).toBe(1);
  });

  it('counts named color as 1', () => {
    expect(countColors(['pantone 123'])).toBe(1);
  });

  it('matches user spec — 2 colors recto, 3 colors verso', () => {
    const parsed = parseInking(
      'pantone bidule, couleur truc/pantone machin, pantone truc, pantone zobi',
    )!;
    expect(countColors(parsed.recto)).toBe(2);
    expect(countColors(parsed.verso)).toBe(3);
  });

  it('sums Q + named = 5', () => {
    const parsed = parseInking('Q, pantone 485/')!;
    expect(countColors(parsed.recto)).toBe(5);
    expect(countColors(parsed.verso)).toBe(0);
  });
});

describe('formatInking — round trip', () => {
  it('preserves the user example verbatim', () => {
    const original = 'pantone bidule, couleur truc/pantone machin, pantone truc, pantone zobi';
    expect(formatInking(parseInking(original)!)).toBe(original);
  });

  it('renders empty sides as just /', () => {
    expect(formatInking({ recto: [], verso: [] })).toBe('/');
  });
});
