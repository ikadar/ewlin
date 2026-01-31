/**
 * Element Generators
 * Generate mock elements for testing.
 *
 * For v0.4.0, each Job has exactly one Element (1:1 relationship).
 * This mirrors what the backend migration will do.
 */

import type { Element, PaperStatus, BatStatus, PlateStatus, FormeStatus } from '@flux/types';

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
  name?: string;
  label?: string;
  /** Paper availability status (defaults to 'in_stock') */
  paperStatus?: PaperStatus;
  /** BAT approval status (defaults to 'bat_approved') */
  batStatus?: BatStatus;
  /** Plates preparation status (defaults to 'ready') */
  plateStatus?: PlateStatus;
  /** Forme (die-cutting tool) status (defaults to 'none') */
  formeStatus?: FormeStatus;
}

/**
 * Create an Element for a Job.
 * For v0.4.0, each Job has exactly one Element containing all its Tasks.
 */
export function createElement(options: CreateElementOptions): Element {
  const {
    jobId,
    taskIds,
    name = 'ELT',
    label,
    paperStatus = 'in_stock',
    batStatus = 'bat_approved',
    plateStatus = 'ready',
    formeStatus = 'none',
  } = options;
  const now = new Date();

  // Element ID is derived from job ID for deterministic testing
  const elementId = `elem-${jobId}`;

  return {
    id: elementId,
    jobId,
    name,
    label,
    prerequisiteElementIds: [],
    taskIds,
    spec: undefined,
    paperStatus,
    batStatus,
    plateStatus,
    formeStatus,
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
