import type {
  ScheduleSnapshot,
  Station,
  Job,
  Task,
  InternalTask,
  Element,
} from '@flux/types';
import {
  today,
  isoDate,
  baseSnapshot,
  sevenDayOperatingSchedule,
  type JobWithoutElementIds,
} from './shared';

// ============================================================================
// Fixture: approval-gates
// For UC-07 (Approval Gate Validation)
// Jobs with different approval states
// Uses 7-day operating schedule so tests pass on weekends
// ============================================================================

export function createApprovalGatesFixture(): ScheduleSnapshot {
  // Custom stations with 7-day operating schedule for weekend-proof testing
  const approvalGatesStations: Station[] = [
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
    // Job without BAT approval (cannot schedule)
    {
      id: 'job-gate-no-bat',
      reference: 'GATE-001',
      client: 'No BAT Client',
      description: 'Job without BAT approval',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#ef4444',
      comments: [],
      taskIds: ['task-gate-no-bat'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job with BAT approved (can schedule)
    {
      id: 'job-gate-bat-ok',
      reference: 'GATE-002',
      client: 'BAT OK Client',
      description: 'Job with BAT approved',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#22c55e',
      comments: [],
      taskIds: ['task-gate-bat-ok'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job with Plates pending (warning only)
    {
      id: 'job-gate-plates-pending',
      reference: 'GATE-003',
      client: 'Plates Pending Client',
      description: 'Job with Plates pending',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#f59e0b',
      comments: [],
      taskIds: ['task-gate-plates-pending'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-gate-no-bat',
      elementId: 'elem-job-gate-no-bat',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-gate-bat-ok',
      elementId: 'elem-job-gate-bat-ok',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-gate-plates-pending',
      elementId: 'elem-job-gate-plates-pending',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Create elements with specific prerequisite statuses for each test case
  const elements: Element[] = [
    // Element without BAT approval (batStatus: waiting_files) - BLOCKING
    {
      id: 'elem-job-gate-no-bat',
      jobId: 'job-gate-no-bat',
      suffix: 'ELT',
      prerequisiteElementIds: [],
      taskIds: ['task-gate-no-bat'],
      paperStatus: 'in_stock',
      batStatus: 'waiting_files', // BAT not approved - blocking
      plateStatus: 'ready',
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Element with BAT approved - CAN SCHEDULE
    {
      id: 'elem-job-gate-bat-ok',
      jobId: 'job-gate-bat-ok',
      suffix: 'ELT',
      prerequisiteElementIds: [],
      taskIds: ['task-gate-bat-ok'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved', // BAT approved - can schedule
      plateStatus: 'ready',
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Element with Plates pending - WARNING ONLY (not blocking)
    {
      id: 'elem-job-gate-plates-pending',
      jobId: 'job-gate-plates-pending',
      suffix: 'ELT',
      prerequisiteElementIds: [],
      taskIds: ['task-gate-plates-pending'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved', // BAT is approved
      plateStatus: 'to_make', // Plates not ready - warning only
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  // Add elementIds to jobs
  (jobs[0] as Job).elementIds = ['elem-job-gate-no-bat'];
  (jobs[1] as Job).elementIds = ['elem-job-gate-bat-ok'];
  (jobs[2] as Job).elementIds = ['elem-job-gate-plates-pending'];

  return {
    ...baseSnapshot(),
    stations: approvalGatesStations,
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments: [],
    conflicts: [],
    lateJobs: [],
  };
}
