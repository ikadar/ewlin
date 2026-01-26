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
// Fixture: precedence-working-hours
// For v0.3.53 (Precedence Lines + Working Hours)
// Job with printing task ending near lunch to test working hours calculation
// ============================================================================

export function createPrecedenceWorkingHoursFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job 1: Drying ends during lunch - demonstrates snap to 13:00
    {
      id: 'job-pwh-1',
      reference: 'PWH-001',
      client: 'Lunch Snap Client',
      description: 'Drying ends during lunch → snap to 13:00',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#8b5cf6', // Purple
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      comments: [],
      taskIds: ['task-pwh-1', 'task-pwh-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: Drying ends within working hours - no snap needed
    {
      id: 'job-pwh-2',
      reference: 'PWH-002',
      client: 'Normal Dry Client',
      description: 'Drying ends within working hours → no snap',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#3b82f6', // Blue
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      comments: [],
      taskIds: ['task-pwh-3', 'task-pwh-4'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // === Job 1: Drying ends during lunch ===
    // Task 1: Printing on Komori (OFFSET) - SCHEDULED at 6:30-8:30
    // Ends at 8:30, dry time = 4h → Drying ends at 12:30 (DURING LUNCH)
    // Since 12:30 is in lunch break (12:00-13:00), snap to 13:00
    // Purple line should be at 13:00
    {
      id: 'task-pwh-1',
      elementId: 'elem-job-pwh-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori', // OFFSET station - requires 4h drying time
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 2: Successor - unscheduled
    {
      id: 'task-pwh-2',
      elementId: 'elem-job-pwh-1',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // === Job 2: Drying ends within working hours ===
    // Task 3: Printing on Heidelberg (OFFSET) - SCHEDULED at 9:00-11:00
    // Ends at 11:00, dry time = 4h → Drying ends at 15:00
    // 15:00 is within working hours (13:00-22:00) → no snap needed
    // Purple line should be at 15:00
    {
      id: 'task-pwh-3',
      elementId: 'elem-job-pwh-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-heidelberg', // OFFSET station - requires 4h drying time
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 4: Successor - unscheduled
    {
      id: 'task-pwh-4',
      elementId: 'elem-job-pwh-2',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Job 1: Task ends at 8:30, drying ends at 12:30 (lunch), snap to 13:00
    {
      id: 'assign-pwh-1',
      taskId: 'task-pwh-1',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(6, 30),
      scheduledEnd: isoDate(8, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: Task ends at 11:00, drying ends at 15:00 (working hours), no snap
    {
      id: 'assign-pwh-3',
      taskId: 'task-pwh-3',
      targetId: 'station-heidelberg',
      isOutsourced: false,
      scheduledStart: isoDate(9, 0),
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
