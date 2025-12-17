import { describe, it, expect } from 'vitest';
import { applyPushDown, wouldCauseOverlap } from './pushDown';
import type { TaskAssignment } from '@flux/types';

// Helper to create a mock assignment
function createMockAssignment(
  id: string,
  taskId: string,
  stationId: string,
  scheduledStart: string,
  scheduledEnd: string
): TaskAssignment {
  return {
    id,
    taskId,
    targetId: stationId,
    isOutsourced: false,
    scheduledStart,
    scheduledEnd,
    isCompleted: false,
    completedAt: null,
    createdAt: '2025-12-16T10:00:00Z',
    updatedAt: '2025-12-16T10:00:00Z',
  };
}

describe('applyPushDown', () => {
  it('shifts assignments that start after the new tile', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:00:00Z', '2025-12-16T11:00:00Z'),
      createMockAssignment('a2', 't2', 'station-1', '2025-12-16T11:00:00Z', '2025-12-16T12:00:00Z'),
    ];

    // Insert new tile at 10:00-11:00, should push a1 and a2
    const result = applyPushDown(
      assignments,
      'station-1',
      '2025-12-16T10:00:00Z',
      '2025-12-16T11:00:00Z',
      'new-task'
    );

    expect(result.shiftedIds).toContain('a1');
    expect(result.shiftedIds).toContain('a2');
    expect(result.updatedAssignments.find(a => a.id === 'a1')?.scheduledStart).toBe('2025-12-16T11:00:00.000Z');
    expect(result.updatedAssignments.find(a => a.id === 'a2')?.scheduledStart).toBe('2025-12-16T12:00:00.000Z');
  });

  it('does not shift assignments before the new tile', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T08:00:00Z', '2025-12-16T09:00:00Z'),
      createMockAssignment('a2', 't2', 'station-1', '2025-12-16T11:00:00Z', '2025-12-16T12:00:00Z'),
    ];

    // Insert new tile at 10:00-11:00
    // a1 (08:00-09:00) is before new tile, not shifted
    // a2 (11:00-12:00) starts exactly when new tile ends - no overlap, not shifted
    const result = applyPushDown(
      assignments,
      'station-1',
      '2025-12-16T10:00:00Z',
      '2025-12-16T11:00:00Z',
      'new-task'
    );

    expect(result.shiftedIds).not.toContain('a1');
    expect(result.shiftedIds).not.toContain('a2'); // No overlap, no shift needed
    expect(result.updatedAssignments.find(a => a.id === 'a1')?.scheduledStart).toBe('2025-12-16T08:00:00Z');
    expect(result.updatedAssignments.find(a => a.id === 'a2')?.scheduledStart).toBe('2025-12-16T11:00:00Z');
  });

  it('does not shift assignments on other stations', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:00:00Z', '2025-12-16T11:00:00Z'),
      createMockAssignment('a2', 't2', 'station-2', '2025-12-16T10:00:00Z', '2025-12-16T11:00:00Z'),
    ];

    // Insert new tile at station-1
    const result = applyPushDown(
      assignments,
      'station-1',
      '2025-12-16T10:00:00Z',
      '2025-12-16T11:00:00Z',
      'new-task'
    );

    expect(result.shiftedIds).toContain('a1');
    expect(result.shiftedIds).not.toContain('a2');
    expect(result.updatedAssignments.find(a => a.id === 'a2')?.scheduledStart).toBe('2025-12-16T10:00:00Z');
  });

  it('excludes the task being assigned (reschedule scenario)', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:00:00Z', '2025-12-16T11:00:00Z'),
    ];

    // Reschedule t1 to same position
    const result = applyPushDown(
      assignments,
      'station-1',
      '2025-12-16T10:00:00Z',
      '2025-12-16T11:00:00Z',
      't1' // Exclude t1
    );

    expect(result.shiftedIds).not.toContain('a1');
  });

  it('shifts overlapping assignments', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:30:00Z', '2025-12-16T11:30:00Z'),
    ];

    // Insert new tile that overlaps with a1
    const result = applyPushDown(
      assignments,
      'station-1',
      '2025-12-16T10:00:00Z',
      '2025-12-16T11:00:00Z',
      'new-task'
    );

    expect(result.shiftedIds).toContain('a1');
  });

  it('shifts tile correctly when dropping onto middle of existing tile', () => {
    const assignments: TaskAssignment[] = [
      // Existing tile: 10:00 - 12:00 (2 hours)
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:00:00Z', '2025-12-16T12:00:00Z'),
    ];

    // Drop new tile at 11:00-11:30 (30 min) - in the MIDDLE of existing tile
    const result = applyPushDown(
      assignments,
      'station-1',
      '2025-12-16T11:00:00Z',
      '2025-12-16T11:30:00Z',
      'new-task'
    );

    // Existing tile should shift to start at new tile's END (11:30), not original + duration
    expect(result.shiftedIds).toContain('a1');
    const shiftedA1 = result.updatedAssignments.find(a => a.id === 'a1');
    expect(shiftedA1?.scheduledStart).toBe('2025-12-16T11:30:00.000Z');
    expect(shiftedA1?.scheduledEnd).toBe('2025-12-16T13:30:00.000Z'); // Preserves 2h duration
  });

  it('cascades shifts correctly with multiple tiles', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:00:00Z', '2025-12-16T11:00:00Z'),
      createMockAssignment('a2', 't2', 'station-1', '2025-12-16T11:00:00Z', '2025-12-16T12:00:00Z'),
      createMockAssignment('a3', 't3', 'station-1', '2025-12-16T12:00:00Z', '2025-12-16T13:00:00Z'),
    ];

    // Drop new tile at 10:30-11:00 - overlaps with a1
    const result = applyPushDown(
      assignments,
      'station-1',
      '2025-12-16T10:30:00Z',
      '2025-12-16T11:00:00Z',
      'new-task'
    );

    // a1 overlaps, shifts to 11:00-12:00
    // a2 would then overlap with shifted a1, shifts to 12:00-13:00
    // a3 would then overlap with shifted a2, shifts to 13:00-14:00
    expect(result.shiftedIds).toEqual(['a1', 'a2', 'a3']);
    expect(result.updatedAssignments.find(a => a.id === 'a1')?.scheduledStart).toBe('2025-12-16T11:00:00.000Z');
    expect(result.updatedAssignments.find(a => a.id === 'a2')?.scheduledStart).toBe('2025-12-16T12:00:00.000Z');
    expect(result.updatedAssignments.find(a => a.id === 'a3')?.scheduledStart).toBe('2025-12-16T13:00:00.000Z');
  });

  it('does not shift outsourced assignments', () => {
    const outsourcedAssignment: TaskAssignment = {
      ...createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:00:00Z', '2025-12-16T11:00:00Z'),
      isOutsourced: true,
    };

    const result = applyPushDown(
      [outsourcedAssignment],
      'station-1',
      '2025-12-16T10:00:00Z',
      '2025-12-16T11:00:00Z',
      'new-task'
    );

    expect(result.shiftedIds).not.toContain('a1');
  });

  it('returns empty shiftedIds when no shifts needed', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T08:00:00Z', '2025-12-16T09:00:00Z'),
    ];

    // Insert new tile after all existing assignments
    const result = applyPushDown(
      assignments,
      'station-1',
      '2025-12-16T12:00:00Z',
      '2025-12-16T13:00:00Z',
      'new-task'
    );

    expect(result.shiftedIds).toHaveLength(0);
  });
});

