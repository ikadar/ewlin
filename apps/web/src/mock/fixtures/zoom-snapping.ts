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
  batSentAt,
  batApprovedAt,
  baseSnapshot,
  generateElementsForJobs,
  sevenDayOperatingSchedule,
  type JobWithoutElementIds,
} from './shared';

// ============================================================================
// Fixture: zoom-snapping
// For v0.3.48 (Zoom-Aware Tile Snapping Bugfix)
// Simple job with one unscheduled task for testing snapping at different zoom levels
// Uses 7-day operating schedule so tests pass on weekends
// ============================================================================

export function createZoomSnappingFixture(): ScheduleSnapshot {
  // Custom stations with 7-day operating schedule for weekend-proof testing
  const zoomSnappingStations: Station[] = [
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
      id: 'job-zoom-1',
      reference: 'ZOOM-001',
      client: 'Zoom Test Client',
      description: 'Job for testing tile snapping at different zoom levels',
      status: 'InProgress',
      workshopExitDate: isoDate(0, 0, 7),
      color: '#3b82f6', // Blue
      paperPurchaseStatus: 'InStock',
      platesStatus: 'Done',
      proofApproval: { sentAt: batSentAt, approvedAt: batApprovedAt },
      requiredJobIds: [],
      comments: [],
      taskIds: ['task-z1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-z1',
      elementId: 'elem-job-zoom-1',
      sequenceOrder: 0,
      status: 'Ready', // Unscheduled, ready to place
      type: 'Internal',
      stationId: 'station-komori',
      duration: { setupMinutes: 30, runMinutes: 30 }, // 1h total
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  // generateElementsForJobs mutates jobs to add elementIds
  const elements = generateElementsForJobs(jobs, tasks);
  // No assignments - task is unscheduled for drag testing at different zoom levels
  return {
    ...baseSnapshot(),
    stations: zoomSnappingStations,
    jobs: jobs as Job[],
    elements,
    tasks,
    assignments: [],
    conflicts: [],
    lateJobs: [],
  };
}
