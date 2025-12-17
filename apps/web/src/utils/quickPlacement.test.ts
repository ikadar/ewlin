import { describe, it, expect } from 'vitest';
import {
  getAvailableTaskForStation,
  getLastUnscheduledTask,
  canActivateQuickPlacement,
  getStationsWithAvailableTasks,
} from './quickPlacement';
import type { Job, Task, TaskAssignment, InternalTask } from '@flux/types';

// Helper to create test data
function createJob(id: string): Job {
  return {
    id,
    reference: `REF-${id}`,
    client: 'Test Client',
    description: 'Test Job',
    color: '#8b5cf6',
    workshopExitDate: '2025-12-20',
    status: 'Planned',
    fullyScheduled: false,
    paperType: 'CB 300g',
    paperFormat: '52x74',
    paperPurchaseStatus: 'InStock',
    proofApproval: {
      sentAt: '2025-12-10',
      approvedAt: '2025-12-12',
    },
    platesStatus: 'Done',
    requiredJobIds: [],
    comments: [],
    taskIds: [],
    createdAt: '2025-12-15T00:00:00Z',
    updatedAt: '2025-12-15T00:00:00Z',
  };
}

function createInternalTask(
  id: string,
  jobId: string,
  stationId: string,
  sequenceOrder: number
): InternalTask {
  return {
    id,
    jobId,
    type: 'Internal',
    stationId,
    status: 'Ready',
    sequenceOrder,
    duration: {
      setupMinutes: 30,
      runMinutes: 60,
    },
    createdAt: '2025-12-15T00:00:00Z',
    updatedAt: '2025-12-15T00:00:00Z',
  };
}

function createAssignment(taskId: string, stationId: string): TaskAssignment {
  return {
    id: `assign-${taskId}`,
    taskId,
    targetId: stationId,
    isOutsourced: false,
    scheduledStart: '2025-12-16T08:00:00Z',
    scheduledEnd: '2025-12-16T09:30:00Z',
    isCompleted: false,
    completedAt: null,
    createdAt: '2025-12-15T00:00:00Z',
    updatedAt: '2025-12-15T00:00:00Z',
  };
}

describe('canActivateQuickPlacement', () => {
  it('returns true when a job is selected', () => {
    expect(canActivateQuickPlacement('job-1')).toBe(true);
  });

  it('returns false when no job is selected', () => {
    expect(canActivateQuickPlacement(null)).toBe(false);
  });
});

describe('getLastUnscheduledTask', () => {
  const job = createJob('job-1');

  it('returns the only unscheduled task', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 'station-a', 1)];
    const assignments: TaskAssignment[] = [];

    const result = getLastUnscheduledTask(job, tasks, assignments);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('task-1');
  });

  it('returns the highest sequence unscheduled task', () => {
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', 'station-a', 1),
      createInternalTask('task-2', 'job-1', 'station-b', 2),
      createInternalTask('task-3', 'job-1', 'station-c', 3),
    ];
    const assignments: TaskAssignment[] = [];

    const result = getLastUnscheduledTask(job, tasks, assignments);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('task-3');
    expect(result!.sequenceOrder).toBe(3);
  });

  it('skips already scheduled tasks', () => {
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', 'station-a', 1),
      createInternalTask('task-2', 'job-1', 'station-b', 2),
      createInternalTask('task-3', 'job-1', 'station-c', 3),
    ];
    // Task 3 is scheduled
    const assignments: TaskAssignment[] = [createAssignment('task-3', 'station-c')];

    const result = getLastUnscheduledTask(job, tasks, assignments);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('task-2');
  });

  it('returns null when all tasks are scheduled', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', 'station-a', 1)];
    const assignments: TaskAssignment[] = [createAssignment('task-1', 'station-a')];

    const result = getLastUnscheduledTask(job, tasks, assignments);
    expect(result).toBeNull();
  });

  it('returns null when job has no tasks', () => {
    const tasks: Task[] = [];
    const assignments: TaskAssignment[] = [];

    const result = getLastUnscheduledTask(job, tasks, assignments);
    expect(result).toBeNull();
  });
});

