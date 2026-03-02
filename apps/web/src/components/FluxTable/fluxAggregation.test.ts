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
  it('returns n.a. for empty array', () => {
    expect(worstPrerequisiteStatus([])).toBe('n.a.');
  });

  it('returns single status unchanged', () => {
    expect(worstPrerequisiteStatus(['OK'])).toBe('OK');
    expect(worstPrerequisiteStatus(['A cder'])).toBe('A cder');
  });

  it('returns red over yellow and green (spec 6.2 example: job 00078 Papier)', () => {
    // Ronde: Stock (green), Carree: Cde (yellow), Ovale: A cder (red)
    expect(worstPrerequisiteStatus(['Stock', 'Cde', 'A cder'])).toBe('A cder');
  });

  it('returns yellow over gray and green (spec 6.2 example: job 00091 Formes)', () => {
    // Couverture: n.a. (gray), Interieur: Cdee (yellow)
    expect(worstPrerequisiteStatus(['n.a.', 'Cdee'])).toBe('Cdee');
  });

  it('returns worst when all same color', () => {
    // All red: returns first red encountered
    const result = worstPrerequisiteStatus(['Att.fich', 'A cder', 'A faire']);
    expect(['Att.fich', 'A cder', 'A faire']).toContain(result);
  });

  it('returns green when all green', () => {
    const result = worstPrerequisiteStatus(['OK', 'Stock', 'Pretes']);
    expect(['OK', 'Stock', 'Pretes']).toContain(result);
  });

  it('red over gray', () => {
    expect(worstPrerequisiteStatus(['n.a.', 'Att.fich'])).toBe('Att.fich');
  });

  it('gray over green', () => {
    expect(worstPrerequisiteStatus(['OK', 'n.a.'])).toBe('n.a.');
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
      id: 'e1', label: 'Ronde', bat: 'OK', papier: 'Stock', formes: 'Stock', plaques: 'Pretes',
      stations: { 'cat-offset': { state: 'late', progress: 60 }, 'cat-cutting': { state: 'planned' } },
    },
    {
      id: 'e2', label: 'Carree', bat: 'Envoye', papier: 'Cde', formes: 'n.a.', plaques: 'A faire',
      stations: { 'cat-offset': { state: 'in-progress', progress: 40 } },
    },
    {
      id: 'e3', label: 'Ovale', bat: 'Att.fich', papier: 'A cder', formes: 'A cder', plaques: 'A faire',
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
