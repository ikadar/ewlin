/**
 * Element Generators
 * Generate mock elements for testing.
 *
 * For v0.4.0, each Job has exactly one Element (1:1 relationship).
 * This mirrors what the backend migration will do.
 */

import type { Element } from '@flux/types';

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

// ============================================================================
// Element Generators
// ============================================================================

interface CreateElementOptions {
  jobId: string;
  taskIds: string[];
  suffix?: string;
  label?: string;
}

/**
 * Create an Element for a Job.
 * For v0.4.0, each Job has exactly one Element containing all its Tasks.
 */
export function createElement(options: CreateElementOptions): Element {
  const { jobId, taskIds, suffix = 'ELT', label } = options;
  const now = new Date();

  // Element ID is derived from job ID for deterministic testing
  const elementId = `elem-${jobId}`;

  return {
    id: elementId,
    jobId,
    suffix,
    label,
    prerequisiteElementIds: [],
    taskIds,
    createdAt: formatTimestamp(now),
    updatedAt: formatTimestamp(now),
  };
}

/**
 * Get element ID for a job (deterministic derivation).
 * Used when creating tasks to set their elementId.
 */
export function getElementIdForJob(jobId: string): string {
  return `elem-${jobId}`;
}
