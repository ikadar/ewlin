import { describe, it, expect } from 'vitest';
import { tileSpecSimilarity, scoreSimilarity, allPrecedenceSatisfied } from '../../src/reorder.js';
import type { Tile } from '../../src/types.js';
import type { SimilarityCriterion } from '@flux/types';

// Helper to build a minimal tile for testing
function makeTile(overrides: Partial<Tile> & { taskId: string; elementId: string; sequenceOrder: number; spec: Record<string, unknown> }): Tile {
  return {
    assignment: { taskId: overrides.taskId, targetId: 'st-1', isOutsourced: false, scheduledStart: '2026-01-01T08:00:00Z', scheduledEnd: '2026-01-01T09:00:00Z', isCompleted: false, completedAt: null, id: 'a-1', createdAt: '', updatedAt: '' },
    task: { id: overrides.taskId, elementId: overrides.elementId, sequenceOrder: overrides.sequenceOrder, status: 'Assigned', type: 'Internal', stationId: 'st-1', duration: { setupMinutes: 10, runMinutes: 50 }, createdAt: '', updatedAt: '' },
    jobId: overrides.jobId ?? 'job-1',
    deadline: overrides.deadline ?? null,
    ...overrides,
  } as Tile;
}

const criteria: SimilarityCriterion[] = [
  { name: 'Paper', fieldPath: 'papier' },
  { name: 'Format', fieldPath: 'format' },
];

describe('tileSpecSimilarity', () => {
  it('counts matching non-null fields', () => {
    expect(tileSpecSimilarity(
      { papier: 'mat', format: 'A4' },
      { papier: 'mat', format: 'A4' },
      criteria,
    )).toBe(2);
  });

  it('returns 0 for no matches', () => {
    expect(tileSpecSimilarity(
      { papier: 'mat', format: 'A4' },
      { papier: 'brillant', format: 'A3' },
      criteria,
    )).toBe(0);
  });

  it('skips null values', () => {
    expect(tileSpecSimilarity(
      { papier: 'mat' },
      { papier: 'mat', format: 'A4' },
      criteria,
    )).toBe(1);
  });

  it('returns 0 for empty specs', () => {
    expect(tileSpecSimilarity({}, {}, criteria)).toBe(0);
  });
});

describe('scoreSimilarity', () => {
  it('sums consecutive pair similarity', () => {
    const tiles = [
      makeTile({ taskId: 't1', elementId: 'e1', sequenceOrder: 0, spec: { papier: 'mat', format: 'A4' } }),
      makeTile({ taskId: 't2', elementId: 'e2', sequenceOrder: 0, spec: { papier: 'mat', format: 'A4' } }),
      makeTile({ taskId: 't3', elementId: 'e3', sequenceOrder: 0, spec: { papier: 'brillant', format: 'A3' } }),
    ];
    // t1↔t2 = 2, t2↔t3 = 0
    expect(scoreSimilarity(tiles, criteria)).toBe(2);
  });

  it('returns 0 for single tile', () => {
    const tiles = [makeTile({ taskId: 't1', elementId: 'e1', sequenceOrder: 0, spec: { papier: 'mat' } })];
    expect(scoreSimilarity(tiles, criteria)).toBe(0);
  });
});

describe('allPrecedenceSatisfied', () => {
  it('accepts correct intra-element order', () => {
    const tiles = [
      makeTile({ taskId: 't1', elementId: 'e1', sequenceOrder: 0, spec: {} }),
      makeTile({ taskId: 't2', elementId: 'e1', sequenceOrder: 1, spec: {} }),
    ];
    expect(allPrecedenceSatisfied(tiles)).toBe(true);
  });

  it('rejects incorrect intra-element order', () => {
    const tiles = [
      makeTile({ taskId: 't2', elementId: 'e1', sequenceOrder: 1, spec: {} }),
      makeTile({ taskId: 't1', elementId: 'e1', sequenceOrder: 0, spec: {} }),
    ];
    expect(allPrecedenceSatisfied(tiles)).toBe(false);
  });

  it('accepts independent elements in any order', () => {
    const tiles = [
      makeTile({ taskId: 't2', elementId: 'e2', sequenceOrder: 0, spec: {} }),
      makeTile({ taskId: 't1', elementId: 'e1', sequenceOrder: 0, spec: {} }),
    ];
    expect(allPrecedenceSatisfied(tiles)).toBe(true);
  });
});
