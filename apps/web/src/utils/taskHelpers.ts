/**
 * Task Helper Utilities
 *
 * Helper functions for working with the Task → Element → Job relationship.
 * Since Task only has elementId, these helpers provide convenient access to the job.
 */

import type { Task, Element } from '@flux/types';

/**
 * Get the jobId for a task by looking up its element.
 *
 * @param task - The task to get the jobId for
 * @param elements - Array of all elements
 * @returns The jobId or undefined if element not found
 */
export function getJobIdForTask(
  task: Task,
  elements: Element[]
): string | undefined {
  const element = elements.find((e) => e.id === task.elementId);
  return element?.jobId;
}

/**
 * Create a map from taskId to jobId for efficient lookups.
 *
 * @param tasks - Array of all tasks
 * @param elements - Array of all elements
 * @returns Map from taskId to jobId
 */
export function createTaskToJobMap(
  tasks: Task[],
  elements: Element[]
): Map<string, string> {
  const elementToJob = new Map<string, string>();
  elements.forEach((e) => elementToJob.set(e.id, e.jobId));

  const taskToJob = new Map<string, string>();
  tasks.forEach((t) => {
    const jobId = elementToJob.get(t.elementId);
    if (jobId) {
      taskToJob.set(t.id, jobId);
    }
  });

  return taskToJob;
}

/**
 * Get all tasks for a specific job.
 *
 * @param jobId - The job ID
 * @param tasks - Array of all tasks
 * @param elements - Array of all elements
 * @returns Array of tasks belonging to the job
 */
export function getTasksForJob(
  jobId: string,
  tasks: Task[],
  elements: Element[]
): Task[] {
  // Get all element IDs for this job
  const jobElementIds = new Set(
    elements.filter((e) => e.jobId === jobId).map((e) => e.id)
  );

  // Return tasks that belong to those elements
  return tasks.filter((t) => jobElementIds.has(t.elementId));
}

/**
 * Get all tasks for a specific element, sorted by sequenceOrder.
 */
export function getElementTasks(
  elementId: string,
  tasks: Task[]
): Task[] {
  return tasks
    .filter((t) => t.elementId === elementId)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

/**
 * Group tasks by their job ID.
 *
 * @param tasks - Array of all tasks
 * @param elements - Array of all elements
 * @returns Map from jobId to array of tasks
 */
export function groupTasksByJob(
  tasks: Task[],
  elements: Element[]
): Map<string, Task[]> {
  const elementToJob = new Map<string, string>();
  elements.forEach((e) => elementToJob.set(e.id, e.jobId));

  const result = new Map<string, Task[]>();
  tasks.forEach((t) => {
    const jobId = elementToJob.get(t.elementId);
    if (jobId) {
      const existing = result.get(jobId) || [];
      existing.push(t);
      result.set(jobId, existing);
    }
  });

  return result;
}
