/**
 * Fixture: blocking-visual
 * v0.4.32b - Scheduler Tile Blocking Visual & Tooltip
 *
 * Tests visual feedback for blocked elements on scheduler tiles.
 *
 * Job 1: READY-001 "Ready Job"
 * ├─ Element: Couverture (all prerequisites ready)
 * │  ├─ paperStatus: 'in_stock' (ready)
 * │  ├─ batStatus: 'bat_approved' (ready)
 * │  └─ plateStatus: 'ready' (ready)
 * │  └─ Task: Printing (scheduled) → should show SOLID border
 *
 * Job 2: BLOCKED-001 "Blocked Job"
 * ├─ Element: Couverture (paper not ready)
 * │  ├─ paperStatus: 'to_order' (blocking)
 * │  ├─ batStatus: 'bat_approved' (ready)
 * │  └─ plateStatus: 'ready' (ready)
 * │  └─ Task: Printing (scheduled) → should show DASHED border + tooltip
 *
 * Job 3: WAITING-001 "Waiting for BAT"
 * ├─ Element: Intérieur (BAT not ready)
 * │  ├─ paperStatus: 'delivered' (ready)
 * │  ├─ batStatus: 'waiting_files' (blocking)
 * │  └─ plateStatus: 'none' (ready - no plates needed)
 * │  └─ Task: Printing (scheduled) → should show DASHED border + tooltip
 *
 * Job 4: PLATES-001 "Waiting for Plates"
 * ├─ Element: Couverture (plates not ready)
 * │  ├─ paperStatus: 'in_stock' (ready)
 * │  ├─ batStatus: 'bat_approved' (ready)
 * │  └─ plateStatus: 'to_make' (blocking)
 * │  └─ Task: Printing (scheduled) → should show DASHED border + tooltip
 */

import type {
  ScheduleSnapshot,
  Job,
  Element,
  Task,
  InternalTask,
  TaskAssignment,
  Station,
} from '@flux/types';
import {
  today,
  isoDate,
  categories,
  groups,
  providers,
  sevenDayOperatingSchedule,
} from './shared';

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
    id: 'station-heidelberg',
    name: 'Heidelberg Speedmaster',
    status: 'Available',
    categoryId: 'cat-offset',
    groupId: 'grp-offset',
    capacity: 1,
    operatingSchedule: sevenDayOperatingSchedule,
    exceptions: [],
  },
];

export function createBlockingVisualFixture(): ScheduleSnapshot {
  const jobs: Job[] = [
    // Job 1: Ready (all prerequisites OK)
    {
      id: 'job-ready',
      reference: 'READY-001',
      client: 'Client Prêt',
      description: 'All prerequisites ready - should show SOLID border',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#22c55e', // Green
      comments: [],
      elementIds: ['elem-ready'],
      taskIds: ['task-ready'],
      fullyScheduled: true,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 2: Blocked (paper to_order)
    {
      id: 'job-blocked-paper',
      reference: 'BLOCKED-001',
      client: 'Client Papier',
      description: 'Paper needs to be ordered - should show DASHED border',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#ef4444', // Red
      comments: [],
      elementIds: ['elem-blocked-paper'],
      taskIds: ['task-blocked-paper'],
      fullyScheduled: true,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 3: Blocked (BAT waiting_files)
    {
      id: 'job-blocked-bat',
      reference: 'WAITING-001',
      client: 'Client BAT',
      description: 'Waiting for client files - should show DASHED border',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#f59e0b', // Amber
      comments: [],
      elementIds: ['elem-blocked-bat'],
      taskIds: ['task-blocked-bat'],
      fullyScheduled: true,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Job 4: Blocked (plates to_make)
    {
      id: 'job-blocked-plates',
      reference: 'PLATES-001',
      client: 'Client Plaques',
      description: 'Plates need to be made - should show DASHED border',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6', // Purple
      comments: [],
      elementIds: ['elem-blocked-plates'],
      taskIds: ['task-blocked-plates'],
      fullyScheduled: true,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const elements: Element[] = [
    // Element 1: Ready (all prerequisites OK)
    {
      id: 'elem-ready',
      jobId: 'job-ready',
      suffix: 'couv',
      label: 'Couverture',
      prerequisiteElementIds: [],
      taskIds: ['task-ready'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved',
      plateStatus: 'ready',
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Element 2: Blocked (paper to_order)
    {
      id: 'elem-blocked-paper',
      jobId: 'job-blocked-paper',
      suffix: 'couv',
      label: 'Couverture',
      prerequisiteElementIds: [],
      taskIds: ['task-blocked-paper'],
      paperStatus: 'to_order', // BLOCKING
      batStatus: 'bat_approved',
      plateStatus: 'ready',
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Element 3: Blocked (BAT waiting_files)
    {
      id: 'elem-blocked-bat',
      jobId: 'job-blocked-bat',
      suffix: 'int',
      label: 'Intérieur',
      prerequisiteElementIds: [],
      taskIds: ['task-blocked-bat'],
      paperStatus: 'delivered',
      batStatus: 'waiting_files', // BLOCKING
      plateStatus: 'none', // No plates needed
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Element 4: Blocked (plates to_make)
    {
      id: 'elem-blocked-plates',
      jobId: 'job-blocked-plates',
      suffix: 'couv',
      label: 'Couverture',
      prerequisiteElementIds: [],
      taskIds: ['task-blocked-plates'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved',
      plateStatus: 'to_make', // BLOCKING
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-ready',
      elementId: 'elem-ready',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-blocked-paper',
      elementId: 'elem-blocked-paper',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-blocked-bat',
      elementId: 'elem-blocked-bat',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-blocked-plates',
      elementId: 'elem-blocked-plates',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // Schedule tasks at different times for visibility
  const assignments: TaskAssignment[] = [
    // Ready task at 08:00
    {
      id: 'assign-ready',
      taskId: 'task-ready',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Blocked (paper) task at 09:30
    {
      id: 'assign-blocked-paper',
      taskId: 'task-blocked-paper',
      targetId: 'station-komori',
      isOutsourced: false,
      scheduledStart: isoDate(9, 30),
      scheduledEnd: isoDate(10, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Blocked (BAT) task at 08:00
    {
      id: 'assign-blocked-bat',
      taskId: 'task-blocked-bat',
      targetId: 'station-heidelberg',
      isOutsourced: false,
      scheduledStart: isoDate(8, 0),
      scheduledEnd: isoDate(9, 0),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    // Blocked (plates) task at 09:30
    {
      id: 'assign-blocked-plates',
      taskId: 'task-blocked-plates',
      targetId: 'station-heidelberg',
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
    categories,
    groups,
    providers,
    jobs,
    elements,
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}
