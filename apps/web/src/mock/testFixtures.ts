/**
 * Test Fixtures for E2E Testing
 *
 * Deterministic mock data for different test scenarios.
 * Each fixture is designed for specific use-case testing.
 *
 * Usage: /?fixture=<fixture-name>
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
// Common Data (shared across fixtures)
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
    maxConcurrent: 10,
    isOutsourcedProviderGroup: false,
  },
  {
    id: 'grp-cutting',
    name: 'Massicots',
    maxConcurrent: 10,
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
// Helper Functions
// ============================================================================

const today = new Date();
today.setHours(0, 0, 0, 0);

function isoDate(hours: number, minutes: number = 0, daysOffset: number = 0): string {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function baseSnapshot(): Omit<ScheduleSnapshot, 'jobs' | 'tasks' | 'assignments' | 'conflicts' | 'lateJobs'> {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stations,
    categories,
    groups,
    providers,
  };
}

// BAT approval dates (proof sent and approved yesterday)
const batSentAt = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
const batApprovedAt = new Date(today.getTime() - 12 * 60 * 60 * 1000).toISOString();

// ============================================================================
// Fixture: test (Basic - existing)
// For UC-02 (Reschedule), UC-03 (Grid Snapping)
// ============================================================================

export function createBasicFixture(): ScheduleSnapshot {
  const jobs: Job[] = [
    {
      id: 'job-test-1',
      reference: 'TEST-001',
      client: 'Test Client A',
      description: 'Test Job 1 - Brochures',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6',
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
      workshopExitDate: isoDate(0, 0, 5),
      color: '#3b82f6',
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
      workshopExitDate: isoDate(0, 0, 3),
      color: '#22c55e',
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
    {
      id: 'task-test-1-print',
      jobId: 'job-test-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
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
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-test-2-print',
      jobId: 'job-test-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 90 },
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
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-test-3-print',
      jobId: 'job-test-3',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    {
      id: 'assign-test-1-print',
      taskId: 'task-test-1-print',
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
      id: 'assign-test-2-print',
      taskId: 'task-test-2-print',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(9, 0),
      scheduledEnd: isoDate(11, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-test-3-print',
      taskId: 'task-test-3-print',
      targetId: 'station-heidelberg',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  return {
    ...baseSnapshot(),
    jobs,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Fixture: push-down
// For UC-04 (Push-Down on Collision)
// 3 consecutive tiles with no gaps for testing push-down chain
// ============================================================================

export function createPushDownFixture(): ScheduleSnapshot {
  const jobs: Job[] = [
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
      requiredJobIds: [],
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
      requiredJobIds: [],
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
      requiredJobIds: [],
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
      jobId: 'job-pd-1',
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
      jobId: 'job-pd-2',
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
      jobId: 'job-pd-3',
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

  return {
    ...baseSnapshot(),
    jobs,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Fixture: precedence
// For UC-06 (Precedence Validation)
// Job with 2 sequential tasks - Task 1 scheduled, Task 2 unscheduled
// ============================================================================

export function createPrecedenceFixture(): ScheduleSnapshot {
  const jobs: Job[] = [
    {
      id: 'job-prec-1',
      reference: 'PREC-001',
      client: 'Precedence Client',
      description: 'Precedence Test Job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-prec-1', 'task-prec-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-prec-1',
      jobId: 'job-prec-1',
      sequenceOrder: 0,  // First task
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-prec-2',
      jobId: 'job-prec-1',
      sequenceOrder: 1,  // Second task (must wait for first)
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 30 }, // 45min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Only Task 1 is scheduled (7:00-8:30)
  // Task 2 is unscheduled and cannot start before 8:30
  const assignments: TaskAssignment[] = [
    {
      id: 'assign-prec-1',
      taskId: 'task-prec-1',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(7, 0),
      scheduledEnd: isoDate(8, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  return {
    ...baseSnapshot(),
    jobs,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Fixture: approval-gates
// For UC-07 (Approval Gate Validation)
// Jobs with different approval states
// ============================================================================

export function createApprovalGatesFixture(): ScheduleSnapshot {
  const jobs: Job[] = [
    // Job without BAT approval (cannot schedule)
    {
      id: 'job-gate-no-bat',
      reference: 'GATE-001',
      client: 'No BAT Client',
      description: 'Job without BAT approval',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#ef4444',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: null }, // NOT approved
      requiredJobIds: [],
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
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
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
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Todo', // NOT done - warning only
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
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
      jobId: 'job-gate-no-bat',
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
      jobId: 'job-gate-bat-ok',
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
      jobId: 'job-gate-plates-pending',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  return {
    ...baseSnapshot(),
    jobs,
    tasks,
    assignments: [],
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Fixture: swap
// For UC-09 (Swap Operations)
// 3 tiles on same station for swap testing
// ============================================================================

export function createSwapFixture(): ScheduleSnapshot {
  const jobs: Job[] = [
    {
      id: 'job-swap-1',
      reference: 'SWAP-001',
      client: 'Swap Client A',
      description: 'Swap Job 1 (Top)',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-swap-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'job-swap-2',
      reference: 'SWAP-002',
      client: 'Swap Client B',
      description: 'Swap Job 2 (Middle)',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#3b82f6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-swap-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'job-swap-3',
      reference: 'SWAP-003',
      client: 'Swap Client C',
      description: 'Swap Job 3 (Bottom)',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#22c55e',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-swap-3'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-swap-1',
      jobId: 'job-swap-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-swap-2',
      jobId: 'job-swap-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-swap-3',
      jobId: 'job-swap-3',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // 3 consecutive 1h tiles: 7:00-8:00, 8:00-9:00, 9:00-10:00
  const assignments: TaskAssignment[] = [
    {
      id: 'assign-swap-1',
      taskId: 'task-swap-1',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(7, 0),
      scheduledEnd: isoDate(8, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-swap-2',
      taskId: 'task-swap-2',
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
      id: 'assign-swap-3',
      taskId: 'task-swap-3',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(9, 0),
      scheduledEnd: isoDate(10, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  return {
    ...baseSnapshot(),
    jobs,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Fixture: sidebar-drag
// For UC-01 (New Task Placement from Sidebar)
// Job with unscheduled task ready for placement
// ============================================================================

export function createSidebarDragFixture(): ScheduleSnapshot {
  const jobs: Job[] = [
    {
      id: 'job-sidebar-1',
      reference: 'SIDE-001',
      client: 'Sidebar Client',
      description: 'Sidebar Drag Test Job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-sidebar-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-sidebar-1',
      jobId: 'job-sidebar-1',
      sequenceOrder: 0,
      status: 'Ready', // Unscheduled, ready to place
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  return {
    ...baseSnapshot(),
    jobs,
    tasks,
    assignments: [], // No assignments - task is unscheduled
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Fixture Registry
// ============================================================================

export type FixtureName = 'test' | 'push-down' | 'precedence' | 'approval-gates' | 'swap' | 'sidebar-drag';

export const fixtureRegistry: Record<FixtureName, () => ScheduleSnapshot> = {
  'test': createBasicFixture,
  'push-down': createPushDownFixture,
  'precedence': createPrecedenceFixture,
  'approval-gates': createApprovalGatesFixture,
  'swap': createSwapFixture,
  'sidebar-drag': createSidebarDragFixture,
};

/**
 * Get fixture by name from URL parameter
 */
export function getFixtureFromUrl(): ScheduleSnapshot | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const fixtureName = params.get('fixture') as FixtureName | null;

  if (!fixtureName || !fixtureRegistry[fixtureName]) {
    return null;
  }

  return fixtureRegistry[fixtureName]();
}

/**
 * Check if any test fixture is requested
 */
export function shouldUseFixture(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const fixtureName = params.get('fixture');
  return !!fixtureName && fixtureName in fixtureRegistry;
}
