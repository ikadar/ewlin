import { faker } from '@faker-js/faker';
import { addMinutes, addHours, startOfDay, addDays } from 'date-fns';
import type { Assignment, Task, Station, OutsourcedProvider, Job } from '../../types';

interface AssignmentGeneratorInput {
  jobs: Job[];
  stations: Station[];
  providers: OutsourcedProvider[];
  startDate: Date;
}

export function generateAssignments({
  jobs,
  stations,
  providers,
  startDate,
}: AssignmentGeneratorInput): Assignment[] {
  const assignments: Assignment[] = [];

  // Collect all tasks from jobs
  const allTasks: Array<{ task: Task; job: Job }> = [];
  for (const job of jobs) {
    for (const task of job.tasks) {
      allTasks.push({ task, job });
    }
  }

  // Filter assignable tasks (only those with Assigned status)
  const assignableTasks = allTasks.filter(
    ({ task }) => task.status === 'Assigned'
  );

  // Sort by sequence order within jobs
  const sortedTasks = [...assignableTasks].sort(
    (a, b) => a.task.sequenceOrder - b.task.sequenceOrder
  );

  // Track occupied time slots per station
  const stationSchedules: Map<string, Array<{ start: Date; end: Date }>> = new Map();

  for (const { task, job } of sortedTasks) {
    let stationId: string;
    let scheduledStart: Date;
    let scheduledEnd: Date;

    if (task.type === 'internal' && task.stationId) {
      // Internal task: assign to its station
      const station = stations.find(s => s.id === task.stationId);
      if (!station) continue;

      stationId = station.id;

      // Find next available slot for this station
      const existingSlots = stationSchedules.get(stationId) || [];

      // Generate a start time that doesn't overlap
      const dayOffset = faker.number.int({ min: 0, max: 10 });
      const hourOffset = faker.number.int({ min: 6, max: 16 });
      scheduledStart = addHours(
        startOfDay(addDays(startDate, dayOffset)),
        hourOffset
      );

      // Avoid conflicts by shifting if needed
      for (const slot of existingSlots) {
        if (scheduledStart >= slot.start && scheduledStart < slot.end) {
          scheduledStart = slot.end;
        }
      }

      scheduledEnd = addMinutes(scheduledStart, task.totalMinutes);

      // Record the slot
      existingSlots.push({ start: scheduledStart, end: scheduledEnd });
      stationSchedules.set(stationId, existingSlots);

    } else if (task.type === 'outsourced' && task.providerId) {
      // Outsourced task: assign to provider
      const provider = providers.find(p => p.id === task.providerId);
      if (!provider) continue;

      stationId = provider.id; // Use provider ID as station ID for scheduling

      // Outsourced tasks span multiple days
      const dayOffset = faker.number.int({ min: 0, max: 7 });
      scheduledStart = startOfDay(addDays(startDate, dayOffset));
      // Duration is in open days, convert to calendar days (rough approximation)
      const calendarDays = Math.ceil((task.durationOpenDays || 1) * 1.4); // Account for weekends
      scheduledEnd = addDays(scheduledStart, calendarDays);

    } else {
      continue;
    }

    assignments.push({
      id: faker.string.uuid(),
      taskId: task.id,
      jobId: job.id,
      stationId,
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      isCompleted: false,
      completedAt: null,
    });
  }

  return assignments;
}
