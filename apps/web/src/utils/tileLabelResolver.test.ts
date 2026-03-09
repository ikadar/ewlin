import { describe, it, expect } from 'vitest';
import type { Element, Task, Job } from '@flux/types';
import { getTirageLabel, getDefaultCategoryWidth } from './tileLabelResolver';

// --- Fixtures ---

const makeJob = (reference = 'REF-001', quantity?: number): Job => ({
  id: 'job-1',
  reference,
  client: 'Client SA',
  description: 'Test Job',
  quantity,
  color: '#FF0000',
  status: 'InProgress',
  workshopExitDate: '2025-12-31T00:00:00Z',
  fullyScheduled: false,
  comments: [],
  elementIds: [],
  taskIds: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
});

const makeElement = (
  id: string,
  name: string,
  spec?: Element['spec'],
  taskIds: string[] = [],
): Element => ({
  id,
  jobId: 'job-1',
  name,
  prerequisiteElementIds: [],
  taskIds,
  spec,
  paperStatus: 'none',
  batStatus: 'none',
  plateStatus: 'none',
  formeStatus: 'none',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
});

const makeInternalTask = (id: string, stationId: string): Task => ({
  id,
  elementId: 'e1',
  type: 'Internal',
  stationId,
  sequenceOrder: 0,
  status: 'Defined',
  duration: { setupMinutes: 0, runMinutes: 30 },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
});

const emptyTaskMap = new Map<string, Task>();
const noAssemblyStations = new Set<string>();

// --- getDefaultCategoryWidth ---

describe('getDefaultCategoryWidth', () => {
  it('returns 400 for pelliculeuse', () => {
    expect(getDefaultCategoryWidth('Pelliculeuses')).toBe(400);
  });

  it('returns 400 for encarteuse', () => {
    expect(getDefaultCategoryWidth('Encarteuses-Piqueuses')).toBe(400);
  });

  it('returns 340 for offset', () => {
    expect(getDefaultCategoryWidth('Presses Offset')).toBe(340);
  });

  it('returns 340 for typographie', () => {
    expect(getDefaultCategoryWidth('Typographie')).toBe(340);
  });

  it('returns 340 for plieuse', () => {
    expect(getDefaultCategoryWidth('Plieuses')).toBe(340);
  });

  it('returns 280 for piqueuse (assembleuses-piqueuses)', () => {
    expect(getDefaultCategoryWidth('Assembleuses-Piqueuses')).toBe(280);
  });

  it('returns null for massicot', () => {
    expect(getDefaultCategoryWidth('Massicots')).toBeNull();
  });

  it('returns null for assembleuse (not piqueuse)', () => {
    expect(getDefaultCategoryWidth('Assembleuses')).toBeNull();
  });

  it('returns null for conditionnement', () => {
    expect(getDefaultCategoryWidth('Conditionnement')).toBeNull();
  });
});

// --- getTirageLabel ---

