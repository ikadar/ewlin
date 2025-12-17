/**
 * Similarity comparison utilities for job property matching.
 */

import type { Job, SimilarityCriterion } from '@flux/types';

/** Result of comparing a single criterion between two jobs */
export interface SimilarityResult {
  /** Criterion being compared */
  criterion: SimilarityCriterion;
  /** Whether the criterion is matched */
  isMatched: boolean;
}

/**
 * Get a value from a job object at a given field path.
 * Supports nested paths like "details.paperType".
 */
export function getFieldValue(job: Job, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let value: unknown = job;

  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'object') {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Compare two values for similarity.
 * Per BR-CATEGORY-003:
 * - Both null/undefined → matched
 * - One null, one has value → not matched
 * - Equal values → matched
 * - Different values → not matched
 */
export function valuesMatch(valueA: unknown, valueB: unknown): boolean {
  const aIsNullish = valueA === null || valueA === undefined;
  const bIsNullish = valueB === null || valueB === undefined;

  // Both null/undefined → matched
  if (aIsNullish && bIsNullish) {
    return true;
  }

  // One null, one has value → not matched
  if (aIsNullish || bIsNullish) {
    return false;
  }

  // Compare values
  return valueA === valueB;
}

/**
 * Compare two jobs against a list of similarity criteria.
 * Returns an array of results indicating which criteria are matched.
 */
export function compareSimilarity(
  jobA: Job,
  jobB: Job,
  criteria: SimilarityCriterion[]
): SimilarityResult[] {
  return criteria.map((criterion) => {
    const valueA = getFieldValue(jobA, criterion.fieldPath);
    const valueB = getFieldValue(jobB, criterion.fieldPath);
    const isMatched = valuesMatch(valueA, valueB);

    return {
      criterion,
      isMatched,
    };
  });
}
