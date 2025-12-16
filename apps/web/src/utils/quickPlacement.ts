/**
 * Quick Placement Mode Utilities
 * Functions for determining which task to place in backward scheduling workflow.
 */

import type { Task, Job, TaskAssignment, InternalTask } from '@flux/types';
import { isInternalTask } from '@flux/types';

/**
 * Get the available task for quick placement on a specific station.
 *
 * For backward scheduling, the available task is:
 * 1. An unscheduled internal task for the given station
 * 2. The task with the highest sequence number where:
 *    - It has no successor in the job, OR
 *    - Its immediate successor is already scheduled
 *
 * @param job - The currently selected job
 * @param tasks - All tasks in the snapshot
 * @param assignments - All current assignments
 * @param stationId - The station being hovered
 * @returns The task to place, or null if none available
 */
export function getAvailableTaskForStation(
  job: Job,
  tasks: Task[],
  assignments: TaskAssignment[],
  stationId: string
): InternalTask | null {
  // Get all tasks for this job
  const jobTasks = tasks.filter((t) => t.jobId === job.id);

  // Filter to internal tasks on the target station that are unscheduled
  const stationTasks = jobTasks
    .filter((t): t is InternalTask => isInternalTask(t) && t.stationId === stationId)
    .filter((t) => !assignments.some((a) => a.taskId === t.id));

  if (stationTasks.length === 0) {
    return null;
  }

  // Sort by sequence descending (highest first for backward scheduling)
  stationTasks.sort((a, b) => b.sequence - a.sequence);

  // Find the first task where successor is placed or no successor exists
  for (const task of stationTasks) {
    // Find the immediate successor (next sequence number in the same job)
    const successorTask = jobTasks.find(
      (t) => t.jobId === job.id && t.sequence === task.sequence + 1
    );

    if (!successorTask) {
      // No successor - this task can be placed
      return task;
    }

    // Check if successor is already scheduled
    const successorIsScheduled = assignments.some((a) => a.taskId === successorTask.id);
    if (successorIsScheduled) {
      // Successor is placed - this task can be placed
      return task;
    }
  }

  // No task available (all remaining tasks have unplaced successors)
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
