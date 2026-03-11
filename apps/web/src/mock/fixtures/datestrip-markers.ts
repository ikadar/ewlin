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
  baseSnapshot,
  generateElementsForJobs,
  type JobWithoutElementIds,
} from './shared';

// ============================================================================
// Fixture: datestrip-markers
// For v0.3.47 (DateStrip Task Markers)
// Job with various task states to test viewport indicator, task markers, and timeline
//
// Production routes (per fixture-guide.md §11):
//   job-markers-1: Dépliant 3 volets — Offset → Massicot → Plieuse → Conditionnement
//   job-markers-2: Flyer             — Offset → Massicot → Conditionnement
// ============================================================================

export function createDatestripMarkersFixture(): ScheduleSnapshot {
  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-markers-1',
      reference: 'MARK-001',
      client: 'DateStrip Markers Client',
      description: 'Dépliant 3 volets - Multiple task states test',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 5), // 5 days from now (exit triangle)
      color: '#3b82f6', // Blue
      comments: [],
      taskIds: ['task-m1', 'task-m2', 'task-m3', 'task-m4'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
    // Second job to test muting behavior
    {
      id: 'job-markers-2',
      reference: 'MARK-002',
      client: 'Other Client',
      description: 'Flyers A5 - muting test',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 10),
      color: '#22c55e', // Green
      comments: [],
      taskIds: ['task-m6a', 'task-m6', 'task-m6b'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
  ];

  const tasks: Task[] = [
    // === job-markers-1: Dépliant 3 volets ===
    // Route: Offset → Massicot → Plieuse → Conditionnement

    // Task 1: Offset (impression) — Yesterday, NOT completed -> LATE (red marker)
    {
      id: 'task-m1',
      elementId: 'elem-job-markers-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-offset',
      duration: { setupMinutes: 30, runMinutes: 60 }, // 1.5h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 2: Massicot (coupe) — Today, COMPLETED -> green marker
    {
      id: 'task-m2',
      elementId: 'elem-job-markers-1',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-massicot',
      duration: { setupMinutes: 10, runMinutes: 20 }, // 30min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 3: Plieuse (pliage) — Tomorrow, scheduled -> gray marker (future)
    {
      id: 'task-m3',
      elementId: 'elem-job-markers-1',
      sequenceOrder: 2,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-plieuse',
      duration: { setupMinutes: 30, runMinutes: 150 }, // 3h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 4: Conditionnement (emballage) — Tomorrow, precedence conflict -> orange marker
    // Starts at 8:00 while predecessor (task-m3 plieuse) ends at 13:00
    {
      id: 'task-m4',
      elementId: 'elem-job-markers-1',
      sequenceOrder: 3,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-conditionnement',
      duration: { setupMinutes: 10, runMinutes: 20 }, // 30min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,

    // === job-markers-2: Flyer ===
    // Route: Offset → Massicot → Conditionnement

    // Task 6a: Offset (impression) — Today morning
    {
      id: 'task-m6a',
      elementId: 'elem-job-markers-2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-offset',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 6: Massicot (coupe) — Today afternoon (after 4h drying)
    {
      id: 'task-m6',
      elementId: 'elem-job-markers-2',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-massicot',
      duration: { setupMinutes: 10, runMinutes: 20 }, // 30min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Task 6b: Conditionnement (emballage) — Today afternoon
    {
      id: 'task-m6b',
      elementId: 'elem-job-markers-2',
      sequenceOrder: 2,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-conditionnement',
      duration: { setupMinutes: 10, runMinutes: 20 }, // 30min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    // === job-markers-1 assignments ===

    // Task 1: Offset — Yesterday 10:00-11:30, NOT completed -> LATE
    {
      id: 'assign-m1',
      taskId: 'task-m1',
      targetId: 'station-offset',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, -1), // Yesterday
      scheduledEnd: isoDate(11, 30, -1),
      isCompleted: false, // NOT completed -> LATE
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task 2: Massicot — Today 8:00-8:30, COMPLETED -> green
    {
      id: 'assign-m2',
      taskId: 'task-m2',
      targetId: 'station-massicot',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 0), // Today
      scheduledEnd: isoDate(8, 30, 0),
      isCompleted: true, // COMPLETED -> green
      completedAt: isoDate(8, 30, 0),
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task 3: Plieuse — Tomorrow 10:00-13:00 -> gray (future scheduled)
    {
      id: 'assign-m3',
      taskId: 'task-m3',
      targetId: 'station-plieuse',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, 1), // Tomorrow
      scheduledEnd: isoDate(13, 0, 1),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task 4: Conditionnement — Tomorrow 8:00-8:30 (starts before task-m3 plieuse ends at 13:00) -> orange
    {
      id: 'assign-m4',
      taskId: 'task-m4',
      targetId: 'station-conditionnement',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0, 1), // Tomorrow, before task-m3 ends
      scheduledEnd: isoDate(8, 30, 1),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },

    // === job-markers-2 assignments ===

    // Task 6a: Offset — Today 10:00-11:00
    {
      id: 'assign-m6a',
      taskId: 'task-m6a',
      targetId: 'station-offset',
      isOutsourced: false,
      scheduledStart: isoDate(10, 0, 0), // Today morning
      scheduledEnd: isoDate(11, 0, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task 6: Massicot — Today 15:00-15:30 (after 4h drying from offset end at 11:00)
    {
      id: 'assign-m6',
      taskId: 'task-m6',
      targetId: 'station-massicot',
      isOutsourced: false,
      scheduledStart: isoDate(15, 0, 0), // Today, after 4h drying
      scheduledEnd: isoDate(15, 30, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Task 6b: Conditionnement — Today 16:00-16:30
    {
      id: 'assign-m6b',
      taskId: 'task-m6b',
      targetId: 'station-conditionnement',
      isOutsourced: false,
      scheduledStart: isoDate(16, 0, 0), // Today afternoon
      scheduledEnd: isoDate(16, 30, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  // Precedence conflict: task-m4 (conditionnement, seq 3) starts at 8:00
  // while task-m3 (plieuse, seq 2) doesn't end until 13:00
  const conflicts = [
    {
      type: 'PrecedenceConflict' as const,
      taskId: 'task-m4',
      message: 'Task scheduled before predecessor completes',
      details: {
        predecessorTaskId: 'task-m3',
        predecessorEnd: isoDate(13, 0, 1),
        taskStart: isoDate(8, 0, 1),
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
