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
// Fixture: context-menu (v0.3.58)
// For testing right-click context menu on tiles
// ============================================================================

export function createContextMenuFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job 1: Has 3 consecutive scheduled tasks on same station for swap testing
    {
      id: 'job-menu-1',
      reference: 'MENU-001',
      client: 'Context Menu Client',
      description: 'Context Menu Test - 3 consecutive tiles',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#3b82f6', // Blue
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-menu-1a', 'task-menu-1b', 'task-menu-1c'],
      fullyScheduled: true,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: Single tile (for isolated menu testing)
    {
      id: 'job-menu-2',
      reference: 'MENU-002',
      client: 'Isolated Tile Client',
      description: 'Single tile test',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 5),
      color: '#8b5cf6', // Purple
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-menu-2a'],
      fullyScheduled: true,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Job 1: 3 consecutive tasks on Komori (for swap testing)
    {
      id: 'task-menu-1a',
      elementId: 'elem-job-menu-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-menu-1b',
      elementId: 'elem-job-menu-1',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-menu-1c',
      elementId: 'elem-job-menu-1',
      sequenceOrder: 2,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 2: Single task on Heidelberg (isolated)
    {
      id: 'task-menu-2a',
      elementId: 'elem-job-menu-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Job 1: 3 consecutive tiles on Komori (8:00-9:00, 9:00-10:00, 10:00-11:00)
    {
      id: 'assign-menu-1a',
      taskId: 'task-menu-1a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-menu-1b',
      taskId: 'task-menu-1b',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(9, 0),
      scheduledEnd: isoDate(10, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-menu-1c',
      taskId: 'task-menu-1c',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0),
      scheduledEnd: isoDate(11, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: Single tile on Heidelberg (14:00-15:30)
    {
      id: 'assign-menu-2a',
      taskId: 'task-menu-2a',
      targetId: 'station-heidelberg',
      isOutsourced: false,
      scheduledStart: isoDate(14, 0),
      scheduledEnd: isoDate(15, 30),
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
