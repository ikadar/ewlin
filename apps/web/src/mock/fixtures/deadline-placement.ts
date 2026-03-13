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
// Fixture: deadline-placement
// Tests that placing a tile after the job deadline (workshopExitDate) is handled correctly.
//
// Job 1: workshopExitDate = TODAY at 14:00 (deadline is today)
//   - Task 1: unscheduled, on station-offset, 1h duration
//   - Placing at 06:00-07:00 = BEFORE deadline = OK
//   - Placing at 15:00-16:00 = AFTER deadline = DeadlineConflict
//
// Job 2: workshopExitDate = YESTERDAY (deadline already passed)
//   - Task 2: unscheduled, on station-massicot, 45min duration
//   - Any placement = AFTER deadline = DeadlineConflict
// ============================================================================

export function createDeadlinePlacementFixture(): ScheduleSnapshot {
  // workshopExitDate format: "YYYY-MM-DDT14:00" (the getDeadlineDate helper sets 14:00)
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-deadline-today',
      reference: 'DEAD-001',
      client: 'Deadline Today Client',
      description: 'Job with deadline today at 14:00',
      status: 'InProgress',
      workshopExitDate: `${todayStr}T14:00`,
      color: '#ef4444', // Red
      comments: [],
      taskIds: ['task-deadline-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
    {
      id: 'job-deadline-past',
      reference: 'DEAD-002',
      client: 'Deadline Past Client',
      description: 'Job with deadline already passed',
      status: 'InProgress',
      workshopExitDate: `${yesterdayStr}T14:00`,
      color: '#f97316', // Orange
      comments: [],
      taskIds: ['task-deadline-2'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-deadline-1',
      elementId: 'elem-job-deadline-today',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-offset',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-deadline-2',
      elementId: 'elem-job-deadline-past',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-massicot',
      duration: { setupMinutes: 15, runMinutes: 30 }, // 45min total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [];

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
