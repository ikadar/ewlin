import { describe, it, expect } from 'vitest';
import { getPredecessorConstraint, getSuccessorConstraint } from './precedenceConstraints';
import type { ScheduleSnapshot, Task, TaskAssignment, Job, Element } from '@flux/types';
import { PIXELS_PER_HOUR } from '../components/TimelineColumn/HourMarker';

/**
 * Create ISO timestamp for a specific local time.
 * This ensures tests work correctly regardless of the system timezone.
 */
function createLocalTimeISO(hour: number, minute: number = 0): string {
  const date = new Date();
  date.setFullYear(2026, 0, 6); // 2026-01-06
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

// Default operating schedule for test stations (24/7 operation to simplify tests)
const DEFAULT_OPERATING_SCHEDULE = {
  monday: { isOperating: true, slots: [{ start: '00:00', end: '23:59' }] },
  tuesday: { isOperating: true, slots: [{ start: '00:00', end: '23:59' }] },
  wednesday: { isOperating: true, slots: [{ start: '00:00', end: '23:59' }] },
  thursday: { isOperating: true, slots: [{ start: '00:00', end: '23:59' }] },
  friday: { isOperating: true, slots: [{ start: '00:00', end: '23:59' }] },
  saturday: { isOperating: true, slots: [{ start: '00:00', end: '23:59' }] },
  sunday: { isOperating: true, slots: [{ start: '00:00', end: '23:59' }] },
};

// Helper to create minimal snapshot
function createSnapshot(overrides: Partial<ScheduleSnapshot> = {}): ScheduleSnapshot {
  return {
    version: 1,
    generatedAt: '2026-01-06T10:00:00Z',
    jobs: [],
    elements: [],
    tasks: [],
    assignments: [],
    stations: [],
    groups: [],
    categories: [
      { id: 'cat-offset', name: 'Offset', similarityCriteria: [] },
      { id: 'cat-cutting', name: 'Cutting', similarityCriteria: [] },
    ],
    providers: [],
    conflicts: [],
    lateJobs: [],
    ...overrides,
  };
}

// Helper to create test job
function createJob(id: string): Job {
  return {
    id,
    reference: '1234',
    client: 'Test Customer',
    description: 'Test Job',
    workshopExitDate: '2026-01-10',
    status: 'InProgress',
    color: '#8B5CF6',
    fullyScheduled: false,
    comments: [],
    taskIds: [],
    elementIds: [`element-${id}`],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Helper to create element
function createElement(jobId: string, taskIds: string[] = []): Element {
  return {
    id: `element-${jobId}`,
    jobId,
    suffix: 'ELT',
    prerequisiteElementIds: [],
    taskIds,
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Helper to create test task (InternalTask)
function createTask(
  id: string,
  elementId: string,
  sequenceOrder: number,
  durationMinutes: number = 60
): Task {
  // Split duration into setup and run (for simplicity, 50% each)
  const setupMinutes = Math.floor(durationMinutes / 2);
  const runMinutes = durationMinutes - setupMinutes;
  return {
    id,
    elementId,
    sequenceOrder,
    type: 'Internal',
    stationId: 'station-1',
    duration: { setupMinutes, runMinutes },
    status: 'Ready',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Helper to create test assignment
function createAssignment(
  taskId: string,
  start: string,
  end: string,
  targetId: string = 'station-1',
  isOutsourced: boolean = false
): TaskAssignment {
  return {
    id: `assign-${taskId}`,
    taskId,
    targetId,
    isOutsourced,
    scheduledStart: start,
    scheduledEnd: end,
    isCompleted: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('getPredecessorConstraint', () => {
  it('returns null when task has no predecessor (first task)', () => {
    const job = createJob('job-1');
    const task = createTask('task-1', 'element-job-1', 1);
    job.taskIds = ['task-1'];

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1')],
      tasks: [task],
    });

    const result = getPredecessorConstraint(task, snapshot, 6, PIXELS_PER_HOUR);
    expect(result).toBeNull();
  });

  it('returns null when predecessor is not scheduled', () => {
    const job = createJob('job-1');
    const task1 = createTask('task-1', 'element-job-1', 1);
    const task2 = createTask('task-2', 'element-job-1', 2);
    job.taskIds = ['task-1', 'task-2'];

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1')],
      tasks: [task1, task2],
      assignments: [], // No assignments
    });

    const result = getPredecessorConstraint(task2, snapshot, 6, PIXELS_PER_HOUR);
    expect(result).toBeNull();
  });

  it('returns correct Y for predecessor with assignment (non-printing)', () => {
    const job = createJob('job-1');
    const task1 = createTask('task-1', 'element-job-1', 1);
    const task2 = createTask('task-2', 'element-job-1', 2);
    job.taskIds = ['task-1', 'task-2'];

    // Predecessor ends at 10:00 local time (4 hours after startHour of 6)
    const assignment = createAssignment(
      'task-1',
      createLocalTimeISO(9, 0),
      createLocalTimeISO(10, 0),
      'station-cutting' // Non-printing station
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1')],
      tasks: [task1, task2],
      assignments: [assignment],
      stations: [
        { id: 'station-cutting', name: 'Cutting', categoryId: 'cat-cutting', groupId: null, operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] },
      ],
    });

    const result = getPredecessorConstraint(task2, snapshot, 6, PIXELS_PER_HOUR);

    // 10:00 is 4 hours from startHour 6
    // Expected Y = 4 * PIXELS_PER_HOUR
    expect(result).toBe(4 * PIXELS_PER_HOUR);
  });

  it('adds 4h dry time for printing predecessor', () => {
    const job = createJob('job-1');
    // Print task (on offset station which is printing)
    const printTask = createTask('task-print', 'element-job-1', 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test helper override
    (printTask as any).stationId = 'station-offset'; // Override to offset station
    const cutTask = createTask('task-cut', 'element-job-1', 2);
    job.taskIds = ['task-print', 'task-cut'];

    // Print ends at 10:00 local time, earliest for cut should be 14:00 (10:00 + 4h dry time)
    const assignment = createAssignment(
      'task-print',
      createLocalTimeISO(9, 0),
      createLocalTimeISO(10, 0),
      'station-offset'
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1')],
      tasks: [printTask, cutTask],
      assignments: [assignment],
      stations: [
        { id: 'station-offset', name: 'Offset Press', categoryId: 'cat-offset', groupId: null, operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] },
      ],
      categories: [
        { id: 'cat-offset', name: 'Offset', colorCode: '#FF0000' },
        { id: 'cat-cutting', name: 'Cutting', colorCode: '#00FF00' },
      ],
    });

    const result = getPredecessorConstraint(cutTask, snapshot, 6, PIXELS_PER_HOUR);

    // 10:00 + 4h = 14:00, which is 8 hours from startHour 6
    // Expected Y = 8 * PIXELS_PER_HOUR
    expect(result).toBe(8 * PIXELS_PER_HOUR);
  });

  it('does not add dry time for outsourced printing', () => {
    const job = createJob('job-1');
    const printTask = createTask('task-print', 'element-job-1', 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test helper override
    (printTask as any).stationId = 'station-offset'; // Override to offset station
    const cutTask = createTask('task-cut', 'element-job-1', 2);
    job.taskIds = ['task-print', 'task-cut'];

    // Outsourced print - no dry time
    const assignment = createAssignment(
      'task-print',
      createLocalTimeISO(9, 0),
      createLocalTimeISO(10, 0),
      'provider-1',
      true // isOutsourced
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1')],
      tasks: [printTask, cutTask],
      assignments: [assignment],
      providers: [{
        id: 'provider-1',
        name: 'External Printer',
        status: 'Active',
        supportedActionTypes: ['offset'],
        latestDepartureTime: '14:00',
        receptionTime: '09:00',
        groupId: 'grp-external',
      }],
    });

    const result = getPredecessorConstraint(cutTask, snapshot, 6, PIXELS_PER_HOUR);

    // 10:00 is 4 hours from startHour 6 (no dry time added)
    expect(result).toBe(4 * PIXELS_PER_HOUR);
  });
});

describe('getSuccessorConstraint', () => {
  it('returns null when task has no successor (last task)', () => {
    const job = createJob('job-1');
    const task = createTask('task-1', 'element-job-1', 1);
    job.taskIds = ['task-1'];

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1')],
      tasks: [task],
    });

    const result = getSuccessorConstraint(task, snapshot, 6, PIXELS_PER_HOUR);
    expect(result).toBeNull();
  });

  it('returns null when successor is not scheduled', () => {
    const job = createJob('job-1');
    const task1 = createTask('task-1', 'element-job-1', 1);
    const task2 = createTask('task-2', 'element-job-1', 2);
    job.taskIds = ['task-1', 'task-2'];

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1')],
      tasks: [task1, task2],
      assignments: [], // No assignments
    });

    const result = getSuccessorConstraint(task1, snapshot, 6, PIXELS_PER_HOUR);
    expect(result).toBeNull();
  });

  it('returns correct Y for successor with assignment', () => {
    const job = createJob('job-1');
    // First task has 60 min duration
    const task1 = createTask('task-1', 'element-job-1', 1, 60);
    const task2 = createTask('task-2', 'element-job-1', 2);
    job.taskIds = ['task-1', 'task-2'];

    // Successor starts at 14:00 local time
    const assignment = createAssignment(
      'task-2',
      createLocalTimeISO(14, 0),
      createLocalTimeISO(15, 0)
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1')],
      tasks: [task1, task2],
      assignments: [assignment],
      stations: [{ id: 'station-1', name: 'Station', categoryId: 'cat-cutting', groupId: null, operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] }],
    });

    const result = getSuccessorConstraint(task1, snapshot, 6, PIXELS_PER_HOUR);

    // Successor starts at 14:00, task1 duration is 60 min
    // Latest start for task1 = 14:00 - 60 min = 13:00
    // 13:00 is 7 hours from startHour 6
    expect(result).toBe(7 * PIXELS_PER_HOUR);
  });

  it('calculates correctly with longer task duration', () => {
    const job = createJob('job-1');
    // First task has 120 min (2h) duration
    const task1 = createTask('task-1', 'element-job-1', 1, 120);
    const task2 = createTask('task-2', 'element-job-1', 2);
    job.taskIds = ['task-1', 'task-2'];

    // Successor starts at 14:00 local time
    const assignment = createAssignment(
      'task-2',
      createLocalTimeISO(14, 0),
      createLocalTimeISO(15, 0)
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1')],
      tasks: [task1, task2],
      assignments: [assignment],
      stations: [{ id: 'station-1', name: 'Station', categoryId: 'cat-cutting', groupId: null, operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] }],
    });

    const result = getSuccessorConstraint(task1, snapshot, 6, PIXELS_PER_HOUR);

    // Successor starts at 14:00, task1 duration is 120 min (2h)
    // Latest start for task1 = 14:00 - 2h = 12:00
    // 12:00 is 6 hours from startHour 6
    expect(result).toBe(6 * PIXELS_PER_HOUR);
  });
});
