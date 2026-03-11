import type {
  ScheduleSnapshot,
  Station,
  Job,
  Task,
  InternalTask,
} from '@flux/types';
import {
  today,
  isoDate,
  baseSnapshot,
  generateElementsForJobs,
  sevenDayOperatingSchedule,
  type JobWithoutElementIds,
} from './shared';

// ============================================================================
// Fixture: sidebar-drag
// For UC-01 (New Task Placement from Sidebar)
// Job with unscheduled task ready for placement
// Uses 7-day operating schedule so tests pass on weekends
// ============================================================================

export function createSidebarDragFixture(): ScheduleSnapshot {
  // Custom stations with 7-day operating schedule for weekend-proof testing
  const sidebarDragStations: Station[] = [
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
      id: 'station-polar',
      name: 'Polar 115',
      status: 'Available',
      categoryId: 'cat-finishing',
      groupId: 'grp-finishing',
      capacity: 1,
      operatingSchedule: sevenDayOperatingSchedule,
      exceptions: [],
    },
  ];

  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-sidebar-1',
      reference: 'SIDE-001',
      client: 'Sidebar Client',
      description: 'Sidebar Drag Test Job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6',
      comments: [],
      taskIds: ['task-sidebar-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      shipped: false,
      shippedAt: null,
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-sidebar-1',
      elementId: 'elem-job-sidebar-1',
      sequenceOrder: 0,
      status: 'Ready', // Unscheduled, ready to place
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 60 },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // generateElementsForJobs mutates jobs to add elementIds
  const elements = generateElementsForJobs(jobs, tasks);
  return {
    ...baseSnapshot(),
    stations: sidebarDragStations,
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments: [], // No assignments - task is unscheduled
    conflicts: [],
    lateJobs: [],
  };
}
