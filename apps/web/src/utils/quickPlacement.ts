/**
 * Quick Placement Mode Utilities
 * Functions for determining which task to place in backward scheduling workflow.
 */

import type { Task, Job, TaskAssignment, InternalTask } from '@flux/types';
import { isInternalTask } from '@flux/types';

/**
 * Get the last (highest sequenceOrder) unscheduled internal task for a job.
 * This is the task that should be placed next in backward scheduling.
 *
 * @param job - The job to get the task for
 * @param tasks - All tasks in the snapshot
 * @param assignments - All current assignments
 * @returns The last unscheduled internal task, or null if none
 */
export function getLastUnscheduledTask(
  job: Job,
  tasks: Task[],
  assignments: TaskAssignment[]
): InternalTask | null {
  // Get all internal tasks for this job that are unscheduled
  const unscheduledTasks = tasks
    .filter((t) => t.jobId === job.id)
    .filter((t): t is InternalTask => isInternalTask(t))
    .filter((t) => !assignments.some((a) => a.taskId === t.id));

  if (unscheduledTasks.length === 0) {
    return null;
  }

  // Sort by sequenceOrder descending and return the highest
  unscheduledTasks.sort((a, b) => b.sequenceOrder - a.sequenceOrder);
  return unscheduledTasks[0];
}

/**
 * Get the available task for quick placement on a specific station.
 *
 * In backward scheduling, only the LAST unscheduled task of the job can be placed.
 * This function returns that task ONLY if it belongs to the given station.
 *
 * @param job - The currently selected job
 * @param tasks - All tasks in the snapshot
 * @param assignments - All current assignments
 * @param stationId - The station being hovered
 * @returns The task to place, or null if the last task is not on this station
 */
export function getAvailableTaskForStation(
  job: Job,
  tasks: Task[],
  assignments: TaskAssignment[],
  stationId: string
): InternalTask | null {
  // Get the last (highest sequence) unscheduled task for this job
  const lastTask = getLastUnscheduledTask(job, tasks, assignments);

  // Only return if this task belongs to the hovered station
  if (lastTask && lastTask.stationId === stationId) {
    return lastTask;
  }

  return null;
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
 * @param assignments - All current assignments
 * @returns Array of station IDs with available tasks
 */
export function getStationsWithAvailableTasks(
  job: Job,
  tasks: Task[],
  assignments: TaskAssignment[]
): string[] {
  // Get all tasks for this job
  const jobTasks = tasks.filter((t) => t.jobId === job.id);

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
    const availableTask = getAvailableTaskForStation(job, tasks, assignments, stationId);
    if (availableTask) {
      availableStations.push(stationId);
    }
  });

  return availableStations;
}
