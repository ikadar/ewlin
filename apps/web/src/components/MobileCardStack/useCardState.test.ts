import { describe, it, expect } from 'vitest';
import { deriveCardState } from './useCardState';

function iso(h: number, m: number): string {
  return `2026-05-20T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function date(h: number, m: number): Date {
  return new Date(`2026-05-20T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
}

describe('deriveCardState', () => {
  const start = iso(9, 0);
  const end = iso(11, 30);
  const durationMin = 150;

  it('returns attente when now is before start', () => {
    const { state } = deriveCardState(start, end, durationMin, date(8, 30), false);
    expect(state).toBe('attente');
  });

  it('returns en-cours when now is within slot but far from end', () => {
    const { state } = deriveCardState(start, end, durationMin, date(9, 30), false);
    expect(state).toBe('en-cours');
  });

  it('returns fin-proche when now is within threshold of end', () => {
    const { state, inEndZone } = deriveCardState(start, end, durationMin, date(11, 20), false);
    expect(state).toBe('fin-proche');
    expect(inEndZone).toBe(true);
  });

  it('uses max(5, 10% of duration) as threshold', () => {
    const { thresholdMin } = deriveCardState(start, end, durationMin, date(10, 0), false);
    expect(thresholdMin).toBe(15);
  });

  it('threshold floors at 5 for short tasks', () => {
    const shortEnd = iso(9, 20);
    const { thresholdMin } = deriveCardState(start, shortEnd, 20, date(9, 10), false);
    expect(thresholdMin).toBe(5);
  });

  it('returns grace when now is past end', () => {
    const { state } = deriveCardState(start, end, durationMin, date(11, 45), false);
    expect(state).toBe('grace');
  });

  it('returns grace when task is completed within grace window', () => {
    const { state } = deriveCardState(start, end, durationMin, date(11, 32), true);
    expect(state).toBe('grace');
  });

  it('inEndZone is false outside the threshold', () => {
    const { inEndZone } = deriveCardState(start, end, durationMin, date(10, 0), false);
    expect(inEndZone).toBe(false);
  });

  it('inEndZone is false in attente', () => {
    const { inEndZone } = deriveCardState(start, end, durationMin, date(8, 0), false);
    expect(inEndZone).toBe(false);
  });

  it('boundary: exactly at start → en-cours', () => {
    const { state } = deriveCardState(start, end, durationMin, date(9, 0), false);
    expect(state).toBe('en-cours');
  });

  it('boundary: exactly at end → grace', () => {
    const { state } = deriveCardState(start, end, durationMin, date(11, 30), false);
    expect(state).toBe('grace');
  });

  it('boundary: exactly at threshold edge → fin-proche', () => {
    const { state } = deriveCardState(start, end, durationMin, date(11, 15), false);
    expect(state).toBe('fin-proche');
  });
});
