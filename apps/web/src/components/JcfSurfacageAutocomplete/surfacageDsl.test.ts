import { describe, it, expect } from 'vitest';
import {
  toPrettySurfacage,
  toDslSurfacage,
  isValidSurfacage,
} from './surfacageDsl';

// ── toPrettySurfacage ──

describe('toPrettySurfacage', () => {
  it('returns empty string for empty input', () => {
    expect(toPrettySurfacage('')).toBe('');
  });

  it('converts mat/mat to pelli mat recto/verso', () => {
    expect(toPrettySurfacage('mat/mat')).toBe('pelli mat recto/verso');
  });

  it('converts satin/satin to pelli satin recto/verso', () => {
    expect(toPrettySurfacage('satin/satin')).toBe('pelli satin recto/verso');
  });

  it('converts brillant/brillant to pelli brillant recto/verso', () => {
    expect(toPrettySurfacage('brillant/brillant')).toBe(
      'pelli brillant recto/verso',
    );
  });

  it('converts UV/UV to vernis UV recto/verso', () => {
    expect(toPrettySurfacage('UV/UV')).toBe('vernis UV recto/verso');
  });

  it('converts dorure/dorure to dorure recto/verso', () => {
    expect(toPrettySurfacage('dorure/dorure')).toBe('dorure recto/verso');
  });

  it('converts mat/ to pelli mat recto', () => {
    expect(toPrettySurfacage('mat/')).toBe('pelli mat recto');
  });

  it('converts satin/ to pelli satin recto', () => {
    expect(toPrettySurfacage('satin/')).toBe('pelli satin recto');
  });

  it('converts brillant/ to pelli brillant recto', () => {
    expect(toPrettySurfacage('brillant/')).toBe('pelli brillant recto');
  });

  it('converts UV/ to vernis UV recto', () => {
    expect(toPrettySurfacage('UV/')).toBe('vernis UV recto');
  });

  it('converts dorure/ to dorure recto', () => {
    expect(toPrettySurfacage('dorure/')).toBe('dorure recto');
  });

  it('is case-insensitive', () => {
    expect(toPrettySurfacage('MAT/MAT')).toBe('pelli mat recto/verso');
    expect(toPrettySurfacage('Uv/Uv')).toBe('vernis UV recto/verso');
  });

  it('returns unknown values as-is', () => {
    expect(toPrettySurfacage('gaufrage/')).toBe('gaufrage/');
    expect(toPrettySurfacage('custom')).toBe('custom');
  });

  it('skips conversion for comma-separated values', () => {
    expect(toPrettySurfacage('mat/mat,brillant/')).toBe('mat/mat,brillant/');
  });
});

// ── toDslSurfacage ──

describe('toDslSurfacage', () => {
  it('returns empty string for empty input', () => {
    expect(toDslSurfacage('')).toBe('');
  });

  it('converts pelli mat recto/verso to mat/mat', () => {
    expect(toDslSurfacage('pelli mat recto/verso')).toBe('mat/mat');
  });

  it('converts pelli satin recto/verso to satin/satin', () => {
    expect(toDslSurfacage('pelli satin recto/verso')).toBe('satin/satin');
  });

  it('converts pelli brillant recto/verso to brillant/brillant', () => {
    expect(toDslSurfacage('pelli brillant recto/verso')).toBe(
      'brillant/brillant',
    );
  });

  it('converts vernis UV recto/verso to UV/UV', () => {
    expect(toDslSurfacage('vernis UV recto/verso')).toBe('UV/UV');
  });

  it('converts dorure recto/verso to dorure/dorure', () => {
    expect(toDslSurfacage('dorure recto/verso')).toBe('dorure/dorure');
  });

  it('converts pelli mat recto to mat/', () => {
    expect(toDslSurfacage('pelli mat recto')).toBe('mat/');
  });

  it('converts vernis UV recto to UV/', () => {
    expect(toDslSurfacage('vernis UV recto')).toBe('UV/');
  });

  it('converts dorure recto to dorure/', () => {
    expect(toDslSurfacage('dorure recto')).toBe('dorure/');
  });

  it('is case-insensitive', () => {
    expect(toDslSurfacage('Pelli Mat Recto/Verso')).toBe('mat/mat');
    expect(toDslSurfacage('VERNIS UV RECTO')).toBe('UV/');
  });

  it('returns unknown values as-is', () => {
    expect(toDslSurfacage('gaufrage/')).toBe('gaufrage/');
    expect(toDslSurfacage('custom value')).toBe('custom value');
  });

  it('skips conversion for comma-separated values', () => {
    expect(toDslSurfacage('pelli mat recto/verso,dorure recto')).toBe(
      'pelli mat recto/verso,dorure recto',
    );
  });
});

// ── isValidSurfacage ──

describe('isValidSurfacage', () => {
  it.each([
    ['mat/mat', true],
    ['mat/', true],
    ['UV/UV', true],
    ['brillant/brillant', true],
    ['gaufrage/', true],
    ['/', true],
    ['mat', false],
    ['hello', false],
    ['', false],
  ])('isValidSurfacage("%s") → %s', (input, expected) => {
    expect(isValidSurfacage(input)).toBe(expected);
  });
});
