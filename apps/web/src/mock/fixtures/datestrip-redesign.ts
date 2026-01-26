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
  batSentAt,
  batApprovedAt,
  baseSnapshot,
  generateElementsForJobs,
  type JobWithoutElementIds,
} from './shared';

// ============================================================================
// Fixture: datestrip-redesign
// For v0.3.44 (DateStrip Redesign - REQ-09)
// Jobs spanning multiple days to test DateStrip scroll sync and visual states
// ============================================================================

export function createDatestripRedesignFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job with departure 7 days from now, tasks scheduled today and day 3
    {
      id: 'job-ds-1',
      reference: 'DS-001',
      client: 'DateStrip Client A',
      description: 'DateStrip Test Job 1',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7), // 7 days from now
      color: '#8b5cf6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      comments: [],
      taskIds: ['task-ds-1-a', 'task-ds-1-b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job with departure 14 days from now, task scheduled day 10
    {
      id: 'job-ds-2',
      reference: 'DS-002',
      client: 'DateStrip Client B',
      description: 'DateStrip Test Job 2',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14), // 14 days from now
      color: '#3b82f6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      comments: [],
      taskIds: ['task-ds-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-ds-1-a',
      elementId: 'elem-job-ds-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-ds-1-b',
      elementId: 'elem-job-ds-1',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-ds-2',
      elementId: 'elem-job-ds-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 90 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Assignments spread across multiple days
  const assignments: TaskAssignment[] = [
    // Task on today
    {
      id: 'assign-ds-1-a',
      taskId: 'task-ds-1-a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 0), // Today at 8:00
      scheduledEnd: isoDate(9, 30, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task on day 3
    {
      id: 'assign-ds-1-b',
      taskId: 'task-ds-1-b',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, 3), // Day 3 at 10:00
      scheduledEnd: isoDate(10, 45, 3),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task on day 10
    {
      id: 'assign-ds-2',
      taskId: 'task-ds-2',
      targetId: 'station-heidelberg',
      isOutsourced: false,
      scheduledStart: isoDate(7, 0, 10), // Day 10 at 7:00
      scheduledEnd: isoDate(9, 0, 10),
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
