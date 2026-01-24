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
  Element,
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

// 7-day operating schedule for tests that need to run on any day of the week
const sevenDayOperatingSchedule = {
  monday: standardDaySchedule,
  tuesday: standardDaySchedule,
  wednesday: standardDaySchedule,
  thursday: standardDaySchedule,
  friday: standardDaySchedule,
  saturday: standardDaySchedule,
  sunday: standardDaySchedule,
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

function baseSnapshot(): Omit<ScheduleSnapshot, 'jobs' | 'elements' | 'tasks' | 'assignments' | 'conflicts' | 'lateJobs'> {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stations,
    categories,
    groups,
    providers,
  };
}

/**
 * Job without elementIds - used for fixture definitions.
 * The generateElementsForJobs function will add elementIds automatically.
 */
type JobWithoutElementIds = Omit<Job, 'elementIds'>;

/**
 * Generate elements for jobs and add elementIds to jobs.
 * For v0.4.1+, mutates jobs to add elementIds and returns elements.
 */
function generateElementsForJobs(jobs: JobWithoutElementIds[], tasks: Task[]): Element[] {
  return jobs.map((job) => {
    const elementId = `elem-${job.id}`;
    // Mutate job to add elementIds (side effect for convenience in fixtures)
    (job as Job).elementIds = [elementId];
    return {
      id: elementId,
      jobId: job.id,
      suffix: 'ELT',
      prerequisiteElementIds: [],
      // Tasks have elementId that matches this element's id
      taskIds: tasks.filter((t) => t.elementId === elementId).map((t) => t.id),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  });
}

// BAT approval dates (proof sent and approved yesterday)
const batSentAt = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
const batApprovedAt = new Date(today.getTime() - 12 * 60 * 60 * 1000).toISOString();

// ============================================================================
// Fixture: test (Basic - existing)
// For UC-02 (Reschedule), UC-03 (Grid Snapping)
// ============================================================================

export function createBasicFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
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
      elementId: 'elem-job-test-1',
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
      elementId: 'elem-job-test-1',
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
      elementId: 'elem-job-test-2',
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
      elementId: 'elem-job-test-2',
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
      elementId: 'elem-job-test-3',
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

// ============================================================================
// Fixture: precedence
// For UC-06 (Precedence Validation)
// Job with 2 sequential tasks - Task 1 scheduled, Task 2 unscheduled
// ============================================================================

export function createPrecedenceFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
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
      elementId: 'elem-job-prec-1',
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
      elementId: 'elem-job-prec-1',
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

  // generateElementsForJobs mutates jobs to add elementIds
  const elements = generateElementsForJobs(jobs, tasks);
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

// ============================================================================
// Fixture: swap
// For UC-09 (Swap Operations)
// 3 tiles on same station for swap testing
// ============================================================================

export function createSwapFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
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
      elementId: 'elem-job-swap-1',
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
      elementId: 'elem-job-swap-2',
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
      elementId: 'elem-job-swap-3',
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

// ============================================================================
// Fixture: sidebar-drag
// For UC-01 (New Task Placement from Sidebar)
// Job with unscheduled task ready for placement
// Uses 7-day operating schedule so tests pass on weekends
// ============================================================================

export function createSidebarDragFixture(): ScheduleSnapshot {
  // Custom stations with 7-day operating schedule for weekend-proof testing
  const sidebarDragStations: Station[] = [
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
    {
      id: 'station-polar',
      name: 'Polar 115',
      status: 'Available',
      categoryId: 'cat-finishing',
      groupId: 'grp-finishing',
      capacity: 1,
      operatingSchedule: sevenDayOperatingSchedule,
      exceptions: [],
    },
  ];

  const jobs: JobWithoutElementIds[] = [
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
      elementId: 'elem-job-sidebar-1',
      sequenceOrder: 0,
      status: 'Ready', // Unscheduled, ready to place
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // generateElementsForJobs mutates jobs to add elementIds
  const elements = generateElementsForJobs(jobs, tasks);
  return {
    ...baseSnapshot(),
    stations: sidebarDragStations,
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments: [], // No assignments - task is unscheduled
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Fixture: alt-bypass
// For v0.3.28 (Alt+Drag Bypass Bug Fix - REQ-13)
// Job with 2 sequential tasks - Task 1 scheduled at 10:00-11:00, Task 2 unscheduled
// Used to test Alt+drop conflict recording
// ============================================================================

export function createAltBypassFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-bypass-1',
      reference: 'BYPASS-001',
      client: 'Alt Bypass Client',
      description: 'Alt Bypass Test Job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#3b82f6', // Blue
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-bypass-1', 'task-bypass-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-bypass-1',
      elementId: 'elem-job-bypass-1',
      sequenceOrder: 0,  // First task
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h total (10:00-11:00)
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-bypass-2',
      elementId: 'elem-job-bypass-1',
      sequenceOrder: 1,  // Second task (must wait for first to complete at 11:00)
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar', // Different station to allow placement
      duration: { setupMinutes: 15, runMinutes: 30 }, // 45min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Task 1 is scheduled at 10:00-11:00
  // Task 2 is unscheduled - valid placement is >= 11:00
  // Placing Task 2 before 11:00 creates a precedence conflict
  const assignments: TaskAssignment[] = [
    {
      id: 'assign-bypass-1',
      taskId: 'task-bypass-1',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0),
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

// ============================================================================
// Fixture: drag-snapping
// For v0.3.41 (Drag Snapping Consistency - REQ-01/02/03)
// Job with unscheduled task, tests snapping at lunch break boundary (12:00-13:00)
// Uses 7-day operating schedule so tests pass on weekends
// ============================================================================

export function createDragSnappingFixture(): ScheduleSnapshot {
  // Custom stations with 7-day operating schedule for weekend-proof testing
  const dragSnappingStations: Station[] = [
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
      id: 'job-snap-1',
      reference: 'SNAP-001',
      client: 'Snapping Test Client',
      description: 'Drag Snapping Test Job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6', // Purple
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-snap-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-snap-1',
      elementId: 'elem-job-snap-1',
      sequenceOrder: 0,
      status: 'Ready', // Unscheduled, ready to place
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // No assignments - task is unscheduled for drag testing
  // Station has lunch break 12:00-13:00 (not in standardDaySchedule slots)
  // Dragging to 12:45 should snap to 13:00 and show GREEN border
  // generateElementsForJobs mutates jobs to add elementIds
  const elements = generateElementsForJobs(jobs, tasks);
  return {
    ...baseSnapshot(),
    stations: dragSnappingStations,
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments: [],
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Fixture: ui-bug-fixes
// For v0.3.42 (UI Bug Fixes - REQ-04/05/06)
// Multi-day grid with multiple jobs, long text content, and scheduled tasks
// ============================================================================

export function createUiBugFixesFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job with very long client name and description (for REQ-05 overflow test)
    {
      id: 'job-long-text',
      reference: 'LONG-001',
      client: 'Extremely Long Client Name That Should Definitely Overflow The Container Width',
      description: 'This is a very long description that should also be truncated properly with ellipsis',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-long-text'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job A - has scheduled task (for REQ-06 click test)
    {
      id: 'job-a',
      reference: 'JOBA-001',
      client: 'Client Alpha',
      description: 'Job Alpha - Click to select',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#3b82f6', // Blue
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-a'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job B - has scheduled task on same station (for REQ-06 muted tile click test)
    {
      id: 'job-b',
      reference: 'JOBB-002',
      client: 'Client Beta',
      description: 'Job Beta - Should be clickable when muted',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#22c55e', // Green
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job C - scheduled on Day 2 (for REQ-04 multi-day overlay test)
    {
      id: 'job-c',
      reference: 'JOBC-003',
      client: 'Client Gamma',
      description: 'Job Gamma - Day 2 task',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#f59e0b', // Amber
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-c'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-long-text',
      elementId: 'elem-job-long-text',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-a',
      elementId: 'elem-job-a',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-b',
      elementId: 'elem-job-b',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-c',
      elementId: 'elem-job-c',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Task A and B on Day 1 (today), Task C on Day 2 (tomorrow)
  const assignments: TaskAssignment[] = [
    {
      id: 'assign-a',
      taskId: 'task-a',
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
      id: 'assign-b',
      taskId: 'task-b',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(9, 0),
      scheduledEnd: isoDate(10, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-c',
      taskId: 'task-c',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 1), // Tomorrow at 8:00
      scheduledEnd: isoDate(9, 30, 1),   // Tomorrow at 9:30
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

// ============================================================================
// Fixture: layout-redesign
// For v0.3.43 (Layout Redesign - REQ-07/08)
// Standard data to test layout changes and zoom levels
// ============================================================================

export function createLayoutRedesignFixture(): ScheduleSnapshot {
  // Use basic fixture data - layout changes don't require specific data
  return createBasicFixture();
}

// ============================================================================
// Fixture: datestrip-redesign
// For v0.3.44 (DateStrip Redesign - REQ-09)
// Jobs spanning multiple days to test DateStrip scroll sync and visual states
// ============================================================================

export function createDatestripRedesignFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job with departure 7 days from now, tasks scheduled today and day 3
    {
      id: 'job-ds-1',
      reference: 'DS-001',
      client: 'DateStrip Client A',
      description: 'DateStrip Test Job 1',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7), // 7 days from now
      color: '#8b5cf6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-ds-1-a', 'task-ds-1-b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job with departure 14 days from now, task scheduled day 10
    {
      id: 'job-ds-2',
      reference: 'DS-002',
      client: 'DateStrip Client B',
      description: 'DateStrip Test Job 2',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14), // 14 days from now
      color: '#3b82f6',
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-ds-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-ds-1-a',
      elementId: 'elem-job-ds-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-ds-1-b',
      elementId: 'elem-job-ds-1',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-ds-2',
      elementId: 'elem-job-ds-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 90 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Assignments spread across multiple days
  const assignments: TaskAssignment[] = [
    // Task on today
    {
      id: 'assign-ds-1-a',
      taskId: 'task-ds-1-a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 0), // Today at 8:00
      scheduledEnd: isoDate(9, 30, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task on day 3
    {
      id: 'assign-ds-1-b',
      taskId: 'task-ds-1-b',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, 3), // Day 3 at 10:00
      scheduledEnd: isoDate(10, 45, 3),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task on day 10
    {
      id: 'assign-ds-2',
      taskId: 'task-ds-2',
      targetId: 'station-heidelberg',
      isOutsourced: false,
      scheduledStart: isoDate(7, 0, 10), // Day 10 at 7:00
      scheduledEnd: isoDate(9, 0, 10),
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

// ============================================================================
// Fixture: precedence-visualization
// For v0.3.45 (Precedence Constraint Visualization - REQ-10)
// Job with 3 sequential tasks to test purple/orange constraint lines
// ============================================================================

export function createPrecedenceVisualizationFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-pv-1',
      reference: 'PV-001',
      client: 'Precedence Viz Client',
      description: 'Precedence Visualization Test Job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#8b5cf6', // Purple
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-pv-1', 'task-pv-2', 'task-pv-3'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Task 1: Printing on Komori - SCHEDULED at 8:00-10:00
    {
      id: 'task-pv-1',
      elementId: 'elem-job-pv-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 2: Printing on Heidelberg - UNSCHEDULED
    // When dragging: should show purple line at 14:00 (Task 1 end 10:00 + 4h dry time)
    {
      id: 'task-pv-2',
      elementId: 'elem-job-pv-1',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 3: Cutting on Polar - SCHEDULED at 18:00-19:00
    // When dragging Task 2: should show orange line at 16:30 (Task 3 start 18:00 - Task 2 duration 1.5h)
    {
      id: 'task-pv-3',
      elementId: 'elem-job-pv-1',
      sequenceOrder: 2,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Task 1 scheduled at 8:00-10:00
    {
      id: 'assign-pv-1',
      taskId: 'task-pv-1',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(10, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task 3 scheduled at 18:00-19:00
    {
      id: 'assign-pv-3',
      taskId: 'task-pv-3',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(18, 0),
      scheduledEnd: isoDate(19, 0),
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

// ============================================================================
// Fixture: virtual-scroll
// For v0.3.46 (Virtual Scrolling for Multi-Day Grid)
// Tasks spread across 200+ days to test virtual scrolling performance
// ============================================================================

export function createVirtualScrollFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [];
  const tasks: Task[] = [];
  const assignments: TaskAssignment[] = [];

  // Create jobs with tasks spread across many days
  // Day 0, 10, 20, 30 for job 1
  // Day 50, 100, 150 for job 2
  // Departure date on day 200 for job 3

  jobs.push({
    id: 'job-vs-1',
    reference: 'VS-001',
    client: 'Virtual Scroll Client A',
    description: 'Virtual Scroll Test - Multiple days',
    status: 'InProgress',
    workshopExitDate: isoDate(0, 0, 35), // 35 days from now
    color: '#8b5cf6', // Purple
    paperPurchaseStatus: 'InStock',
    platesStatus: 'Done',
    proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
    requiredJobIds: [],
    comments: [],
    taskIds: ['task-vs-1a', 'task-vs-1b', 'task-vs-1c', 'task-vs-1d'],
    fullyScheduled: false,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  });

  jobs.push({
    id: 'job-vs-2',
    reference: 'VS-002',
    client: 'Virtual Scroll Client B',
    description: 'Virtual Scroll Test - Far dates',
    status: 'InProgress',
    workshopExitDate: isoDate(0, 0, 160), // 160 days from now
    color: '#3b82f6', // Blue
    paperPurchaseStatus: 'InStock',
    platesStatus: 'Done',
    proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
    requiredJobIds: [],
    comments: [],
    taskIds: ['task-vs-2a', 'task-vs-2b', 'task-vs-2c'],
    fullyScheduled: false,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  });

  jobs.push({
    id: 'job-vs-3',
    reference: 'VS-003',
    client: 'Virtual Scroll Client C',
    description: 'Virtual Scroll Test - Very far departure',
    status: 'InProgress',
    workshopExitDate: isoDate(0, 0, 200), // 200 days from now
    color: '#22c55e', // Green
    paperPurchaseStatus: 'InStock',
    platesStatus: 'Done',
    proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
    requiredJobIds: [],
    comments: [],
    taskIds: ['task-vs-3'],
    fullyScheduled: false,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  });

  // Tasks for job 1: on days 0, 10, 20, 30
  const job1Days = [0, 10, 20, 30];
  const job1TaskSuffixes = ['a', 'b', 'c', 'd'];
  job1Days.forEach((dayOffset, i) => {
    tasks.push({
      id: `task-vs-1${job1TaskSuffixes[i]}`,
      elementId: 'elem-job-vs-1',
      sequenceOrder: i,
      status: 'Assigned',
      type: 'Internal',
      stationId: i % 2 === 0 ? 'station-komori' : 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask);

    assignments.push({
      id: `assign-vs-1${job1TaskSuffixes[i]}`,
      taskId: `task-vs-1${job1TaskSuffixes[i]}`,
      targetId: i % 2 === 0 ? 'station-komori' : 'station-heidelberg',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, dayOffset),
      scheduledEnd: isoDate(9, 30, dayOffset),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    });
  });

  // Tasks for job 2: on days 50, 100, 150
  const job2Days = [50, 100, 150];
  const job2TaskSuffixes = ['a', 'b', 'c'];
  job2Days.forEach((dayOffset, i) => {
    tasks.push({
      id: `task-vs-2${job2TaskSuffixes[i]}`,
      elementId: 'elem-job-vs-2',
      sequenceOrder: i,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask);

    assignments.push({
      id: `assign-vs-2${job2TaskSuffixes[i]}`,
      taskId: `task-vs-2${job2TaskSuffixes[i]}`,
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, dayOffset),
      scheduledEnd: isoDate(11, 0, dayOffset),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    });
  });

  // Task for job 3: on day 180 (near the 200-day departure)
  tasks.push({
    id: 'task-vs-3',
    elementId: 'elem-job-vs-3',
    sequenceOrder: 0,
    status: 'Assigned',
    type: 'Internal',
    stationId: 'station-heidelberg',
    duration: { setupMinutes: 30, runMinutes: 90 }, // 2h
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  } as InternalTask);

  assignments.push({
    id: 'assign-vs-3',
    taskId: 'task-vs-3',
    targetId: 'station-heidelberg',
    isOutsourced: false,
    scheduledStart: isoDate(7, 0, 180),
    scheduledEnd: isoDate(9, 0, 180),
    isCompleted: false,
    completedAt: null,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  });

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

// ============================================================================
// Fixture: datestrip-markers
// For v0.3.47 (DateStrip Task Markers)
// Job with various task states to test viewport indicator, task markers, and timeline
// ============================================================================

export function createDatestripMarkersFixture(): ScheduleSnapshot {
  // Calculate yesterday for "late" task assignment
  const yesterdayAt10 = new Date(today);
  yesterdayAt10.setDate(yesterdayAt10.getDate() - 1);
  yesterdayAt10.setHours(10, 0, 0, 0);

  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-markers-1',
      reference: 'MARK-001',
      client: 'DateStrip Markers Client',
      description: 'DateStrip Markers Test Job - Multiple task states',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 5), // 5 days from now (exit triangle)
      color: '#3b82f6', // Blue
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-m1', 'task-m2', 'task-m3', 'task-m4', 'task-m5'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Second job to test muting behavior
    {
      id: 'job-markers-2',
      reference: 'MARK-002',
      client: 'Other Client',
      description: 'Second job for muting test',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 10),
      color: '#22c55e', // Green
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-m6'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Task 1: Yesterday, NOT completed -> LATE (red marker)
    {
      id: 'task-m1',
      elementId: 'elem-job-markers-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 2: Today, COMPLETED -> green marker
    {
      id: 'task-m2',
      elementId: 'elem-job-markers-1',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 3: Tomorrow (day 1), NOT completed, scheduled -> gray marker (future)
    {
      id: 'task-m3',
      elementId: 'elem-job-markers-1',
      sequenceOrder: 2,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 4: Day 2, scheduled but with precedence conflict -> orange marker
    {
      id: 'task-m4',
      elementId: 'elem-job-markers-1',
      sequenceOrder: 3,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 5: Day 3, NOT scheduled -> no marker (unscheduled)
    {
      id: 'task-m5',
      elementId: 'elem-job-markers-1',
      sequenceOrder: 4,
      status: 'Ready', // Unscheduled
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 6: Other job, today
    {
      id: 'task-m6',
      elementId: 'elem-job-markers-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Task 1: Yesterday 10:00-11:30, NOT completed -> LATE
    {
      id: 'assign-m1',
      taskId: 'task-m1',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, -1), // Yesterday
      scheduledEnd: isoDate(11, 30, -1),
      isCompleted: false, // NOT completed -> LATE
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task 2: Today 8:00-9:30, COMPLETED -> green
    {
      id: 'assign-m2',
      taskId: 'task-m2',
      targetId: 'station-heidelberg',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 0), // Today
      scheduledEnd: isoDate(9, 30, 0),
      isCompleted: true, // COMPLETED -> green
      completedAt: isoDate(9, 30, 0),
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task 3: Tomorrow 10:00-11:00 -> gray (future scheduled)
    {
      id: 'assign-m3',
      taskId: 'task-m3',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, 1), // Tomorrow
      scheduledEnd: isoDate(11, 0, 1),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task 4: Day 2 at 7:00-8:00 (before Task 3 ends - precedence conflict) -> orange
    // This creates a precedence violation because task-m4 (seq 3) starts before task-m3 (seq 2) ends
    {
      id: 'assign-m4',
      taskId: 'task-m4',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(7, 0, 2), // Day 2, before task-m3 ends
      scheduledEnd: isoDate(8, 0, 2),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task 6: Other job, today
    {
      id: 'assign-m6',
      taskId: 'task-m6',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(14, 0, 0), // Today afternoon
      scheduledEnd: isoDate(15, 0, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  // Precedence conflict for task-m4 (scheduled before predecessor task-m3 completes)
  const conflicts = [
    {
      type: 'PrecedenceConflict' as const,
      taskId: 'task-m4',
      message: 'Task scheduled before predecessor completes',
      details: {
        predecessorTaskId: 'task-m3',
        predecessorEnd: isoDate(11, 0, 1),
        taskStart: isoDate(7, 0, 2),
      },
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
    conflicts,
    lateJobs: [{ jobId: 'job-markers-1', deadline: isoDate(0, 0, -1), expectedCompletion: isoDate(0, 0, 1), delayDays: 2 }],
  };
}

// ============================================================================
// Fixture: zoom-snapping
// For v0.3.48 (Zoom-Aware Tile Snapping Bugfix)
// Simple job with one unscheduled task for testing snapping at different zoom levels
// Uses 7-day operating schedule so tests pass on weekends
// ============================================================================

export function createZoomSnappingFixture(): ScheduleSnapshot {
  // Custom stations with 7-day operating schedule for weekend-proof testing
  const zoomSnappingStations: Station[] = [
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
      id: 'job-zoom-1',
      reference: 'ZOOM-001',
      client: 'Zoom Test Client',
      description: 'Job for testing tile snapping at different zoom levels',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#3b82f6', // Blue
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-z1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-z1',
      elementId: 'elem-job-zoom-1',
      sequenceOrder: 0,
      status: 'Ready', // Unscheduled, ready to place
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // generateElementsForJobs mutates jobs to add elementIds
  const elements = generateElementsForJobs(jobs, tasks);
  // No assignments - task is unscheduled for drag testing at different zoom levels
  return {
    ...baseSnapshot(),
    stations: zoomSnappingStations,
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments: [],
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Fixture: drying-time
// For v0.3.51 (Drying Time Visualization)
// Job with printing task on offset station - shows yellow drying arrow during drag
// ============================================================================

export function createDryingTimeFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-dry-1',
      reference: 'DRY-001',
      client: 'Drying Time Client',
      description: 'Drying Time Visualization Test Job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#f59e0b', // Amber/Yellow (matches drying indicator)
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-dry-1', 'task-dry-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Task 1: Printing on Komori (OFFSET) - SCHEDULED at 8:00-10:00
    // This task requires 4h drying time after completion
    {
      id: 'task-dry-1',
      elementId: 'elem-job-dry-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori', // OFFSET station - requires drying time
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 2: Cutting on Polar - UNSCHEDULED
    // When dragging: should show yellow drying arrow on Komori column
    // Arrow goes from 10:00 (task-dry-1 end) to 14:00 (10:00 + 4h dry time)
    {
      id: 'task-dry-2',
      elementId: 'elem-job-dry-1',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar', // Cutting station
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Task 1 scheduled at 8:00-10:00 on Komori (offset)
    // Drying time: 10:00 + 4h = 14:00
    {
      id: 'assign-dry-1',
      taskId: 'task-dry-1',
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
      requiredJobIds: [],
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
      requiredJobIds: [],
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

// ============================================================================
// Fixture: pick-place
// For v0.3.54 (Pick & Place from Sidebar)
// Jobs with unscheduled tasks for pick & place testing
// ============================================================================

export function createPickPlaceFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    // Job 1: Has unscheduled tasks for picking
    {
      id: 'job-pick-1',
      reference: 'PICK-001',
      client: 'Pick & Place Client A',
      description: 'Pick & Place Test Job - Multiple unscheduled tasks',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#3b82f6', // Blue
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-pick-1a', 'task-pick-1b', 'task-pick-1c'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: All unscheduled (for testing multiple picks)
    {
      id: 'job-pick-2',
      reference: 'PICK-002',
      client: 'Pick & Place Client B',
      description: 'Pick & Place Test Job - All unscheduled',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 10),
      color: '#8b5cf6', // Purple
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-pick-2a', 'task-pick-2b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 3: Has existing scheduled task (for conflict testing)
    {
      id: 'job-pick-3',
      reference: 'PICK-003',
      client: 'Pick & Place Client C',
      description: 'Pick & Place Test Job - With scheduled task',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#22c55e', // Green
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-pick-3a', 'task-pick-3b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Job 1 tasks: Print (scheduled) → Cut (unscheduled) → Finish (unscheduled)
    {
      id: 'task-pick-1a',
      elementId: 'elem-job-pick-1',
      sequenceOrder: 0,
      status: 'Assigned', // Scheduled
      type: 'Internal',
      stationId: 'station-komori', // Offset
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-pick-1b',
      elementId: 'elem-job-pick-1',
      sequenceOrder: 1,
      status: 'Ready', // Unscheduled - waiting for predecessor
      type: 'Internal',
      stationId: 'station-polar', // Cutting
      duration: { setupMinutes: 15, runMinutes: 30 }, // 45min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-pick-1c',
      elementId: 'elem-job-pick-1',
      sequenceOrder: 2,
      status: 'Ready', // Unscheduled
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 2 tasks: All unscheduled (different stations)
    {
      id: 'task-pick-2a',
      elementId: 'elem-job-pick-2',
      sequenceOrder: 0,
      status: 'Ready', // Unscheduled
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-pick-2b',
      elementId: 'elem-job-pick-2',
      sequenceOrder: 1,
      status: 'Ready', // Unscheduled
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 3 tasks: Print (scheduled) → Cut (unscheduled, has predecessor)
    {
      id: 'task-pick-3a',
      elementId: 'elem-job-pick-3',
      sequenceOrder: 0,
      status: 'Assigned', // Scheduled
      type: 'Internal',
      stationId: 'station-komori', // Offset - requires dry time
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-pick-3b',
      elementId: 'elem-job-pick-3',
      sequenceOrder: 1,
      status: 'Ready', // Unscheduled - has precedence constraint (predecessor + dry time)
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 15, runMinutes: 30 }, // 45min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Job 1, Task 1a: Scheduled at 8:00-9:30 (offset, so +4h dry time = 13:30 earliest for task 1b)
    {
      id: 'assign-pick-1a',
      taskId: 'task-pick-1a',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 3, Task 3a: Scheduled at 10:00-11:30 (offset, so +4h dry time = 15:30 earliest for task 3b)
    {
      id: 'assign-pick-3a',
      taskId: 'task-pick-3a',
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
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}

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

// ============================================================================
// Fixed Tile Height Fixture (v0.3.59)
// ============================================================================

/**
 * Fixture for testing Job Details Panel fixed tile height.
 * Contains tasks with varying durations to verify all tiles render at same height.
 */
function createFixedTileHeightFixture(): ScheduleSnapshot {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isoDate = (hour: number, minute: number = 0): string => {
    const d = new Date(today);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-height-1',
      reference: 'HEIGHT-001',
      client: 'Test Client',
      description: 'Task with varying durations',
      status: 'InProgress',
      color: '#8b5cf6', // Purple
      workshopExitDate: isoDate(17, 0),
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      platesStatus: 'Done',
      paperPurchaseStatus: 'InStock',
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-h-15min', 'task-h-30min', 'task-h-2h', 'task-h-4h'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'job-height-2',
      reference: 'HEIGHT-002',
      client: 'Another Client',
      description: 'Mix of scheduled and unscheduled',
      status: 'InProgress',
      color: '#3b82f6', // Blue
      workshopExitDate: isoDate(17, 0),
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      platesStatus: 'Done',
      paperPurchaseStatus: 'InStock',
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-h-sched', 'task-h-unsched'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Job 1: 4 tasks with varying durations (all unscheduled)
    {
      id: 'task-h-15min',
      elementId: 'elem-job-height-1',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 5, runMinutes: 10 }, // 15 minutes total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-h-30min',
      elementId: 'elem-job-height-1',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 10, runMinutes: 20 }, // 30 minutes total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-h-2h',
      elementId: 'elem-job-height-1',
      sequenceOrder: 2,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2 hours total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-h-4h',
      elementId: 'elem-job-height-1',
      sequenceOrder: 3,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 60, runMinutes: 180 }, // 4 hours total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // Job 2: One scheduled, one unscheduled
    {
      id: 'task-h-sched',
      elementId: 'elem-job-height-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1 hour
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-h-unsched',
      elementId: 'elem-job-height-2',
      sequenceOrder: 1,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2 hours
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // Only job-height-2's first task is scheduled
    {
      id: 'assign-h-sched',
      taskId: 'task-h-sched',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 0),
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

// ============================================================================
// Fixture: unavailability-overlay
// For v0.3.60 (Unavailability Overlay SVG)
// Stations with clear unavailability periods to verify stripe pattern rendering
// ============================================================================

function createUnavailabilityOverlayFixture(): ScheduleSnapshot {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isoDate = (hour: number, minute: number = 0): string => {
    const d = new Date(today);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  // Station with standard lunch break (12-13)
  const lunchBreakSchedule: DaySchedule = {
    isOperating: true,
    slots: [
      { start: '06:00', end: '12:00' },
      { start: '13:00', end: '22:00' },
    ],
  };

  // Station with morning and afternoon shifts (gap 12-14)
  const splitShiftSchedule: DaySchedule = {
    isOperating: true,
    slots: [
      { start: '06:00', end: '12:00' },
      { start: '14:00', end: '20:00' },
    ],
  };

  // Station with short day (08-17)
  const shortDaySchedule: DaySchedule = {
    isOperating: true,
    slots: [
      { start: '08:00', end: '17:00' },
    ],
  };

  const closedDay: DaySchedule = {
    isOperating: false,
    slots: [],
  };

  const overlayStations: Station[] = [
    {
      id: 'station-overlay-lunch',
      name: 'Lunch Break Station',
      status: 'Available',
      categoryId: 'cat-offset',
      groupId: 'grp-offset',
      capacity: 1,
      operatingSchedule: {
        monday: lunchBreakSchedule,
        tuesday: lunchBreakSchedule,
        wednesday: lunchBreakSchedule,
        thursday: lunchBreakSchedule,
        friday: lunchBreakSchedule,
        saturday: closedDay,
        sunday: closedDay,
      },
      exceptions: [],
    },
    {
      id: 'station-overlay-split',
      name: 'Split Shift Station',
      status: 'Available',
      categoryId: 'cat-offset',
      groupId: 'grp-offset',
      capacity: 1,
      operatingSchedule: {
        monday: splitShiftSchedule,
        tuesday: splitShiftSchedule,
        wednesday: splitShiftSchedule,
        thursday: splitShiftSchedule,
        friday: splitShiftSchedule,
        saturday: closedDay,
        sunday: closedDay,
      },
      exceptions: [],
    },
    {
      id: 'station-overlay-short',
      name: 'Short Day Station',
      status: 'Available',
      categoryId: 'cat-cutting',
      groupId: 'grp-cutting',
      capacity: 1,
      operatingSchedule: {
        monday: shortDaySchedule,
        tuesday: shortDaySchedule,
        wednesday: shortDaySchedule,
        thursday: shortDaySchedule,
        friday: shortDaySchedule,
        saturday: closedDay,
        sunday: closedDay,
      },
      exceptions: [],
    },
  ];

  const localBatSentAt = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const localBatApprovedAt = new Date(today.getTime() - 12 * 60 * 60 * 1000).toISOString();

  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-overlay-1',
      reference: 'OVERLAY-001',
      client: 'Overlay Test Client',
      description: 'Test job for unavailability overlay',
      status: 'InProgress',
      color: '#8b5cf6', // Purple
      workshopExitDate: isoDate(17, 0),
      proofApproval: { sentAt: localBatSentAt, approvedAt: localBatApprovedAt },
      platesStatus: 'Done',
      paperPurchaseStatus: 'InStock',
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-overlay-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-overlay-1',
      elementId: 'elem-job-overlay-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-overlay-lunch',
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2 hours
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    {
      id: 'assign-overlay-1',
      taskId: 'task-overlay-1',
      targetId: 'station-overlay-lunch',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(10, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  return {
    version: 1,
    generatedAt: today.toISOString(),
    stations: overlayStations,
    categories,
    groups,
    providers: [],
    jobs: jobs as Job[],
    elements: generateElementsForJobs(jobs, tasks),
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Fixture Registry
// ============================================================================

export type FixtureName = 'test' | 'push-down' | 'precedence' | 'approval-gates' | 'swap' | 'sidebar-drag' | 'alt-bypass' | 'drag-snapping' | 'ui-bug-fixes' | 'layout-redesign' | 'datestrip-redesign' | 'precedence-visualization' | 'virtual-scroll' | 'datestrip-markers' | 'zoom-snapping' | 'drying-time' | 'validation-messages' | 'precedence-working-hours' | 'pick-place' | 'context-menu' | 'fixed-tile-height' | 'unavailability-overlay';

export const fixtureRegistry: Record<FixtureName, () => ScheduleSnapshot> = {
  'test': createBasicFixture,
  'push-down': createPushDownFixture,
  'precedence': createPrecedenceFixture,
  'approval-gates': createApprovalGatesFixture,
  'swap': createSwapFixture,
  'sidebar-drag': createSidebarDragFixture,
  'alt-bypass': createAltBypassFixture,
  'drag-snapping': createDragSnappingFixture,
  'ui-bug-fixes': createUiBugFixesFixture,
  'layout-redesign': createLayoutRedesignFixture,
  'datestrip-redesign': createDatestripRedesignFixture,
  'precedence-visualization': createPrecedenceVisualizationFixture,
  'virtual-scroll': createVirtualScrollFixture,
  'datestrip-markers': createDatestripMarkersFixture,
  'zoom-snapping': createZoomSnappingFixture,
  'drying-time': createDryingTimeFixture,
  'validation-messages': createValidationMessagesFixture,
  'precedence-working-hours': createPrecedenceWorkingHoursFixture,
  'pick-place': createPickPlaceFixture,
  'context-menu': createContextMenuFixture,
  'fixed-tile-height': createFixedTileHeightFixture,
  'unavailability-overlay': createUnavailabilityOverlayFixture,
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
