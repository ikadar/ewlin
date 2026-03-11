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
      comments: [],
      taskIds: ['task-pv-1', 'task-pv-2', 'task-pv-3'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
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
      stationId: 'station-offset',
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
      stationId: 'station-plieuse',
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
      stationId: 'station-massicot',
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
      targetId: 'station-offset',
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
      targetId: 'station-massicot',
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
