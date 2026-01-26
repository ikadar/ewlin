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
// Fixture: datestrip-markers
// For v0.3.47 (DateStrip Task Markers)
// Job with various task states to test viewport indicator, task markers, and timeline
// ============================================================================

export function createDatestripMarkersFixture(): ScheduleSnapshot {
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
