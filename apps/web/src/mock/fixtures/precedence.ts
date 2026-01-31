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
