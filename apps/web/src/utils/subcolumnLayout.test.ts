/**
 * Subcolumn Layout Utilities Tests
 * Tests for REQ-19: Provider column subcolumn layout
 */

import { describe, it, expect } from 'vitest';
import type { TaskAssignment } from '@flux/types';
import {
  timeRangesOverlap,
  findMaxConcurrent,
  findOverlappingAssignments,
  calculateSubcolumnLayout,
  getSubcolumnLayout,
} from './subcolumnLayout';

// Test fixtures
const createAssignment = (
  id: string,
  scheduledStart: string,
  scheduledEnd: string
): TaskAssignment => ({
  id,
  taskId: `task-${id}`,
  targetId: 'provider-1',
  isOutsourced: true,
  scheduledStart,
  scheduledEnd,
});

describe('timeRangesOverlap', () => {
  it('returns true for overlapping ranges', () => {
    const start1 = new Date('2025-01-01T08:00:00Z');
    const end1 = new Date('2025-01-01T12:00:00Z');
    const start2 = new Date('2025-01-01T10:00:00Z');
    const end2 = new Date('2025-01-01T14:00:00Z');

    expect(timeRangesOverlap(start1, end1, start2, end2)).toBe(true);
  });

  it('returns false for non-overlapping ranges', () => {
    const start1 = new Date('2025-01-01T08:00:00Z');
    const end1 = new Date('2025-01-01T10:00:00Z');
    const start2 = new Date('2025-01-01T12:00:00Z');
    const end2 = new Date('2025-01-01T14:00:00Z');

    expect(timeRangesOverlap(start1, end1, start2, end2)).toBe(false);
  });

  it('returns false for ranges that only touch at endpoints', () => {
    const start1 = new Date('2025-01-01T08:00:00Z');
    const end1 = new Date('2025-01-01T10:00:00Z');
    const start2 = new Date('2025-01-01T10:00:00Z');
    const end2 = new Date('2025-01-01T12:00:00Z');

    expect(timeRangesOverlap(start1, end1, start2, end2)).toBe(false);
  });

  it('returns true when one range contains another', () => {
    const start1 = new Date('2025-01-01T08:00:00Z');
    const end1 = new Date('2025-01-01T16:00:00Z');
    const start2 = new Date('2025-01-01T10:00:00Z');
    const end2 = new Date('2025-01-01T12:00:00Z');

    expect(timeRangesOverlap(start1, end1, start2, end2)).toBe(true);
  });
});

describe('findMaxConcurrent', () => {
  it('returns 0 for empty assignments', () => {
    expect(findMaxConcurrent([])).toBe(0);
  });

  it('returns 1 for single assignment', () => {
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T10:00:00Z'),
    ];
    expect(findMaxConcurrent(assignments)).toBe(1);
  });

  it('returns 2 for two overlapping assignments', () => {
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', '2025-01-01T10:00:00Z', '2025-01-01T14:00:00Z'),
    ];
    expect(findMaxConcurrent(assignments)).toBe(2);
  });

  it('returns 1 for non-overlapping assignments', () => {
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T10:00:00Z'),
      createAssignment('a2', '2025-01-01T10:00:00Z', '2025-01-01T12:00:00Z'),
    ];
    expect(findMaxConcurrent(assignments)).toBe(1);
  });

  it('returns 3 for three overlapping assignments', () => {
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', '2025-01-01T09:00:00Z', '2025-01-01T11:00:00Z'),
      createAssignment('a3', '2025-01-01T10:00:00Z', '2025-01-01T13:00:00Z'),
    ];
    expect(findMaxConcurrent(assignments)).toBe(3);
  });

  it('handles complex overlapping patterns', () => {
    // A: 08-12
    // B: 10-14
    // C: 11-13  <- 3 concurrent at 11:00
    // D: 14-16  <- only 1 at 14:00
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', '2025-01-01T10:00:00Z', '2025-01-01T14:00:00Z'),
      createAssignment('a3', '2025-01-01T11:00:00Z', '2025-01-01T13:00:00Z'),
      createAssignment('a4', '2025-01-01T14:00:00Z', '2025-01-01T16:00:00Z'),
    ];
    expect(findMaxConcurrent(assignments)).toBe(3);
  });
});

describe('findOverlappingAssignments', () => {
  it('returns empty array when no overlaps', () => {
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T10:00:00Z'),
      createAssignment('a2', '2025-01-01T12:00:00Z', '2025-01-01T14:00:00Z'),
    ];
    const result = findOverlappingAssignments(assignments[0], assignments);
    expect(result).toHaveLength(0);
  });

  it('returns overlapping assignments', () => {
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', '2025-01-01T10:00:00Z', '2025-01-01T14:00:00Z'),
      createAssignment('a3', '2025-01-01T16:00:00Z', '2025-01-01T18:00:00Z'),
    ];
    const result = findOverlappingAssignments(assignments[0], assignments);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a2');
  });

  it('excludes itself from results', () => {
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
    ];
    const result = findOverlappingAssignments(assignments[0], assignments);
    expect(result).toHaveLength(0);
  });
});