describe('getAvailableTaskForStation', () => {
  const job = createJob('job-1');
  const stationA = 'station-a';
  const stationB = 'station-b';
  const stationC = 'station-c';

  it('returns the task when it is the last unscheduled and matches station', () => {
    // Only one task, it's the last and matches station
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', stationA, 1)];
    const assignments: TaskAssignment[] = [];

    const result = getAvailableTaskForStation(job, tasks, assignments, stationA);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('task-1');
  });

  it('returns null when station does not have the last unscheduled task', () => {
    // Task 1 is on stationA (seq 1), Task 2 is on stationB (seq 2)
    // Last unscheduled is task-2, so stationA returns null
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationB, 2),
    ];
    const assignments: TaskAssignment[] = [];

    // StationA should return null because task-2 (last) is not on stationA
    const result = getAvailableTaskForStation(job, tasks, assignments, stationA);
    expect(result).toBeNull();

    // StationB should return task-2 because it's the last unscheduled
    const resultB = getAvailableTaskForStation(job, tasks, assignments, stationB);
    expect(resultB).not.toBeNull();
    expect(resultB!.id).toBe('task-2');
  });

  it('returns null when all tasks are scheduled', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', stationA, 1)];
    const assignments: TaskAssignment[] = [createAssignment('task-1', stationA)];

    const result = getAvailableTaskForStation(job, tasks, assignments, stationA);
    expect(result).toBeNull();
  });

  it('returns null when no tasks exist for the station', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', stationB, 1)];
    const assignments: TaskAssignment[] = [];

    const result = getAvailableTaskForStation(job, tasks, assignments, stationA);
    expect(result).toBeNull();
  });

  it('supports backward scheduling: place last task first', () => {
    // Workflow: Task 1 (seq 1, stationA) → Task 2 (seq 2, stationB) → Task 3 (seq 3, stationC)
    // None scheduled → only stationC is available (task 3)
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationB, 2),
      createInternalTask('task-3', 'job-1', stationC, 3),
    ];
    const assignments: TaskAssignment[] = [];

    // Only stationC should have available task
    expect(getAvailableTaskForStation(job, tasks, assignments, stationA)).toBeNull();
    expect(getAvailableTaskForStation(job, tasks, assignments, stationB)).toBeNull();
    expect(getAvailableTaskForStation(job, tasks, assignments, stationC)?.id).toBe('task-3');
  });

  it('allows previous task after last is scheduled', () => {
    // Task 3 is scheduled → Task 2 becomes available
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationB, 2),
      createInternalTask('task-3', 'job-1', stationC, 3),
    ];
    const assignments: TaskAssignment[] = [createAssignment('task-3', stationC)];

    // Now stationB should have task-2 available
    expect(getAvailableTaskForStation(job, tasks, assignments, stationA)).toBeNull();
    expect(getAvailableTaskForStation(job, tasks, assignments, stationB)?.id).toBe('task-2');
    expect(getAvailableTaskForStation(job, tasks, assignments, stationC)).toBeNull();
  });

  it('works through full backward scheduling sequence', () => {
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationB, 2),
      createInternalTask('task-3', 'job-1', stationC, 3),
    ];

    // Step 1: None scheduled → only task-3 available
    let assignments: TaskAssignment[] = [];
    expect(getAvailableTaskForStation(job, tasks, assignments, stationC)?.id).toBe('task-3');

    // Step 2: Task 3 scheduled → task-2 available
    assignments = [createAssignment('task-3', stationC)];
    expect(getAvailableTaskForStation(job, tasks, assignments, stationB)?.id).toBe('task-2');

    // Step 3: Task 2 & 3 scheduled → task-1 available
    assignments = [
      createAssignment('task-3', stationC),
      createAssignment('task-2', stationB),
    ];
    expect(getAvailableTaskForStation(job, tasks, assignments, stationA)?.id).toBe('task-1');

    // Step 4: All scheduled → nothing available
    assignments = [
      createAssignment('task-3', stationC),
      createAssignment('task-2', stationB),
      createAssignment('task-1', stationA),
    ];
    expect(getAvailableTaskForStation(job, tasks, assignments, stationA)).toBeNull();
    expect(getAvailableTaskForStation(job, tasks, assignments, stationB)).toBeNull();
    expect(getAvailableTaskForStation(job, tasks, assignments, stationC)).toBeNull();
  });
});

describe('getStationsWithAvailableTasks', () => {
  const job = createJob('job-1');
  const stationA = 'station-a';
  const stationB = 'station-b';
  const stationC = 'station-c';

  it('returns only the station with the last unscheduled task', () => {
    // Task 1 on stationA, Task 2 on stationB
    // Only stationB should be available (task-2 is the last)
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationB, 2),
    ];
    const assignments: TaskAssignment[] = [];

    const result = getStationsWithAvailableTasks(job, tasks, assignments);
    expect(result).toContain(stationB);
    expect(result).not.toContain(stationA);
    expect(result).toHaveLength(1);
  });

  it('returns empty array when all tasks are scheduled', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', stationA, 1)];
    const assignments: TaskAssignment[] = [createAssignment('task-1', stationA)];

    const result = getStationsWithAvailableTasks(job, tasks, assignments);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when job has no tasks', () => {
    const tasks: Task[] = [];
    const assignments: TaskAssignment[] = [];

    const result = getStationsWithAvailableTasks(job, tasks, assignments);
    expect(result).toHaveLength(0);
  });

  it('shifts to previous station as tasks are scheduled', () => {
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationB, 2),
      createInternalTask('task-3', 'job-1', stationC, 3),
    ];

    // None scheduled → only stationC
    let result = getStationsWithAvailableTasks(job, tasks, []);
    expect(result).toEqual([stationC]);

    // Task 3 scheduled → only stationB
    result = getStationsWithAvailableTasks(job, tasks, [createAssignment('task-3', stationC)]);
    expect(result).toEqual([stationB]);

    // Task 2 & 3 scheduled → only stationA
    result = getStationsWithAvailableTasks(job, tasks, [
      createAssignment('task-3', stationC),
      createAssignment('task-2', stationB),
    ]);
    expect(result).toEqual([stationA]);
  });
});
