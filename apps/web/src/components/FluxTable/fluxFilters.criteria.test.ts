import { describe, it, expect } from 'vitest';
import {
  CARRIER_NONE,
  EMPTY_FLUX_FILTERS,
  deriveFluxJobStatus,
  filterByCriteria,
  hasActiveFilters,
  type FluxFilters,
} from './fluxFilters';
import type { FluxElement, FluxJob } from './fluxTypes';

function elem(overrides: Partial<FluxElement> = {}): FluxElement {
  return {
    id: 'el-1',
    label: 'Couv',
    bat: 'none',
    papier: 'none',
    formes: 'none',
    plaques: 'none',
    stations: {},
    outsourcing: [],
    ...overrides,
  };
}

function job(overrides: Partial<FluxJob> = {}): FluxJob {
  return {
    id: '00042',
    client: 'Ducros',
    referent: null,
    designation: 'Cartes 500',
    sortie: '15/03',
    sortieIso: '2026-03-15',
    deadlineRelativeWorkingDays: null,
    batDeadline: null,
    deadlinePriority: 2,
    elements: [elem()],
    transporteur: null,
    parti: { shipped: false, date: null },
    facture: { invoiced: false, date: null },
    ...overrides,
  };
}

describe('deriveFluxJobStatus', () => {
  it('returns invoiced when the job is invoiced', () => {
    expect(deriveFluxJobStatus(job({ facture: { invoiced: true, date: null } }))).toBe('invoiced');
  });

  it('returns shipped when the job is shipped but not invoiced', () => {
    expect(deriveFluxJobStatus(job({ parti: { shipped: true, date: null } }))).toBe('shipped');
  });

  it('returns ready when all prerequisites are done and not yet shipped', () => {
    const j = job({
      elements: [elem({ bat: 'bat_approved', papier: 'in_stock', formes: 'in_stock', plaques: 'ready' })],
    });
    expect(deriveFluxJobStatus(j)).toBe('ready');
  });

  it('returns todo when nothing has been started yet', () => {
    expect(deriveFluxJobStatus(job())).toBe('todo');
  });

  it('returns prep when at least one prerequisite is in progress', () => {
    const j = job({ elements: [elem({ bat: 'bat_sent' })] });
    expect(deriveFluxJobStatus(j)).toBe('prep');
  });

  it('aggregates worst status across multiple elements', () => {
    const j = job({
      elements: [
        elem({ bat: 'bat_approved', papier: 'in_stock', formes: 'in_stock', plaques: 'ready' }),
        elem({ bat: 'waiting_files', papier: 'to_order', formes: 'none', plaques: 'to_make' }),
      ],
    });
    // The second element is still pending → not ready, but partial work elsewhere
    expect(deriveFluxJobStatus(j)).toBe('todo');
  });

  it('precedence: invoiced wins over a still-pending prerequisite', () => {
    const j = job({
      elements: [elem({ bat: 'waiting_files' })],
      facture: { invoiced: true, date: null },
    });
    expect(deriveFluxJobStatus(j)).toBe('invoiced');
  });
});

describe('hasActiveFilters', () => {
  it('returns false for the empty filter set', () => {
    expect(hasActiveFilters(EMPTY_FLUX_FILTERS)).toBe(false);
  });

  it('returns true when any multi-select has values', () => {
    const f: FluxFilters = { ...EMPTY_FLUX_FILTERS, clients: new Set(['Ducros']) };
    expect(hasActiveFilters(f)).toBe(true);
  });

  it('returns true when only a date bound is set', () => {
    const f: FluxFilters = { ...EMPTY_FLUX_FILTERS, sortieFrom: '2026-03-01' };
    expect(hasActiveFilters(f)).toBe(true);
  });
});

