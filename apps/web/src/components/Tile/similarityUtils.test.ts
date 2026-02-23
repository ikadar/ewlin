import { describe, it, expect } from 'vitest';
import { getFieldValue, valuesMatch, compareSimilarity } from './similarityUtils';
import type { ElementSpec, SimilarityCriterion } from '@flux/types';

// Minimal mock element spec for testing
const createMockSpec = (overrides: Partial<ElementSpec> = {}): ElementSpec => ({
  ...overrides,
});

describe('getFieldValue', () => {
  it('returns direct property value', () => {
    const spec = createMockSpec({ papier: 'Couché mat:135' });
    expect(getFieldValue(spec, 'papier')).toBe('Couché mat:135');
  });

  it('returns undefined for non-existent property', () => {
    const spec = createMockSpec();
    expect(getFieldValue(spec, 'nonExistent')).toBeUndefined();
  });

  it('handles nested paths', () => {
    const spec = createMockSpec();
    (spec as Record<string, unknown>).nested = { value: 'test' };
    expect(getFieldValue(spec, 'nested.value')).toBe('test');
  });

  it('returns undefined for deeply nested non-existent path', () => {
    const spec = createMockSpec();
    expect(getFieldValue(spec, 'nested.value')).toBeUndefined();
  });

  it('handles null intermediate values', () => {
    const spec = createMockSpec();
    (spec as Record<string, unknown>).nested = null;
    expect(getFieldValue(spec, 'nested.value')).toBeUndefined();
  });

  it('returns format field correctly', () => {
    const spec = createMockSpec({ format: 'A4' });
    expect(getFieldValue(spec, 'format')).toBe('A4');
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
    expect(valuesMatch('Couché mat:135', 'Couché mat:135')).toBe(true);
  });

  it('returns false when string values differ', () => {
    expect(valuesMatch('Couché mat:135', 'Couché mat:300')).toBe(false);
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
    { name: 'Même type de papier', fieldPath: 'papier' },
    { name: 'Même format', fieldPath: 'format' },
    { name: 'Même encrage', fieldPath: 'impression' },
  ];

  it('returns empty array when no criteria provided', () => {
    const specA = createMockSpec();
    const specB = createMockSpec();
    expect(compareSimilarity(specA, specB, [])).toEqual([]);
  });

  it('returns correct number of results', () => {
    const specA = createMockSpec();
    const specB = createMockSpec();
    const results = compareSimilarity(specA, specB, mockCriteria);
    expect(results).toHaveLength(3);
  });

  it('marks matching values as matched', () => {
    const specA = createMockSpec({ format: 'A4' });
    const specB = createMockSpec({ format: 'A4' });
    const results = compareSimilarity(specA, specB, [
      { name: 'Même format', fieldPath: 'format' },
    ]);
    expect(results[0].isMatched).toBe(true);
    expect(results[0].criterion.name).toBe('Même format');
  });

  it('marks different values as not matched', () => {
    const specA = createMockSpec({ format: 'A4' });
    const specB = createMockSpec({ format: '210x297' });
    const results = compareSimilarity(specA, specB, [
      { name: 'Même format', fieldPath: 'format' },
    ]);
    expect(results[0].isMatched).toBe(false);
  });

  it('handles mixed matching and non-matching criteria', () => {
    const specA = createMockSpec({ papier: 'Couché mat:135', format: 'A4', impression: 'Q/Q' });
    const specB = createMockSpec({ papier: 'Couché mat:135', format: '70x100', impression: 'Q/Q' });

    const results = compareSimilarity(specA, specB, mockCriteria);

    // papier matches
    expect(results[0].isMatched).toBe(true);
    // format differs
    expect(results[1].isMatched).toBe(false);
    // impression matches
    expect(results[2].isMatched).toBe(true);
  });

  it('treats both null/undefined values as matched', () => {
    const specA = createMockSpec();
    const specB = createMockSpec();
    // Neither spec has papier defined
    const results = compareSimilarity(specA, specB, [
      { name: 'Même type de papier', fieldPath: 'papier' },
    ]);
    expect(results[0].isMatched).toBe(true);
  });

  it('treats one null one value as not matched', () => {
    const specA = createMockSpec({ papier: 'Couché mat:135' });
    const specB = createMockSpec();
    const results = compareSimilarity(specA, specB, [
      { name: 'Même type de papier', fieldPath: 'papier' },
    ]);
    expect(results[0].isMatched).toBe(false);
  });

  it('preserves criterion reference in results', () => {
    const specA = createMockSpec();
    const specB = createMockSpec();
    const criterion: SimilarityCriterion = {
      name: 'Test Criterion',
      fieldPath: 'format',
    };
    const results = compareSimilarity(specA, specB, [criterion]);
    expect(results[0].criterion).toBe(criterion);
  });

  describe('papier comparison (paper type + weight)', () => {
    const papierCriterion: SimilarityCriterion = {
      name: 'Même type de papier',
      fieldPath: 'papier',
    };

    it('marks matching papier as matched', () => {
      const specA = createMockSpec({ papier: 'Couché mat:300' });
      const specB = createMockSpec({ papier: 'Couché mat:300' });
      const results = compareSimilarity(specA, specB, [papierCriterion]);
      expect(results[0].isMatched).toBe(true);
    });

    it('marks different papier as not matched', () => {
      const specA = createMockSpec({ papier: 'Couché mat:300' });
      const specB = createMockSpec({ papier: 'Offset:170' });
      const results = compareSimilarity(specA, specB, [papierCriterion]);
      expect(results[0].isMatched).toBe(false);
    });

    it('marks one undefined papier as not matched', () => {
      const specA = createMockSpec({ papier: 'Couché mat:300' });
      const specB = createMockSpec();
      const results = compareSimilarity(specA, specB, [papierCriterion]);
      expect(results[0].isMatched).toBe(false);
    });
  });

  describe('impression comparison (inking)', () => {
    const impressionCriterion: SimilarityCriterion = {
      name: 'Même encrage',
      fieldPath: 'impression',
    };

    it('marks matching impression as matched', () => {
      const specA = createMockSpec({ impression: 'Q/Q' });
      const specB = createMockSpec({ impression: 'Q/Q' });
      const results = compareSimilarity(specA, specB, [impressionCriterion]);
      expect(results[0].isMatched).toBe(true);
    });

    it('marks different impression as not matched', () => {
      const specA = createMockSpec({ impression: 'Q/Q' });
      const specB = createMockSpec({ impression: 'Q+V/' });
      const results = compareSimilarity(specA, specB, [impressionCriterion]);
      expect(results[0].isMatched).toBe(false);
    });

    it('marks one undefined impression as not matched', () => {
      const specA = createMockSpec({ impression: 'Q/Q' });
      const specB = createMockSpec();
      const results = compareSimilarity(specA, specB, [impressionCriterion]);
      expect(results[0].isMatched).toBe(false);
    });
  });

  describe('offset press criteria', () => {
    const offsetPressCriteria: SimilarityCriterion[] = [
      { name: 'Même type de papier', fieldPath: 'papier' },
      { name: 'Même format', fieldPath: 'format' },
      { name: 'Même encrage', fieldPath: 'impression' },
    ];

    it('compares all offset press criteria correctly', () => {
      const specA = createMockSpec({
        papier: 'Couché mat:300',
        format: '63x88',
        impression: 'Q/Q',
      });
      const specB = createMockSpec({
        papier: 'Couché mat:300',
        format: '70x100', // different
        impression: 'Q/Q',
      });
      const results = compareSimilarity(specA, specB, offsetPressCriteria);

      expect(results[0].isMatched).toBe(true);  // papier matches
      expect(results[1].isMatched).toBe(false); // format differs
      expect(results[2].isMatched).toBe(true);  // impression matches
    });

    it('shows real differences when impression values differ', () => {
      const specA = createMockSpec({ impression: 'Q/Q' });
      const specB = createMockSpec({ impression: 'Q+V/' });
      const results = compareSimilarity(specA, specB, [
        { name: 'Même encrage', fieldPath: 'impression' },
      ]);
      expect(results[0].isMatched).toBe(false);
    });
  });
});
