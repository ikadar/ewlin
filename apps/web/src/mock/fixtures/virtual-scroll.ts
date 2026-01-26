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
