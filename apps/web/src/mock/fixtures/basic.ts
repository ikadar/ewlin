import type {
  ScheduleSnapshot,
  Job,
  Task,
  InternalTask,
  TaskAssignment,
} from '@flux/types';
import {
  today,
  isoDate,
  baseSnapshot,
  generateElementsForJobs,
  type JobWithoutElementIds,
} from './shared';

// ============================================================================
// Fixture: test (Basic - existing)
// For UC-02 (Reschedule), UC-03 (Grid Snapping)
// ============================================================================

export function createBasicFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-test-1',
      reference: 'TEST-001',
      client: 'Test Client A',
      description: 'Test Job 1 - Brochures',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6',
      comments: [],
      taskIds: ['task-test-1-print', 'task-test-1-cut'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
    {
      id: 'job-test-2',
      reference: 'TEST-002',
      client: 'Test Client B',
      description: 'Test Job 2 - Flyers',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 5),
      color: '#3b82f6',
      comments: [],
      taskIds: ['task-test-2-print', 'task-test-2-cut'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
    {
      id: 'job-test-3',
      reference: 'TEST-003',
      client: 'Test Client C',
      description: 'Test Job 3 - Posters',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 3),
      color: '#22c55e',
      comments: [],
      taskIds: ['task-test-3-print'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-test-1-print',
      elementId: 'elem-job-test-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-offset',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-test-1-cut',
      elementId: 'elem-job-test-1',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-massicot',
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-test-2-print',
      elementId: 'elem-job-test-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-offset',
      duration: { setupMinutes: 30, runMinutes: 90 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-test-2-cut',
      elementId: 'elem-job-test-2',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-massicot',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-test-3-print',
      elementId: 'elem-job-test-3',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-offset',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    {
      id: 'assign-test-1-print',
      taskId: 'task-test-1-print',
      targetId: 'station-offset',
      isOutsourced: false,
      scheduledStart: isoDate(7, 0),
      scheduledEnd: isoDate(8, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-test-2-print',
      taskId: 'task-test-2-print',
      targetId: 'station-offset',
      isOutsourced: false,
      scheduledStart: isoDate(9, 0),
      scheduledEnd: isoDate(11, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-test-3-print',
      taskId: 'task-test-3-print',
      targetId: 'station-offset',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  // generateElementsForJobs mutates jobs to add elementIds
  const elements = generateElementsForJobs(jobs, tasks);
  return {
    ...baseSnapshot(),
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}
