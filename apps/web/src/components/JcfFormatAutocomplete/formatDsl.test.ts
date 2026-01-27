import { describe, it, expect } from 'vitest';
import {
  isValidFormat,
  normalizeFormat,
  buildDimensionLookup,
  toPrettyFormat,
} from './formatDsl';
import type { ProductFormat } from '@flux/types';

// ── Test data ──

const formats: ProductFormat[] = [
  { id: 'a3', name: 'A3', width: 297, height: 420 },
  { id: 'a4', name: 'A4', width: 210, height: 297 },
  { id: 'a5', name: 'A5', width: 148, height: 210 },
  { id: 'a6', name: 'A6', width: 105, height: 148 },
];

const lookup = buildDimensionLookup(formats);

// ── isValidFormat ──

describe('isValidFormat', () => {
  it.each([
    ['A4', true],
    ['A3', true],
    ['A10', true],
    ['a4', true],
    ['A4f', true],
    ['A4fi', true],
    ['a5f', true],
    ['a5fi', true],
    ['210x297', true],
    ['100x200', true],
    ['210x297f', true],
    ['210x297fi', true],
    ['A3/A6', true],
    ['210x297/A4', true],
    ['A4/105x148', true],
    ['', false],
    ['hello', false],
    ['A11', false],
    ['A-1', false],
    ['Ax4', false],
    ['210', false],
    ['A3/A6/A4', false],
  ])('isValidFormat("%s") → %s', (input, expected) => {
    expect(isValidFormat(input)).toBe(expected);
  });
});

// ── normalizeFormat ──

describe('normalizeFormat', () => {
  it.each([
    ['a4', 'A4'],
    ['A4', 'A4'],
    ['a4f', 'A4f'],
    ['A4F', 'A4f'],
    ['a4fi', 'A4fi'],
    ['A4FI', 'A4fi'],
    ['210X297', '210x297'],
    ['210x297F', '210x297f'],
    ['210x297FI', '210x297fi'],
    ['a3/a6', 'A3/A6'],
    ['a4f/a5fi', 'A4f/A5fi'],
    ['  a4  ', 'A4'],
  ])('normalizeFormat("%s") → "%s"', (input, expected) => {
    expect(normalizeFormat(input)).toBe(expected);
  });
});

// ── buildDimensionLookup ──

describe('buildDimensionLookup', () => {
  it('looks up dimensions by exact name', () => {
    expect(lookup.get('A4')).toEqual({ width: 210, height: 297 });
  });

  it('looks up dimensions case-insensitively', () => {
    expect(lookup.get('a4')).toEqual({ width: 210, height: 297 });
  });

  it('returns undefined for unknown format', () => {
    expect(lookup.get('A99')).toBeUndefined();
  });
});

// ── toPrettyFormat ──

describe('toPrettyFormat', () => {
  it('returns empty string for empty input', () => {
    expect(toPrettyFormat('', lookup)).toBe('');
  });

  it('formats plain ISO with dimensions', () => {
    expect(toPrettyFormat('A4', lookup)).toBe('A4 — 210×297mm');
  });

  it('formats fermé (f) with ouvert/fermé dimensions', () => {
    expect(toPrettyFormat('A4f', lookup)).toBe(
      'A4f — 420×297 ouv. / 210×297 fermé',
    );
  });

  it('formats fermé italienne (fi) with ouvert/fermé dimensions', () => {
    expect(toPrettyFormat('A4fi', lookup)).toBe(
      'A4fi — 210×594 ouv. / 210×297 fermé',
    );
  });

  it('formats composite with both dimensions', () => {
    expect(toPrettyFormat('A3/A6', lookup)).toBe(
      'A3/A6 — 297×420 / 105×148',
    );
  });

  it('formats custom dimensions', () => {
    expect(toPrettyFormat('210x297', lookup)).toBe('210×297mm');
  });

  it('returns unknown format as-is', () => {
    expect(toPrettyFormat('XYZ', lookup)).toBe('XYZ');
  });

  it('returns fermé format as-is when base not found', () => {
    expect(toPrettyFormat('B9f', lookup)).toBe('B9f');
  });

  it('returns composite as-is when parts not found', () => {
    expect(toPrettyFormat('B1/B2', lookup)).toBe('B1/B2');
  });
});