describe('calculateSubcolumnLayout', () => {
  it('returns empty map for empty assignments', () => {
    const result = calculateSubcolumnLayout([]);
    expect(result.size).toBe(0);
  });

  it('assigns single assignment to subcolumn 0 with full width', () => {
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T10:00:00Z'),
    ];
    const result = calculateSubcolumnLayout(assignments);

    expect(result.size).toBe(1);
    const layout = result.get('a1');
    expect(layout?.subcolumnIndex).toBe(0);
    expect(layout?.totalSubcolumns).toBe(1);
    expect(layout?.widthPercent).toBe(100);
    expect(layout?.leftPercent).toBe(0);
  });

  it('assigns overlapping assignments to different subcolumns', () => {
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', '2025-01-01T10:00:00Z', '2025-01-01T14:00:00Z'),
    ];
    const result = calculateSubcolumnLayout(assignments);

    expect(result.size).toBe(2);

    const layout1 = result.get('a1');
    const layout2 = result.get('a2');

    expect(layout1?.subcolumnIndex).toBe(0);
    expect(layout2?.subcolumnIndex).toBe(1);

    // Both should have 50% width
    expect(layout1?.widthPercent).toBe(50);
    expect(layout2?.widthPercent).toBe(50);

    // Left positions should be different
    expect(layout1?.leftPercent).toBe(0);
    expect(layout2?.leftPercent).toBe(50);
  });

  it('reuses subcolumn indices for non-overlapping assignments', () => {
    // A: 08-10
    // B: 10-12 (doesn't overlap with A, can reuse column 0)
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T10:00:00Z'),
      createAssignment('a2', '2025-01-01T10:00:00Z', '2025-01-01T12:00:00Z'),
    ];
    const result = calculateSubcolumnLayout(assignments);

    const layout1 = result.get('a1');
    const layout2 = result.get('a2');

    // Both should be in column 0 since they don't overlap
    expect(layout1?.subcolumnIndex).toBe(0);
    expect(layout2?.subcolumnIndex).toBe(0);

    // Full width since max concurrent is 1
    expect(layout1?.widthPercent).toBe(100);
    expect(layout2?.widthPercent).toBe(100);
  });

  it('handles three concurrent assignments', () => {
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', '2025-01-01T09:00:00Z', '2025-01-01T11:00:00Z'),
      createAssignment('a3', '2025-01-01T10:00:00Z', '2025-01-01T13:00:00Z'),
    ];
    const result = calculateSubcolumnLayout(assignments);

    // All three are concurrent, so each gets 33.33% width
    const layout1 = result.get('a1');
    const layout2 = result.get('a2');
    const layout3 = result.get('a3');

    expect(layout1?.subcolumnIndex).toBe(0);
    expect(layout2?.subcolumnIndex).toBe(1);
    expect(layout3?.subcolumnIndex).toBe(2);

    expect(layout1?.totalSubcolumns).toBe(3);
    expect(layout1?.widthPercent).toBeCloseTo(33.33, 1);
  });

  it('uses greedy algorithm for subcolumn assignment', () => {
    // A: 08-12 -> column 0
    // B: 10-14 -> column 1 (overlaps A)
    // C: 12-16 -> column 0 (doesn't overlap A anymore, reuses column 0)
    const assignments = [
      createAssignment('a1', '2025-01-01T08:00:00Z', '2025-01-01T12:00:00Z'),
      createAssignment('a2', '2025-01-01T10:00:00Z', '2025-01-01T14:00:00Z'),
      createAssignment('a3', '2025-01-01T12:00:00Z', '2025-01-01T16:00:00Z'),
    ];
    const result = calculateSubcolumnLayout(assignments);

    const layout1 = result.get('a1');
    const layout2 = result.get('a2');
    const layout3 = result.get('a3');

    expect(layout1?.subcolumnIndex).toBe(0);
    expect(layout2?.subcolumnIndex).toBe(1);
    // a3 starts when a1 ends, so it can reuse column 0
    expect(layout3?.subcolumnIndex).toBe(0);
  });
});

describe('getSubcolumnLayout', () => {
  it('returns layout from map when present', () => {
    const layoutMap = new Map();
    layoutMap.set('a1', {
      assignmentId: 'a1',
      subcolumnIndex: 1,
      totalSubcolumns: 3,
      widthPercent: 33.33,
      leftPercent: 33.33,
    });

    const result = getSubcolumnLayout('a1', layoutMap);
    expect(result.subcolumnIndex).toBe(1);
    expect(result.totalSubcolumns).toBe(3);
  });

  it('returns full-width default when not in map', () => {
    const layoutMap = new Map();
    const result = getSubcolumnLayout('unknown', layoutMap);

    expect(result.subcolumnIndex).toBe(0);
    expect(result.totalSubcolumns).toBe(1);
    expect(result.widthPercent).toBe(100);
    expect(result.leftPercent).toBe(0);
  });
});