describe('filterByCriteria', () => {
  it('passes any job through the empty filter set', () => {
    expect(filterByCriteria(job(), EMPTY_FLUX_FILTERS)).toBe(true);
  });

  it('filters by status (synthetic)', () => {
    const todo = job();
    const shipped = job({ parti: { shipped: true, date: null } });
    const f: FluxFilters = { ...EMPTY_FLUX_FILTERS, statuses: new Set(['shipped']) };
    expect(filterByCriteria(shipped, f)).toBe(true);
    expect(filterByCriteria(todo, f)).toBe(false);
  });

  it('filters by client (OR within filter)', () => {
    const j1 = job({ client: 'Ducros' });
    const j2 = job({ client: 'Müller' });
    const j3 = job({ client: 'Lefevre' });
    const f: FluxFilters = { ...EMPTY_FLUX_FILTERS, clients: new Set(['Ducros', 'Müller']) };
    expect(filterByCriteria(j1, f)).toBe(true);
    expect(filterByCriteria(j2, f)).toBe(true);
    expect(filterByCriteria(j3, f)).toBe(false);
  });

  it('filters by carrier including the "none" sentinel', () => {
    const withCarrier = job({ transporteur: 'DHL' });
    const noCarrier = job({ transporteur: null });
    const f: FluxFilters = { ...EMPTY_FLUX_FILTERS, carriers: new Set([CARRIER_NONE]) };
    expect(filterByCriteria(noCarrier, f)).toBe(true);
    expect(filterByCriteria(withCarrier, f)).toBe(false);
  });

  it('filters by priority', () => {
    const urgent = job({ deadlinePriority: 0 });
    const standard = job({ deadlinePriority: 2 });
    const f: FluxFilters = { ...EMPTY_FLUX_FILTERS, priorities: new Set([0, 1]) };
    expect(filterByCriteria(urgent, f)).toBe(true);
    expect(filterByCriteria(standard, f)).toBe(false);
  });

  it('filters by job id (multi-select)', () => {
    const j1 = job({ id: '00042' });
    const j2 = job({ id: '00099' });
    const f: FluxFilters = { ...EMPTY_FLUX_FILTERS, jobIds: new Set(['00042']) };
    expect(filterByCriteria(j1, f)).toBe(true);
    expect(filterByCriteria(j2, f)).toBe(false);
  });

  it('filters by sortie date range (inclusive)', () => {
    const inWindow = job({ sortieIso: '2026-03-15' });
    const before   = job({ sortieIso: '2026-02-28' });
    const after    = job({ sortieIso: '2026-04-01' });
    const f: FluxFilters = { ...EMPTY_FLUX_FILTERS, sortieFrom: '2026-03-01', sortieTo: '2026-03-31' };
    expect(filterByCriteria(inWindow, f)).toBe(true);
    expect(filterByCriteria(before, f)).toBe(false);
    expect(filterByCriteria(after, f)).toBe(false);
  });

  it('rejects jobs without a sortie date when the range is set', () => {
    const noDate = job({ sortieIso: null });
    const f: FluxFilters = { ...EMPTY_FLUX_FILTERS, sortieFrom: '2026-03-01' };
    expect(filterByCriteria(noDate, f)).toBe(false);
  });

  it('filters by BAT deadline using the date portion of the ISO datetime', () => {
    const j = job({ batDeadline: '2026-03-10T17:00' });
    const fHit:  FluxFilters = { ...EMPTY_FLUX_FILTERS, batFrom: '2026-03-10', batTo: '2026-03-10' };
    const fMiss: FluxFilters = { ...EMPTY_FLUX_FILTERS, batFrom: '2026-03-11' };
    expect(filterByCriteria(j, fHit)).toBe(true);
    expect(filterByCriteria(j, fMiss)).toBe(false);
  });

  it('AND-combines distinct filters', () => {
    const j = job({ client: 'Ducros', deadlinePriority: 0 });
    const fBoth: FluxFilters = {
      ...EMPTY_FLUX_FILTERS,
      clients: new Set(['Ducros']),
      priorities: new Set([0]),
    };
    const fOnlyClient: FluxFilters = {
      ...EMPTY_FLUX_FILTERS,
      clients: new Set(['Müller']),
      priorities: new Set([0]),
    };
    expect(filterByCriteria(j, fBoth)).toBe(true);
    expect(filterByCriteria(j, fOnlyClient)).toBe(false);
  });
});
