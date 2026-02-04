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
// Fixture: drag-snapping
// For v0.3.41 (Drag Snapping Consistency - REQ-01/02/03)
// Job with unscheduled task, tests snapping at lunch break boundary (12:00-13:00)
// Uses 7-day operating schedule so tests pass on weekends
// ============================================================================

export function createDragSnappingFixture(): ScheduleSnapshot {
  // Custom stations with 7-day operating schedule for weekend-proof testing
  const dragSnappingStations: Station[] = [
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
  ];

  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-snap-1',
      reference: 'SNAP-001',
      client: 'Snapping Test Client',
      description: 'Drag Snapping Test Job',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#8b5cf6', // Purple
      comments: [],
      taskIds: ['task-snap-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-snap-1',
      elementId: 'elem-job-snap-1',
      sequenceOrder: 0,
      status: 'Ready', // Unscheduled, ready to place
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // No assignments - task is unscheduled for drag testing
  // Station has lunch break 12:00-13:00 (not in standardDaySchedule slots)
  // Dragging to 12:45 should snap to 13:00 and show GREEN border
  // generateElementsForJobs mutates jobs to add elementIds
  const elements = generateElementsForJobs(jobs, tasks);
  return {
    ...baseSnapshot(),
    stations: dragSnappingStations,
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments: [],
    conflicts: [],
    lateJobs: [],
  };
}
