/**
 * Tests for conflictRecalculation utility
 */

import { describe, it, expect } from 'vitest';
import { recalculatePrecedenceConflicts, updateSnapshotConflicts } from './conflictRecalculation';
import type { ScheduleSnapshot, InternalTask } from '@flux/types';

const weekdaySchedule = { isOperating: true, slots: [{ start: '07:00', end: '19:00' }] };
const weekendSchedule = { isOperating: false, slots: [] };

// Helper to create a minimal test snapshot
function createTestSnapshot(overrides: Partial<ScheduleSnapshot> = {}): ScheduleSnapshot {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stations: [
      {
        id: 'station-1',
        name: 'Station 1',
        categoryId: 'cat-1',
        groupId: 'group-1',
        capacity: 1,
        status: 'Available',
        operatingSchedule: {
          monday: weekdaySchedule,
          tuesday: weekdaySchedule,
          wednesday: weekdaySchedule,
          thursday: weekdaySchedule,
          friday: weekdaySchedule,
          saturday: weekendSchedule,
          sunday: weekendSchedule,
        },
        exceptions: [],
      },
    ],
    categories: [
      {
        id: 'cat-1',
        name: 'Category 1',
        similarityCriteria: [],
      },
    ],
    groups: [],
    providers: [],
    jobs: [
      {
        id: 'job-1',
        reference: 'JOB-001',
        client: 'Test Client',
        description: 'Test Job',
        status: 'InProgress',
        workshopExitDate: '2025-12-31',
        fullyScheduled: false,
        color: '#3B82F6',
        comments: [],
        elementIds: ['elem-1'],
        taskIds: ['task-1', 'task-2'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shipped: false,
        shippedAt: null,
      },
    ],
    elements: [
      {
        id: 'elem-1',
        jobId: 'job-1',
        name: 'Element 1',
        label: 'E1',
        prerequisiteElementIds: [],
        taskIds: ['task-1', 'task-2'],
        paperStatus: 'in_stock',
        batStatus: 'bat_approved',
        plateStatus: 'ready',
        formeStatus: 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    tasks: [
      {
        id: 'task-1',
        elementId: 'elem-1',
        sequenceOrder: 0,
        status: 'Assigned',
        type: 'Internal',
        stationId: 'station-1',
        duration: { setupMinutes: 15, runMinutes: 45 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as InternalTask,
      {
        id: 'task-2',
        elementId: 'elem-1',
        sequenceOrder: 1, // Must come after task-1
        status: 'Assigned',
        type: 'Internal',
        stationId: 'station-1',
        duration: { setupMinutes: 15, runMinutes: 45 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as InternalTask,
    ],
    assignments: [],
    conflicts: [],
    lateJobs: [],
    ...overrides,
  };
}

describe('recalculatePrecedenceConflicts', () => {
  it('returns empty array when there are no assignments', () => {
    const snapshot = createTestSnapshot();
    const conflicts = recalculatePrecedenceConflicts(snapshot);
    expect(conflicts).toEqual([]);
  });

  it('returns empty array when assignments respect precedence', () => {
    const snapshot = createTestSnapshot({
      assignments: [
        {
          id: 'assign-1',
          taskId: 'task-1',
          targetId: 'station-1',
          isOutsourced: false,
          scheduledStart: '2025-01-01T08:00:00.000Z',
          scheduledEnd: '2025-01-01T09:00:00.000Z',
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'assign-2',
          taskId: 'task-2',
          targetId: 'station-1',
          isOutsourced: false,
          scheduledStart: '2025-01-01T09:00:00.000Z', // Starts after task-1 ends
          scheduledEnd: '2025-01-01T10:00:00.000Z',
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const conflicts = recalculatePrecedenceConflicts(snapshot);
    expect(conflicts).toEqual([]);
  });

  it('detects precedence conflict when successor starts before predecessor ends', () => {
    const snapshot = createTestSnapshot({
      assignments: [
        {
          id: 'assign-1',
          taskId: 'task-1',
          targetId: 'station-1',
          isOutsourced: false,
          scheduledStart: '2025-01-01T09:00:00.000Z',
          scheduledEnd: '2025-01-01T10:00:00.000Z',
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'assign-2',
          taskId: 'task-2',
          targetId: 'station-1',
          isOutsourced: false,
          scheduledStart: '2025-01-01T08:00:00.000Z', // Starts BEFORE task-1!
          scheduledEnd: '2025-01-01T09:00:00.000Z',
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const conflicts = recalculatePrecedenceConflicts(snapshot);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].type).toBe('PrecedenceConflict');
    // The conflict is detected - the specific taskId depends on validator implementation
    expect(['task-1', 'task-2']).toContain(conflicts[0].taskId);
  });

  it('deduplicates conflicts with same taskId and relatedTaskId', () => {
    const snapshot = createTestSnapshot({
      assignments: [
        {
          id: 'assign-1',
          taskId: 'task-1',
          targetId: 'station-1',
          isOutsourced: false,
          scheduledStart: '2025-01-01T09:00:00.000Z',
          scheduledEnd: '2025-01-01T10:00:00.000Z',
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'assign-2',
          taskId: 'task-2',
          targetId: 'station-1',
          isOutsourced: false,
          scheduledStart: '2025-01-01T08:00:00.000Z',
          scheduledEnd: '2025-01-01T09:00:00.000Z',
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const conflicts = recalculatePrecedenceConflicts(snapshot);
    // Should only have unique conflicts
    const keys = conflicts.map((c) => `${c.taskId}-${c.relatedTaskId ?? ''}`);
    const uniqueKeys = [...new Set(keys)];
    expect(keys.length).toBe(uniqueKeys.length);
  });
});

describe('updateSnapshotConflicts', () => {
  it('preserves non-precedence conflicts', () => {
    const snapshot = createTestSnapshot({
      conflicts: [
        {
          type: 'StationConflict',
          message: 'Existing station conflict',
          taskId: 'task-1',
        },
      ],
    });

    const updated = updateSnapshotConflicts(snapshot);
    expect(updated.conflicts.some((c) => c.type === 'StationConflict')).toBe(true);
  });

  it('replaces precedence conflicts with recalculated ones', () => {
    const snapshot = createTestSnapshot({
      conflicts: [
        {
          type: 'PrecedenceConflict',
          message: 'Old conflict that no longer exists',
          taskId: 'task-old',
        },
      ],
      assignments: [], // No assignments, so no real conflicts
    });

    const updated = updateSnapshotConflicts(snapshot);
    // Old precedence conflict should be removed
    expect(updated.conflicts.some((c) => c.taskId === 'task-old')).toBe(false);
  });

  it('adds new precedence conflicts when detected', () => {
    const snapshot = createTestSnapshot({
      conflicts: [],
      assignments: [
        {
          id: 'assign-1',
          taskId: 'task-1',
          targetId: 'station-1',
          isOutsourced: false,
          scheduledStart: '2025-01-01T09:00:00.000Z',
          scheduledEnd: '2025-01-01T10:00:00.000Z',
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'assign-2',
          taskId: 'task-2',
          targetId: 'station-1',
          isOutsourced: false,
          scheduledStart: '2025-01-01T08:00:00.000Z', // Precedence violation
          scheduledEnd: '2025-01-01T09:00:00.000Z',
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const updated = updateSnapshotConflicts(snapshot);
    expect(updated.conflicts.some((c) => c.type === 'PrecedenceConflict')).toBe(true);
  });
});