describe('getTirageLabel — Presses Offset', () => {
  const job = makeJob('REF-001', 5000);
  const element = makeElement('e1', 'int', {
    papier: 'Couché mat:135',
    imposition: '50x70(8)',
    impression: 'Q/Q',
    quantite: 5000,
  });

  it('builds full label', () => {
    expect(
      getTirageLabel('Presses Offset', element, job, [element], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 • Couché mat 135g 50x70 Q/Q 5000ex');
  });

  it('skips missing fields', () => {
    const el = makeElement('e1', 'int', { papier: 'Offset' });
    const jobNoQty = makeJob();
    expect(
      getTirageLabel('Presses Offset', el, jobNoQty, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 • Offset');
  });
});

describe('getTirageLabel — Massicots', () => {
  const job = makeJob('REF-001', 1000);

  it('builds label with format and quantity', () => {
    const el = makeElement('e1', 'int', { format: 'A4', quantite: 1000 });
    expect(
      getTirageLabel('Massicots', el, job, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 • A4 1000ex');
  });

  it('returns empty string when no spec fields and no job quantity', () => {
    const el = makeElement('e1', 'int', {});
    const jobNoQty = makeJob();
    expect(
      getTirageLabel('Massicots', el, jobNoQty, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('');
  });
});

describe('getTirageLabel — Plieuses', () => {
  const assemblyStations = new Set(['assembly-1']);

  it('leaflet format (no assembly siblings)', () => {
    const job = makeJob('REF-001', 5000);
    const el = makeElement('e1', 'int', { format: 'A5', papier: 'Offset:80', quantite: 5000 }, ['t1']);
    const taskMap = new Map<string, Task>([['t1', makeInternalTask('t1', 'plieuse-1')]]);
    expect(
      getTirageLabel('Plieuses', el, job, [el], taskMap, assemblyStations),
    ).toBe('REF-001 • A5 Offset 80g 5000ex');
  });

  it('brochure format (has assembly sibling)', () => {
    const job = makeJob('REF-001', 3000);
    const el = makeElement('e1', 'int', { format: 'A5', papier: 'Couché mat:115', pagination: 16, quantite: 3000 }, ['t1']);
    const sibling = makeElement('e2', 'couv', {}, ['t2']);
    const taskMap = new Map<string, Task>([
      ['t1', makeInternalTask('t1', 'plieuse-1')],
      ['t2', makeInternalTask('t2', 'assembly-1')],
    ]);
    expect(
      getTirageLabel('Plieuses', el, job, [el, sibling], taskMap, assemblyStations),
    ).toBe('REF-001 · int • A5 16p Couché mat 115g 3000ex');
  });
});

describe('getTirageLabel — Encarteuses-Piqueuses', () => {
  const job = makeJob();

  it('builds label with format and cahiers summary', () => {
    const el = makeElement('e1', 'int1', { format: 'A4', pagination: 16 });
    const el2 = makeElement('e2', 'int2', { pagination: 16 });
    const el3 = makeElement('e3', 'couv');
    expect(
      getTirageLabel('Encarteuses-Piqueuses', el, job, [el, el2, el3], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 · int1 • A4 2x16p + couv');
  });
});

describe('getTirageLabel — Assembleuses-Piqueuses', () => {
  const job = makeJob();

  it('builds label with format, total pagination and couv', () => {
    const el = makeElement('e1', 'int1', { format: 'A5', pagination: 16 });
    const el2 = makeElement('e2', 'int2', { pagination: 16 });
    const cover = makeElement('e3', 'couv');
    expect(
      getTirageLabel('Assembleuses-Piqueuses', el, job, [el, el2, cover], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 · int1 • A5 32p + couv');
  });

  it('skips couv suffix when no cover element', () => {
    const el = makeElement('e1', 'int1', { format: 'A4', pagination: 8 });
    const el2 = makeElement('e2', 'int2', { pagination: 8 });
    expect(
      getTirageLabel('Assembleuses-Piqueuses', el, job, [el, el2], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 · int1 • A4 16p');
  });
});

describe('getTirageLabel — Assembleuses (not piqueuse)', () => {
  it('builds feuillets label', () => {
    const job = makeJob('REF-001', 2000);
    const el = makeElement('e1', 'int', { pagination: 16, quantite: 2000 });
    expect(
      getTirageLabel('Assembleuses', el, job, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 • 4 feuillets 2000ex');
  });

  it('ceils feuillets correctly (e.g. 18/4 = 4.5 → 5)', () => {
    const job = makeJob('REF-001', 500);
    const el = makeElement('e1', 'int', { pagination: 18, quantite: 500 });
    expect(
      getTirageLabel('Assembleuses', el, job, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 • 5 feuillets 500ex');
  });
});

describe('getTirageLabel — Typographie', () => {
  const job = makeJob();

  it('builds label', () => {
    const el = makeElement('e1', 'int', { imposition: '50x70(4)', qteFeuilles: 250, papier: 'Offset:80' });
    expect(
      getTirageLabel('Typographie', el, job, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 • 50x70(4) 250F Offset 80g');
  });
});

describe('getTirageLabel — Pelliculeuses', () => {
  const job = makeJob();

  it('builds label', () => {
    const el = makeElement('e1', 'couv', { surfacage: 'mat/mat', imposition: '50x70(8)', qteFeuilles: 125, papier: 'Couché mat:135' });
    expect(
      getTirageLabel('Pelliculeuses', el, job, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 • mat/mat 50x70(8) 125F Couché mat 135g');
  });
});

describe('getTirageLabel — Conditionnement and unknown categories', () => {
  const job = makeJob();

  it('returns empty string for Conditionnement', () => {
    const el = makeElement('e1', 'int', { format: 'A4', quantite: 1000 });
    expect(
      getTirageLabel('Conditionnement', el, job, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('');
  });

  it('returns empty string for unknown category', () => {
    const el = makeElement('e1', 'int', { format: 'A4' });
    expect(
      getTirageLabel('Inconnu', el, job, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('');
  });
});

describe('getTirageLabel — single vs multi element prefix', () => {
  it('omits element name for single-element job', () => {
    const el = makeElement('e1', 'ELT', { papier: 'Offset:80', imposition: '50x70', impression: 'R°', quantite: 1000 });
    expect(
      getTirageLabel('Presses Offset', el, makeJob('REF-001', 1000), [el], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 • Offset 80g 50x70 R° 1000ex');
  });

  it('shows element name for multi-element job', () => {
    const el = makeElement('e1', 'int', { papier: 'Offset:80', imposition: '50x70', impression: 'R°', quantite: 1000 });
    const el2 = makeElement('e2', 'couv');
    expect(
      getTirageLabel('Presses Offset', el, makeJob('REF-001', 1000), [el, el2], emptyTaskMap, noAssemblyStations),
    ).toBe('REF-001 · int • Offset 80g 50x70 R° 1000ex');
  });
});

describe('getTirageLabel — graceful handling of missing spec', () => {
  const job = makeJob();

  it('returns empty string for Offset with no spec', () => {
    const el = makeElement('e1', 'int');
    expect(
      getTirageLabel('Presses Offset', el, job, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('');
  });

  it('returns empty string for Massicot with no spec', () => {
    const el = makeElement('e1', 'int');
    expect(
      getTirageLabel('Massicots', el, job, [el], emptyTaskMap, noAssemblyStations),
    ).toBe('');
  });
});
