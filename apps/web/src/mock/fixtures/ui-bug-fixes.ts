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
// Fixture: ui-bug-fixes
// For v0.3.42 (UI Bug Fixes - REQ-04/05/06)
// Multi-day grid with multiple jobs, long text content, and scheduled tasks
// ============================================================================

export function createUiBugFixesFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job with very long client name and description (for REQ-05 overflow test)
    {
      id: 'job-long-text',
      reference: 'LONG-001',
      client: 'Extremely Long Client Name That Should Definitely Overflow The Container Width',
      description: 'This is a very long description that should also be truncated properly with ellipsis',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6',
      comments: [],
      taskIds: ['task-long-text'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job A - has scheduled task (for REQ-06 click test)
    {
      id: 'job-a',
      reference: 'JOBA-001',
      client: 'Client Alpha',
      description: 'Job Alpha - Click to select',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#3b82f6', // Blue
      comments: [],
      taskIds: ['task-a'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job B - has scheduled task on same station (for REQ-06 muted tile click test)
    {
      id: 'job-b',
      reference: 'JOBB-002',
      client: 'Client Beta',
      description: 'Job Beta - Should be clickable when muted',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#22c55e', // Green
      comments: [],
      taskIds: ['task-b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job C - scheduled on Day 2 (for REQ-04 multi-day overlay test)
    {
      id: 'job-c',
      reference: 'JOBC-003',
      client: 'Client Gamma',
      description: 'Job Gamma - Day 2 task',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#f59e0b', // Amber
      comments: [],
      taskIds: ['task-c'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-long-text',
      elementId: 'elem-job-long-text',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-a',
      elementId: 'elem-job-a',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-b',
      elementId: 'elem-job-b',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-c',
      elementId: 'elem-job-c',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Task A and B on Day 1 (today), Task C on Day 2 (tomorrow)
  const assignments: TaskAssignment[] = [
    {
      id: 'assign-a',
      taskId: 'task-a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(7, 0),
      scheduledEnd: isoDate(8, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-b',
      taskId: 'task-b',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(9, 0),
      scheduledEnd: isoDate(10, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-c',
      taskId: 'task-c',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 1), // Tomorrow at 8:00
      scheduledEnd: isoDate(9, 30, 1),   // Tomorrow at 9:30
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
