import type {
  ScheduleSnapshot,
  Station,
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
  sevenDayOperatingSchedule,
  type JobWithoutElementIds,
} from './shared';

// ============================================================================
// Fixture: push-down
// For UC-04 (Push-Down on Collision)
// 3 consecutive tiles with no gaps for testing push-down chain
// Uses 7-day operating schedule so tests pass on weekends
// ============================================================================

export function createPushDownFixture(): ScheduleSnapshot {
  // Custom stations with 7-day operating schedule for weekend-proof testing
  const pushDownStations: Station[] = [
    {
      id: 'station-komori',
      name: 'Komori G40',
      status: 'Available',
      categoryId: 'cat-offset',
      groupId: 'grp-offset',
      capacity: 1,
      operatingSchedule: sevenDayOperatingSchedule,
      exceptions: [],
    },
  ];

  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-pd-1',
      reference: 'PD-001',
      client: 'PushDown Client A',
      description: 'Push-Down Job 1',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      comments: [],
      taskIds: ['task-pd-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'job-pd-2',
      reference: 'PD-002',
      client: 'PushDown Client B',
      description: 'Push-Down Job 2',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#3b82f6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      comments: [],
      taskIds: ['task-pd-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'job-pd-3',
      reference: 'PD-003',
      client: 'PushDown Client C',
      description: 'Push-Down Job 3',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#22c55e',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      comments: [],
      taskIds: ['task-pd-3'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-pd-1',
      elementId: 'elem-job-pd-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-pd-2',
      elementId: 'elem-job-pd-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-pd-3',
      elementId: 'elem-job-pd-3',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Consecutive tiles: 7:00-8:30, 8:30-10:00, 10:00-11:30
  const assignments: TaskAssignment[] = [
    {
      id: 'assign-pd-1',
      taskId: 'task-pd-1',
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
      id: 'assign-pd-2',
      taskId: 'task-pd-2',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 30),
      scheduledEnd: isoDate(10, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-pd-3',
      taskId: 'task-pd-3',
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
    stations: pushDownStations,
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}
