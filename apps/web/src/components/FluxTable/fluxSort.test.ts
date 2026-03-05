/**
 * Unit tests for fluxSort.ts (v0.5.21)
 */

import { describe, it, expect } from 'vitest';
import { sortFluxJobs } from './fluxSort';
import type { FluxJob } from './fluxTypes';

// ── Test fixtures ────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<FluxJob> & { id: string }): FluxJob {
  return {
    client: 'Client',
    designation: 'Designation',
    sortie: '01/01',
    elements: [
      {
        id: 'e1',
        label: 'Main',
        bat: 'none',
        papier: 'none',
        formes: 'none',
        plaques: 'none',
        stations: {},
      },
    ],
    transporteur: null,
    parti: { shipped: false, date: null },
    ...overrides,
  };
}

const jobA = makeJob({ id: '00001', client: 'Alix', designation: 'Brochure', sortie: '15/01' });
const jobB = makeJob({ id: '00002', client: 'Bruno', designation: 'Catalogue', sortie: '28/02' });
const jobC = makeJob({ id: '00003', client: 'Clara', designation: 'Affiche', sortie: '05/03' });

// ── ID sort ──────────────────────────────────────────────────────────────────

describe('sortFluxJobs — id', () => {
  it('sorts by id ascending', () => {
    const result = sortFluxJobs([jobC, jobA, jobB], 'id', 'asc');
    expect(result.map(j => j.id)).toEqual(['00001', '00002', '00003']);
  });

  it('sorts by id descending', () => {
    const result = sortFluxJobs([jobA, jobC, jobB], 'id', 'desc');
    expect(result.map(j => j.id)).toEqual(['00003', '00002', '00001']);
  });
});

// ── Client sort ──────────────────────────────────────────────────────────────

describe('sortFluxJobs — client', () => {
  it('sorts by client ascending (alphabetical)', () => {
    const result = sortFluxJobs([jobB, jobC, jobA], 'client', 'asc');
    expect(result.map(j => j.client)).toEqual(['Alix', 'Bruno', 'Clara']);
  });

  it('sorts by client descending', () => {
    const result = sortFluxJobs([jobA, jobB, jobC], 'client', 'desc');
    expect(result.map(j => j.client)).toEqual(['Clara', 'Bruno', 'Alix']);
  });
});

// ── Designation sort ─────────────────────────────────────────────────────────

describe('sortFluxJobs — designation', () => {
  it('sorts by designation ascending', () => {
    const result = sortFluxJobs([jobA, jobB, jobC], 'designation', 'asc');
    // Affiche < Brochure < Catalogue
    expect(result.map(j => j.designation)).toEqual(['Affiche', 'Brochure', 'Catalogue']);
  });
});

// ── Sortie date sort ─────────────────────────────────────────────────────────

describe('sortFluxJobs — sortie', () => {
  it('sorts by sortie ascending (month-correct, not day-correct)', () => {
    // jobA=15/01 → 0115, jobB=28/02 → 0228, jobC=05/03 → 0305
    const result = sortFluxJobs([jobC, jobB, jobA], 'sortie', 'asc');
    expect(result.map(j => j.sortie)).toEqual(['15/01', '28/02', '05/03']);
  });

  it('does NOT sort naively by day (would put 05/03 before 15/01)', () => {
    // Naive day sort would give: 05/03, 15/01, 28/02
    // Correct MMDD sort gives:   15/01, 28/02, 05/03
    const result = sortFluxJobs([jobC, jobA, jobB], 'sortie', 'asc');
    expect(result[0]!.sortie).toBe('15/01'); // 01-month comes first
  });

  it('sorts by sortie descending', () => {
    const result = sortFluxJobs([jobA, jobB, jobC], 'sortie', 'desc');
    expect(result.map(j => j.sortie)).toEqual(['05/03', '28/02', '15/01']);
  });
});

// ── Prerequisite sort ─────────────────────────────────────────────────────────

