/**
 * Quick Placement Mode Utilities
 * Functions for determining which task to place in backward scheduling workflow.
 */

import type { Task, Job, TaskAssignment, InternalTask, Element } from '@flux/types';
import { isInternalTask } from '@flux/types';
import { getTasksForJob } from './taskHelpers';

/**
 * Get the last (bottom-most in task list) unscheduled internal task for a job.
 * Iterates through all elements in display order, then tasks by sequenceOrder,
 * and returns the last unscheduled internal task across all elements.
 *
 * @param job - The job to get the task for
 * @param tasks - All tasks in the snapshot
 * @param elements - All elements in the snapshot
 * @param assignments - All current assignments
 * @returns The last unscheduled internal task, or null if none
 */
export function getLastUnscheduledTask(
  job: Job,
  tasks: Task[],
  elements: Element[],
  assignments: TaskAssignment[]
): InternalTask | null {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const assignedTaskIds = new Set(assignments.map((a) => a.taskId));

  // Iterate elements in display order (same as sidebar: elements array filtered by job)
  const jobElements = elements.filter((e) => job.elementIds.includes(e.id));

  let lastUnscheduled: InternalTask | null = null;

  for (const element of jobElements) {
    // Tasks within element in sequenceOrder
    const elementTasks = element.taskIds
      .map((id) => taskById.get(id))
      .filter((t): t is Task => t !== undefined)
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    for (const task of elementTasks) {
      if (isInternalTask(task) && !assignedTaskIds.has(task.id)) {
        lastUnscheduled = task;
      }
    }
  }

  return lastUnscheduled;
}

/**
 * Get the available task for quick placement on a specific station.
 *
 * In backward scheduling, only the LAST unscheduled task of the job can be placed.
 * This function returns that task ONLY if it belongs to the given station.
 *
 * @param job - The currently selected job
 * @param tasks - All tasks in the snapshot
 * @param elements - All elements in the snapshot
 * @param assignments - All current assignments
 * @param stationId - The station being hovered
 * @returns The task to place, or null if the last task is not on this station
 */
export function getAvailableTaskForStation(
  job: Job,
  tasks: Task[],
  elements: Element[],
  assignments: TaskAssignment[],
  stationId: string
): InternalTask | null {
  // Get the last (highest sequence) unscheduled task for this job
  const lastTask = getLastUnscheduledTask(job, tasks, elements, assignments);

  // Only return if this task belongs to the hovered station
  return lastTask?.stationId === stationId ? lastTask : null;
}

/**
 * Check if quick placement mode can be active.
 * Requires a job to be selected.
 *
 * @param selectedJobId - The currently selected job ID
 * @returns Whether quick placement mode can be activated
 */
export function canActivateQuickPlacement(selectedJobId: string | null): boolean {
  return selectedJobId !== null;
}

/**
 * Get all stations that have available tasks for placement.
 *
 * @param job - The currently selected job
 * @param tasks - All tasks in the snapshot
 * @param elements - All elements in the snapshot
 * @param assignments - All current assignments
 * @returns Array of station IDs with available tasks
 */
export function getStationsWithAvailableTasks(
  job: Job,
  tasks: Task[],
  elements: Element[],
  assignments: TaskAssignment[]
): string[] {
  // Get all tasks for this job
  const jobTasks = getTasksForJob(job.id, tasks, elements);

  // Get unique station IDs from internal tasks
  const stationIds = new Set<string>();
  jobTasks.forEach((t) => {
    if (isInternalTask(t)) {
      stationIds.add(t.stationId);
    }
  });

  // Filter to stations that have available tasks
  const availableStations: string[] = [];
  stationIds.forEach((stationId) => {
    const availableTask = getAvailableTaskForStation(job, tasks, elements, assignments, stationId);
    if (availableTask) {
      availableStations.push(stationId);
    }
  });

  return availableStations;
}
