import type {
  ScheduleSnapshot,
  Job,
  Element,
  Task,
  InternalTask,
  TaskAssignment,
} from '@flux/types';
import type { Station } from '@flux/types';
import {
  today,
  isoDate,
  categories,
  groups,
  providers,
  sevenDayOperatingSchedule,
} from './shared';

// ============================================================================
// Fixture: element-precedence
// Multi-element job with cross-element dependencies
//
// Job: BOOK-001 "Book Production"
// ├─ Element A "Couverture" (cover)
// │  ├─ Task A1: Printing (Komori, seq 0)
// │  └─ Task A2: Cutting (Polar, seq 1)
// ├─ Element B "Intérieur" (interior)
// │  ├─ Task B1: Printing (Komori, seq 0)
// │  └─ Task B2: Cutting (Polar, seq 1)
// └─ Element C "Reliure" (binding) — depends on A AND B
//    └─ Task C1: Binding (Polar, seq 0) — UNSCHEDULED
//
// Element C.prerequisiteElementIds = [elem-cover, elem-interior]
// ============================================================================

// Stations with 7-day operating schedule (so tests pass regardless of day-of-week)
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
  {
    id: 'station-polar',
    name: 'Polar 137',
    status: 'Available',
    categoryId: 'cat-cutting',
    groupId: 'grp-cutting',
    capacity: 1,
    operatingSchedule: sevenDayOperatingSchedule,
    exceptions: [],
  },
];

export function createElementPrecedenceFixture(): ScheduleSnapshot {
  const elemCoverId = 'elem-cover';
  const elemInteriorId = 'elem-interior';
  const elemBindingId = 'elem-binding';

  const jobs: Job[] = [
    {
      id: 'job-book',
      reference: 'BOOK-001',
      client: 'Éditions Gallimard',
      description: 'Book Production — Couverture + Intérieur + Reliure',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#6366f1', // Indigo
      comments: [],
      elementIds: [elemCoverId, elemInteriorId, elemBindingId],
      taskIds: ['task-a1', 'task-a2', 'task-b1', 'task-b2', 'task-c1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const elements: Element[] = [
    {
      id: elemCoverId,
      jobId: 'job-book',
      suffix: 'couv',
      label: 'Couverture',
      prerequisiteElementIds: [],
      taskIds: ['task-a1', 'task-a2'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved',
      plateStatus: 'ready',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: elemInteriorId,
      jobId: 'job-book',
      suffix: 'int',
      label: 'Intérieur',
      prerequisiteElementIds: [],
      taskIds: ['task-b1', 'task-b2'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved',
      plateStatus: 'ready',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: elemBindingId,
      jobId: 'job-book',
      suffix: 'rel',
      label: 'Reliure',
      prerequisiteElementIds: [elemCoverId, elemInteriorId],
      taskIds: ['task-c1'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved',
      plateStatus: 'ready',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Element A (Couverture): Printing → Cutting
    {
      id: 'task-a1',
      elementId: elemCoverId,
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-a2',
      elementId: elemCoverId,
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 10, runMinutes: 20 }, // 30min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Element B (Intérieur): Printing → Cutting
    {
      id: 'task-b1',
      elementId: elemInteriorId,
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-b2',
      elementId: elemInteriorId,
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 10, runMinutes: 20 }, // 30min
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Element C (Reliure): Binding — UNSCHEDULED
    {
      id: 'task-c1',
      elementId: elemBindingId,
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 20, runMinutes: 40 }, // 1h
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // A1: 08:00 - 09:00 on Komori (printing → requires 4h dry time)
  // A2: 13:00 - 13:30 on Polar (after dry time from A1)
  // B1: 09:00 - 10:00 on Komori (printing → requires 4h dry time)
  // B2: 14:00 - 14:30 on Polar (after dry time from B1)
  // C1: UNSCHEDULED — must wait for BOTH A2 and B2 to complete
  //     Earliest start: max(A2 end, B2 end) = 14:30
  const assignments: TaskAssignment[] = [
    {
      id: 'assign-a1',
      taskId: 'task-a1',
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
      id: 'assign-a2',
      taskId: 'task-a2',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(13, 0),
      scheduledEnd: isoDate(13, 30),
      isCompleted: false,
      completedAt: null,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'assign-b1',
      taskId: 'task-b1',
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
      id: 'assign-b2',
      taskId: 'task-b2',
      targetId: 'station-polar',
      isOutsourced: false,
      scheduledStart: isoDate(14, 0),
      scheduledEnd: isoDate(14, 30),
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
