import { describe, it, expect } from 'vitest';
import { fmtTimeMin, parseTimeStr, snapTo15, clampMin } from './timeUtils';

describe('fmtTimeMin', () => {
  it('formats whole hours', () => {
    expect(fmtTimeMin(720)).toBe('12h00');
    expect(fmtTimeMin(0)).toBe('0h00');
    expect(fmtTimeMin(60)).toBe('1h00');
  });

  it('formats half hours', () => {
    expect(fmtTimeMin(570)).toBe('9h30');
    expect(fmtTimeMin(645)).toBe('10h45');
  });

  it('pads single-digit minutes', () => {
    expect(fmtTimeMin(5)).toBe('0h05');
    expect(fmtTimeMin(305)).toBe('5h05');
  });

  it('rounds fractional input', () => {
    expect(fmtTimeMin(720.4)).toBe('12h00');
    expect(fmtTimeMin(720.6)).toBe('12h01');
  });

  it('clamps negative input to 0h00', () => {
    expect(fmtTimeMin(-5)).toBe('0h00');
  });
});

describe('parseTimeStr', () => {
  it('parses "HhMM" format', () => {
    expect(parseTimeStr('12h00')).toBe(720);
    expect(parseTimeStr('9h30')).toBe(570);
    expect(parseTimeStr('10h45')).toBe(645);
  });

  it('parses "HH:MM" format', () => {
    expect(parseTimeStr('12:00')).toBe(720);
    expect(parseTimeStr('09:30')).toBe(570);
  });

  it('parses relaxed inputs ("Hh", "H:M")', () => {
    expect(parseTimeStr('12h')).toBe(720);
    expect(parseTimeStr('12:')).toBe(720);
    expect(parseTimeStr('1h5')).toBe(65);
  });

  it('trims whitespace', () => {
    expect(parseTimeStr('  12h00  ')).toBe(720);
  });

  it('returns null for invalid formats', () => {
    expect(parseTimeStr('abc')).toBeNull();
    expect(parseTimeStr('')).toBeNull();
    expect(parseTimeStr('12 30')).toBeNull();
    expect(parseTimeStr('12.30')).toBeNull();
  });

  it('returns null for out-of-range values', () => {
    expect(parseTimeStr('24h00')).toBeNull();
    expect(parseTimeStr('12h60')).toBeNull();
    expect(parseTimeStr('25h00')).toBeNull();
  });
});

describe('snapTo15', () => {
  it('keeps already-snapped values', () => {
    expect(snapTo15(720)).toBe(720);
    expect(snapTo15(0)).toBe(0);
  });

  it('rounds to the nearest 15', () => {
    expect(snapTo15(722)).toBe(720);
    expect(snapTo15(728)).toBe(735);
    expect(snapTo15(7)).toBe(0);
    expect(snapTo15(8)).toBe(15);
  });
});

describe('clampMin', () => {
  it('returns the value when in range', () => {
    expect(clampMin(720, 600, 800)).toBe(720);
  });

  it('clamps to lower bound', () => {
    expect(clampMin(500, 600, 800)).toBe(600);
  });

  it('clamps to upper bound', () => {
    expect(clampMin(900, 600, 800)).toBe(800);
  });
});
