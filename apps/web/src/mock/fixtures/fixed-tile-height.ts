import type {
  ScheduleSnapshot,
  Job,
  Task,
  InternalTask,
  TaskAssignment,
} from '@flux/types';
import {
  batSentAt,
  batApprovedAt,
  baseSnapshot,
  generateElementsForJobs,
  type JobWithoutElementIds,
} from './shared';

// ============================================================================
// Fixed Tile Height Fixture (v0.3.59)
// ============================================================================

/**
 * Fixture for testing Job Details Panel fixed tile height.
 * Contains tasks with varying durations to verify all tiles render at same height.
 */
export function createFixedTileHeightFixture(): ScheduleSnapshot {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isoDate = (hour: number, minute: number = 0): string => {
    const d = new Date(today);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-height-1',
      reference: 'HEIGHT-001',
      client: 'Test Client',
      description: 'Task with varying durations',
      status: 'InProgress',
      color: '#8b5cf6', // Purple
      workshopExitDate: isoDate(17, 0),
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      platesStatus: 'Done',
      paperPurchaseStatus: 'InStock',
      comments: [],
      taskIds: ['task-h-15min', 'task-h-30min', 'task-h-2h', 'task-h-4h'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'job-height-2',
      reference: 'HEIGHT-002',
      client: 'Another Client',
      description: 'Mix of scheduled and unscheduled',
      status: 'InProgress',
      color: '#3b82f6', // Blue
      workshopExitDate: isoDate(17, 0),
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      platesStatus: 'Done',
      paperPurchaseStatus: 'InStock',
      comments: [],
      taskIds: ['task-h-sched', 'task-h-unsched'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Job 1: 4 tasks with varying durations (all unscheduled)
    {
      id: 'task-h-15min',
      elementId: 'elem-job-height-1',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 5, runMinutes: 10 }, // 15 minutes total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-h-30min',
      elementId: 'elem-job-height-1',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 10, runMinutes: 20 }, // 30 minutes total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-h-2h',
      elementId: 'elem-job-height-1',
      sequenceOrder: 2,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2 hours total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-h-4h',
      elementId: 'elem-job-height-1',
      sequenceOrder: 3,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 60, runMinutes: 180 }, // 4 hours total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 2: One scheduled, one unscheduled
    {
      id: 'task-h-sched',
      elementId: 'elem-job-height-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1 hour
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-h-unsched',
      elementId: 'elem-job-height-2',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2 hours
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Only job-height-2's first task is scheduled
    {
      id: 'assign-h-sched',
      taskId: 'task-h-sched',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 0),
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
