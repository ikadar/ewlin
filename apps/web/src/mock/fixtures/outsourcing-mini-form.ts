import type {
  ScheduleSnapshot,
  Job,
  Task,
  InternalTask,
  OutsourcedTask,
  TaskAssignment,
  OutsourcedProvider,
} from '@flux/types';
import {
  today,
  isoDate,
  baseSnapshot,
  generateElementsForJobs,
  type JobWithoutElementIds,
} from './shared';

// ============================================================================
// Fixture: outsourcing-mini-form
// For v0.5.11 (Outsourcing Mini-Form)
// Jobs with outsourced tasks to test the mini-form in Job Details Panel
// ============================================================================

// Test providers
const testProviders: OutsourcedProvider[] = [
  {
    id: 'provider-pelliculage',
    name: 'ABC Finitions',
    status: 'Active',
    supportedActionTypes: ['Pelliculage', 'Vernis UV'],
    latestDepartureTime: '14:00',
    receptionTime: '09:00',
    transitDays: 1,
    groupId: 'grp-outsourced',
  },
  {
    id: 'provider-dorure',
    name: 'Dorure Express',
    status: 'Active',
    supportedActionTypes: ['Dorure', 'Embossage'],
    latestDepartureTime: '16:00',
    receptionTime: '10:00',
    transitDays: 2,
    groupId: 'grp-outsourced',
  },
  {
    id: 'provider-reliure',
    name: 'Reliure Pro',
    status: 'Active',
    supportedActionTypes: ['Reliure', 'Dos carré collé'],
    latestDepartureTime: '12:00',
    receptionTime: '08:00',
    transitDays: 1,
    groupId: 'grp-outsourced',
  },
];

export function createOutsourcingMiniFormFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job 1: Print → Pelliculage (outsourced) → Cut
    // Predecessor scheduled, so dates should auto-calculate
    {
      id: 'job-outsource-1',
      reference: 'OUT-001',
      client: 'Outsourcing Client A',
      description: 'Job with scheduled predecessor - auto-calculation test',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#3b82f6', // Blue
      comments: [],
      taskIds: ['task-out-1a', 'task-out-1b', 'task-out-1c'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
    // Job 2: Print (unscheduled) → Dorure (outsourced) → Finish
    // Predecessor not scheduled, dates should be empty
    {
      id: 'job-outsource-2',
      reference: 'OUT-002',
      client: 'Outsourcing Client B',
      description: 'Job with unscheduled predecessor - empty dates test',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 21),
      color: '#8b5cf6', // Purple
      comments: [],
      taskIds: ['task-out-2a', 'task-out-2b', 'task-out-2c'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
    // Job 3: Cut → Reliure (outsourced with manual dates)
    // Has manual override values
    {
      id: 'job-outsource-3',
      reference: 'OUT-003',
      client: 'Outsourcing Client C',
      description: 'Job with manual date overrides',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 10),
      color: '#22c55e', // Green
      comments: [],
      taskIds: ['task-out-3a', 'task-out-3b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
    // Job 4: Internal-only job (no outsourcing)
    // For regression testing - should show standard tiles
    {
      id: 'job-internal-only',
      reference: 'INT-001',
      client: 'Internal Client',
      description: 'Internal tasks only - standard tiles',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#f59e0b', // Amber
      comments: [],
      taskIds: ['task-int-1a', 'task-int-1b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
  ];

  const tasks: Task[] = [
    // Job 1 tasks: Print (scheduled) → Pelliculage → Cut
    {
      id: 'task-out-1a',
      elementId: 'elem-job-outsource-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-offset',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-out-1b',
      elementId: 'elem-job-outsource-1',
      sequenceOrder: 1,
      status: 'Defined',
      type: 'Outsourced',
      providerId: 'provider-pelliculage',
      actionType: 'Pelliculage',
      duration: {
        openDays: 2,
        latestDepartureTime: '14:00',
        receptionTime: '09:00',
      },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as OutsourcedTask,
    {
      id: 'task-out-1c',
      elementId: 'elem-job-outsource-1',
      sequenceOrder: 2,
      status: 'Defined',
      type: 'Internal',
      stationId: 'station-massicot',
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 2 tasks: Print (unscheduled) → Dorure → Finish
    {
      id: 'task-out-2a',
      elementId: 'elem-job-outsource-2',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-offset',
      duration: { setupMinutes: 30, runMinutes: 90 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-out-2b',
      elementId: 'elem-job-outsource-2',
      sequenceOrder: 1,
      status: 'Defined',
      type: 'Outsourced',
      providerId: 'provider-dorure',
      actionType: 'Dorure',
      duration: {
        openDays: 3,
        latestDepartureTime: '16:00',
        receptionTime: '10:00',
      },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as OutsourcedTask,
    {
      id: 'task-out-2c',
      elementId: 'elem-job-outsource-2',
      sequenceOrder: 2,
      status: 'Defined',
      type: 'Internal',
      stationId: 'station-massicot',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 3 tasks: Cut (scheduled) → Reliure (with manual dates)
    {
      id: 'task-out-3a',
      elementId: 'elem-job-outsource-3',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-massicot',
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-out-3b',
      elementId: 'elem-job-outsource-3',
      sequenceOrder: 1,
      status: 'Defined',
      type: 'Outsourced',
      providerId: 'provider-reliure',
      actionType: 'Reliure',
      duration: {
        openDays: 4,
        latestDepartureTime: '12:00',
        receptionTime: '08:00',
      },
      manualDeparture: isoDate(12, 0, 2), // Manual: 2 days from now at 12:00
      manualReturn: isoDate(8, 0, 8), // Manual: 8 days from now at 08:00
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as OutsourcedTask,

    // Job 4 tasks: Internal only
    {
      id: 'task-int-1a',
      elementId: 'elem-job-internal-only',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-offset',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-int-1b',
      elementId: 'elem-job-internal-only',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-massicot',
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Assignments for scheduled tasks
  const assignments: TaskAssignment[] = [
    // Job 1: Print scheduled at 8:00 today
    {
      id: 'assign-out-1a',
      taskId: 'task-out-1a',
      targetId: 'station-offset',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 0),
      scheduledEnd: isoDate(9, 30, 0), // 1.5h
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 3: Cut scheduled at 10:00 today
    {
      id: 'assign-out-3a',
      taskId: 'task-out-3a',
      targetId: 'station-massicot',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, 0),
      scheduledEnd: isoDate(10, 45, 0), // 45min
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const elements = generateElementsForJobs(jobs, tasks);

  return {
    ...baseSnapshot(),
    providers: testProviders,
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}
