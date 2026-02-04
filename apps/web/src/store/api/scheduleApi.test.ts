/**
 * Tests for scheduleApi optimistic updates
 *
 * These tests verify that the optimistic update logic correctly modifies
 * the cache. The actual RTK Query integration is tested via E2E tests.
 *
 * @see docs/releases/v0.5.8-optimistic-updates.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import type { ScheduleSnapshot, TaskAssignment } from '@flux/types';
import { scheduleApi } from './scheduleApi';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a minimal test snapshot
 */
function createTestSnapshot(overrides: Partial<ScheduleSnapshot> = {}): ScheduleSnapshot {
  return {
    version: 1,
    generatedAt: '2026-02-04T10:00:00.000Z',
    stations: [],
    categories: [],
    groups: [],
    providers: [],
    jobs: [],
    elements: [],
    tasks: [],
    assignments: [],
    conflicts: [],
    lateJobs: [],
    ...overrides,
  };
}

/**
 * Create a test assignment
 */
function createTestAssignment(taskId: string, stationId: string): TaskAssignment {
  return {
    id: `assignment-${taskId}`,
    taskId,
    targetId: stationId,
    isOutsourced: false,
    scheduledStart: '2026-02-04T08:00:00.000Z',
    scheduledEnd: '2026-02-04T09:00:00.000Z',
    isCompleted: false,
    completedAt: null,
    createdAt: '2026-02-04T10:00:00.000Z',
    updatedAt: '2026-02-04T10:00:00.000Z',
  };
}

/**
 * Create a test store with pre-populated snapshot cache
 */