describe('wouldCauseOverlap', () => {
  it('returns true when new tile overlaps with existing', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:00:00Z', '2025-12-16T11:00:00Z'),
    ];

    const result = wouldCauseOverlap(
      assignments,
      'station-1',
      '2025-12-16T10:30:00Z',
      '2025-12-16T11:30:00Z',
      'new-task'
    );

    expect(result).toBe(true);
  });

  it('returns false when no overlap', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:00:00Z', '2025-12-16T11:00:00Z'),
    ];

    const result = wouldCauseOverlap(
      assignments,
      'station-1',
      '2025-12-16T12:00:00Z',
      '2025-12-16T13:00:00Z',
      'new-task'
    );

    expect(result).toBe(false);
  });

  it('returns false for different station', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:00:00Z', '2025-12-16T11:00:00Z'),
    ];

    const result = wouldCauseOverlap(
      assignments,
      'station-2',
      '2025-12-16T10:30:00Z',
      '2025-12-16T11:30:00Z',
      'new-task'
    );

    expect(result).toBe(false);
  });

  it('returns false when excluding the same task', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T10:00:00Z', '2025-12-16T11:00:00Z'),
    ];

    const result = wouldCauseOverlap(
      assignments,
      'station-1',
      '2025-12-16T10:00:00Z',
      '2025-12-16T11:00:00Z',
      't1'
    );

    expect(result).toBe(false);
  });

  it('detects edge case: new tile ends exactly when existing starts', () => {
    const assignments: TaskAssignment[] = [
      createMockAssignment('a1', 't1', 'station-1', '2025-12-16T11:00:00Z', '2025-12-16T12:00:00Z'),
    ];

    // New tile ends exactly when existing starts - no overlap
    const result = wouldCauseOverlap(
      assignments,
      'station-1',
      '2025-12-16T10:00:00Z',
      '2025-12-16T11:00:00Z',
      'new-task'
    );

    expect(result).toBe(false);
  });
});
