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
  Element,
  InternalTask,
  OutsourcedTask,
} from '@flux/types';
import { isInternalTask, isOutsourcedTask } from '@flux/types';
import { calculateEndTime } from '../../utils/timeCalculations';
import { SNAP_INTERVAL_MINUTES } from '../../components/DragPreview';
import { groupTasksByJob, getTasksForJob, compareTaskOrder } from '../../utils/taskHelpers';

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

function _addMinutes(date: Date, minutes: number): Date {
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
  elements: Element[];
  stations: Station[];
  baseDate?: Date;
}

interface AssignmentResult {
  assignments: TaskAssignment[];
  stationNextAvailable: Map<string, Date>;
}

interface InternalTaskContext {
  task: InternalTask;
  stations: Station[];
  stationNextAvailable: Map<string, Date>;
  previousTaskEnd: Date | null;
  startTime: Date;
  baseDate: Date;
}

interface OutsourcedTaskContext {
  task: OutsourcedTask;
  previousTaskEnd: Date | null;
  startTime: Date;
  baseDate: Date;
}

/**
 * Create assignment for an internal task.
 * Extracted to reduce cognitive complexity.
 */
function createInternalAssignment(ctx: InternalTaskContext): { assignment: TaskAssignment; scheduledEnd: Date } {
  const { task, stations, stationNextAvailable, previousTaskEnd, startTime, baseDate } = ctx;
  const stationId = task.stationId;
  const station = stations.find((s) => s.id === stationId);
  const stationAvailable = stationNextAvailable.get(stationId) || startTime;

  // Start time is the later of: station availability or previous task end
  let scheduledStart = new Date(stationAvailable);
  if (previousTaskEnd && previousTaskEnd > scheduledStart) {
    scheduledStart = new Date(previousTaskEnd);
  }

  // Snap to grid interval (SNAP_INTERVAL_MINUTES)
  const minutes = scheduledStart.getMinutes();
  if (minutes % SNAP_INTERVAL_MINUTES !== 0) {
    scheduledStart.setMinutes(Math.ceil(minutes / SNAP_INTERVAL_MINUTES) * SNAP_INTERVAL_MINUTES);
  }

  // Calculate end time with operating hours stretching (BR-ASSIGN-003b)
  const scheduledEndStr = calculateEndTime(task, scheduledStart.toISOString(), station);
  const scheduledEnd = new Date(scheduledEndStr);

  // Only mark tasks as completed if they're in the past
  const now = new Date();
  const isInPast = scheduledEnd < now;
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

  return { assignment, scheduledEnd };
}

/**
 * Create assignment for an outsourced task.
 * Extracted to reduce cognitive complexity.
 */
function createOutsourcedAssignment(ctx: OutsourcedTaskContext): { assignment: TaskAssignment; scheduledEnd: Date } {
  const { task, previousTaskEnd, startTime, baseDate } = ctx;
  const providerId = task.providerId;

  // Start time is after previous task
  let scheduledStart: Date = previousTaskEnd ? new Date(previousTaskEnd) : new Date(startTime);

  // Move to next workday if needed and set to departure time
  const departureHour = parseInt(task.duration.latestDepartureTime.split(':')[0]);
  if (scheduledStart.getHours() >= departureHour) {
    scheduledStart = getNextWorkday(scheduledStart);
  }
  scheduledStart = setTime(scheduledStart, departureHour - 1, 0);

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

  return { assignment, scheduledEnd };
}

export function generateAssignments(options: AssignmentGeneratorOptions): AssignmentResult {
  const { tasks, elements, stations, baseDate = new Date() } = options;
  const assignments: TaskAssignment[] = [];
  const stationNextAvailable = new Map<string, Date>();

  // Initialize station availability (start at 6:00 today)
  const startTime = setTime(baseDate, 6, 0);
  for (const station of stations) {
    stationNextAvailable.set(station.id, new Date(startTime));
  }

  // Group and sort tasks by job
  const tasksByJobMap = groupTasksByJob(tasks, elements);
  for (const jobTasks of tasksByJobMap.values()) {
    jobTasks.sort(compareTaskOrder);
  }

  // Process each job's tasks
  for (const [, jobTasks] of tasksByJobMap.entries()) {
    let previousTaskEnd: Date | null = null;

    for (const task of jobTasks) {
      if (task.status !== 'Assigned') continue;

      if (isInternalTask(task)) {
        const { assignment, scheduledEnd } = createInternalAssignment({
          task, stations, stationNextAvailable, previousTaskEnd, startTime, baseDate,
        });
        assignments.push(assignment);
        stationNextAvailable.set(task.stationId, scheduledEnd);
        previousTaskEnd = scheduledEnd;
      } else if (isOutsourcedTask(task)) {
        const { assignment, scheduledEnd } = createOutsourcedAssignment({
          task, previousTaskEnd, startTime, baseDate,
        });
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
  elements: Element[];
  assignments: TaskAssignment[];
}

export function generateConflicts(options: ConflictGeneratorOptions): ScheduleConflict[] {
  const { jobs, tasks, elements, assignments } = options;
  const conflicts: ScheduleConflict[] = [];

  // Find jobs marked for conflict testing
  const conflictJobs = jobs.filter((job) => job.notes === 'CONFLICT_TEST');

  for (const job of conflictJobs) {
    const jobTasks = getTasksForJob(job.id, tasks, elements);

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
      const jobTasks = getTasksForJob(job.id, tasks, elements);
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
  elements: Element[],
  stations: Station[]
): AssignmentData {
  const { assignments } = generateAssignments({ tasks, jobs, elements, stations });
  const conflicts = generateConflicts({ jobs, tasks, elements, assignments });

  return { assignments, conflicts };
}
