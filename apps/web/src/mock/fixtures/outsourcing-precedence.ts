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
// Fixture: outsourcing-precedence
// For v0.5.12 (Outsourcing Precedence Calculation)
// Jobs with outsourced tasks to test precedence constraint lines
// ============================================================================

// Test providers with different transit times
const testProviders: OutsourcedProvider[] = [
  {
    id: 'provider-fast',
    name: 'Fast Finitions',
    status: 'Active',
    supportedActionTypes: ['Pelliculage', 'Vernis UV'],
    latestDepartureTime: '14:00',
    receptionTime: '09:00',
    transitDays: 1,
    groupId: 'grp-outsourced',
  },
  {
    id: 'provider-slow',
    name: 'Slow Reliure',
    status: 'Active',
    supportedActionTypes: ['Reliure', 'Dos carré collé'],
    latestDepartureTime: '12:00',
    receptionTime: '10:00',
    transitDays: 2,
    groupId: 'grp-outsourced',
  },
];

export function createOutsourcingPrecedenceFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job 1: Internal → Outsourced → Internal
    // Tests forward calculation: successor should have constraint at outsourced return time
    {
      id: 'job-prec-1',
      reference: 'PREC-001',
      client: 'Precedence Client A',
      description: 'Forward: Internal → Outsourced → Internal',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#3b82f6', // Blue
      comments: [],
      taskIds: ['task-prec-1a', 'task-prec-1b', 'task-prec-1c'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: Internal → Outsourced (with manual dates)
    // Tests manual return override affecting constraint
    {
      id: 'job-prec-2',
      reference: 'PREC-002',
      client: 'Precedence Client B',
      description: 'Forward with manual return override',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 21),
      color: '#8b5cf6', // Purple
      comments: [],
      taskIds: ['task-prec-2a', 'task-prec-2b', 'task-prec-2c'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 3: Internal → Internal (before outsourced)
    // Tests backward calculation: predecessor should have constraint at outsourced departure time
    {
      id: 'job-prec-3',
      reference: 'PREC-003',
      client: 'Precedence Client C',
      description: 'Backward: Internal before Outsourced',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#22c55e', // Green
      comments: [],
      taskIds: ['task-prec-3a', 'task-prec-3b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 4: Internal-only chain (regression test)
    {
      id: 'job-prec-4',
      reference: 'PREC-004',
      client: 'Precedence Client D',
      description: 'Internal-only (regression test)',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#f59e0b', // Amber
      comments: [],
      taskIds: ['task-prec-4a', 'task-prec-4b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Job 1 tasks: Internal (scheduled) → Outsourced (scheduled) → Internal (scheduled)
    {
      id: 'task-prec-1a',
      elementId: 'elem-job-prec-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-prec-1b',
      elementId: 'elem-job-prec-1',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Outsourced',
      providerId: 'provider-fast',
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
      id: 'task-prec-1c',
      elementId: 'elem-job-prec-1',
      sequenceOrder: 2,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 2 tasks: Internal → Outsourced (manual return) → Internal
    {
      id: 'task-prec-2a',
      elementId: 'elem-job-prec-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 90 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-prec-2b',
      elementId: 'elem-job-prec-2',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Outsourced',
      providerId: 'provider-slow',
      actionType: 'Reliure',
      duration: {
        openDays: 3,
        latestDepartureTime: '12:00',
        receptionTime: '10:00',
      },
      // Manual return override - earlier than calculated
      manualReturn: isoDate(10, 0, 5), // Day 5 at 10:00
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as OutsourcedTask,
    {
      id: 'task-prec-2c',
      elementId: 'elem-job-prec-2',
      sequenceOrder: 2,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 3 tasks: Internal → Outsourced (with manual departure)
    // The internal task's successor constraint should use the outsourced departure
    {
      id: 'task-prec-3a',
      elementId: 'elem-job-prec-3',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-prec-3b',
      elementId: 'elem-job-prec-3',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Outsourced',
      providerId: 'provider-fast',
      actionType: 'Vernis UV',
      duration: {
        openDays: 2,
        latestDepartureTime: '14:00',
        receptionTime: '09:00',
      },
      // Manual departure override
      manualDeparture: isoDate(14, 0, 3), // Day 3 at 14:00
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as OutsourcedTask,

    // Job 4 tasks: Internal → Internal (regression test)
    {
      id: 'task-prec-4a',
      elementId: 'elem-job-prec-4',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-prec-4b',
      elementId: 'elem-job-prec-4',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Assignments - all tasks scheduled
  const assignments: TaskAssignment[] = [
    // Job 1: Full chain scheduled
    {
      id: 'assign-prec-1a',
      taskId: 'task-prec-1a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 0), // Today 8:00
      scheduledEnd: isoDate(9, 30, 0), // Today 9:30
      isCompleted: false,
    },
    {
      id: 'assign-prec-1b',
      taskId: 'task-prec-1b',
      targetId: 'provider-fast',
      isOutsourced: true,
      scheduledStart: isoDate(14, 0, 0), // Today 14:00 (departure)
      scheduledEnd: isoDate(9, 0, 5), // Day 5 at 09:00 (return after 1+2+1 transit+work days)
      isCompleted: false,
    },
    {
      id: 'assign-prec-1c',
      taskId: 'task-prec-1c',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, 5), // Day 5 at 10:00 (after outsourced return)
      scheduledEnd: isoDate(10, 45, 5), // Day 5 at 10:45
      isCompleted: false,
    },

    // Job 2: Chain with manual return
    {
      id: 'assign-prec-2a',
      taskId: 'task-prec-2a',
      targetId: 'station-heidelberg',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 1), // Day 1 at 8:00
      scheduledEnd: isoDate(10, 0, 1), // Day 1 at 10:00
      isCompleted: false,
    },
    {
      id: 'assign-prec-2b',
      taskId: 'task-prec-2b',
      targetId: 'provider-slow',
      isOutsourced: true,
      scheduledStart: isoDate(12, 0, 1), // Day 1 at 12:00 (departure)
      scheduledEnd: isoDate(10, 0, 5), // Day 5 at 10:00 (manual return)
      isCompleted: false,
    },
    {
      id: 'assign-prec-2c',
      taskId: 'task-prec-2c',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(11, 0, 5), // Day 5 at 11:00 (after manual return)
      scheduledEnd: isoDate(12, 0, 5), // Day 5 at 12:00
      isCompleted: false,
    },

    // Job 3: Backward calculation test
    {
      id: 'assign-prec-3a',
      taskId: 'task-prec-3a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 2), // Day 2 at 8:00
      scheduledEnd: isoDate(9, 30, 2), // Day 2 at 9:30
      isCompleted: false,
    },
    {
      id: 'assign-prec-3b',
      taskId: 'task-prec-3b',
      targetId: 'provider-fast',
      isOutsourced: true,
      scheduledStart: isoDate(14, 0, 3), // Day 3 at 14:00 (manual departure)
      scheduledEnd: isoDate(9, 0, 8), // Day 8 at 09:00 (return)
      isCompleted: false,
    },

    // Job 4: Internal-only (regression)
    {
      id: 'assign-prec-4a',
      taskId: 'task-prec-4a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 3), // Day 3 at 8:00
      scheduledEnd: isoDate(9, 30, 3), // Day 3 at 9:30
      isCompleted: false,
    },
    {
      id: 'assign-prec-4b',
      taskId: 'task-prec-4b',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, 3), // Day 3 at 10:00
      scheduledEnd: isoDate(10, 45, 3), // Day 3 at 10:45
      isCompleted: false,
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