describe('sortFluxJobs — bat (prerequisite)', () => {
  const greenJob = makeJob({ id: '00001', elements: [{ id: 'e1', label: '', bat: 'bat_approved', papier: 'none', formes: 'none', plaques: 'none', stations: {} }] });
  const yellowJob = makeJob({ id: '00002', elements: [{ id: 'e1', label: '', bat: 'bat_sent', papier: 'none', formes: 'none', plaques: 'none', stations: {} }] });
  const redJob = makeJob({ id: '00003', elements: [{ id: 'e1', label: '', bat: 'waiting_files', papier: 'none', formes: 'none', plaques: 'none', stations: {} }] });

  it('ascending = best (green) first', () => {
    const result = sortFluxJobs([redJob, greenJob, yellowJob], 'bat', 'asc');
    const batValues = result.map(j => j.elements[0]!.bat);
    expect(batValues[0]).toBe('bat_approved'); // green first
    expect(batValues[2]).toBe('waiting_files'); // red last
  });

  it('descending = worst (red) first', () => {
    const result = sortFluxJobs([greenJob, yellowJob, redJob], 'bat', 'desc');
    const batValues = result.map(j => j.elements[0]!.bat);
    expect(batValues[0]).toBe('waiting_files'); // red first
    expect(batValues[2]).toBe('bat_approved'); // green last
  });
});

describe('sortFluxJobs — bat (multi-element aggregation)', () => {
  // Multi-element job: worst is waiting_files (red)
  const multiJob = makeJob({
    id: '00001',
    elements: [
      { id: 'e1', label: '', bat: 'bat_approved', papier: 'none', formes: 'none', plaques: 'none', stations: {} },
      { id: 'e2', label: '', bat: 'waiting_files', papier: 'none', formes: 'none', plaques: 'none', stations: {} },
    ],
  });
  // Single-element job: green
  const singleGreenJob = makeJob({
    id: '00002',
    elements: [{ id: 'e1', label: '', bat: 'bat_approved', papier: 'none', formes: 'none', plaques: 'none', stations: {} }],
  });

  it('uses worst element status for multi-element jobs', () => {
    // multiJob worst BAT = waiting_files (red) → sorts last in asc
    const result = sortFluxJobs([multiJob, singleGreenJob], 'bat', 'asc');
    expect(result[0]!.id).toBe('00002'); // green single first
    expect(result[1]!.id).toBe('00001'); // red multi last
  });
});

// ── Transporteur sort ─────────────────────────────────────────────────────────

describe('sortFluxJobs — transporteur', () => {
  const withA = makeJob({ id: '00001', transporteur: 'Chronopost' });
  const withB = makeJob({ id: '00002', transporteur: 'DHL' });
  const withNull = makeJob({ id: '00003', transporteur: null });

  it('sorts transporteur ascending (A before B)', () => {
    const result = sortFluxJobs([withB, withA, withNull], 'transporteur', 'asc');
    expect(result[0]!.transporteur).toBe('Chronopost');
    expect(result[1]!.transporteur).toBe('DHL');
    expect(result[2]!.transporteur).toBeNull(); // null last
  });

  it('sorts transporteur descending (B before A, null still last)', () => {
    const result = sortFluxJobs([withA, withNull, withB], 'transporteur', 'desc');
    expect(result[0]!.transporteur).toBe('DHL');
    expect(result[1]!.transporteur).toBe('Chronopost');
    expect(result[2]!.transporteur).toBeNull(); // null always last
  });

  it('null always sorts to end regardless of direction', () => {
    const resultAsc = sortFluxJobs([withNull, withA], 'transporteur', 'asc');
    const resultDesc = sortFluxJobs([withNull, withA], 'transporteur', 'desc');
    expect(resultAsc[resultAsc.length - 1]!.transporteur).toBeNull();
    expect(resultDesc[resultDesc.length - 1]!.transporteur).toBeNull();
  });

  it('two null transporteurs are treated equally', () => {
    const null1 = makeJob({ id: '00001', transporteur: null });
    const null2 = makeJob({ id: '00002', transporteur: null });
    const result = sortFluxJobs([null1, null2], 'transporteur', 'asc');
    expect(result).toHaveLength(2);
  });
});

// ── Station column sort ───────────────────────────────────────────────────────

