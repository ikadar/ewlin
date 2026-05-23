import { describe, it, expect } from 'vitest';
import { computePlateEarliestStart } from './plateGate';
import type { PlateLeadTimeConfig } from '@flux/types';

const NOW = new Date('2026-05-10T08:00:00Z');
const CONFIG: PlateLeadTimeConfig = { offsetHours: 2, stationId: null, updatedAt: '2026-05-01T00:00:00Z' };

describe('computePlateEarliestStart', () => {
  it('returns null when config is undefined', () => {
    expect(computePlateEarliestStart({ plateStatus: 'to_make' }, undefined, NOW)).toBeNull();
  });

  it('returns null when plateStatus is none', () => {
    expect(computePlateEarliestStart({ plateStatus: 'none' }, CONFIG, NOW)).toBeNull();
  });

  it('returns null when plateStatus is ready', () => {
    expect(computePlateEarliestStart({ plateStatus: 'ready' }, CONFIG, NOW)).toBeNull();
  });

  it('returns now + offsetHours when plateStatus is to_make', () => {
    const result = computePlateEarliestStart({ plateStatus: 'to_make' }, CONFIG, NOW);
    expect(result).toEqual(new Date('2026-05-10T10:00:00Z'));
  });

  it('uses offsetHours=0 correctly (no delay)', () => {
    const zeroConfig: PlateLeadTimeConfig = { offsetHours: 0, stationId: null, updatedAt: '2026-05-01T00:00:00Z' };
    const result = computePlateEarliestStart({ plateStatus: 'to_make' }, zeroConfig, NOW);
    expect(result).toEqual(NOW);
  });
});
