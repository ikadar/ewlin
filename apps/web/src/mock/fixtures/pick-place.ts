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
// Fixture: pick-place
// For v0.3.54 (Pick & Place from Sidebar)
// Jobs with unscheduled tasks for pick & place testing
// ============================================================================

export function createPickPlaceFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job 1: Has unscheduled tasks for picking
    {
      id: 'job-pick-1',
      reference: 'PICK-001',
      client: 'Pick & Place Client A',
      description: 'Pick & Place Test Job - Multiple unscheduled tasks',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#3b82f6', // Blue
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      comments: [],
      taskIds: ['task-pick-1a', 'task-pick-1b', 'task-pick-1c'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: All unscheduled (for testing multiple picks)
    {
      id: 'job-pick-2',
      reference: 'PICK-002',
      client: 'Pick & Place Client B',
      description: 'Pick & Place Test Job - All unscheduled',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 10),
      color: '#8b5cf6', // Purple
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      comments: [],
      taskIds: ['task-pick-2a', 'task-pick-2b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 3: Has existing scheduled task (for conflict testing)
    {
      id: 'job-pick-3',
      reference: 'PICK-003',
      client: 'Pick & Place Client C',
      description: 'Pick & Place Test Job - With scheduled task',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#22c55e', // Green
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      comments: [],
      taskIds: ['task-pick-3a', 'task-pick-3b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Job 1 tasks: Print (scheduled) → Cut (unscheduled) → Finish (unscheduled)
    {
      id: 'task-pick-1a',
      elementId: 'elem-job-pick-1',
      sequenceOrder: 0,
      status: 'Assigned', // Scheduled
      type: 'Internal',
      stationId: 'station-komori', // Offset
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-pick-1b',
      elementId: 'elem-job-pick-1',
      sequenceOrder: 1,
      status: 'Ready', // Unscheduled - waiting for predecessor
      type: 'Internal',
      stationId: 'station-polar', // Cutting
      duration: { setupMinutes: 15, runMinutes: 30 }, // 45min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-pick-1c',
      elementId: 'elem-job-pick-1',
      sequenceOrder: 2,
      status: 'Ready', // Unscheduled
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 2 tasks: All unscheduled (different stations)
    {
      id: 'task-pick-2a',
      elementId: 'elem-job-pick-2',
      sequenceOrder: 0,
      status: 'Ready', // Unscheduled
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-pick-2b',
      elementId: 'elem-job-pick-2',
      sequenceOrder: 1,
      status: 'Ready', // Unscheduled
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 3 tasks: Print (scheduled) → Cut (unscheduled, has predecessor)
    {
      id: 'task-pick-3a',
      elementId: 'elem-job-pick-3',
      sequenceOrder: 0,
      status: 'Assigned', // Scheduled
      type: 'Internal',
      stationId: 'station-komori', // Offset - requires dry time
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-pick-3b',
      elementId: 'elem-job-pick-3',
      sequenceOrder: 1,
      status: 'Ready', // Unscheduled - has precedence constraint (predecessor + dry time)
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 30 }, // 45min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Job 1, Task 1a: Scheduled at 8:00-9:30 (offset, so +4h dry time = 13:30 earliest for task 1b)
    {
      id: 'assign-pick-1a',
      taskId: 'task-pick-1a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 3, Task 3a: Scheduled at 10:00-11:30 (offset, so +4h dry time = 15:30 earliest for task 3b)
    {
      id: 'assign-pick-3a',
      taskId: 'task-pick-3a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0),
      scheduledEnd: isoDate(11, 30),
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
