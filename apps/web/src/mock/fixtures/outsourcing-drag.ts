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
// Fixture: outsourcing-drag
// For v0.5.13 (Outsourcing Drag Visualization)
// Jobs with internal tasks following outsourced predecessors - for drag testing
// ============================================================================

// Test provider
const testProviders: OutsourcedProvider[] = [
  {
    id: 'provider-finition',
    name: 'Finitions Express',
    status: 'Active',
    supportedActionTypes: ['Pelliculage', 'Vernis UV'],
    latestDepartureTime: '14:00',
    receptionTime: '09:00',
    transitDays: 1,
    groupId: 'grp-outsourced',
  },
];

export function createOutsourcingDragFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job 1: Outsourced → Internal (unscheduled)
    // When picking the internal task, should show cyan outsourcing indicator
    {
      id: 'job-drag-1',
      reference: 'DRAG-001',
      client: 'Outsourcing Drag Client',
      description: 'Outsourced (scheduled) → Internal (unscheduled) - PICK ME',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#06b6d4', // Cyan (matches outsourcing indicator)
      comments: [],
      taskIds: ['task-drag-1a', 'task-drag-1b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: Internal → Outsourced → Internal (unscheduled)
    // Full chain - the last internal task is unscheduled
    {
      id: 'job-drag-2',
      reference: 'DRAG-002',
      client: 'Chain Test Client',
      description: 'Internal → Outsourced → Internal (unscheduled)',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#8b5cf6', // Purple
      comments: [],
      taskIds: ['task-drag-2a', 'task-drag-2b', 'task-drag-2c'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 3: Internal-only (regression test - no outsourcing indicator)
    {
      id: 'job-drag-3',
      reference: 'DRAG-003',
      client: 'Regression Client',
      description: 'Internal → Internal (no outsourcing indicator)',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#f59e0b', // Amber
      comments: [],
      taskIds: ['task-drag-3a', 'task-drag-3b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Job 1: Outsourced (scheduled) → Internal (unscheduled)
    // The outsourced task departs today at 14:00 and returns on day 5 at 09:00
    {
      id: 'task-drag-1a',
      elementId: 'elem-job-drag-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Outsourced',
      providerId: 'provider-finition',
      actionType: 'Pelliculage',
      duration: {
        openDays: 2,
        latestDepartureTime: '14:00',
        receptionTime: '09:00',
      },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as OutsourcedTask,
    // Internal task following outsourced - UNSCHEDULED
    // When picked, should show cyan indicator from departure to return
    {
      id: 'task-drag-1b',
      elementId: 'elem-job-drag-1',
      sequenceOrder: 1,
      status: 'Ready', // Unscheduled
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 2: Internal → Outsourced → Internal (unscheduled)
    {
      id: 'task-drag-2a',
      elementId: 'elem-job-drag-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-drag-2b',
      elementId: 'elem-job-drag-2',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Outsourced',
      providerId: 'provider-finition',
      actionType: 'Vernis UV',
      duration: {
        openDays: 2,
        latestDepartureTime: '14:00',
        receptionTime: '09:00',
      },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as OutsourcedTask,
    // Internal task following outsourced - UNSCHEDULED
    {
      id: 'task-drag-2c',
      elementId: 'elem-job-drag-2',
      sequenceOrder: 2,
      status: 'Ready', // Unscheduled
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 3: Internal → Internal (regression - no outsourcing)
    {
      id: 'task-drag-3a',
      elementId: 'elem-job-drag-3',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Internal task - UNSCHEDULED - should NOT show outsourcing indicator
    {
      id: 'task-drag-3b',
      elementId: 'elem-job-drag-3',
      sequenceOrder: 1,
      status: 'Ready', // Unscheduled
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Assignments - only scheduled tasks
  const assignments: TaskAssignment[] = [
    // Job 1: Outsourced task scheduled
    // Departure: today 14:00, Return: day 5 at 09:00 (1 transit + 2 work + 1 transit)
    {
      id: 'assign-drag-1a',
      taskId: 'task-drag-1a',
      targetId: 'provider-finition',
      isOutsourced: true,
      scheduledStart: isoDate(14, 0, 0), // Today 14:00 (departure)
      scheduledEnd: isoDate(9, 0, 5), // Day 5 at 09:00 (return)
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },

    // Job 2: Internal and Outsourced scheduled
    {
      id: 'assign-drag-2a',
      taskId: 'task-drag-2a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 0), // Today 8:00
      scheduledEnd: isoDate(9, 30, 0), // Today 9:30
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-drag-2b',
      taskId: 'task-drag-2b',
      targetId: 'provider-finition',
      isOutsourced: true,
      scheduledStart: isoDate(14, 0, 0), // Today 14:00 (departure)
      scheduledEnd: isoDate(9, 0, 5), // Day 5 at 09:00 (return)
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },

    // Job 3: Internal task scheduled
    {
      id: 'assign-drag-3a',
      taskId: 'task-drag-3a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, 0), // Today 10:00
      scheduledEnd: isoDate(11, 30, 0), // Today 11:30
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
