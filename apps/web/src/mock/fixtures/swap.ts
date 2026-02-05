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
// Fixture: swap
// For UC-09 (Swap Operations)
// 3 tiles on same station for swap testing
// ============================================================================

export function createSwapFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-swap-1',
      reference: 'SWAP-001',
      client: 'Swap Client A',
      description: 'Swap Job 1 (Top)',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6',
      comments: [],
      taskIds: ['task-swap-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'job-swap-2',
      reference: 'SWAP-002',
      client: 'Swap Client B',
      description: 'Swap Job 2 (Middle)',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#3b82f6',
      comments: [],
      taskIds: ['task-swap-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'job-swap-3',
      reference: 'SWAP-003',
      client: 'Swap Client C',
      description: 'Swap Job 3 (Bottom) - has predecessor',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#22c55e',
      comments: [],
      taskIds: ['task-swap-3-pred', 'task-swap-3'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-swap-1',
      elementId: 'elem-job-swap-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-swap-2',
      elementId: 'elem-job-swap-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Predecessor task for SWAP-003: scheduled on Polar, ends at 9:00
    {
      id: 'task-swap-3-pred',
      elementId: 'elem-job-swap-3',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Main task for SWAP-003: must start after predecessor ends
    {
      id: 'task-swap-3',
      elementId: 'elem-job-swap-3',
      sequenceOrder: 1, // After predecessor
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // 3 consecutive 1h tiles: 7:00-8:00, 8:00-9:00, 9:00-10:00
  const assignments: TaskAssignment[] = [
    {
      id: 'assign-swap-1',
      taskId: 'task-swap-1',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(7, 0),
      scheduledEnd: isoDate(8, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-swap-2',
      taskId: 'task-swap-2',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Predecessor for SWAP-003: on Polar, 8:00-9:00 (ends when task-swap-3 starts)
    {
      id: 'assign-swap-3-pred',
      taskId: 'task-swap-3-pred',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // SWAP-003 main task: on Komori, 9:00-10:00
    {
      id: 'assign-swap-3',
      taskId: 'task-swap-3',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(9, 0),
      scheduledEnd: isoDate(10, 0),
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
