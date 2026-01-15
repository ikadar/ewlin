/**
 * Unit tests for precedenceBounds.ts
 *
 * v0.3.54: Precedence bounds precalculation for O(1) drag validation
 */

import { describe, it, expect } from 'vitest';
import { calculatePrecedenceBounds, validatePrecedenceBounds } from './precedenceBounds';
import type { ScheduleSnapshot, Task, InternalTask, Job, TaskAssignment, Station, StationCategory } from '@flux/types';

// Helper to create a minimal snapshot
function createSnapshot(overrides: Partial<ScheduleSnapshot> = {}): ScheduleSnapshot {
  return {
    snapshotVersion: 1,
    stations: [],
    groups: [],
    categories: [],
    providers: [],
    jobs: [],
    tasks: [],
    assignments: [],
    conflicts: [],
    lateJobs: [],
    ...overrides,
  };
}

// Helper to create an internal task
function createTask(overrides: Partial<InternalTask> = {}): InternalTask {
  return {
    id: 'task-1',
    jobId: 'job-1',
    stationId: 'station-1',
    type: 'Internal',
    sequenceOrder: 1,
    status: 'Assigned',
    duration: {
      setupMinutes: 30,
      runMinutes: 60,
    },
    rawDsl: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Helper to create an assignment
function createAssignment(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    id: 'assignment-1',
    taskId: 'task-1',
    targetId: 'station-1',
    isOutsourced: false,
    scheduledStart: '2024-01-15T09:00:00Z',
    scheduledEnd: '2024-01-15T10:30:00Z',
    isCompleted: false,
    completedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Helper to create a station
function createStation(overrides: Partial<Station> = {}): Station {
  return {
    id: 'station-1',
    name: 'Station 1',
    status: 'Active',
    categoryId: 'category-1',
    groupId: null,
    operatingSchedule: {
      monday: { isOpen: true, slots: [{ start: '08:00', end: '17:00' }] },
      tuesday: { isOpen: true, slots: [{ start: '08:00', end: '17:00' }] },
      wednesday: { isOpen: true, slots: [{ start: '08:00', end: '17:00' }] },
      thursday: { isOpen: true, slots: [{ start: '08:00', end: '17:00' }] },
      friday: { isOpen: true, slots: [{ start: '08:00', end: '17:00' }] },
      saturday: { isOpen: false, slots: [] },
      sunday: { isOpen: false, slots: [] },
    },
    exceptions: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Helper to create a category
function createCategory(overrides: Partial<StationCategory> = {}): StationCategory {
  return {
    id: 'category-1',
    name: 'Test Category',
    similarityCriteria: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('calculatePrecedenceBounds', () => {
  it('should return null bounds for task with no predecessor or successor', () => {
    const task = createTask({ sequenceOrder: 1 });
    const snapshot = createSnapshot({
      tasks: [task],
    });

    const bounds = calculatePrecedenceBounds(task, snapshot);

    expect(bounds.minStart).toBeNull();
    expect(bounds.maxEnd).toBeNull();
    expect(bounds.taskDurationMs).toBe(90 * 60 * 1000); // 90 minutes
  });

  it('should calculate minStart from scheduled predecessor', () => {
    const task1 = createTask({ id: 'task-1', sequenceOrder: 1 });
    const task2 = createTask({ id: 'task-2', sequenceOrder: 2 });
    const assignment1 = createAssignment({
      id: 'assignment-1',
      taskId: 'task-1',
      scheduledStart: '2024-01-15T09:00:00Z',
      scheduledEnd: '2024-01-15T10:30:00Z',
    });

    const snapshot = createSnapshot({
      tasks: [task1, task2],
      assignments: [assignment1],
      stations: [createStation()],
      categories: [createCategory()],
    });

    const bounds = calculatePrecedenceBounds(task2, snapshot);

    // minStart should be predecessor's end time
    expect(bounds.minStart).toEqual(new Date('2024-01-15T10:30:00Z'));
    expect(bounds.maxEnd).toBeNull();
  });

  it('should calculate maxEnd from scheduled successor', () => {
    const task1 = createTask({ id: 'task-1', sequenceOrder: 1 });
    const task2 = createTask({ id: 'task-2', sequenceOrder: 2 });
    const assignment2 = createAssignment({
      id: 'assignment-2',
      taskId: 'task-2',
      scheduledStart: '2024-01-15T14:00:00Z',
      scheduledEnd: '2024-01-15T15:30:00Z',
    });

    const snapshot = createSnapshot({
      tasks: [task1, task2],
      assignments: [assignment2],
      stations: [createStation()],
      categories: [createCategory()],
    });

    const bounds = calculatePrecedenceBounds(task1, snapshot);

    expect(bounds.minStart).toBeNull();
    // maxEnd should be successor's start time
    expect(bounds.maxEnd).toEqual(new Date('2024-01-15T14:00:00Z'));
  });

  it('should add dry time for printing (offset) station predecessor', () => {
    const task1 = createTask({ id: 'task-1', sequenceOrder: 1, stationId: 'offset-station' });
    const task2 = createTask({ id: 'task-2', sequenceOrder: 2 });
    const assignment1 = createAssignment({
      id: 'assignment-1',
      taskId: 'task-1',
      targetId: 'offset-station',
      scheduledStart: '2024-01-15T09:00:00Z',
      scheduledEnd: '2024-01-15T10:00:00Z',
    });

    const snapshot = createSnapshot({
      tasks: [task1, task2],
      assignments: [assignment1],
      stations: [
        createStation({ id: 'offset-station', categoryId: 'offset-category' }),
      ],
      categories: [
        createCategory({ id: 'offset-category', name: 'Offset Press' }),
      ],
    });

    const bounds = calculatePrecedenceBounds(task2, snapshot);

    // minStart should be predecessor's end time + 4 hours dry time
    const expectedMinStart = new Date('2024-01-15T10:00:00Z');
    expectedMinStart.setTime(expectedMinStart.getTime() + 4 * 60 * 60 * 1000);
    expect(bounds.minStart).toEqual(expectedMinStart);
  });

  it('should return null minStart when predecessor is not scheduled', () => {
    const task1 = createTask({ id: 'task-1', sequenceOrder: 1 });
    const task2 = createTask({ id: 'task-2', sequenceOrder: 2 });

    const snapshot = createSnapshot({
      tasks: [task1, task2],
      assignments: [], // No assignments
    });

    const bounds = calculatePrecedenceBounds(task2, snapshot);

    expect(bounds.minStart).toBeNull();
  });

  it('should calculate bounds for middle task with both predecessor and successor', () => {
    const task1 = createTask({ id: 'task-1', sequenceOrder: 1 });
    const task2 = createTask({ id: 'task-2', sequenceOrder: 2 });
    const task3 = createTask({ id: 'task-3', sequenceOrder: 3 });

    const assignment1 = createAssignment({
      id: 'assignment-1',
      taskId: 'task-1',
      scheduledEnd: '2024-01-15T10:00:00Z',
    });
    const assignment3 = createAssignment({
      id: 'assignment-3',
      taskId: 'task-3',
      scheduledStart: '2024-01-15T14:00:00Z',
    });

    const snapshot = createSnapshot({
      tasks: [task1, task2, task3],
      assignments: [assignment1, assignment3],
      stations: [createStation()],
      categories: [createCategory()],
    });

    const bounds = calculatePrecedenceBounds(task2, snapshot);

    expect(bounds.minStart).toEqual(new Date('2024-01-15T10:00:00Z'));
    expect(bounds.maxEnd).toEqual(new Date('2024-01-15T14:00:00Z'));
  });
});

describe('validatePrecedenceBounds', () => {
  const taskDurationMs = 90 * 60 * 1000; // 90 minutes

  it('should return valid when no bounds exist', () => {
    const bounds = { minStart: null, maxEnd: null, taskDurationMs };

    const result = validatePrecedenceBounds('2024-01-15T12:00:00Z', bounds);

    expect(result.isValid).toBe(true);
    expect(result.hasPredecessorConflict).toBe(false);
    expect(result.hasSuccessorConflict).toBe(false);
  });

  it('should detect predecessor conflict when start is before minStart', () => {
    const bounds = {
      minStart: new Date('2024-01-15T10:00:00Z'),
      maxEnd: null,
      taskDurationMs,
    };

    const result = validatePrecedenceBounds('2024-01-15T09:00:00Z', bounds);

    expect(result.isValid).toBe(false);
    expect(result.hasPredecessorConflict).toBe(true);
    expect(result.hasSuccessorConflict).toBe(false);
  });

  it('should return valid when start is at minStart', () => {
    const bounds = {
      minStart: new Date('2024-01-15T10:00:00Z'),
      maxEnd: null,
      taskDurationMs,
    };

    const result = validatePrecedenceBounds('2024-01-15T10:00:00Z', bounds);

    expect(result.isValid).toBe(true);
    expect(result.hasPredecessorConflict).toBe(false);
  });

  it('should detect successor conflict when end is after maxEnd', () => {
    const bounds = {
      minStart: null,
      maxEnd: new Date('2024-01-15T12:00:00Z'),
      taskDurationMs, // 90 minutes
    };

    // Start at 11:00, end at 12:30 (after maxEnd of 12:00)
    const result = validatePrecedenceBounds('2024-01-15T11:00:00Z', bounds);

    expect(result.isValid).toBe(false);
    expect(result.hasPredecessorConflict).toBe(false);
    expect(result.hasSuccessorConflict).toBe(true);
  });

  it('should return valid when end is at maxEnd', () => {
    const bounds = {
      minStart: null,
      maxEnd: new Date('2024-01-15T12:00:00Z'),
      taskDurationMs, // 90 minutes
    };

    // Start at 10:30, end at 12:00 (exactly at maxEnd)
    const result = validatePrecedenceBounds('2024-01-15T10:30:00Z', bounds);

    expect(result.isValid).toBe(true);
    expect(result.hasSuccessorConflict).toBe(false);
  });

  it('should accept Date object as scheduledStart', () => {
    const bounds = {
      minStart: new Date('2024-01-15T10:00:00Z'),
      maxEnd: null,
      taskDurationMs,
    };

    const result = validatePrecedenceBounds(new Date('2024-01-15T11:00:00Z'), bounds);

    expect(result.isValid).toBe(true);
    expect(result.hasPredecessorConflict).toBe(false);
  });

  it('should detect both conflicts when position violates both bounds', () => {
    const bounds = {
      minStart: new Date('2024-01-15T10:00:00Z'),
      maxEnd: new Date('2024-01-15T10:30:00Z'), // Very tight window
      taskDurationMs, // 90 minutes - impossible to fit
    };

    // Start at 09:00 (before minStart), end at 10:30 (exactly at maxEnd but start violates)
    const result = validatePrecedenceBounds('2024-01-15T09:00:00Z', bounds);

    expect(result.isValid).toBe(false);
    expect(result.hasPredecessorConflict).toBe(true);
    // End would be 10:30, exactly at maxEnd, so no successor conflict
    expect(result.hasSuccessorConflict).toBe(false);
  });
});
