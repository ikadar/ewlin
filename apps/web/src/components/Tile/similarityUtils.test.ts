import { describe, it, expect } from 'vitest';
import { getFieldValue, valuesMatch, compareSimilarity } from './similarityUtils';
import type { Job, SimilarityCriterion } from '@flux/types';

// Minimal mock job for testing
const createMockJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  reference: '12345',
  client: 'Test Client',
  description: 'Test Job',
  status: 'Planned',
  workshopExitDate: new Date().toISOString(),
  color: '#8B5CF6',
  paperPurchaseStatus: 'InStock',
  platesStatus: 'Done',
  proofSentAt: null,
  proofApprovedAt: null,
  requiredJobIds: [],
  ...overrides,
});

describe('getFieldValue', () => {
  it('returns direct property value', () => {
    const job = createMockJob({ reference: 'ABC123' });
    expect(getFieldValue(job, 'reference')).toBe('ABC123');
  });

  it('returns undefined for non-existent property', () => {
    const job = createMockJob();
    expect(getFieldValue(job, 'nonExistent')).toBeUndefined();
  });

  it('handles nested paths', () => {
    const job = createMockJob();
    // Add nested property for testing
    (job as Record<string, unknown>).details = { paperType: 'CB 300g' };
    expect(getFieldValue(job, 'details.paperType')).toBe('CB 300g');
  });

  it('returns undefined for deeply nested non-existent path', () => {
    const job = createMockJob();
    expect(getFieldValue(job, 'details.paperType')).toBeUndefined();
  });

  it('handles null intermediate values', () => {
    const job = createMockJob();
    (job as Record<string, unknown>).details = null;
    expect(getFieldValue(job, 'details.paperType')).toBeUndefined();
  });

  it('returns client field correctly', () => {
    const job = createMockJob({ client: 'Autosphere' });
    expect(getFieldValue(job, 'client')).toBe('Autosphere');
  });
});

describe('valuesMatch', () => {
  it('returns true when both values are null', () => {
    expect(valuesMatch(null, null)).toBe(true);
  });

  it('returns true when both values are undefined', () => {
    expect(valuesMatch(undefined, undefined)).toBe(true);
  });

  it('returns true when one is null and one is undefined', () => {
    expect(valuesMatch(null, undefined)).toBe(true);
  });

  it('returns false when one is null and one has value', () => {
    expect(valuesMatch(null, 'value')).toBe(false);
    expect(valuesMatch('value', null)).toBe(false);
  });

  it('returns false when one is undefined and one has value', () => {
    expect(valuesMatch(undefined, 'value')).toBe(false);
    expect(valuesMatch('value', undefined)).toBe(false);
  });

  it('returns true when string values are equal', () => {
    expect(valuesMatch('CB 300g', 'CB 300g')).toBe(true);
  });

  it('returns false when string values differ', () => {
    expect(valuesMatch('CB 300g', 'CB 135g')).toBe(false);
  });

  it('returns true when number values are equal', () => {
    expect(valuesMatch(100, 100)).toBe(true);
  });

  it('returns false when number values differ', () => {
    expect(valuesMatch(100, 200)).toBe(false);
  });

  it('returns true when boolean values are equal', () => {
    expect(valuesMatch(true, true)).toBe(true);
    expect(valuesMatch(false, false)).toBe(true);
  });

  it('returns false when boolean values differ', () => {
    expect(valuesMatch(true, false)).toBe(false);
  });
});

describe('compareSimilarity', () => {
  const mockCriteria: SimilarityCriterion[] = [
    { id: 'crit-1', name: 'Same paper type', fieldPath: 'paperType' },
    { id: 'crit-2', name: 'Same client', fieldPath: 'client' },
    { id: 'crit-3', name: 'Same color', fieldPath: 'color' },
  ];

  it('returns empty array when no criteria provided', () => {
    const jobA = createMockJob();
    const jobB = createMockJob();
    expect(compareSimilarity(jobA, jobB, [])).toEqual([]);
  });

  it('returns correct number of results', () => {
    const jobA = createMockJob();
    const jobB = createMockJob();
    const results = compareSimilarity(jobA, jobB, mockCriteria);
    expect(results).toHaveLength(3);
  });

  it('marks matching values as matched', () => {
    const jobA = createMockJob({ client: 'Same Client' });
    const jobB = createMockJob({ client: 'Same Client' });
    const results = compareSimilarity(jobA, jobB, [
      { id: 'crit-1', name: 'Same client', fieldPath: 'client' },
    ]);
    expect(results[0].isMatched).toBe(true);
    expect(results[0].criterion.name).toBe('Same client');
  });

  it('marks different values as not matched', () => {
    const jobA = createMockJob({ client: 'Client A' });
    const jobB = createMockJob({ client: 'Client B' });
    const results = compareSimilarity(jobA, jobB, [
      { id: 'crit-1', name: 'Same client', fieldPath: 'client' },
    ]);
    expect(results[0].isMatched).toBe(false);
  });

  it('handles mixed matching and non-matching criteria', () => {
    const jobA = createMockJob({ client: 'Same', color: '#8B5CF6' });
    const jobB = createMockJob({ client: 'Same', color: '#F43F5E' });
    (jobA as Record<string, unknown>).paperType = 'CB 300g';
    (jobB as Record<string, unknown>).paperType = 'CB 300g';

    const results = compareSimilarity(jobA, jobB, mockCriteria);

    // paperType matches
    expect(results[0].isMatched).toBe(true);
    // client matches
    expect(results[1].isMatched).toBe(true);
    // color differs
    expect(results[2].isMatched).toBe(false);
  });

  it('treats both null/undefined values as matched', () => {
    const jobA = createMockJob();
    const jobB = createMockJob();
    // Neither job has paperType defined
    const results = compareSimilarity(jobA, jobB, [
      { id: 'crit-1', name: 'Same paper type', fieldPath: 'paperType' },
    ]);
    expect(results[0].isMatched).toBe(true);
  });

  it('treats one null one value as not matched', () => {
    const jobA = createMockJob();
    const jobB = createMockJob();
    (jobA as Record<string, unknown>).paperType = 'CB 300g';
    // jobB has no paperType
    const results = compareSimilarity(jobA, jobB, [
      { id: 'crit-1', name: 'Same paper type', fieldPath: 'paperType' },
    ]);
    expect(results[0].isMatched).toBe(false);
  });

  it('preserves criterion reference in results', () => {
    const jobA = createMockJob();
    const jobB = createMockJob();
    const criterion: SimilarityCriterion = {
      id: 'crit-test',
      name: 'Test Criterion',
      fieldPath: 'reference',
    };
    const results = compareSimilarity(jobA, jobB, [criterion]);
    expect(results[0].criterion).toBe(criterion);
  });
});
