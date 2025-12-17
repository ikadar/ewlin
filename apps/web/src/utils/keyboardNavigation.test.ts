import { describe, it, expect } from 'vitest';
import {
  getOrderedJobIds,
  getPreviousJobId,
  getNextJobId,
  calculateScrollToBottom,
  calculateScrollToCenter,
} from './keyboardNavigation';
import type { Job, Task, LateJob, ScheduleConflict, InternalTask } from '@flux/types';

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

function createTask(id: string, jobId: string): InternalTask {
  return {
    id,
    jobId,
    type: 'Internal',
    stationId: 'station-1',
    sequence: 1,
    sequenceOrder: 1,
    duration: {
      setupMinutes: 30,
      runMinutes: 60,
    },
    createdAt: '2025-12-15T00:00:00Z',
    updatedAt: '2025-12-15T00:00:00Z',
  };
}

function createLateJob(jobId: string): LateJob {
  return {
    jobId,
    daysOverdue: 1,
    workshopExitDate: '2025-12-15T00:00:00Z',
  };
}

function createConflict(taskId: string): ScheduleConflict {
  return {
    type: 'StationConflict',
    message: 'Test conflict',
    taskId,
    targetId: 'station-1',
  };
}

describe('getOrderedJobIds', () => {
  it('returns jobs in order: late first, then conflicts, then normal', () => {
    const jobs = [
      createJob('normal-1'),
      createJob('late-1'),
      createJob('conflict-1'),
      createJob('normal-2'),
    ];
    const tasks: Task[] = [createTask('task-conflict', 'conflict-1')];
    const lateJobs: LateJob[] = [createLateJob('late-1')];
    const conflicts: ScheduleConflict[] = [createConflict('task-conflict')];

    const result = getOrderedJobIds(jobs, tasks, lateJobs, conflicts);

    // Late jobs first, then conflict jobs, then normal jobs
    expect(result).toEqual(['late-1', 'conflict-1', 'normal-1', 'normal-2']);
  });

  it('returns empty array when no jobs', () => {
    const result = getOrderedJobIds([], [], [], []);
    expect(result).toEqual([]);
  });

  it('returns all normal jobs when no problems', () => {
    const jobs = [createJob('job-1'), createJob('job-2'), createJob('job-3')];

    const result = getOrderedJobIds(jobs, [], [], []);

    expect(result).toEqual(['job-1', 'job-2', 'job-3']);
  });

  it('handles job that is both late and has conflict', () => {
    const jobs = [createJob('problem-job'), createJob('normal-job')];
    const tasks: Task[] = [createTask('task-1', 'problem-job')];
    const lateJobs: LateJob[] = [createLateJob('problem-job')];
    const conflicts: ScheduleConflict[] = [createConflict('task-1')];

    const result = getOrderedJobIds(jobs, tasks, lateJobs, conflicts);

    // Job should appear once (as late, which is higher priority)
    expect(result).toEqual(['problem-job', 'normal-job']);
  });
});

describe('getPreviousJobId', () => {
  const orderedJobIds = ['job-1', 'job-2', 'job-3'];

  it('returns first job when none selected', () => {
    const result = getPreviousJobId(orderedJobIds, null);
    expect(result).toBe('job-1');
  });

  it('returns previous job in list', () => {
    const result = getPreviousJobId(orderedJobIds, 'job-2');
    expect(result).toBe('job-1');
  });

  it('wraps from first to last job', () => {
    const result = getPreviousJobId(orderedJobIds, 'job-1');
    expect(result).toBe('job-3');
  });

  it('returns null when list is empty', () => {
    const result = getPreviousJobId([], 'job-1');
    expect(result).toBeNull();
  });

  it('returns first job when current job not in list', () => {
    const result = getPreviousJobId(orderedJobIds, 'unknown-job');
    expect(result).toBe('job-1');
  });
});

describe('getNextJobId', () => {
  const orderedJobIds = ['job-1', 'job-2', 'job-3'];

  it('returns first job when none selected', () => {
    const result = getNextJobId(orderedJobIds, null);
    expect(result).toBe('job-1');
  });

  it('returns next job in list', () => {
    const result = getNextJobId(orderedJobIds, 'job-1');
    expect(result).toBe('job-2');
  });

  it('wraps from last to first job', () => {
    const result = getNextJobId(orderedJobIds, 'job-3');
    expect(result).toBe('job-1');
  });

  it('returns null when list is empty', () => {
    const result = getNextJobId([], 'job-1');
    expect(result).toBeNull();
  });

  it('returns first job when current job not in list', () => {
    const result = getNextJobId(orderedJobIds, 'unknown-job');
    expect(result).toBe('job-1');
  });
});

describe('calculateScrollToBottom', () => {
  it('calculates correct scroll position', () => {
    const yPosition = 1000;
    const viewportHeight = 600;
    const bottomMargin = 100;

    const result = calculateScrollToBottom(yPosition, viewportHeight, bottomMargin);

    // 1000 - 600 + 100 = 500
    expect(result).toBe(500);
  });

  it('clamps to zero for small y positions', () => {
    const yPosition = 100;
    const viewportHeight = 600;
    const bottomMargin = 100;

    const result = calculateScrollToBottom(yPosition, viewportHeight, bottomMargin);

    // 100 - 600 + 100 = -400, clamped to 0
    expect(result).toBe(0);
  });

  it('uses default bottom margin of 100', () => {
    const result = calculateScrollToBottom(1000, 600);
    expect(result).toBe(500);
  });
});

describe('calculateScrollToCenter', () => {
  it('calculates correct scroll position', () => {
    const yPosition = 1000;
    const viewportHeight = 600;

    const result = calculateScrollToCenter(yPosition, viewportHeight);

    // 1000 - 300 = 700
    expect(result).toBe(700);
  });

  it('clamps to zero for small y positions', () => {
    const yPosition = 100;
    const viewportHeight = 600;

    const result = calculateScrollToCenter(yPosition, viewportHeight);

    // 100 - 300 = -200, clamped to 0
    expect(result).toBe(0);
  });
});
