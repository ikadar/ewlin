import { describe, it, expect } from 'vitest';
import { fmtGraceTimer } from './useGraceCountdown';

describe('fmtGraceTimer', () => {
  it('formats full minutes', () => {
    expect(fmtGraceTimer(300)).toBe('5:00');
    expect(fmtGraceTimer(60)).toBe('1:00');
  });

  it('pads seconds', () => {
    expect(fmtGraceTimer(65)).toBe('1:05');
    expect(fmtGraceTimer(9)).toBe('0:09');
  });

  it('handles zero', () => {
    expect(fmtGraceTimer(0)).toBe('0:00');
  });

  it('handles partial minutes', () => {
    expect(fmtGraceTimer(258)).toBe('4:18');
    expect(fmtGraceTimer(125)).toBe('2:05');
  });
});
