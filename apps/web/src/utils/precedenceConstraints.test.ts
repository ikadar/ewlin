import { describe, it, expect } from 'vitest';
import {
  getPredecessorConstraint,
  getSuccessorConstraint,
  getOutsourcedTaskReturnTime,
  getOutsourcedTaskDepartureTime,
  getOutsourcingTimeInfo,
} from './precedenceConstraints';
import type { ScheduleSnapshot, Task, TaskAssignment, Job, Element, OutsourcedTask, OutsourcedProvider } from '@flux/types';
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
    name: 'ELT',
    prerequisiteElementIds: [],
    taskIds,
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    formeStatus: 'none',
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
        { id: 'station-cutting', name: 'Cutting', status: 'Available', capacity: 1, categoryId: 'cat-cutting', groupId: 'group-1', operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] },
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
        { id: 'station-offset', name: 'Offset Press', status: 'Available', capacity: 1, categoryId: 'cat-offset', groupId: 'group-1', operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] },
      ],
      categories: [
        { id: 'cat-offset', name: 'Offset', similarityCriteria: [] },
        { id: 'cat-cutting', name: 'Cutting', similarityCriteria: [] },
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
        transitDays: 1,
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
      stations: [{ id: 'station-1', name: 'Station', status: 'Available', capacity: 1, categoryId: 'cat-cutting', groupId: 'group-1', operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] }],
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
      stations: [{ id: 'station-1', name: 'Station', status: 'Available', capacity: 1, categoryId: 'cat-cutting', groupId: 'group-1', operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] }],
    });

    const result = getSuccessorConstraint(task1, snapshot, 6, PIXELS_PER_HOUR);

    // Successor starts at 14:00, task1 duration is 120 min (2h)
    // Latest start for task1 = 14:00 - 2h = 12:00
    // 12:00 is 6 hours from startHour 6
    expect(result).toBe(6 * PIXELS_PER_HOUR);
  });
});

// ============================================================================
// v0.5.12: Outsourcing Precedence Calculation Tests
// ============================================================================

