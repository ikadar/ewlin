/**
 * Test Fixture
 * Deterministic mock data for E2E testing.
 * This provides predictable tile positions for drag-drop tests.
 */

import type {
  ScheduleSnapshot,
  Station,
  StationCategory,
  StationGroup,
  Job,
  Task,
  InternalTask,
  TaskAssignment,
  OutsourcedProvider,
  DaySchedule,
} from '@flux/types';

// ============================================================================
// Fixed Station Data
// ============================================================================

const standardDaySchedule: DaySchedule = {
  isOperating: true,
  slots: [
    { start: '06:00', end: '12:00' },
    { start: '13:00', end: '22:00' },
  ],
};

const closedDaySchedule: DaySchedule = {
  isOperating: false,
  slots: [],
};

const categories: StationCategory[] = [
  {
    id: 'cat-offset',
    name: 'Presses Offset',
    description: 'Machines d\'impression offset',
    similarityCriteria: [],
  },
  {
    id: 'cat-cutting',
    name: 'Massicots',
    description: 'Machines de découpe',
    similarityCriteria: [],
  },
];

const groups: StationGroup[] = [
  {
    id: 'grp-offset',
    name: 'Presses Offset',
    maxConcurrent: 10, // High capacity for testing without constraints
    isOutsourcedProviderGroup: false,
  },
  {
    id: 'grp-cutting',
    name: 'Massicots',
    maxConcurrent: 10, // High capacity for testing without constraints
    isOutsourcedProviderGroup: false,
  },
];

const stations: Station[] = [
  {
    id: 'station-komori',
    name: 'Komori G40',
    status: 'Available',
    categoryId: 'cat-offset',
    groupId: 'grp-offset',
    capacity: 1,
    operatingSchedule: {
      monday: standardDaySchedule,
      tuesday: standardDaySchedule,
      wednesday: standardDaySchedule,
      thursday: standardDaySchedule,
      friday: standardDaySchedule,
      saturday: closedDaySchedule,
      sunday: closedDaySchedule,
    },
    exceptions: [],
  },
  {
    id: 'station-heidelberg',
    name: 'Heidelberg Speedmaster',
    status: 'Available',
    categoryId: 'cat-offset',
    groupId: 'grp-offset',
    capacity: 1,
    operatingSchedule: {
      monday: standardDaySchedule,
      tuesday: standardDaySchedule,
      wednesday: standardDaySchedule,
      thursday: standardDaySchedule,
      friday: standardDaySchedule,
      saturday: closedDaySchedule,
      sunday: closedDaySchedule,
    },
    exceptions: [],
  },
  {
    id: 'station-polar',
    name: 'Polar 137',
    status: 'Available',
    categoryId: 'cat-cutting',
    groupId: 'grp-cutting',
    capacity: 1,
    operatingSchedule: {
      monday: standardDaySchedule,
      tuesday: standardDaySchedule,
      wednesday: standardDaySchedule,
      thursday: standardDaySchedule,
      friday: standardDaySchedule,
      saturday: closedDaySchedule,
      sunday: closedDaySchedule,
    },
    exceptions: [],
  },
];

const providers: OutsourcedProvider[] = [];

// ============================================================================
// Fixed Job Data
// ============================================================================

// Use today's date for assignments
const today = new Date();
today.setHours(0, 0, 0, 0);

