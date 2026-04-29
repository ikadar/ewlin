import { describe, it, expect } from 'vitest';
import {
  CARRIER_NONE,
  EMPTY_FLUX_FILTERS,
  filterByCriteria,
  hasActiveFilters,
  jobIsPlanned,
  jobMatchesStatus,
  type FluxFilters,
  type JobStatusContext,
} from './fluxFilters';
import type { FluxElement, FluxJob } from './fluxTypes';

const EMPTY_CTX: JobStatusContext = { lateJobIds: new Set(), conflictJobIds: new Set() };

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
    internalId: 'job-uuid-00042',
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

describe('jobIsPlanned', () => {
  it('is false when every station is empty', () => {
    expect(jobIsPlanned(job())).toBe(false);
  });

  it('is true when at least one station has a non-empty state', () => {
    const j = job({
      elements: [elem({ stations: { 'cat-1': { state: 'planned' } } })],
    });
    expect(jobIsPlanned(j)).toBe(true);
  });

  it('is true when a station is in-progress', () => {
    const j = job({
      elements: [elem({ stations: { 'cat-1': { state: 'in-progress', progress: 30 } } })],
    });
    expect(jobIsPlanned(j)).toBe(true);
  });
});

describe('jobMatchesStatus', () => {
  it('returns false for archived jobs across every status', () => {
    const shipped = job({ parti: { shipped: true, date: null } });
    const invoiced = job({ facture: { invoiced: true, date: null } });
    for (const s of ['conflict', 'late', 'planned', 'unplanned'] as const) {
      expect(jobMatchesStatus(shipped, s, EMPTY_CTX)).toBe(false);
      expect(jobMatchesStatus(invoiced, s, EMPTY_CTX)).toBe(false);
    }
  });

  it('matches conflict for jobs in conflictJobIds', () => {
    const ctx: JobStatusContext = {
      lateJobIds: new Set(),
      conflictJobIds: new Set(['job-uuid-00042']),
    };
    expect(jobMatchesStatus(job(), 'conflict', ctx)).toBe(true);
  });

  it('matches late for jobs in lateJobIds and not in conflict', () => {
    const ctx: JobStatusContext = {
      lateJobIds: new Set(['job-uuid-00042']),
      conflictJobIds: new Set(),
    };
    expect(jobMatchesStatus(job(), 'late', ctx)).toBe(true);
  });

  it('a conflict-and-late job matches late but NOT conflict (precedence)', () => {
    const ctx: JobStatusContext = {
      lateJobIds: new Set(['job-uuid-00042']),
      conflictJobIds: new Set(['job-uuid-00042']),
    };
    expect(jobMatchesStatus(job(), 'late', ctx)).toBe(true);
    expect(jobMatchesStatus(job(), 'conflict', ctx)).toBe(false);
  });

  it('matches planned for jobs with stations and no conflict/lateness', () => {
    const j = job({
      elements: [elem({ stations: { 'cat-1': { state: 'planned' } } })],
    });
    expect(jobMatchesStatus(j, 'planned', EMPTY_CTX)).toBe(true);
  });

  it('does not match planned when the job is late', () => {
    const j = job({
      elements: [elem({ stations: { 'cat-1': { state: 'planned' } } })],
    });
    const ctx: JobStatusContext = {
      lateJobIds: new Set(['job-uuid-00042']),
      conflictJobIds: new Set(),
    };
    expect(jobMatchesStatus(j, 'planned', ctx)).toBe(false);
    expect(jobMatchesStatus(j, 'late', ctx)).toBe(true);
  });

  it('matches unplanned for jobs with no station progress', () => {
    expect(jobMatchesStatus(job(), 'unplanned', EMPTY_CTX)).toBe(true);
  });

  it('considers a station in late state as planned (not unplanned)', () => {
    const j = job({
      elements: [elem({ stations: { 'cat-1': { state: 'late' } } })],
    });
    expect(jobMatchesStatus(j, 'unplanned', EMPTY_CTX)).toBe(false);
    expect(jobMatchesStatus(j, 'late', EMPTY_CTX)).toBe(true);
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

  it('filters by status with context (planned)', () => {
    const planned   = job({ elements: [elem({ stations: { 'cat-1': { state: 'planned' } } })] });
    const unplanned = job();
    const f: FluxFilters = { ...EMPTY_FLUX_FILTERS, statuses: new Set(['planned']) };
    expect(filterByCriteria(planned, f, EMPTY_CTX)).toBe(true);
    expect(filterByCriteria(unplanned, f, EMPTY_CTX)).toBe(false);
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

  it('OR-combines status values within the same filter', () => {
    const planned   = job({ elements: [elem({ stations: { 'cat-1': { state: 'planned' } } })] });
    const unplanned = job();
    const f: FluxFilters = {
      ...EMPTY_FLUX_FILTERS,
      statuses: new Set(['planned', 'unplanned']),
    };
    expect(filterByCriteria(planned, f, EMPTY_CTX)).toBe(true);
    expect(filterByCriteria(unplanned, f, EMPTY_CTX)).toBe(true);
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
