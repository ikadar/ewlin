/**
 * Assignment Generators
 * Generate mock task assignments and schedule conflicts for testing.
 */

import type {
  Task,
  TaskAssignment,
  ScheduleConflict,
  ConflictType,
  Job,
  Station,
} from '@flux/types';
import { isInternalTask, isOutsourcedTask } from '@flux/types';

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function setTime(date: Date, hours: number, minutes: number): Date {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function getNextWorkday(date: Date): Date {
  const result = new Date(date);
  // Skip to next day
  result.setDate(result.getDate() + 1);
  // Skip weekends
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

// ============================================================================
// Assignment Generator
// ============================================================================

interface AssignmentGeneratorOptions {
  tasks: Task[];
  jobs: Job[];
  stations: Station[];
  baseDate?: Date;
}

interface AssignmentResult {
  assignments: TaskAssignment[];
  stationNextAvailable: Map<string, Date>;
}

export function generateAssignments(options: AssignmentGeneratorOptions): AssignmentResult {
  const { tasks, jobs: _jobs, stations, baseDate = new Date() } = options;
  const assignments: TaskAssignment[] = [];

  // Track next available time per station
  const stationNextAvailable = new Map<string, Date>();

  // Initialize station availability (start at 6:00 today)
  const startTime = setTime(baseDate, 6, 0);
  for (const station of stations) {
    stationNextAvailable.set(station.id, new Date(startTime));
  }

  // Group tasks by job
  const tasksByJob = new Map<string, Task[]>();
  for (const task of tasks) {
    const jobTasks = tasksByJob.get(task.jobId) || [];
    jobTasks.push(task);
    tasksByJob.set(task.jobId, jobTasks);
  }

  // Sort tasks within each job by sequence order
  for (const jobTasks of tasksByJob.values()) {
    jobTasks.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }

  // Process each job's tasks
  for (const [_jobId, jobTasks] of tasksByJob.entries()) {
    let previousTaskEnd: Date | null = null;

    for (const task of jobTasks) {
      // Only create assignment for tasks with status 'Assigned'
      if (task.status !== 'Assigned') continue;

      if (isInternalTask(task)) {
        const stationId = task.stationId;
        const stationAvailable = stationNextAvailable.get(stationId) || startTime;

        // Start time is the later of: station availability or previous task end
        let scheduledStart = new Date(stationAvailable);
        if (previousTaskEnd && previousTaskEnd > scheduledStart) {
          scheduledStart = new Date(previousTaskEnd);
        }

        // Snap to 30-minute grid
        const minutes = scheduledStart.getMinutes();
        if (minutes % 30 !== 0) {
          scheduledStart.setMinutes(Math.ceil(minutes / 30) * 30);
        }

        // Calculate end time
        const totalMinutes = task.duration.setupMinutes + task.duration.runMinutes;
        const scheduledEnd = addMinutes(scheduledStart, totalMinutes);

        // Only mark tasks as completed if they're in the past
        const now = new Date();
        const isInPast = scheduledEnd < now;
        // 80% of past tasks are completed, future tasks are never completed
        const isCompleted = isInPast && Math.random() > 0.2;

        const assignment: TaskAssignment = {
          id: `assign-${task.id}`,
          taskId: task.id,
          targetId: stationId,
          isOutsourced: false,
          scheduledStart: formatTimestamp(scheduledStart),
          scheduledEnd: formatTimestamp(scheduledEnd),
          isCompleted,
          completedAt: isCompleted ? formatTimestamp(scheduledEnd) : null,
          createdAt: formatTimestamp(baseDate),
          updatedAt: formatTimestamp(baseDate),
        };

        assignments.push(assignment);
        stationNextAvailable.set(stationId, scheduledEnd);
        previousTaskEnd = scheduledEnd;

      } else if (isOutsourcedTask(task)) {
        const providerId = task.providerId;

        // Start time is after previous task
        let scheduledStart: Date = previousTaskEnd ? new Date(previousTaskEnd) : new Date(startTime);

        // Move to next workday if needed and set to departure time
        const departureHour = parseInt(task.duration.latestDepartureTime.split(':')[0]);
        if (scheduledStart.getHours() >= departureHour) {
          scheduledStart = getNextWorkday(scheduledStart);
        }
        scheduledStart = setTime(scheduledStart, departureHour - 1, 0); // Send 1 hour before cutoff

        // Calculate end time based on open days
        let scheduledEnd: Date = new Date(scheduledStart);
        for (let i = 0; i < task.duration.openDays; i++) {
          scheduledEnd = getNextWorkday(scheduledEnd);
        }
        const receptionHour = parseInt(task.duration.receptionTime.split(':')[0]);
        scheduledEnd = setTime(scheduledEnd, receptionHour, 0);

        const assignment: TaskAssignment = {
          id: `assign-${task.id}`,
          taskId: task.id,
          targetId: providerId,
          isOutsourced: true,
          scheduledStart: formatTimestamp(scheduledStart),
          scheduledEnd: formatTimestamp(scheduledEnd),
          isCompleted: false,
          completedAt: null,
          createdAt: formatTimestamp(baseDate),
          updatedAt: formatTimestamp(baseDate),
        };

        assignments.push(assignment);
        previousTaskEnd = scheduledEnd;
      }
    }
  }

  return { assignments, stationNextAvailable };
}

// ============================================================================
// Conflict Generator
// ============================================================================

interface ConflictGeneratorOptions {
  jobs: Job[];
  tasks: Task[];
  assignments: TaskAssignment[];
}

export function generateConflicts(options: ConflictGeneratorOptions): ScheduleConflict[] {
  const { jobs, tasks, assignments } = options;
  const conflicts: ScheduleConflict[] = [];

  // Find jobs marked for conflict testing
  const conflictJobs = jobs.filter((job) => job.notes === 'CONFLICT_TEST');

  for (const job of conflictJobs) {
    const jobTasks = tasks.filter((t) => t.jobId === job.id);

    if (jobTasks.length > 1) {
      // Create a precedence conflict for the first task
      const firstTask = jobTasks[0];
      const secondTask = jobTasks[1];

      conflicts.push({
        type: 'PrecedenceConflict' as ConflictType,
        message: `La tâche ${secondTask.id} est planifiée avant la fin de ${firstTask.id}`,
        taskId: secondTask.id,
        relatedTaskId: firstTask.id,
        details: {
          jobId: job.id,
          jobReference: job.reference,
        },
      });
    }
  }

  // Also detect deadline conflicts for late jobs
  for (const job of jobs) {
    if (job.status === 'Delayed') {
      const jobTasks = tasks.filter((t) => t.jobId === job.id);
      const lastTask = jobTasks[jobTasks.length - 1];
      const lastAssignment = assignments.find((a) => a.taskId === lastTask?.id);

      if (lastTask && lastAssignment) {
        conflicts.push({
          type: 'DeadlineConflict' as ConflictType,
          message: `Le travail ${job.reference} dépasse la date de départ (${job.workshopExitDate})`,
          taskId: lastTask.id,
          details: {
            jobId: job.id,
            jobReference: job.reference,
            deadline: job.workshopExitDate,
            expectedCompletion: lastAssignment.scheduledEnd,
          },
        });
      }
    }
  }

  return conflicts;
}

// ============================================================================
// Stretched Assignment Generator (for downtime-aware height testing)
// ============================================================================

/**
 * Creates an assignment that spans overnight (stretched across non-operating period).
 * This simulates a 2-hour task starting at 17:00 that continues at 07:00 next day.
 * Used for testing downtime-aware tile height calculation.
 */
export function createStretchedAssignment(
  task: Task,
  baseDate: Date = new Date()
): TaskAssignment | null {
  if (!isInternalTask(task)) return null;

  // Start at 17:00 today (simulating 1 hour before station closes at 18:00)
  const scheduledStart = setTime(baseDate, 17, 0);

  // End at 09:00 next day (1 hour work before close + 1 hour after next day open)
  // This creates a 16-hour span for a 2-hour task
  const scheduledEnd = setTime(new Date(baseDate), 9, 0);
  scheduledEnd.setDate(scheduledEnd.getDate() + 1);

  return {
    id: `assign-stretched-${task.id}`,
    taskId: task.id,
    targetId: task.stationId,
    isOutsourced: false,
    scheduledStart: formatTimestamp(scheduledStart),
    scheduledEnd: formatTimestamp(scheduledEnd),
    isCompleted: false,
    completedAt: null,
    createdAt: formatTimestamp(baseDate),
    updatedAt: formatTimestamp(baseDate),
  };
}

// ============================================================================
// Combined Generator
// ============================================================================

export interface AssignmentData {
  assignments: TaskAssignment[];
  conflicts: ScheduleConflict[];
}

export function generateAllAssignmentData(
  tasks: Task[],
  jobs: Job[],
  stations: Station[]
): AssignmentData {
  const { assignments } = generateAssignments({ tasks, jobs, stations });
  const conflicts = generateConflicts({ jobs, tasks, assignments });

  return { assignments, conflicts };
}
