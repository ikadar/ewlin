import { describe, it, expect } from 'vitest';
import type { Element, Task } from '@flux/types';
import { detectBrochureOrLeaflet } from './brochureDetection';

const makeElement = (id: string, taskIds: string[] = [], name = 'elt'): Element => ({
  id,
  jobId: 'job-1',
  name,
  prerequisiteElementIds: [],
  taskIds,
  paperStatus: 'none',
  batStatus: 'none',
  plateStatus: 'none',
  formeStatus: 'none',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
});

const makeInternalTask = (id: string, stationId: string): Task => ({
  id,
  elementId: 'elt-1',
  type: 'Internal',
  stationId,
  sequenceOrder: 0,
  status: 'Defined',
  duration: { setupMinutes: 0, runMinutes: 30 },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
});

describe('detectBrochureOrLeaflet', () => {
  const assemblyStationIds = new Set(['assembly-1', 'assembly-2']);

  it('returns leaflet when job has only one element', () => {
    const element = makeElement('e1', ['t1']);
    const taskMap = new Map<string, Task>([['t1', makeInternalTask('t1', 'plieuse-1')]]);
    expect(detectBrochureOrLeaflet(element, [element], taskMap, assemblyStationIds)).toBe('leaflet');
  });

  it('returns leaflet when no sibling has assembly station tasks', () => {
    const element = makeElement('e1', ['t1']);
    const sibling = makeElement('e2', ['t2']);
    const taskMap = new Map<string, Task>([
      ['t1', makeInternalTask('t1', 'plieuse-1')],
      ['t2', makeInternalTask('t2', 'massicot-1')],
    ]);
    expect(detectBrochureOrLeaflet(element, [element, sibling], taskMap, assemblyStationIds)).toBe('leaflet');
  });

  it('returns brochure when a sibling has a task on an assembly station', () => {
    const element = makeElement('e1', ['t1']);
    const sibling = makeElement('e2', ['t2', 't3']);
    const taskMap = new Map<string, Task>([
      ['t1', makeInternalTask('t1', 'plieuse-1')],
      ['t2', makeInternalTask('t2', 'massicot-1')],
      ['t3', makeInternalTask('t3', 'assembly-1')],
    ]);
    expect(detectBrochureOrLeaflet(element, [element, sibling], taskMap, assemblyStationIds)).toBe('brochure');
  });

  it('returns brochure when a different sibling has assembly station task', () => {
    const element = makeElement('e1', ['t1']);
    const sibling2 = makeElement('e2', ['t2']);
    const sibling3 = makeElement('e3', ['t3']);
    const taskMap = new Map<string, Task>([
      ['t1', makeInternalTask('t1', 'plieuse-1')],
      ['t2', makeInternalTask('t2', 'non-assembly')],
      ['t3', makeInternalTask('t3', 'assembly-2')],
    ]);
    expect(
      detectBrochureOrLeaflet(element, [element, sibling2, sibling3], taskMap, assemblyStationIds),
    ).toBe('brochure');
  });

  it('ignores the current element itself when checking siblings', () => {
    const element = makeElement('e1', ['t1']);
    const taskMap = new Map<string, Task>([
      // t1 is on an assembly station, but e1 is the current element itself
      ['t1', makeInternalTask('t1', 'assembly-1')],
    ]);
    // Only element is e1 itself — single element → leaflet
    expect(detectBrochureOrLeaflet(element, [element], taskMap, assemblyStationIds)).toBe('leaflet');
  });
});