// Helper to create outsourced task
function createOutsourcedTask(
  id: string,
  elementId: string,
  sequenceOrder: number,
  providerId: string,
  overrides: Partial<OutsourcedTask> = {}
): OutsourcedTask {
  return {
    id,
    elementId,
    sequenceOrder,
    type: 'Outsourced',
    providerId,
    actionType: 'Pelliculage',
    duration: {
      openDays: 2,
      latestDepartureTime: '14:00',
      receptionTime: '09:00',
    },
    status: 'Ready',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create provider
function createProvider(id: string, transitDays: number = 1): OutsourcedProvider {
  return {
    id,
    name: `Provider ${id}`,
    status: 'Active',
    supportedActionTypes: ['Pelliculage'],
    latestDepartureTime: '14:00',
    receptionTime: '09:00',
    transitDays,
    groupId: 'grp-external',
  };
}

describe('getOutsourcedTaskReturnTime (v0.5.12)', () => {
  it('returns manual return date when set', () => {
    const manualReturn = '2026-01-10T10:00:00.000Z';
    const task = createOutsourcedTask('task-1', 'elem-1', 0, 'provider-1', {
      manualReturn,
    });
    const provider = createProvider('provider-1');

    const result = getOutsourcedTaskReturnTime(task, undefined, provider);

    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe(manualReturn);
  });

  it('returns null when no manual return and no predecessor end time', () => {
    const task = createOutsourcedTask('task-1', 'elem-1', 0, 'provider-1');
    const provider = createProvider('provider-1');

    const result = getOutsourcedTaskReturnTime(task, undefined, provider);

    expect(result).toBeNull();
  });

  it('returns null when no provider', () => {
    const task = createOutsourcedTask('task-1', 'elem-1', 0, 'provider-1');

    const result = getOutsourcedTaskReturnTime(task, '2026-01-06T10:00:00.000Z', undefined);

    expect(result).toBeNull();
  });

  it('calculates return from predecessor end time when no manual dates', () => {
    const task = createOutsourcedTask('task-1', 'elem-1', 0, 'provider-1', {
      duration: {
        openDays: 2,
        latestDepartureTime: '14:00',
        receptionTime: '09:00',
      },
    });
    const provider = createProvider('provider-1', 1); // 1 transit day

    // Predecessor ends at 10:00 on Jan 6 (Monday)
    const predecessorEnd = new Date(2026, 0, 6, 10, 0); // Monday Jan 6, 2026 at 10:00

    const result = getOutsourcedTaskReturnTime(task, predecessorEnd, provider);

    // Departure: Jan 6 at 14:00 (same day since 10:00 < 14:00)
    // Transit out: +1 day = Jan 7
    // Work: +2 days = Jan 8, Jan 9
    // Transit back: +1 day = Jan 12 (Jan 10-11 are weekend)
    // Return: Jan 12 at 09:00
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(9);
    expect(result!.getMinutes()).toBe(0);
  });
});

describe('getOutsourcedTaskDepartureTime (v0.5.12)', () => {
  it('returns manual departure date when set', () => {
    const manualDeparture = '2026-01-06T14:00:00.000Z';
    const task = createOutsourcedTask('task-1', 'elem-1', 0, 'provider-1', {
      manualDeparture,
    });

    const result = getOutsourcedTaskDepartureTime(task, undefined);

    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe(manualDeparture);
  });

  it('returns null when no manual departure and no predecessor end time', () => {
    const task = createOutsourcedTask('task-1', 'elem-1', 0, 'provider-1');

    const result = getOutsourcedTaskDepartureTime(task, undefined);

    expect(result).toBeNull();
  });

  it('calculates departure from predecessor end time', () => {
    const task = createOutsourcedTask('task-1', 'elem-1', 0, 'provider-1', {
      duration: {
        openDays: 2,
        latestDepartureTime: '14:00',
        receptionTime: '09:00',
      },
    });

    // Predecessor ends at 10:00 - before latest departure, so same day
    const predecessorEnd = new Date(2026, 0, 6, 10, 0); // Monday 10:00

    const result = getOutsourcedTaskDepartureTime(task, predecessorEnd);

    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(6); // Same day
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(0);
  });

  it('moves to next business day when predecessor ends after latest departure', () => {
    const task = createOutsourcedTask('task-1', 'elem-1', 0, 'provider-1', {
      duration: {
        openDays: 2,
        latestDepartureTime: '14:00',
        receptionTime: '09:00',
      },
    });

    // Predecessor ends at 15:00 - after latest departure, so next day
    const predecessorEnd = new Date(2026, 0, 6, 15, 0); // Monday 15:00

    const result = getOutsourcedTaskDepartureTime(task, predecessorEnd);

    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(7); // Next day
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(0);
  });
});

describe('getPredecessorConstraint with outsourced predecessor (v0.5.12)', () => {
  it('uses manual return for outsourced predecessor', () => {
    const job = createJob('job-1');
    const manualReturn = createLocalTimeISO(10, 0); // 10:00
    const outsourcedTask = createOutsourcedTask('task-out', 'element-job-1', 0, 'provider-1', {
      manualReturn,
    });
    const internalTask = createTask('task-int', 'element-job-1', 1);
    job.taskIds = ['task-out', 'task-int'];

    const assignment = createAssignment(
      'task-out',
      createLocalTimeISO(14, 0), // departure
      createLocalTimeISO(9, 0), // scheduled end (would be calculated return)
      'provider-1',
      true
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1', ['task-out', 'task-int'])],
      tasks: [outsourcedTask, internalTask],
      assignments: [assignment],
      providers: [createProvider('provider-1')],
    });

    const result = getPredecessorConstraint(internalTask, snapshot, 6, PIXELS_PER_HOUR);

    // Manual return at 10:00 = 4 hours from startHour 6
    expect(result).toBe(4 * PIXELS_PER_HOUR);
  });

  it('uses scheduled end when no manual return', () => {
    const job = createJob('job-1');
    const outsourcedTask = createOutsourcedTask('task-out', 'element-job-1', 0, 'provider-1');
    const internalTask = createTask('task-int', 'element-job-1', 1);
    job.taskIds = ['task-out', 'task-int'];

    const assignment = createAssignment(
      'task-out',
      createLocalTimeISO(14, 0), // departure
      createLocalTimeISO(12, 0), // return at 12:00
      'provider-1',
      true
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1', ['task-out', 'task-int'])],
      tasks: [outsourcedTask, internalTask],
      assignments: [assignment],
      providers: [createProvider('provider-1')],
    });

    const result = getPredecessorConstraint(internalTask, snapshot, 6, PIXELS_PER_HOUR);

    // Scheduled end at 12:00 = 6 hours from startHour 6
    expect(result).toBe(6 * PIXELS_PER_HOUR);
  });
});

