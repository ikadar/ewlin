import { describe, it, expect } from 'vitest';
import {
  toPrettyImpression,
  toDslImpression,
  isValidImpression,
} from './impressionDsl';

// ── toPrettyImpression ──

describe('toPrettyImpression', () => {
  it('returns empty string for empty input', () => {
    expect(toPrettyImpression('')).toBe('');
  });

  it('converts Q/Q to quadri recto/verso', () => {
    expect(toPrettyImpression('Q/Q')).toBe('quadri recto/verso');
  });

  it('converts N/N to noir recto/verso', () => {
    expect(toPrettyImpression('N/N')).toBe('noir recto/verso');
  });

  it('converts Q/ to quadri recto', () => {
    expect(toPrettyImpression('Q/')).toBe('quadri recto');
  });

  it('converts N/ to noir recto', () => {
    expect(toPrettyImpression('N/')).toBe('noir recto');
  });

  it('is case-insensitive', () => {
    expect(toPrettyImpression('q/q')).toBe('quadri recto/verso');
    expect(toPrettyImpression('n/n')).toBe('noir recto/verso');
  });

  it('returns unknown values as-is', () => {
    expect(toPrettyImpression('Q+V/Q+V')).toBe('Q+V/Q+V');
    expect(toPrettyImpression('Q/N')).toBe('Q/N');
    expect(toPrettyImpression('custom')).toBe('custom');
  });

  it('skips conversion for comma-separated values', () => {
    expect(toPrettyImpression('Q/Q,N/N')).toBe('Q/Q,N/N');
  });
});

// ── toDslImpression ──

describe('toDslImpression', () => {
  it('returns empty string for empty input', () => {
    expect(toDslImpression('')).toBe('');
  });

  it('converts quadri recto/verso to Q/Q', () => {
    expect(toDslImpression('quadri recto/verso')).toBe('Q/Q');
  });

  it('converts noir recto/verso to N/N', () => {
    expect(toDslImpression('noir recto/verso')).toBe('N/N');
  });

  it('converts quadri recto to Q/', () => {
    expect(toDslImpression('quadri recto')).toBe('Q/');
  });

  it('converts noir recto to N/', () => {
    expect(toDslImpression('noir recto')).toBe('N/');
  });

  it('is case-insensitive', () => {
    expect(toDslImpression('Quadri Recto/Verso')).toBe('Q/Q');
  });

  it('returns unknown values as-is', () => {
    expect(toDslImpression('Q+V/Q+V')).toBe('Q+V/Q+V');
    expect(toDslImpression('custom value')).toBe('custom value');
  });

  it('skips conversion for comma-separated values', () => {
    expect(toDslImpression('quadri recto/verso,noir recto')).toBe(
      'quadri recto/verso,noir recto',
    );
  });
});

// ── isValidImpression ──

describe('isValidImpression', () => {
  it.each([
    ['Q/Q', true],
    ['Q/', true],
    ['N/N', true],
    ['Q+V/Q+V', true],
    ['CMJN/CMJN', true],
    ['custom/', true],
    ['/', true],
    ['Q', false],
    ['hello', false],
    ['', false],
  ])('isValidImpression("%s") → %s', (input, expected) => {
    expect(isValidImpression(input)).toBe(expected);
  });
});
