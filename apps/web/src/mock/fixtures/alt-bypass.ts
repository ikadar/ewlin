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
// Fixture: alt-bypass
// For v0.3.28 (Alt+Drag Bypass Bug Fix - REQ-13)
// Job with 2 sequential tasks - Task 1 scheduled at 10:00-11:00, Task 2 unscheduled
// Used to test Alt+drop conflict recording
// ============================================================================

export function createAltBypassFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-bypass-1',
      reference: 'BYPASS-001',
      client: 'Alt Bypass Client',
      description: 'Alt Bypass Test Job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#3b82f6', // Blue
      comments: [],
      taskIds: ['task-bypass-1', 'task-bypass-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-bypass-1',
      elementId: 'elem-job-bypass-1',
      sequenceOrder: 0,  // First task
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-offset',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h total (10:00-11:00)
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-bypass-2',
      elementId: 'elem-job-bypass-1',
      sequenceOrder: 1,  // Second task (must wait for first to complete at 11:00)
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-massicot', // Different station to allow placement
      duration: { setupMinutes: 15, runMinutes: 30 }, // 45min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Task 1 is scheduled at 10:00-11:00
  // Task 2 is unscheduled - valid placement is >= 11:00
  // Placing Task 2 before 11:00 creates a precedence conflict
  const assignments: TaskAssignment[] = [
    {
      id: 'assign-bypass-1',
      taskId: 'task-bypass-1',
      targetId: 'station-offset',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0),
      scheduledEnd: isoDate(11, 0),
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
