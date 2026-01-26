import type {
  ScheduleSnapshot,
  Station,
  Job,
  Task,
  InternalTask,
  TaskAssignment,
  DaySchedule,
} from '@flux/types';
import {
  categories,
  groups,
  generateElementsForJobs,
  type JobWithoutElementIds,
} from './shared';

// ============================================================================
// Fixture: unavailability-overlay
// For v0.3.60 (Unavailability Overlay SVG)
// Stations with clear unavailability periods to verify stripe pattern rendering
// ============================================================================

export function createUnavailabilityOverlayFixture(): ScheduleSnapshot {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isoDate = (hour: number, minute: number = 0): string => {
    const d = new Date(today);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  // Station with standard lunch break (12-13)
  const lunchBreakSchedule: DaySchedule = {
    isOperating: true,
    slots: [
      { start: '06:00', end: '12:00' },
      { start: '13:00', end: '22:00' },
    ],
  };

  // Station with morning and afternoon shifts (gap 12-14)
  const splitShiftSchedule: DaySchedule = {
    isOperating: true,
    slots: [
      { start: '06:00', end: '12:00' },
      { start: '14:00', end: '20:00' },
    ],
  };

  // Station with short day (08-17)
  const shortDaySchedule: DaySchedule = {
    isOperating: true,
    slots: [
      { start: '08:00', end: '17:00' },
    ],
  };

  const closedDay: DaySchedule = {
    isOperating: false,
    slots: [],
  };

  const overlayStations: Station[] = [
    {
      id: 'station-overlay-lunch',
      name: 'Lunch Break Station',
      status: 'Available',
      categoryId: 'cat-offset',
      groupId: 'grp-offset',
      capacity: 1,
      operatingSchedule: {
        monday: lunchBreakSchedule,
        tuesday: lunchBreakSchedule,
        wednesday: lunchBreakSchedule,
        thursday: lunchBreakSchedule,
        friday: lunchBreakSchedule,
        saturday: closedDay,
        sunday: closedDay,
      },
      exceptions: [],
    },
    {
      id: 'station-overlay-split',
      name: 'Split Shift Station',
      status: 'Available',
      categoryId: 'cat-offset',
      groupId: 'grp-offset',
      capacity: 1,
      operatingSchedule: {
        monday: splitShiftSchedule,
        tuesday: splitShiftSchedule,
        wednesday: splitShiftSchedule,
        thursday: splitShiftSchedule,
        friday: splitShiftSchedule,
        saturday: closedDay,
        sunday: closedDay,
      },
      exceptions: [],
    },
    {
      id: 'station-overlay-short',
      name: 'Short Day Station',
      status: 'Available',
      categoryId: 'cat-cutting',
      groupId: 'grp-cutting',
      capacity: 1,
      operatingSchedule: {
        monday: shortDaySchedule,
        tuesday: shortDaySchedule,
        wednesday: shortDaySchedule,
        thursday: shortDaySchedule,
        friday: shortDaySchedule,
        saturday: closedDay,
        sunday: closedDay,
      },
      exceptions: [],
    },
  ];

  const localBatSentAt = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const localBatApprovedAt = new Date(today.getTime() - 12 * 60 * 60 * 1000).toISOString();

  const jobs: JobWithoutElementIds[] = [
    {
      id: 'job-overlay-1',
      reference: 'OVERLAY-001',
      client: 'Overlay Test Client',
      description: 'Test job for unavailability overlay',
      status: 'InProgress',
      color: '#8b5cf6', // Purple
      workshopExitDate: isoDate(17, 0),
      proofApproval: { sentAt: localBatSentAt, approvedAt: localBatApprovedAt },
      platesStatus: 'Done',
      paperPurchaseStatus: 'InStock',
      comments: [],
      taskIds: ['task-overlay-1'],
      fullyScheduled: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-overlay-1',
      elementId: 'elem-job-overlay-1',
      sequenceOrder: 0,
      status: 'Assigned',
      type: 'Internal',
      stationId: 'station-overlay-lunch',
      duration: { setupMinutes: 30, runMinutes: 90 }, // 2 hours
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as InternalTask,
  ];

  const assignments: TaskAssignment[] = [
    {
      id: 'assign-overlay-1',
      taskId: 'task-overlay-1',
      targetId: 'station-overlay-lunch',
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
    generatedAt: today.toISOString(),
    stations: overlayStations,
    categories,
    groups,
    providers: [],
    jobs: jobs as Job[],
    elements: generateElementsForJobs(jobs, tasks),
    tasks,
    assignments,
    conflicts: [],
    lateJobs: [],
  };
}
