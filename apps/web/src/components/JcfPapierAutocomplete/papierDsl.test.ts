import { describe, it, expect } from 'vitest';
import {
  toPrettyPapier,
  toDslPapier,
  isValidPapier,
  parsePapierInput,
} from './papierDsl';

describe('toPrettyPapier', () => {
  it('converts DSL to pretty format', () => {
    expect(toPrettyPapier('Couché mat:135')).toBe('Couché mat 135g');
  });

  it('converts single-word type', () => {
    expect(toPrettyPapier('Offset:80')).toBe('Offset 80g');
  });

  it('handles grammage already with g suffix', () => {
    expect(toPrettyPapier('Laser:90g')).toBe('Laser 90g');
  });

  it('returns empty string for empty input', () => {
    expect(toPrettyPapier('')).toBe('');
  });

  it('returns as-is when no colon present', () => {
    expect(toPrettyPapier('no-colon')).toBe('no-colon');
  });

  it('returns as-is when grammage is empty (incomplete DSL)', () => {
    expect(toPrettyPapier('Couché mat:')).toBe('Couché mat:');
  });

  it('returns as-is when grammage is non-numeric', () => {
    expect(toPrettyPapier('Couché mat:abc')).toBe('Couché mat:abc');
  });
});

describe('toDslPapier', () => {
  it('converts pretty to DSL format', () => {
    expect(toDslPapier('Couché mat 135g')).toBe('Couché mat:135');
  });

  it('converts single-word type', () => {
    expect(toDslPapier('Offset 80g')).toBe('Offset:80');
  });

  it('handles grammage without g suffix in pretty', () => {
    expect(toDslPapier('Laser 90')).toBe('Laser:90');
  });

  it('returns empty string for empty input', () => {
    expect(toDslPapier('')).toBe('');
  });

  it('returns as-is when already in DSL format', () => {
    expect(toDslPapier('Couché mat:135')).toBe('Couché mat:135');
  });

  it('returns as-is when no match found', () => {
    expect(toDslPapier('invalid')).toBe('invalid');
  });
});

describe('isValidPapier', () => {
  it('returns true for valid DSL', () => {
    expect(isValidPapier('Couché mat:135')).toBe(true);
  });

  it('returns true for single-word type', () => {
    expect(isValidPapier('Offset:80')).toBe(true);
  });

  it('returns false when no colon present', () => {
    expect(isValidPapier('no-colon')).toBe(false);
  });

  it('returns false when grammage is empty', () => {
    expect(isValidPapier('Couché mat:')).toBe(false);
  });

  it('returns false when type is empty', () => {
    expect(isValidPapier(':135')).toBe(false);
  });

  it('returns false when grammage is non-numeric', () => {
    expect(isValidPapier('Couché mat:abc')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidPapier('')).toBe(false);
  });
});

describe('parsePapierInput', () => {
  it('parses type-only input (no colon)', () => {
    expect(parsePapierInput('Cou')).toEqual({
      type: 'Cou',
      grammage: '',
      isTypingGrammage: false,
    });
  });

  it('parses type with colon (ready for grammage)', () => {
    expect(parsePapierInput('Couché mat:')).toEqual({
      type: 'Couché mat',
      grammage: '',
      isTypingGrammage: true,
    });
  });

  it('parses type and partial grammage', () => {
    expect(parsePapierInput('Couché mat:13')).toEqual({
      type: 'Couché mat',
      grammage: '13',
      isTypingGrammage: true,
    });
  });

  it('parses complete DSL', () => {
    expect(parsePapierInput('Offset:80')).toEqual({
      type: 'Offset',
      grammage: '80',
      isTypingGrammage: true,
    });
  });

  it('handles empty input', () => {
    expect(parsePapierInput('')).toEqual({
      type: '',
      grammage: '',
      isTypingGrammage: false,
    });
  });

  it('handles whitespace', () => {
    expect(parsePapierInput('  Offset:80  ')).toEqual({
      type: 'Offset',
      grammage: '80',
      isTypingGrammage: true,
    });
  });
});
