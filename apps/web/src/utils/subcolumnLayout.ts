/**
 * Subcolumn Layout Utilities
 *
 * For provider columns with unlimited capacity, overlapping tasks
 * are displayed side by side in subcolumns (calendar-style layout).
 */

import type { TaskAssignment } from '@flux/types';

/** Layout information for a single assignment in a subcolumn */
export interface SubcolumnLayout {
  /** Assignment ID */
  assignmentId: string;
  /** Subcolumn index (0-based, from left) */
  subcolumnIndex: number;
  /** Total number of subcolumns in this time range */
  totalSubcolumns: number;
  /** Width as percentage (100 / totalSubcolumns) */
  widthPercent: number;
  /** Left position as percentage (subcolumnIndex * widthPercent) */
  leftPercent: number;
}

/**
 * Check if two time ranges overlap.
 * Ranges are considered overlapping if they share any time period.
 * Note: Ranges that only touch at endpoints (end === start) do NOT overlap.
 */
export function timeRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Find the maximum number of concurrent assignments at any point in time.
 */
export function findMaxConcurrent(assignments: TaskAssignment[]): number {
  if (assignments.length === 0) return 0;
  if (assignments.length === 1) return 1;

  // Collect all time boundaries
  const events: Array<{ time: number; type: 'start' | 'end' }> = [];

  assignments.forEach((assignment) => {
    const start = new Date(assignment.scheduledStart).getTime();
    const end = new Date(assignment.scheduledEnd).getTime();
    events.push({ time: start, type: 'start' });
    events.push({ time: end, type: 'end' });
  });

  // Sort by time, with 'end' events before 'start' events at the same time
  // This ensures that tasks that only touch at endpoints don't count as concurrent
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return a.type === 'end' ? -1 : 1;
  });

  let current = 0;
  let maxConcurrent = 0;

  events.forEach((event) => {
    if (event.type === 'start') {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
    } else {
      current--;
    }
  });

  return maxConcurrent;
}

/**
 * Find all assignments that overlap with a given assignment.
 */
export function findOverlappingAssignments(
  assignment: TaskAssignment,
  allAssignments: TaskAssignment[]
): TaskAssignment[] {
  const start = new Date(assignment.scheduledStart);
  const end = new Date(assignment.scheduledEnd);

  return allAssignments.filter((other) => {
    if (other.id === assignment.id) return false;
    const otherStart = new Date(other.scheduledStart);
    const otherEnd = new Date(other.scheduledEnd);
    return timeRangesOverlap(start, end, otherStart, otherEnd);
  });
}

/**
 * Assign subcolumn indices to assignments using a greedy algorithm.
 * Each assignment gets the first available (lowest) subcolumn index
 * that doesn't conflict with overlapping assignments.
 *
 * @param assignments - Assignments to layout (should be for a single provider)
 * @returns Map of assignment ID to SubcolumnLayout
 */
export function calculateSubcolumnLayout(
  assignments: TaskAssignment[]
): Map<string, SubcolumnLayout> {
  const result = new Map<string, SubcolumnLayout>();

  if (assignments.length === 0) return result;

  // Sort assignments by start time, then by end time
  const sorted = [...assignments].sort((a, b) => {
    const startDiff =
      new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
    if (startDiff !== 0) return startDiff;
    return new Date(a.scheduledEnd).getTime() - new Date(b.scheduledEnd).getTime();
  });

  // Track assigned subcolumn indices
  const assignmentIndices = new Map<string, number>();

  // For each assignment, find the first available subcolumn
  sorted.forEach((assignment) => {
    const overlapping = findOverlappingAssignments(assignment, sorted);
    const usedIndices = new Set<number>();

    // Collect indices used by overlapping assignments that have already been assigned
    overlapping.forEach((other) => {
      const idx = assignmentIndices.get(other.id);
      if (idx !== undefined) {
        usedIndices.add(idx);
      }
    });

    // Find the first available index (greedy)
    let subcolumnIndex = 0;
    while (usedIndices.has(subcolumnIndex)) {
      subcolumnIndex++;
    }

    assignmentIndices.set(assignment.id, subcolumnIndex);
  });

  // Calculate the maximum number of subcolumns needed
  const maxSubcolumns = findMaxConcurrent(assignments);
  const totalSubcolumns = Math.max(1, maxSubcolumns);

  // Build the result map with layout info
  assignmentIndices.forEach((subcolumnIndex, assignmentId) => {
    const widthPercent = 100 / totalSubcolumns;
    const leftPercent = subcolumnIndex * widthPercent;

    result.set(assignmentId, {
      assignmentId,
      subcolumnIndex,
      totalSubcolumns,
      widthPercent,
      leftPercent,
    });
  });

  return result;
}

/**
 * Get layout for a single assignment within a provider column.
 * If the assignment is not in the layout map, returns full-width layout.
 */
export function getSubcolumnLayout(
  assignmentId: string,
  layoutMap: Map<string, SubcolumnLayout>
): SubcolumnLayout {
  return layoutMap.get(assignmentId) ?? {
    assignmentId,
    subcolumnIndex: 0,
    totalSubcolumns: 1,
    widthPercent: 100,
    leftPercent: 0,
  };
}
