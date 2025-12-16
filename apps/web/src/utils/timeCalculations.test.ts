import { describe, it, expect } from 'vitest';
import { calculateEndTime, getDurationMs } from './timeCalculations';
import type { InternalTask } from '@flux/types';

// Helper to create a mock internal task
function createMockTask(setupMinutes: number, runMinutes: number): InternalTask {
  return {
    id: 'task-1',
    jobId: 'job-1',
    type: 'Internal',
    stationId: 'station-1',
    sequenceOrder: 0,
    status: 'Ready',
    duration: {
      setupMinutes,
      runMinutes,
    },
    createdAt: '2025-12-16T10:00:00Z',
    updatedAt: '2025-12-16T10:00:00Z',
  };
}

describe('calculateEndTime', () => {
  it('calculates end time correctly for a 60-minute task', () => {
    const task = createMockTask(10, 50); // 60 minutes total
    const scheduledStart = '2025-12-16T10:00:00Z';
    const endTime = calculateEndTime(task, scheduledStart);

    expect(endTime).toBe('2025-12-16T11:00:00.000Z');
  });

  it('calculates end time correctly for a 30-minute task', () => {
    const task = createMockTask(0, 30); // 30 minutes total
    const scheduledStart = '2025-12-16T14:30:00Z';
    const endTime = calculateEndTime(task, scheduledStart);

    expect(endTime).toBe('2025-12-16T15:00:00.000Z');
  });

  it('calculates end time correctly for a 2-hour task', () => {
    const task = createMockTask(15, 105); // 120 minutes total
    const scheduledStart = '2025-12-16T08:00:00Z';
    const endTime = calculateEndTime(task, scheduledStart);

    expect(endTime).toBe('2025-12-16T10:00:00.000Z');
  });

  it('handles tasks spanning midnight', () => {
    const task = createMockTask(30, 90); // 120 minutes total
    const scheduledStart = '2025-12-16T23:00:00Z';
    const endTime = calculateEndTime(task, scheduledStart);

    expect(endTime).toBe('2025-12-17T01:00:00.000Z');
  });
});

describe('getDurationMs', () => {
  it('returns duration in milliseconds', () => {
    const task = createMockTask(10, 50); // 60 minutes total
    const durationMs = getDurationMs(task);

    expect(durationMs).toBe(60 * 60 * 1000); // 1 hour in ms
  });

  it('handles setup only', () => {
    const task = createMockTask(30, 0);
    const durationMs = getDurationMs(task);

    expect(durationMs).toBe(30 * 60 * 1000);
  });

  it('handles run only', () => {
    const task = createMockTask(0, 45);
    const durationMs = getDurationMs(task);

    expect(durationMs).toBe(45 * 60 * 1000);
  });
});
