/**
 * Fixture: forme-date-tracking
 * v0.4.32c - Forme Status & Date Tracking
 *
 * Tests forme prerequisite tracking and date display for die-cutting elements.
 *
 * Job 1: FORME-001 "Die-Cutting Job"
 * ├─ Element: Couverture (with die-cutting task)
 * │  ├─ paperStatus: 'ordered' with date
 * │  ├─ batStatus: 'bat_approved' with date
 * │  ├─ plateStatus: 'ready'
 * │  └─ formeStatus: 'ordered' with date
 * │  └─ Task: Die-cutting (on Bobst) → should show Forme dropdown
 *
 * Job 2: NO-FORME-001 "No Die-Cutting Job"
 * ├─ Element: Couverture (no die-cutting task)
 * │  ├─ paperStatus: 'in_stock'
 * │  ├─ batStatus: 'bat_approved'
 * │  ├─ plateStatus: 'ready'
 * │  └─ formeStatus: 'none'
 * │  └─ Task: Printing (on Komori) → should NOT show Forme dropdown
 */

import type {
  ScheduleSnapshot,
  Job,
  Element,
  Task,
  InternalTask,
  TaskAssignment,
  Station,
  StationCategory,
  StationGroup,
} from '@flux/types';
import {
  today,
  isoDate,
  providers,
  sevenDayOperatingSchedule,
} from './shared';

// Categories including die-cutting
const fixtureCategories: StationCategory[] = [
  {
    id: 'cat-offset',
    name: 'Presses Offset',
    description: 'Machines d\'impression offset',
    similarityCriteria: [],
  },
  {
    id: 'cat-die-cutting',
    name: 'Découpe',
    description: 'Machines de découpe à forme',
    similarityCriteria: [],
  },
];

// Groups including die-cutting
const fixtureGroups: StationGroup[] = [
  {
    id: 'grp-offset',
    name: 'Presses Offset',
    maxConcurrent: 10,
    isOutsourcedProviderGroup: false,
  },
  {
    id: 'grp-die-cutting',
    name: 'Découpe',
    maxConcurrent: 1,
    isOutsourcedProviderGroup: false,
  },
];

// Stations with 7-day operating schedule
const fixtureStations: Station[] = [
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
    id: 'station-bobst',
    name: 'Bobst SP 102',
    status: 'Available',
    categoryId: 'cat-die-cutting',
    groupId: 'grp-die-cutting',
    capacity: 1,
    operatingSchedule: sevenDayOperatingSchedule,
    exceptions: [],
  },
];

export function createFormeDateTrackingFixture(): ScheduleSnapshot {
  // Sample dates for testing
  const paperOrderedDate = new Date(today);
  paperOrderedDate.setDate(paperOrderedDate.getDate() - 5);

  const batApprovedDate = new Date(today);
  batApprovedDate.setDate(batApprovedDate.getDate() - 3);

  const formeOrderedDate = new Date(today);
  formeOrderedDate.setDate(formeOrderedDate.getDate() - 2);

  const jobs: Job[] = [
    // Job 1: With die-cutting (should show Forme dropdown)
    {
      id: 'job-forme',
      reference: 'FORME-001',
      client: 'Client Découpe',
      description: 'Job with die-cutting - should show Forme dropdown',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6', // Purple
      comments: [],
      elementIds: ['elem-forme'],
      taskIds: ['task-forme-print', 'task-forme-cut'],
      fullyScheduled: true,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: Without die-cutting (should NOT show Forme dropdown)
    {
      id: 'job-no-forme',
      reference: 'NO-FORME-001',
      client: 'Client Sans Forme',
      description: 'Job without die-cutting - should NOT show Forme dropdown',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#22c55e', // Green
      comments: [],
      elementIds: ['elem-no-forme'],
      taskIds: ['task-no-forme'],
      fullyScheduled: true,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const elements: Element[] = [
    // Element 1: With die-cutting task (forme required)
    {
      id: 'elem-forme',
      jobId: 'job-forme',
      name: 'couv',
      label: 'Couverture avec découpe',
      prerequisiteElementIds: [],
      taskIds: ['task-forme-print', 'task-forme-cut'],
      paperStatus: 'ordered',
      paperOrderedAt: paperOrderedDate.toISOString(),
      batStatus: 'bat_approved',
      batApprovedAt: batApprovedDate.toISOString(),
      plateStatus: 'ready',
      formeStatus: 'ordered',
      formeOrderedAt: formeOrderedDate.toISOString(),
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Element 2: Without die-cutting task (no forme needed)
    {
      id: 'elem-no-forme',
      jobId: 'job-no-forme',
      name: 'couv',
      label: 'Couverture sans découpe',
      prerequisiteElementIds: [],
      taskIds: ['task-no-forme'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved',
      plateStatus: 'ready',
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Job 1: Print + Die-cut
    {
      id: 'task-forme-print',
      elementId: 'elem-forme',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-forme-cut',
      elementId: 'elem-forme',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-bobst', // Die-cutting station
      duration: { setupMinutes: 20, runMinutes: 30 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Job 2: Print only
    {
      id: 'task-no-forme',
      elementId: 'elem-no-forme',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Schedule tasks
  const assignments: TaskAssignment[] = [
    // Job 1 tasks
    {
      id: 'assign-forme-print',
      taskId: 'task-forme-print',
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
      id: 'assign-forme-cut',
      taskId: 'task-forme-cut',
      targetId: 'station-bobst',
      isOutsourced: false,
      scheduledStart: isoDate(13, 0),
      scheduledEnd: isoDate(13, 50),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2 task
    {
      id: 'assign-no-forme',
      taskId: 'task-no-forme',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(9, 30),
      scheduledEnd: isoDate(10, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stations: fixtureStations,
    categories: fixtureCategories,
    groups: fixtureGroups,
    providers,
    jobs,
    elements,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}
