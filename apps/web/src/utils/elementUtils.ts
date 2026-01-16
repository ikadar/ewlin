/**
 * Element Utilities
 *
 * Helper functions for working with Elements in the context of
 * inter-element precedence constraints.
 *
 * v0.3.70: Element Precedence Logic
 */

import type { Element, Task, TaskAssignment } from '@flux/types';

/**
 * Check if a task is the first task of its element.
 *
 * First tasks of elements with prerequisites must wait for all
 * prerequisite elements to complete before they can start.
 *
 * @param task - Task to check
 * @param elements - All elements in the snapshot
 * @returns true if task is the first task of its element
 */
export function isFirstTaskOfElement(task: Task, elements: Element[]): boolean {
  if (!task.elementId) {
    return false; // Task has no element = not first of element
  }

  const element = elements.find((e) => e.id === task.elementId);
  if (!element) {
    return false; // Element not found
  }

  // Check if this task is the first in the element's taskIds array
  return element.taskIds.length > 0 && element.taskIds[0] === task.id;
}

/**
 * Get the element for a task.
 *
 * @param task - Task to find element for
 * @param elements - All elements
 * @returns Element or undefined
 */
export function getElementForTask(task: Task, elements: Element[]): Element | undefined {
  if (!task.elementId) {
    return undefined;
  }
  return elements.find((e) => e.id === task.elementId);
}

/**
 * Get all prerequisite elements for an element.
 *
 * @param element - Element to get prerequisites for
 * @param allElements - All elements in the snapshot
 * @returns Array of prerequisite elements
 */
export function getPrerequisiteElements(element: Element, allElements: Element[]): Element[] {
  if (element.prerequisiteElementIds.length === 0) {
    return [];
  }

  return element.prerequisiteElementIds
    .map((prereqId) => allElements.find((e) => e.id === prereqId))
    .filter((e): e is Element => e !== undefined);
}

/**
 * Get the last task assignment for an element.
 *
 * Used to find when an element "completes" - the end time of its last scheduled task.
 *
 * @param element - Element to find last task for
 * @param assignments - All task assignments
 * @returns Last task assignment or undefined if no tasks are scheduled
 */
export function getLastTaskAssignment(
  element: Element,
  assignments: TaskAssignment[]
): TaskAssignment | undefined {
  if (element.taskIds.length === 0) {
    return undefined;
  }

  // Get the last task ID in the element
  const lastTaskId = element.taskIds[element.taskIds.length - 1];

  // Find assignment for this task
  return assignments.find((a) => a.taskId === lastTaskId);
}

/**
 * Calculate the inter-element precedence bound for a task.
 *
 * For the first task of an element with prerequisites, the bound is
 * the MAX of the end times of all prerequisite elements' last tasks.
 *
 * @param task - Task to calculate bound for
 * @param elements - All elements
 * @param assignments - All task assignments
 * @returns Earliest start time based on inter-element precedence, or null if no constraint
 */
export function getInterElementBound(
  task: Task,
  elements: Element[],
  assignments: TaskAssignment[]
): Date | null {
  // Must be first task of an element
  if (!isFirstTaskOfElement(task, elements)) {
    return null;
  }

  // Get the element for this task
  const element = getElementForTask(task, elements);
  if (!element) {
    return null;
  }

  // Get prerequisite elements
  const prerequisites = getPrerequisiteElements(element, elements);
  if (prerequisites.length === 0) {
    return null; // No prerequisites = no inter-element constraint
  }

  // Find the end times of all prerequisite elements' last tasks
  const endTimes: number[] = [];

  for (const prereq of prerequisites) {
    const lastAssignment = getLastTaskAssignment(prereq, assignments);
    if (lastAssignment) {
      endTimes.push(new Date(lastAssignment.scheduledEnd).getTime());
    }
    // If prerequisite has no scheduled tasks, we can't enforce the constraint
    // (the constraint will apply once the prerequisite is scheduled)
  }

  if (endTimes.length === 0) {
    return null; // No scheduled prerequisites = no constraint yet
  }

  // Return MAX of all end times
  const maxEndTime = Math.max(...endTimes);
  return new Date(maxEndTime);
}