describe('getSuccessorConstraint with outsourced successor (v0.5.12)', () => {
  it('uses manual departure for outsourced successor', () => {
    const job = createJob('job-1');
    const manualDeparture = createLocalTimeISO(14, 0); // 14:00
    const internalTask = createTask('task-int', 'element-job-1', 0, 60); // 1 hour duration
    const outsourcedTask = createOutsourcedTask('task-out', 'element-job-1', 1, 'provider-1', {
      manualDeparture,
    });
    job.taskIds = ['task-int', 'task-out'];

    const assignment = createAssignment(
      'task-out',
      createLocalTimeISO(14, 0), // departure (same as manual)
      createLocalTimeISO(9, 0), // return
      'provider-1',
      true
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1', ['task-int', 'task-out'])],
      tasks: [internalTask, outsourcedTask],
      assignments: [assignment],
      stations: [{ id: 'station-1', name: 'Station', status: 'Available', capacity: 1, categoryId: 'cat-cutting', groupId: 'group-1', operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] }],
      providers: [createProvider('provider-1')],
    });

    const result = getSuccessorConstraint(internalTask, snapshot, 6, PIXELS_PER_HOUR);

    // Manual departure at 14:00, internal task is 60 min
    // Latest start = 14:00 - 60 min = 13:00
    // 13:00 is 7 hours from startHour 6
    expect(result).toBe(7 * PIXELS_PER_HOUR);
  });

  it('uses scheduled start (departure) when no manual departure', () => {
    const job = createJob('job-1');
    const internalTask = createTask('task-int', 'element-job-1', 0, 60); // 1 hour duration
    const outsourcedTask = createOutsourcedTask('task-out', 'element-job-1', 1, 'provider-1');
    job.taskIds = ['task-int', 'task-out'];

    const assignment = createAssignment(
      'task-out',
      createLocalTimeISO(16, 0), // departure at 16:00
      createLocalTimeISO(9, 0), // return
      'provider-1',
      true
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1', ['task-int', 'task-out'])],
      tasks: [internalTask, outsourcedTask],
      assignments: [assignment],
      stations: [{ id: 'station-1', name: 'Station', status: 'Available', capacity: 1, categoryId: 'cat-cutting', groupId: 'group-1', operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] }],
      providers: [createProvider('provider-1')],
    });

    const result = getSuccessorConstraint(internalTask, snapshot, 6, PIXELS_PER_HOUR);

    // Scheduled departure at 16:00, internal task is 60 min
    // Latest start = 16:00 - 60 min = 15:00
    // 15:00 is 9 hours from startHour 6
    expect(result).toBe(9 * PIXELS_PER_HOUR);
  });
});

// ============================================================================
// v0.5.13: Outsourcing Time Info Tests (Drag Visualization)
// ============================================================================

