import { describe, it, expect } from 'vitest';
import { compactTimeline, COMPACT_HORIZONS } from './compactTimeline';
import type { ScheduleSnapshot, TaskAssignment, Task, Station, InternalTask, Job } from '@flux/types';

// Helper to create a basic snapshot
function createSnapshot(overrides: Partial<ScheduleSnapshot> = {}): ScheduleSnapshot {
  return {
    stations: [],
    categories: [],
    groups: [],
    providers: [],
    jobs: [],
    tasks: [],
    assignments: [],
    lateJobs: [],
    conflicts: [],
    snapshotVersion: 1,
    ...overrides,
  };
}

// Helper to create a station
function createStation(id: string, name: string = id): Station {
  return {
    id,
    name,
    code: id.toUpperCase(),
    categoryId: 'cat-1',
    groupId: null,
    status: 'Active',
    operatingSchedule: {
      monday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
      tuesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
      wednesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
      thursday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
      friday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
      saturday: { isOperating: false, slots: [] },
      sunday: { isOperating: false, slots: [] },
    },
    exceptions: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

// Helper to create a job
function createJob(id: string): Job {
  return {
    id,
    reference: id,
    client: 'Test Client',
    description: 'Test Job',
    workshopEntryDate: '2024-01-01T00:00:00Z',
    workshopExitDate: null,
    status: 'InProgress',
    color: '#FF0000',
    proofSentAt: null,
    proofApprovedAt: '2024-01-01T00:00:00Z',
    platesStatus: 'Done',
    paperPurchaseStatus: 'InStock',
    paperOrderedAt: null,
    requiredJobIds: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

// Helper to create an internal task
function createTask(
  id: string,
  jobId: string,
  stationId: string,
  sequenceOrder: number,
  durationMinutes: number = 60
): Task {
  return {
    id,
    jobId,
    type: 'Internal',
    stationId,
    sequenceOrder,
    status: 'Assigned',
    duration: {
      setupMinutes: 0,
      runMinutes: durationMinutes,
    },
    rawDsl: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  } as Task;
}

// Helper to create an assignment
function createAssignment(
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
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

// Simple calculateEndTime for tests (just adds duration)
function mockCalculateEndTime(task: InternalTask, start: string): string {
  const startDate = new Date(start);
  const durationMs = (task.duration.setupMinutes + task.duration.runMinutes) * 60 * 1000;
  return new Date(startDate.getTime() + durationMs).toISOString();
}

describe('compactTimeline', () => {
  describe('COMPACT_HORIZONS', () => {
    it('has three horizon options', () => {
      expect(COMPACT_HORIZONS).toHaveLength(3);
    });

    it('has correct horizon values', () => {
      expect(COMPACT_HORIZONS[0]).toEqual({ label: '4h', hours: 4 });
      expect(COMPACT_HORIZONS[1]).toEqual({ label: '8h', hours: 8 });
      expect(COMPACT_HORIZONS[2]).toEqual({ label: '24h', hours: 24 });
    });
  });

  describe('basic compaction', () => {
    it('returns unchanged snapshot when no assignments', () => {
      const snapshot = createSnapshot({
        stations: [createStation('station-1')],
      });

      const result = compactTimeline({
        snapshot,
        horizonHours: 4,
        calculateEndTime: mockCalculateEndTime,
      });

      expect(result.movedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.snapshot.assignments).toHaveLength(0);
    });

    it('removes gaps between tasks', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('station-1');
      const job = createJob('job-1');
      const task1 = createTask('task-1', 'job-1', 'station-1', 1, 60);
      const task2 = createTask('task-2', 'job-1', 'station-1', 2, 60);

      // Task 1: 10:00-11:00
      // Gap: 11:00-12:00
      // Task 2: 12:00-13:00
      const snapshot = createSnapshot({
        stations: [station],
        jobs: [job],
        tasks: [task1, task2],
        assignments: [
          createAssignment('a1', 'task-1', 'station-1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 'task-2', 'station-1', '2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z'),
        ],
      });

      const result = compactTimeline({
        snapshot,
        horizonHours: 4,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Task 2 should move from 12:00 to 11:00
      const task2Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-2');
      expect(task2Assignment?.scheduledStart).toBe('2024-01-15T11:00:00.000Z');
      expect(result.movedCount).toBe(1);
    });
  });

  describe('immobile tasks', () => {
    it('does not move tasks that have already started', () => {
      const now = new Date('2024-01-15T10:30:00Z'); // Now is 10:30
      const station = createStation('station-1');
      const job = createJob('job-1');
      const task1 = createTask('task-1', 'job-1', 'station-1', 1, 60);
      const task2 = createTask('task-2', 'job-1', 'station-1', 2, 60);

      // Task 1: 10:00-11:00 (already started at 10:30)
      // Task 2: 12:00-13:00 (within horizon, movable)
      const snapshot = createSnapshot({
        stations: [station],
        jobs: [job],
        tasks: [task1, task2],
        assignments: [
          createAssignment('a1', 'task-1', 'station-1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 'task-2', 'station-1', '2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z'),
        ],
      });

      const result = compactTimeline({
        snapshot,
        horizonHours: 4,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Task 1 should not move (already started)
      const task1Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-1');
      expect(task1Assignment?.scheduledStart).toBe('2024-01-15T10:00:00Z');
      expect(result.skippedCount).toBe(1);

      // Task 2 should move to 11:00
      const task2Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-2');
      expect(task2Assignment?.scheduledStart).toBe('2024-01-15T11:00:00.000Z');
    });

    it('does not move tasks in progress', () => {
      const now = new Date('2024-01-15T10:30:00Z'); // Now is 10:30
      const station = createStation('station-1');
      const job = createJob('job-1');
      const task1 = createTask('task-1', 'job-1', 'station-1', 1, 90); // 1.5 hours

      // Task 1: 10:00-11:30 (in progress at 10:30)
      const snapshot = createSnapshot({
        stations: [station],
        jobs: [job],
        tasks: [task1],
        assignments: [
          createAssignment('a1', 'task-1', 'station-1', '2024-01-15T10:00:00Z', '2024-01-15T11:30:00Z'),
        ],
      });

      const result = compactTimeline({
        snapshot,
        horizonHours: 4,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Task 1 should not move (in progress)
      const task1Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-1');
      expect(task1Assignment?.scheduledStart).toBe('2024-01-15T10:00:00Z');
      expect(result.skippedCount).toBe(1);
    });
  });

  describe('time horizon', () => {
    it('only compacts tasks within the horizon', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('station-1');
      const job = createJob('job-1');
      const task1 = createTask('task-1', 'job-1', 'station-1', 1, 60);
      const task2 = createTask('task-2', 'job-1', 'station-1', 2, 60);
      const task3 = createTask('task-3', 'job-1', 'station-1', 3, 60);

      // Task 1: 10:00-11:00 (now)
      // Task 2: 12:00-13:00 (within 4h horizon)
      // Task 3: 16:00-17:00 (outside 4h horizon: 10:00 + 4h = 14:00)
      const snapshot = createSnapshot({
        stations: [station],
        jobs: [job],
        tasks: [task1, task2, task3],
        assignments: [
          createAssignment('a1', 'task-1', 'station-1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 'task-2', 'station-1', '2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z'),
          createAssignment('a3', 'task-3', 'station-1', '2024-01-15T16:00:00Z', '2024-01-15T17:00:00Z'),
        ],
      });

      const result = compactTimeline({
        snapshot,
        horizonHours: 4,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Task 2 should move to 11:00
      const task2Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-2');
      expect(task2Assignment?.scheduledStart).toBe('2024-01-15T11:00:00.000Z');

      // Task 3 should NOT move (outside horizon)
      const task3Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-3');
      expect(task3Assignment?.scheduledStart).toBe('2024-01-15T16:00:00Z');
    });

    it('8h horizon covers more tasks', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('station-1');
      const job = createJob('job-1');
      const task1 = createTask('task-1', 'job-1', 'station-1', 1, 60);
      const task2 = createTask('task-2', 'job-1', 'station-1', 2, 60);

      // Task 1: 10:00-11:00
      // Task 2: 16:00-17:00 (outside 4h but within 8h)
      const snapshot = createSnapshot({
        stations: [station],
        jobs: [job],
        tasks: [task1, task2],
        assignments: [
          createAssignment('a1', 'task-1', 'station-1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 'task-2', 'station-1', '2024-01-15T16:00:00Z', '2024-01-15T17:00:00Z'),
        ],
      });

      const result = compactTimeline({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Task 2 should move to 11:00 (within 8h horizon)
      const task2Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-2');
      expect(task2Assignment?.scheduledStart).toBe('2024-01-15T11:00:00.000Z');
    });
  });

  describe('precedence rules', () => {
    it('respects precedence between tasks in same job', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station1 = createStation('station-1');
      const station2 = createStation('station-2');
      const job = createJob('job-1');
      const task1 = createTask('task-1', 'job-1', 'station-1', 1, 60); // First task
      const task2 = createTask('task-2', 'job-1', 'station-2', 2, 60); // Second task

      // Task 1: 10:00-11:00 on station-1
      // Task 2: 14:00-15:00 on station-2 (has gap but must wait for task 1)
      const snapshot = createSnapshot({
        stations: [station1, station2],
        jobs: [job],
        tasks: [task1, task2],
        assignments: [
          createAssignment('a1', 'task-1', 'station-1', '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
          createAssignment('a2', 'task-2', 'station-2', '2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z'),
        ],
      });

      const result = compactTimeline({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Task 2 should move to 11:00 (after task 1 ends)
      const task2Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-2');
      expect(task2Assignment?.scheduledStart).toBe('2024-01-15T11:00:00.000Z');
    });

    it('does not move task before predecessor ends', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station1 = createStation('station-1');
      const station2 = createStation('station-2');
      const job = createJob('job-1');
      const task1 = createTask('task-1', 'job-1', 'station-1', 1, 120); // 2 hours
      const task2 = createTask('task-2', 'job-1', 'station-2', 2, 60);

      // Task 1: 10:00-12:00 on station-1 (2 hours)
      // Task 2: 14:00-15:00 on station-2
      const snapshot = createSnapshot({
        stations: [station1, station2],
        jobs: [job],
        tasks: [task1, task2],
        assignments: [
          createAssignment('a1', 'task-1', 'station-1', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z'),
          createAssignment('a2', 'task-2', 'station-2', '2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z'),
        ],
      });

      const result = compactTimeline({
        snapshot,
        horizonHours: 8,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Task 2 should move to 12:00 (after task 1 ends at 12:00)
      const task2Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-2');
      expect(task2Assignment?.scheduledStart).toBe('2024-01-15T12:00:00.000Z');
    });
  });

  describe('multiple stations', () => {
    it('compacts tasks across multiple stations', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station1 = createStation('station-1');
      const station2 = createStation('station-2');
      const job1 = createJob('job-1');
      const job2 = createJob('job-2');
      const task1 = createTask('task-1', 'job-1', 'station-1', 1, 60);
      const task2 = createTask('task-2', 'job-2', 'station-2', 1, 60);

      // Both stations have a task with a gap after now
      const snapshot = createSnapshot({
        stations: [station1, station2],
        jobs: [job1, job2],
        tasks: [task1, task2],
        assignments: [
          createAssignment('a1', 'task-1', 'station-1', '2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'),
          createAssignment('a2', 'task-2', 'station-2', '2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z'),
        ],
      });

      const result = compactTimeline({
        snapshot,
        horizonHours: 4,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Task 1 should move to 10:00
      const task1Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-1');
      expect(task1Assignment?.scheduledStart).toBe('2024-01-15T10:00:00.000Z');

      // Task 2 should move to 10:00 (different station)
      const task2Assignment = result.snapshot.assignments.find((a) => a.taskId === 'task-2');
      expect(task2Assignment?.scheduledStart).toBe('2024-01-15T10:00:00.000Z');

      expect(result.movedCount).toBe(2);
    });
  });

  describe('outsourced assignments', () => {
    it('ignores outsourced assignments', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const station = createStation('station-1');
      const job = createJob('job-1');
      const task1 = createTask('task-1', 'job-1', 'station-1', 1, 60);

      const outsourcedAssignment: TaskAssignment = {
        id: 'a1',
        taskId: 'task-1',
        targetId: 'provider-1',
        isOutsourced: true,
        scheduledStart: '2024-01-15T12:00:00Z',
        scheduledEnd: '2024-01-15T13:00:00Z',
        isCompleted: false,
        completedAt: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const snapshot = createSnapshot({
        stations: [station],
        jobs: [job],
        tasks: [task1],
        assignments: [outsourcedAssignment],
      });

      const result = compactTimeline({
        snapshot,
        horizonHours: 4,
        now,
        calculateEndTime: mockCalculateEndTime,
      });

      // Outsourced assignment should not be moved
      expect(result.movedCount).toBe(0);
    });
  });
});
