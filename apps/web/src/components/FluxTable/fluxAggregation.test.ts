import { describe, it, expect } from 'vitest';
import {
  worstPrerequisiteStatus,
  sortStationDataBySeverity,
  getMultiElementStationData,
  PREREQUISITE_COLOR_SEVERITY,
  STATION_STATE_SEVERITY,
} from './fluxAggregation';
import type { FluxElement, FluxStationData } from './fluxTypes';

describe('PREREQUISITE_COLOR_SEVERITY', () => {
  it('red has lowest severity (0)', () => {
    expect(PREREQUISITE_COLOR_SEVERITY.red).toBe(0);
  });

  it('green has highest severity (3)', () => {
    expect(PREREQUISITE_COLOR_SEVERITY.green).toBe(3);
  });

  it('yellow < gray < green', () => {
    expect(PREREQUISITE_COLOR_SEVERITY.yellow).toBeLessThan(PREREQUISITE_COLOR_SEVERITY.gray);
    expect(PREREQUISITE_COLOR_SEVERITY.gray).toBeLessThan(PREREQUISITE_COLOR_SEVERITY.green);
  });
});

describe('worstPrerequisiteStatus', () => {
  it('returns none for empty array', () => {
    expect(worstPrerequisiteStatus([])).toBe('none');
  });

  it('returns single status unchanged', () => {
    expect(worstPrerequisiteStatus(['bat_approved'])).toBe('bat_approved');
    expect(worstPrerequisiteStatus(['to_order'])).toBe('to_order');
  });

  it('returns red over yellow and green (spec 6.2 example: job 00078 Papier)', () => {
    // Ronde: in_stock (green), Carree: ordered (yellow), Ovale: to_order (red)
    expect(worstPrerequisiteStatus(['in_stock', 'ordered', 'to_order'])).toBe('to_order');
  });

  it('returns yellow over gray and green (spec 6.2 example: job 00091 Formes)', () => {
    // Couverture: none (gray), Interieur: ordered (yellow)
    expect(worstPrerequisiteStatus(['none', 'ordered'])).toBe('ordered');
  });

  it('returns worst when all same color', () => {
    // All red: returns first red encountered
    const result = worstPrerequisiteStatus(['waiting_files', 'to_order', 'to_make']);
    expect(['waiting_files', 'to_order', 'to_make']).toContain(result);
  });

  it('returns green when all green', () => {
    const result = worstPrerequisiteStatus(['bat_approved', 'in_stock', 'ready']);
    expect(['bat_approved', 'in_stock', 'ready']).toContain(result);
  });

  it('red over gray', () => {
    expect(worstPrerequisiteStatus(['none', 'waiting_files'])).toBe('waiting_files');
  });

  it('gray over green', () => {
    expect(worstPrerequisiteStatus(['bat_approved', 'none'])).toBe('none');
  });
});

describe('sortStationDataBySeverity', () => {
  it('sorts late first', () => {
    const data: FluxStationData[] = [
      { state: 'planned' },
      { state: 'late', progress: 60 },
      { state: 'in-progress', progress: 40 },
    ];
    const sorted = sortStationDataBySeverity(data);
    expect(sorted[0].state).toBe('late');
    expect(sorted[1].state).toBe('in-progress');
    expect(sorted[2].state).toBe('planned');
  });

  it('sorts done last', () => {
    const data: FluxStationData[] = [
      { state: 'done' },
      { state: 'planned' },
    ];
    const sorted = sortStationDataBySeverity(data);
    expect(sorted[0].state).toBe('planned');
    expect(sorted[1].state).toBe('done');
  });

  it('does not mutate the original array', () => {
    const data: FluxStationData[] = [{ state: 'done' }, { state: 'late' }];
    sortStationDataBySeverity(data);
    expect(data[0].state).toBe('done');
  });

  it('returns empty array for empty input', () => {
    expect(sortStationDataBySeverity([])).toEqual([]);
  });

  it('full severity order: late > in-progress > planned > done', () => {
    const data: FluxStationData[] = [
      { state: 'done' },
      { state: 'planned' },
      { state: 'in-progress' },
      { state: 'late' },
    ];
    const sorted = sortStationDataBySeverity(data);
    expect(sorted.map(d => d.state)).toEqual(['late', 'in-progress', 'planned', 'done']);
  });
});

describe('getMultiElementStationData', () => {
  const elements: FluxElement[] = [
    {
      id: 'e1', label: 'Ronde',
      bat: 'bat_approved', papier: 'in_stock', formes: 'in_stock', plaques: 'ready',
      stations: { 'cat-offset': { state: 'late', progress: 60 }, 'cat-cutting': { state: 'planned' } },
    },
    {
      id: 'e2', label: 'Carree',
      bat: 'bat_sent', papier: 'ordered', formes: 'none', plaques: 'to_make',
      stations: { 'cat-offset': { state: 'in-progress', progress: 40 } },
    },
    {
      id: 'e3', label: 'Ovale',
      bat: 'waiting_files', papier: 'to_order', formes: 'to_order', plaques: 'to_make',
      stations: { 'cat-offset': { state: 'planned' } },
    },
  ];

  it('collects station data from all elements', () => {
    const result = getMultiElementStationData(elements, 'cat-offset');
    expect(result).toHaveLength(3);
    expect(result[0].state).toBe('late');
    expect(result[1].state).toBe('in-progress');
    expect(result[2].state).toBe('planned');
  });

  it('skips elements without that station', () => {
    const result = getMultiElementStationData(elements, 'cat-cutting');
    expect(result).toHaveLength(1);
    expect(result[0].state).toBe('planned');
  });

  it('returns empty array when no element has that station', () => {
    const result = getMultiElementStationData(elements, 'cat-pelliculeuse');
    expect(result).toHaveLength(0);
  });
});

describe('STATION_STATE_SEVERITY', () => {
  it('late has lowest severity (0)', () => {
    expect(STATION_STATE_SEVERITY.late).toBe(0);
  });

  it('empty has highest severity (4)', () => {
    expect(STATION_STATE_SEVERITY.empty).toBe(4);
  });

  it('late < in-progress < planned < done < empty', () => {
    expect(STATION_STATE_SEVERITY.late).toBeLessThan(STATION_STATE_SEVERITY['in-progress']);
    expect(STATION_STATE_SEVERITY['in-progress']).toBeLessThan(STATION_STATE_SEVERITY.planned);
    expect(STATION_STATE_SEVERITY.planned).toBeLessThan(STATION_STATE_SEVERITY.done);
    expect(STATION_STATE_SEVERITY.done).toBeLessThan(STATION_STATE_SEVERITY.empty);
  });
});