describe('getOutsourcingTimeInfo (v0.5.13)', () => {
  it('returns null when task has no outsourced predecessor', () => {
    const job = createJob('job-1');
    const task1 = createTask('task-1', 'element-job-1', 0);
    const task2 = createTask('task-2', 'element-job-1', 1);
    job.taskIds = ['task-1', 'task-2'];

    const assignment = createAssignment(
      'task-1',
      createLocalTimeISO(8, 0),
      createLocalTimeISO(9, 0),
      'station-1',
      false
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1', ['task-1', 'task-2'])],
      tasks: [task1, task2],
      assignments: [assignment],
      stations: [{ id: 'station-1', name: 'Station', status: 'Available', capacity: 1, categoryId: 'cat-cutting', groupId: 'group-1', operatingSchedule: DEFAULT_OPERATING_SCHEDULE, exceptions: [] }],
    });

    const result = getOutsourcingTimeInfo(task2, snapshot, 6, PIXELS_PER_HOUR);
    expect(result).toBeNull();
  });

  it('returns correct Y positions for outsourced predecessor', () => {
    const job = createJob('job-1');
    const outsourcedTask = createOutsourcedTask('task-out', 'element-job-1', 0, 'provider-1');
    const internalTask = createTask('task-int', 'element-job-1', 1);
    job.taskIds = ['task-out', 'task-int'];

    // Outsourced: departs 14:00, returns 09:00 (next day or later)
    const assignment = createAssignment(
      'task-out',
      createLocalTimeISO(14, 0), // departure
      createLocalTimeISO(9, 0), // return (simplified for test)
      'provider-1',
      true
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1', ['task-out', 'task-int'])],
      tasks: [outsourcedTask, internalTask],
      assignments: [assignment],
      providers: [createProvider('provider-1')],
    });

    const result = getOutsourcingTimeInfo(internalTask, snapshot, 6, PIXELS_PER_HOUR);

    expect(result).not.toBeNull();
    // Departure at 14:00 = 8 hours from startHour 6
    expect(result!.departureY).toBe(8 * PIXELS_PER_HOUR);
    // Return at 09:00 = 3 hours from startHour 6
    expect(result!.returnY).toBe(3 * PIXELS_PER_HOUR);
  });

  it('uses manual return for Y position when set', () => {
    const job = createJob('job-1');
    const manualReturn = createLocalTimeISO(12, 0); // Manual return at 12:00
    const outsourcedTask = createOutsourcedTask('task-out', 'element-job-1', 0, 'provider-1', {
      manualReturn,
    });
    const internalTask = createTask('task-int', 'element-job-1', 1);
    job.taskIds = ['task-out', 'task-int'];

    const assignment = createAssignment(
      'task-out',
      createLocalTimeISO(14, 0), // departure
      createLocalTimeISO(9, 0), // scheduled return (will be overridden by manual)
      'provider-1',
      true
    );

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1', ['task-out', 'task-int'])],
      tasks: [outsourcedTask, internalTask],
      assignments: [assignment],
      providers: [createProvider('provider-1')],
    });

    const result = getOutsourcingTimeInfo(internalTask, snapshot, 6, PIXELS_PER_HOUR);

    expect(result).not.toBeNull();
    // Departure at 14:00 = 8 hours from startHour 6
    expect(result!.departureY).toBe(8 * PIXELS_PER_HOUR);
    // Manual return at 12:00 = 6 hours from startHour 6
    expect(result!.returnY).toBe(6 * PIXELS_PER_HOUR);
  });

  it('returns null when outsourced predecessor is not scheduled', () => {
    const job = createJob('job-1');
    const outsourcedTask = createOutsourcedTask('task-out', 'element-job-1', 0, 'provider-1');
    const internalTask = createTask('task-int', 'element-job-1', 1);
    job.taskIds = ['task-out', 'task-int'];

    const snapshot = createSnapshot({
      jobs: [job],
      elements: [createElement('job-1', ['task-out', 'task-int'])],
      tasks: [outsourcedTask, internalTask],
      assignments: [], // No assignment
      providers: [createProvider('provider-1')],
    });

    const result = getOutsourcingTimeInfo(internalTask, snapshot, 6, PIXELS_PER_HOUR);
    expect(result).toBeNull();
  });
});