function isoDate(hours: number, minutes: number = 0): string {
  const d = new Date(today);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

// BAT approval dates (proof sent and approved yesterday)
const batSentAt = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
const batApprovedAt = new Date(today.getTime() - 12 * 60 * 60 * 1000).toISOString();

const jobs: Job[] = [
  {
    id: 'job-test-1',
    reference: 'TEST-001',
    client: 'Test Client A',
    description: 'Test Job 1 - Brochures',
    status: 'InProgress',
    workshopExitDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    color: '#8b5cf6', // Purple
    paperPurchaseStatus: 'InStock',
    platesStatus: 'Done',
    proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
    requiredJobIds: [],
    comments: [],
    taskIds: ['task-test-1-print', 'task-test-1-cut'],
    fullyScheduled: false,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: 'job-test-2',
    reference: 'TEST-002',
    client: 'Test Client B',
    description: 'Test Job 2 - Flyers',
    status: 'InProgress',
    workshopExitDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    color: '#3b82f6', // Blue
    paperPurchaseStatus: 'InStock',
    platesStatus: 'Done',
    proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
    requiredJobIds: [],
    comments: [],
    taskIds: ['task-test-2-print', 'task-test-2-cut'],
    fullyScheduled: false,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: 'job-test-3',
    reference: 'TEST-003',
    client: 'Test Client C',
    description: 'Test Job 3 - Posters',
    status: 'InProgress',
    workshopExitDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    color: '#22c55e', // Green
    paperPurchaseStatus: 'InStock',
    platesStatus: 'Done',
    proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
    requiredJobIds: [],
    comments: [],
    taskIds: ['task-test-3-print'],
    fullyScheduled: false,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  },
];

const tasks: Task[] = [
  // Job 1 tasks
  {
    id: 'task-test-1-print',
    jobId: 'job-test-1',
    sequenceOrder: 0,
    status: 'Assigned',
    type: 'Internal',
    stationId: 'station-komori',
    duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5 hours total
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  } as InternalTask,
  {
    id: 'task-test-1-cut',
    jobId: 'job-test-1',
    sequenceOrder: 1,
    status: 'Ready',
    type: 'Internal',
    stationId: 'station-polar',
    duration: { setupMinutes: 15, runMinutes: 30 }, // 45 min total
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  } as InternalTask,
  // Job 2 tasks
  {
    id: 'task-test-2-print',
    jobId: 'job-test-2',
    sequenceOrder: 0,
    status: 'Assigned',
    type: 'Internal',
    stationId: 'station-komori',
    duration: { setupMinutes: 30, runMinutes: 90 }, // 2 hours total
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  } as InternalTask,
  {
    id: 'task-test-2-cut',
    jobId: 'job-test-2',
    sequenceOrder: 1,
    status: 'Ready',
    type: 'Internal',
    stationId: 'station-polar',
    duration: { setupMinutes: 15, runMinutes: 45 }, // 1 hour total
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  } as InternalTask,
  // Job 3 tasks
  {
    id: 'task-test-3-print',
    jobId: 'job-test-3',
    sequenceOrder: 0,
    status: 'Assigned',
    type: 'Internal',
    stationId: 'station-heidelberg',
    duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5 hours total
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  } as InternalTask,
];

// ============================================================================
// Fixed Assignment Data
// Assignments at known positions for predictable testing
// ============================================================================

const assignments: TaskAssignment[] = [
  // Job 1 print task - Komori at 7:00
  {
    id: 'assign-test-1-print',
    taskId: 'task-test-1-print',
    targetId: 'station-komori',
    isOutsourced: false,
    scheduledStart: isoDate(7, 0),  // 7:00
    scheduledEnd: isoDate(8, 30),   // 8:30 (1.5 hours)
    isCompleted: false,
    completedAt: null,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  },
  // Job 2 print task - Komori at 9:00 (gap after Job 1)
  {
    id: 'assign-test-2-print',
    taskId: 'task-test-2-print',
    targetId: 'station-komori',
    isOutsourced: false,
    scheduledStart: isoDate(9, 0),  // 9:00
    scheduledEnd: isoDate(11, 0),   // 11:00 (2 hours)
    isCompleted: false,
    completedAt: null,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  },
  // Job 3 print task - Heidelberg at 8:00
  {
    id: 'assign-test-3-print',
    taskId: 'task-test-3-print',
    targetId: 'station-heidelberg',
    isOutsourced: false,
    scheduledStart: isoDate(8, 0),  // 8:00
    scheduledEnd: isoDate(9, 30),   // 9:30 (1.5 hours)
    isCompleted: false,
    completedAt: null,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  },
];

// ============================================================================
// Export Test Fixture Snapshot
// ============================================================================

export function createTestFixtureSnapshot(): ScheduleSnapshot {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stations,
    categories,
    groups,
    providers,
    jobs,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}

/**
 * Check if we should use test fixture based on URL parameter
 */
export function shouldUseTestFixture(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('fixture') === 'test';
}
