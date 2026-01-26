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
// Fixture: validation-messages
// For v0.3.52 (Human-Readable Validation Messages)
// Various conflict scenarios to test validation message display
// ============================================================================

export function createValidationMessagesFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job 1: Has 2 sequential tasks - for precedence conflict testing
    {
      id: 'job-val-1',
      reference: 'VAL-001',
      client: 'Validation Test Client',
      description: 'Validation Messages Test Job - Precedence',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#3b82f6', // Blue
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-val-1', 'task-val-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: BAT not approved - for approval gate conflict
    {
      id: 'job-val-2',
      reference: 'VAL-002',
      client: 'No BAT Client',
      description: 'Validation Messages Test Job - No BAT',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#ef4444', // Red
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: null }, // NOT approved
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-val-3'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 3: Normal job with valid task for comparison
    {
      id: 'job-val-3',
      reference: 'VAL-003',
      client: 'Valid Client',
      description: 'Validation Messages Test Job - Valid',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#22c55e', // Green
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-val-4'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Task 1: Predecessor on Komori, scheduled 8:00-10:00
    {
      id: 'task-val-1',
      elementId: 'elem-job-val-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori', // Offset - has dry time
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 2: Successor, unscheduled - will show precedence conflict if placed too early
    {
      id: 'task-val-2',
      elementId: 'elem-job-val-1',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar', // Cutting
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 3: No BAT approval - will show approval gate conflict
    {
      id: 'task-val-3',
      elementId: 'elem-job-val-2',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 4: Valid task for comparison
    {
      id: 'task-val-4',
      elementId: 'elem-job-val-3',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Task 1 scheduled at 8:00-10:00 on Komori
    // Dry time ends at 14:00 (10:00 + 4h)
    {
      id: 'assign-val-1',
      taskId: 'task-val-1',
      targetId: 'station-komori',
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
