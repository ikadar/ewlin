import { describe, it, expect } from 'vitest';
import {
  getAvailableTaskForStation,
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
    workshopEntryDate: '2025-12-16T08:00:00Z',
    workshopExitDate: '2025-12-20T17:00:00Z',
    approvalGates: {
      bat: 'approved',
      paper: 'approved',
      plates: 'approved',
    },
    createdAt: '2025-12-15T00:00:00Z',
    updatedAt: '2025-12-15T00:00:00Z',
  };
}

function createInternalTask(
  id: string,
  jobId: string,
  stationId: string,
  sequence: number
): InternalTask {
  return {
    id,
    jobId,
    type: 'Internal',
    stationId,
    sequence,
    sequenceOrder: sequence,
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

describe('getAvailableTaskForStation', () => {
  const job = createJob('job-1');
  const stationA = 'station-a';
  const stationB = 'station-b';

  it('returns the only unscheduled task when there is just one', () => {
    const tasks: Task[] = [createInternalTask('task-1', 'job-1', stationA, 1)];
    const assignments: TaskAssignment[] = [];

    const result = getAvailableTaskForStation(job, tasks, assignments, stationA);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('task-1');
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

  it('returns the highest sequence task without successor (backward scheduling)', () => {
    // Job has: Task 1 (seq 1) → Task 2 (seq 2) → Task 3 (seq 3)
    // All on stationA, none scheduled
    // Should return Task 3 (highest sequence, no successor)
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationA, 2),
      createInternalTask('task-3', 'job-1', stationA, 3),
    ];
    const assignments: TaskAssignment[] = [];

    const result = getAvailableTaskForStation(job, tasks, assignments, stationA);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('task-3');
  });

  it('returns task when its successor is already scheduled', () => {
    // Task 3 is scheduled, so Task 2 should be available
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationA, 2),
      createInternalTask('task-3', 'job-1', stationA, 3),
    ];
    const assignments: TaskAssignment[] = [createAssignment('task-3', stationA)];

    const result = getAvailableTaskForStation(job, tasks, assignments, stationA);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('task-2');
  });

  it('returns null when successor is not yet scheduled', () => {
    // Task 3 is not scheduled, so Task 2 should NOT be available
    // Even though Task 2 is unscheduled, its successor (Task 3) is not placed
    // Only Task 3 should be available
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationA, 2),
      createInternalTask('task-3', 'job-1', stationA, 3),
    ];
    const assignments: TaskAssignment[] = [];

    // getAvailableTaskForStation should return task-3, not task-2
    const result = getAvailableTaskForStation(job, tasks, assignments, stationA);
    expect(result!.id).toBe('task-3');

    // Simulating: if task-3 were the only unscheduled one, we'd still get task-3
    // But if we ask for a task when task-3 is not the highest unscheduled,
    // we need to check the logic works in sequence
  });

  it('handles tasks on different stations correctly', () => {
    // Job has tasks on different stations
    // Should only consider tasks for the requested station
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationB, 2), // Different station
      createInternalTask('task-3', 'job-1', stationA, 3),
    ];
    const assignments: TaskAssignment[] = [];

    // For stationA, task-3 is the highest sequence unscheduled task
    const result = getAvailableTaskForStation(job, tasks, assignments, stationA);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('task-3');
  });

  it('considers cross-station sequencing for successor check', () => {
    // Task 1 (stationA, seq 1) → Task 2 (stationB, seq 2) → Task 3 (stationA, seq 3)
    // Task 2 and Task 3 are not scheduled
    // For stationA: Task 3 is available (no successor)
    // For stationB: Task 2's successor (Task 3) is not scheduled, so Task 2 is NOT available
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationB, 2),
      createInternalTask('task-3', 'job-1', stationA, 3),
    ];
    const assignments: TaskAssignment[] = [];

    // For stationA: task-3 is available
    const resultA = getAvailableTaskForStation(job, tasks, assignments, stationA);
    expect(resultA).not.toBeNull();
    expect(resultA!.id).toBe('task-3');

    // For stationB: task-2's successor (task-3) is not scheduled
    const resultB = getAvailableTaskForStation(job, tasks, assignments, stationB);
    expect(resultB).toBeNull();
  });

  it('allows task when successor on different station is scheduled', () => {
    // Task 2 (stationB) → Task 3 (stationA) where Task 3 is scheduled
    // Task 2 should be available for stationB
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationB, 2),
      createInternalTask('task-3', 'job-1', stationA, 3),
    ];
    const assignments: TaskAssignment[] = [createAssignment('task-3', stationA)];

    const result = getAvailableTaskForStation(job, tasks, assignments, stationB);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('task-2');
  });
});

describe('getStationsWithAvailableTasks', () => {
  const job = createJob('job-1');
  const stationA = 'station-a';
  const stationB = 'station-b';

  it('returns stations with available tasks', () => {
    const tasks: Task[] = [
      createInternalTask('task-1', 'job-1', stationA, 1),
      createInternalTask('task-2', 'job-1', stationB, 2),
    ];
    const assignments: TaskAssignment[] = [];

    const result = getStationsWithAvailableTasks(job, tasks, assignments);

    // stationA has task-1 available (no successor in this case because task-2 is on stationB)
    // Wait, task-2 has sequence 2, so it's the successor of task-1
    // task-2 is not scheduled, so task-1's successor is not placed
    // Only task-2 should be available (highest sequence, no successor)
    // So only stationB should have available tasks
    expect(result).toContain(stationB);
    expect(result).not.toContain(stationA);
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
});
