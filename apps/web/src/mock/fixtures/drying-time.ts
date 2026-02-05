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
// Fixture: drying-time
// For v0.3.51 (Drying Time Visualization)
// Job with printing task on offset station - shows yellow drying arrow during drag
// ============================================================================

export function createDryingTimeFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-dry-1',
      reference: 'DRY-001',
      client: 'Drying Time Client',
      description: 'Drying Time Visualization Test Job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#f59e0b', // Amber/Yellow (matches drying indicator)
      comments: [],
      taskIds: ['task-dry-1', 'task-dry-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Task 1: Printing on Komori (OFFSET) - SCHEDULED at 8:00-10:00
    // This task requires 4h drying time after completion
    {
      id: 'task-dry-1',
      elementId: 'elem-job-dry-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-offset', // OFFSET station - requires drying time
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 2: Cutting on Polar - UNSCHEDULED
    // When dragging: should show yellow drying arrow on Komori column
    // Arrow goes from 10:00 (task-dry-1 end) to 14:00 (10:00 + 4h dry time)
    {
      id: 'task-dry-2',
      elementId: 'elem-job-dry-1',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-massicot', // Cutting station
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Task 1 scheduled at 8:00-10:00 on Komori (offset)
    // Drying time: 10:00 + 4h = 14:00
    {
      id: 'assign-dry-1',
      taskId: 'task-dry-1',
      targetId: 'station-offset',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
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