describe('sortFluxJobs — station column', () => {
  const cat = 'cat-offset';

  const lateJob = makeJob({
    id: '00001',
    elements: [{ id: 'e1', label: '', bat: 'none', papier: 'none', formes: 'none', plaques: 'none', stations: { [cat]: { state: 'late', progress: 0 } } }],
  });
  const inProgressJob = makeJob({
    id: '00002',
    elements: [{ id: 'e1', label: '', bat: 'none', papier: 'none', formes: 'none', plaques: 'none', stations: { [cat]: { state: 'in-progress', progress: 50 } } }],
  });
  const plannedJob = makeJob({
    id: '00003',
    elements: [{ id: 'e1', label: '', bat: 'none', papier: 'none', formes: 'none', plaques: 'none', stations: { [cat]: { state: 'planned', progress: 0 } } }],
  });
  const doneJob = makeJob({
    id: '00004',
    elements: [{ id: 'e1', label: '', bat: 'none', papier: 'none', formes: 'none', plaques: 'none', stations: { [cat]: { state: 'done', progress: 100 } } }],
  });
  const emptyJob = makeJob({
    id: '00005',
    elements: [{ id: 'e1', label: '', bat: 'none', papier: 'none', formes: 'none', plaques: 'none', stations: {} }],
  });

  it('ascending: done before late', () => {
    const result = sortFluxJobs([lateJob, doneJob], `station:${cat}`, 'asc');
    expect(result[0]!.id).toBe('00004'); // done first
    expect(result[1]!.id).toBe('00001'); // late last
  });

  it('descending: late before done', () => {
    const result = sortFluxJobs([doneJob, lateJob], `station:${cat}`, 'desc');
    expect(result[0]!.id).toBe('00001'); // late first
    expect(result[1]!.id).toBe('00004'); // done last
  });

  it('in-progress sorts between late and planned', () => {
    // ascending = best (highest severity) first: planned(2) > in-progress(1) > late(0)
    const result = sortFluxJobs([plannedJob, lateJob, inProgressJob], `station:${cat}`, 'asc');
    expect(result[0]!.id).toBe('00003'); // planned (severity=2) first in asc
    expect(result[1]!.id).toBe('00002'); // in-progress (severity=1)
    expect(result[2]!.id).toBe('00001'); // late (severity=0) last
  });

  it('empty (severity=4) sorts before done (severity=3) in ascending', () => {
    // ascending = best (highest severity) first: empty(4) > done(3) > late(0)
    const result = sortFluxJobs([emptyJob, doneJob, lateJob], `station:${cat}`, 'asc');
    expect(result[0]!.id).toBe('00005'); // empty first (severity=4, no station data)
    expect(result[1]!.id).toBe('00004'); // done second (severity=3)
    expect(result[result.length - 1]!.id).toBe('00001'); // late last
  });

  it('multi-element: uses worst state across all elements', () => {
    const multiJob = makeJob({
      id: '00001',
      elements: [
        { id: 'e1', label: '', bat: 'none', papier: 'none', formes: 'none', plaques: 'none', stations: { [cat]: { state: 'done', progress: 100 } } },
        { id: 'e2', label: '', bat: 'none', papier: 'none', formes: 'none', plaques: 'none', stations: { [cat]: { state: 'late', progress: 0 } } },
      ],
    });
    const singleDoneJob = makeJob({
      id: '00002',
      elements: [{ id: 'e1', label: '', bat: 'none', papier: 'none', formes: 'none', plaques: 'none', stations: { [cat]: { state: 'done', progress: 100 } } }],
    });
    // multiJob worst = late → sorts last in asc
    const result = sortFluxJobs([multiJob, singleDoneJob], `station:${cat}`, 'asc');
    expect(result[0]!.id).toBe('00002'); // done-only job first
    expect(result[1]!.id).toBe('00001'); // multi with late worst, last
  });

  it('both jobs empty at category: stable order preserved', () => {
    const empty1 = makeJob({ id: '00001', elements: [{ id: 'e1', label: '', bat: 'none', papier: 'none', formes: 'none', plaques: 'none', stations: {} }] });
    const empty2 = makeJob({ id: '00002', elements: [{ id: 'e1', label: '', bat: 'none', papier: 'none', formes: 'none', plaques: 'none', stations: {} }] });
    const result = sortFluxJobs([empty1, empty2], `station:${cat}`, 'asc');
    expect(result).toHaveLength(2);
    // Both have severity 4 (empty), diff = 0, stable relative order
    expect(result[0]!.id).toBe('00001');
    expect(result[1]!.id).toBe('00002');
  });
});

// ── Empty array ───────────────────────────────────────────────────────────────

describe('sortFluxJobs — edge cases', () => {
  it('returns empty array unchanged', () => {
    expect(sortFluxJobs([], 'id', 'asc')).toEqual([]);
  });

  it('returns single-item array unchanged', () => {
    const result = sortFluxJobs([jobA], 'id', 'asc');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('00001');
  });

  it('does not mutate the input array', () => {
    const input = [jobC, jobA, jobB];
    sortFluxJobs(input, 'id', 'asc');
    expect(input[0]!.id).toBe('00003'); // unchanged
  });
});