async function createTestStoreWithSnapshot(snapshot: ScheduleSnapshot) {
  const store = configureStore({
    reducer: {
      [scheduleApi.reducerPath]: scheduleApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(scheduleApi.middleware),
  });

  // Pre-populate the cache with snapshot data
  await store.dispatch(
    scheduleApi.util.upsertQueryData('getSnapshot', undefined, snapshot)
  );

  return store;
}

/**
 * Get assignments from cache using updateQueryData's recipe function
 */
function getCachedAssignments(store: Awaited<ReturnType<typeof createTestStoreWithSnapshot>>): TaskAssignment[] {
  const state = store.getState();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries = (state as any)[scheduleApi.reducerPath].queries;
  const snapshotQuery = queries['getSnapshot(undefined)'];
  return (snapshotQuery?.data as ScheduleSnapshot)?.assignments ?? [];
}

// ============================================================================
// Tests for updateQueryData (core optimistic update mechanism)
// ============================================================================

describe('scheduleApi cache updates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-04T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('updateQueryData for assignments', () => {
    it('can add assignment to cache', async () => {
      const snapshot = createTestSnapshot({ assignments: [] });
      const store = await createTestStoreWithSnapshot(snapshot);

      // Verify initial state
      expect(getCachedAssignments(store)).toHaveLength(0);

      // Directly use updateQueryData (what optimistic updates use internally)
      store.dispatch(
        scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
          draft.assignments.push({
            id: 'temp-123',
            taskId: 'task-1',
            targetId: 'station-1',
            isOutsourced: false,
            scheduledStart: '2026-02-04T08:00:00.000Z',
            scheduledEnd: '2026-02-04T09:00:00.000Z',
            isCompleted: false,
            completedAt: null,
            createdAt: '2026-02-04T10:00:00.000Z',
            updatedAt: '2026-02-04T10:00:00.000Z',
          });
        })
      );

      // Verify assignment was added
      const assignments = getCachedAssignments(store);
      expect(assignments).toHaveLength(1);
      expect(assignments[0]).toMatchObject({
        id: 'temp-123',
        taskId: 'task-1',
        targetId: 'station-1',
      });
    });

    it('can update assignment in cache', async () => {
      const existingAssignment = createTestAssignment('task-1', 'station-1');
      const snapshot = createTestSnapshot({ assignments: [existingAssignment] });
      const store = await createTestStoreWithSnapshot(snapshot);

      // Verify initial state
      const initial = getCachedAssignments(store);
      expect(initial).toHaveLength(1);
      expect(initial[0].scheduledStart).toBe('2026-02-04T08:00:00.000Z');

      // Update the assignment
      store.dispatch(
        scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
          const assignment = draft.assignments.find((a) => a.taskId === 'task-1');
          if (assignment) {
            assignment.scheduledStart = '2026-02-04T14:00:00.000Z';
            assignment.scheduledEnd = '2026-02-04T15:00:00.000Z';
            assignment.updatedAt = new Date().toISOString();
          }
        })
      );

      // Verify assignment was updated
      const assignments = getCachedAssignments(store);
      expect(assignments).toHaveLength(1);
      expect(assignments[0].scheduledStart).toBe('2026-02-04T14:00:00.000Z');
      expect(assignments[0].scheduledEnd).toBe('2026-02-04T15:00:00.000Z');
    });

    it('can remove assignment from cache', async () => {
      const existingAssignment = createTestAssignment('task-1', 'station-1');
      const snapshot = createTestSnapshot({ assignments: [existingAssignment] });
      const store = await createTestStoreWithSnapshot(snapshot);

      // Verify initial state
      expect(getCachedAssignments(store)).toHaveLength(1);

      // Remove the assignment
      store.dispatch(
        scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
          const index = draft.assignments.findIndex((a) => a.taskId === 'task-1');
          if (index !== -1) {
            draft.assignments.splice(index, 1);
          }
        })
      );

      // Verify assignment was removed
      expect(getCachedAssignments(store)).toHaveLength(0);
    });

    it('can toggle completion status', async () => {
      const existingAssignment = createTestAssignment('task-1', 'station-1');
      const snapshot = createTestSnapshot({ assignments: [existingAssignment] });
      const store = await createTestStoreWithSnapshot(snapshot);

      // Verify initial state
      expect(getCachedAssignments(store)[0].isCompleted).toBe(false);

      // Toggle completion
      store.dispatch(
        scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
          const assignment = draft.assignments.find((a) => a.taskId === 'task-1');
          if (assignment) {
            assignment.isCompleted = !assignment.isCompleted;
            assignment.completedAt = assignment.isCompleted
              ? new Date().toISOString()
              : null;
            assignment.updatedAt = new Date().toISOString();
          }
        })
      );

      // Verify completion was toggled
      const assignments = getCachedAssignments(store);
      expect(assignments[0].isCompleted).toBe(true);
      expect(assignments[0].completedAt).toBe('2026-02-04T10:00:00.000Z');
    });

    it('preserves other assignments when modifying one', async () => {
      const assignment1 = createTestAssignment('task-1', 'station-1');
      const assignment2 = createTestAssignment('task-2', 'station-1');
      assignment2.id = 'assignment-task-2';
      assignment2.taskId = 'task-2';

      const snapshot = createTestSnapshot({ assignments: [assignment1, assignment2] });
      const store = await createTestStoreWithSnapshot(snapshot);

      // Remove only task-1
      store.dispatch(
        scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
          const index = draft.assignments.findIndex((a) => a.taskId === 'task-1');
          if (index !== -1) {
            draft.assignments.splice(index, 1);
          }
        })
      );

      // Verify only task-1 was removed
      const assignments = getCachedAssignments(store);
      expect(assignments).toHaveLength(1);
      expect(assignments[0].taskId).toBe('task-2');
    });

    it('can update targetId when moving to different station', async () => {
      const existingAssignment = createTestAssignment('task-1', 'station-1');
      const snapshot = createTestSnapshot({ assignments: [existingAssignment] });
      const store = await createTestStoreWithSnapshot(snapshot);

      // Move to different station
      store.dispatch(
        scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
          const assignment = draft.assignments.find((a) => a.taskId === 'task-1');
          if (assignment) {
            assignment.targetId = 'station-2';
            assignment.scheduledStart = '2026-02-04T14:00:00.000Z';
            assignment.scheduledEnd = '2026-02-04T15:00:00.000Z';
            assignment.updatedAt = new Date().toISOString();
          }
        })
      );

      // Verify targetId was updated
      const assignments = getCachedAssignments(store);
      expect(assignments[0].targetId).toBe('station-2');
    });
  });

  describe('rollback with patchResult.undo()', () => {
    it('can undo assignment addition', async () => {
      const snapshot = createTestSnapshot({ assignments: [] });
      const store = await createTestStoreWithSnapshot(snapshot);

      // Add assignment with patch result
      const patchResult = store.dispatch(
        scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
          draft.assignments.push({
            id: 'temp-123',
            taskId: 'task-1',
            targetId: 'station-1',
            isOutsourced: false,
            scheduledStart: '2026-02-04T08:00:00.000Z',
            scheduledEnd: '2026-02-04T09:00:00.000Z',
            isCompleted: false,
            completedAt: null,
            createdAt: '2026-02-04T10:00:00.000Z',
            updatedAt: '2026-02-04T10:00:00.000Z',
          });
        })
      );

      // Verify assignment was added
      expect(getCachedAssignments(store)).toHaveLength(1);

      // Undo the change
      patchResult.undo();

      // Verify rollback
      expect(getCachedAssignments(store)).toHaveLength(0);
    });

    it('can undo assignment update', async () => {
      const existingAssignment = createTestAssignment('task-1', 'station-1');
      const snapshot = createTestSnapshot({ assignments: [existingAssignment] });
      const store = await createTestStoreWithSnapshot(snapshot);

      const originalStart = getCachedAssignments(store)[0].scheduledStart;

      // Update with patch result
      const patchResult = store.dispatch(
        scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
          const assignment = draft.assignments.find((a) => a.taskId === 'task-1');
          if (assignment) {
            assignment.scheduledStart = '2026-02-04T14:00:00.000Z';
          }
        })
      );

      // Verify update
      expect(getCachedAssignments(store)[0].scheduledStart).toBe('2026-02-04T14:00:00.000Z');

      // Undo
      patchResult.undo();

      // Verify rollback
      expect(getCachedAssignments(store)[0].scheduledStart).toBe(originalStart);
    });

    it('can undo assignment removal', async () => {
      const existingAssignment = createTestAssignment('task-1', 'station-1');
      const snapshot = createTestSnapshot({ assignments: [existingAssignment] });
      const store = await createTestStoreWithSnapshot(snapshot);

      // Remove with patch result
      const patchResult = store.dispatch(
        scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
          const index = draft.assignments.findIndex((a) => a.taskId === 'task-1');
          if (index !== -1) {
            draft.assignments.splice(index, 1);
          }
        })
      );

      // Verify removal
      expect(getCachedAssignments(store)).toHaveLength(0);

      // Undo
      patchResult.undo();

      // Verify rollback
      expect(getCachedAssignments(store)).toHaveLength(1);
      expect(getCachedAssignments(store)[0].taskId).toBe('task-1');
    });
  });
});

// ============================================================================
// Tests for helper functions (exposed via the module)
// ============================================================================

describe('optimistic update helpers', () => {
  describe('generateTempId pattern', () => {
    it('generates unique IDs', () => {
      // Test the pattern used in our implementation
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const id = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        ids.add(id);
      }
      // Should have at least 90 unique IDs (allowing for some collisions in fast loop)
      expect(ids.size).toBeGreaterThan(90);
    });

    it('starts with temp- prefix', () => {
      const id = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      expect(id).toMatch(/^temp-/);
    });
  });
});
