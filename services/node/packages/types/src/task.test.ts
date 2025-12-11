import { describe, it, expect } from 'vitest';
import { isInternalTask, isOutsourcedTask, getTotalMinutes } from './task.js';
import type { InternalTask, OutsourcedTask } from './task.js';

describe('Task type guards', () => {
  const internalTask: InternalTask = {
    id: '1',
    jobId: 'job-1',
    type: 'Internal',
    sequenceOrder: 0,
    status: 'Ready',
    stationId: 'station-1',
    duration: { setupMinutes: 10, runMinutes: 30 },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  const outsourcedTask: OutsourcedTask = {
    id: '2',
    jobId: 'job-1',
    type: 'Outsourced',
    sequenceOrder: 1,
    status: 'Ready',
    providerId: 'provider-1',
    actionType: 'Pelliculage',
    duration: { openDays: 2 },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  it('should identify internal task', () => {
    expect(isInternalTask(internalTask)).toBe(true);
    expect(isInternalTask(outsourcedTask)).toBe(false);
  });

  it('should identify outsourced task', () => {
    expect(isOutsourcedTask(outsourcedTask)).toBe(true);
    expect(isOutsourcedTask(internalTask)).toBe(false);
  });
});

describe('getTotalMinutes', () => {
  it('should calculate total duration', () => {
    expect(getTotalMinutes({ setupMinutes: 10, runMinutes: 30 })).toBe(40);
    expect(getTotalMinutes({ setupMinutes: 0, runMinutes: 15 })).toBe(15);
    expect(getTotalMinutes({ setupMinutes: 20, runMinutes: 0 })).toBe(20);
  });
});
