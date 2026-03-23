import type {
  ScheduleSnapshot,
  Job,
  Element,
  Task,
  InternalTask,
  TaskAssignment,
} from '@flux/types';
import {
  today,
  isoDate,
  categories,
  groups,
  providers,
  sevenDayOperatingSchedule,
} from './shared';
import type { Station } from '@flux/types';

// ============================================================================
// Fixture: job-precedence
// Cross-job dependency: Job B depends on Job A
//
// Job A: PRINT-001 "Brochures" — prerequisite job
// ├─ Element A1 "couv" (cover)
// │  ├─ Task A1-1: Printing (Komori, seq 0) — assigned 08:00-09:00
// │  └─ Task A1-2: Cutting (Polar, seq 1) — assigned 13:00-13:30
// └─ Element A2 "int" (interior)
//    └─ Task A2-1: Printing (Heidelberg, seq 0) — assigned 08:00-10:00
//
// Job B: ASSEM-002 "Assembly" — depends on Job A (requiredJobIds)
// └─ Element B1 "fin" (finishing) — root element (no element prerequisites)
//    └─ Task B1-1: Binding (Polar, seq 0) — UNSCHEDULED
//
// Expected: Task B1-1 cannot start until ALL tasks in Job A finish.
//   Most constraining: max(A1-2 end=13:30, A2-1 end=10:00+4h dry=14:00) = 14:00
// ============================================================================

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

export function createJobPrecedenceFixture(): ScheduleSnapshot {
  const jobs: Job[] = [
    {
      id: 'job-a',
      reference: 'PRINT-001',
      client: 'Client Alpha',
      description: 'Brochures — prerequisite job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 14),
      color: '#6366f1',
      comments: [],
      requiredJobIds: [],
      elementIds: ['elem-a1', 'elem-a2'],
      taskIds: ['task-a1-1', 'task-a1-2', 'task-a2-1'],
      fullyScheduled: true,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
    {
      id: 'job-b',
      reference: 'ASSEM-002',
      client: 'Client Alpha',
      description: 'Assembly — depends on PRINT-001',
      status: 'Planned',
      workshopExitDate: isoDate(0, 0, 21),
      color: '#22c55e',
      comments: [],
      requiredJobIds: ['job-a'],
      elementIds: ['elem-b1'],
      taskIds: ['task-b1-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
  ];

  const elements: Element[] = [
    {
      id: 'elem-a1',
      jobId: 'job-a',
      name: 'couv',
      label: 'Couverture',
      prerequisiteElementIds: [],
      taskIds: ['task-a1-1', 'task-a1-2'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved',
      plateStatus: 'ready',
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'elem-a2',
      jobId: 'job-a',
      name: 'int',
      label: 'Intérieur',
      prerequisiteElementIds: [],
      taskIds: ['task-a2-1'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved',
      plateStatus: 'ready',
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'elem-b1',
      jobId: 'job-b',
      name: 'fin',
      label: 'Finishing',
      prerequisiteElementIds: [],
      taskIds: ['task-b1-1'],
      paperStatus: 'in_stock',
      batStatus: 'bat_approved',
      plateStatus: 'ready',
      formeStatus: 'none',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    // Job A, Element A1: Printing → Cutting
    {
      id: 'task-a1-1',
      elementId: 'elem-a1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 15, runMinutes: 45 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    {
      id: 'task-a1-2',
      elementId: 'elem-a1',
      sequenceOrder: 1,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 10, runMinutes: 20 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Job A, Element A2: Printing (offset → dry time)
    {
      id: 'task-a2-1',
      elementId: 'elem-a2',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-heidelberg',
      duration: { setupMinutes: 30, runMinutes: 90 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
    // Job B, Element B1: Binding — UNSCHEDULED
    {
      id: 'task-b1-1',
      elementId: 'elem-b1',
      sequenceOrder: 0,
      status: 'Ready',
      type: 'Internal',
      stationId: 'station-polar',
      duration: { setupMinutes: 20, runMinutes: 40 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // A1-1: 08:00-09:00 on Komori (offset → 4h dry)
  // A1-2: 13:00-13:30 on Polar
  // A2-1: 08:00-10:00 on Heidelberg (offset → 4h dry → effective end 14:00)
  const assignments: TaskAssignment[] = [
    {
      id: 'assign-a1-1',
      taskId: 'task-a1-1',
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
      id: 'assign-a1-2',
      taskId: 'task-a1-2',
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
      id: 'assign-a2-1',
      taskId: 'task-a2-1',
      targetId: 'station-heidelberg',
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
