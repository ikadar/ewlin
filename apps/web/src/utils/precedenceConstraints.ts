/**
 * Precedence Constraint Utilities
 *
 * Calculate Y positions for precedence constraint visualization lines.
 * REQ-10: Precedence Constraint Visualization
 * v0.3.53: Precedence Lines + Working Hours (REQ-03)
 *
 * Element-scoped: predecessor/successor are within the same element.
 * Cross-element: prerequisiteElementIds define finish-to-start dependencies.
 */

import type { ScheduleSnapshot, Task, TaskAssignment, Station, Element } from '@flux/types';
import { parseTimestamp } from '@flux/schedule-validator';
import { timeToYPosition } from '../components/TimelineColumn/utils';
import { subtractWorkingTime, snapToNextWorkingTime } from './workingTime';
import { getElementTasks } from './taskHelpers';

// Dry time in milliseconds (4 hours) - same as in @flux/schedule-validator
const DRY_TIME_MS = 4 * 60 * 60 * 1000;

// ============================================================================
// Element / Lookup helpers
// ============================================================================

function findElement(snapshot: ScheduleSnapshot, elementId: string): Element | undefined {
  return snapshot.elements.find((e) => e.id === elementId);
}

function findAssignmentByTaskId(
  snapshot: ScheduleSnapshot,
  taskId: string
): TaskAssignment | undefined {
  return snapshot.assignments.find((a) => a.taskId === taskId);
}

function findStationById(snapshot: ScheduleSnapshot, stationId: string): Station | undefined {
  return snapshot.stations.find((s) => s.id === stationId);
}

/**
 * Check if a station is a printing (offset) station that requires dry time.
 */
function isPrintingStation(snapshot: ScheduleSnapshot, stationId: string): boolean {
  const station = snapshot.stations.find((s) => s.id === stationId);
  if (!station) return false;

  const category = snapshot.categories.find((c) => c.id === station.categoryId);
  if (!category) return false;

  return category.name.toLowerCase().includes('offset');
}

// ============================================================================
// Intra-element predecessor / successor (scoped to same element)
// ============================================================================

/**
 * Get the predecessor task within the SAME ELEMENT.
 */
function getPredecessorTask(snapshot: ScheduleSnapshot, task: Task): Task | undefined {
  const elementTasks = getElementTasks(task.elementId, snapshot.tasks);
  const taskIndex = elementTasks.findIndex((t) => t.id === task.id);
  if (taskIndex > 0) {
    return elementTasks[taskIndex - 1];
  }
  return undefined;
}

/**
 * Get the successor task within the SAME ELEMENT.
 */
function getSuccessorTask(snapshot: ScheduleSnapshot, task: Task): Task | undefined {
  const elementTasks = getElementTasks(task.elementId, snapshot.tasks);
  const taskIndex = elementTasks.findIndex((t) => t.id === task.id);
  if (taskIndex >= 0 && taskIndex < elementTasks.length - 1) {
    return elementTasks[taskIndex + 1];
  }
  return undefined;
}

// ============================================================================
// Cross-element predecessor / successor
// ============================================================================

/**
 * If task is the first in its element and the element has prerequisites,
 * return the last task of each prerequisite element.
 */
function getCrossElementPredecessors(snapshot: ScheduleSnapshot, task: Task): Task[] {
  const element = findElement(snapshot, task.elementId);
  if (!element) return [];

  const elementTasks = getElementTasks(element.id, snapshot.tasks);
  if (elementTasks.length === 0 || elementTasks[0].id !== task.id) {
    return []; // Not the first task in element
  }

  if (!element.prerequisiteElementIds || element.prerequisiteElementIds.length === 0) {
    return [];
  }

  const predecessors: Task[] = [];
  for (const prereqElementId of element.prerequisiteElementIds) {
    const prereqTasks = getElementTasks(prereqElementId, snapshot.tasks);
    if (prereqTasks.length > 0) {
      predecessors.push(prereqTasks[prereqTasks.length - 1]);
    }
  }
  return predecessors;
}

/**
 * If task is the last in its element, return the first task of each
 * element that depends on this element.
 */
function getCrossElementSuccessors(snapshot: ScheduleSnapshot, task: Task): Task[] {
  const element = findElement(snapshot, task.elementId);
  if (!element) return [];

  const elementTasks = getElementTasks(element.id, snapshot.tasks);
  if (elementTasks.length === 0 || elementTasks[elementTasks.length - 1].id !== task.id) {
    return []; // Not the last task in element
  }

  const dependentElements = snapshot.elements.filter((e) =>
    e.prerequisiteElementIds?.includes(element.id)
  );

  const successors: Task[] = [];
  for (const depElement of dependentElements) {
    const depTasks = getElementTasks(depElement.id, snapshot.tasks);
    if (depTasks.length > 0) {
      successors.push(depTasks[0]);
    }
  }
  return successors;
}

// ============================================================================
// Shared: earliest start from a single predecessor
// ============================================================================

/**
 * Calculate the earliest start Date from a single predecessor assignment.
 * Handles dry time for printing stations + working hours snapping.
 */
function getEarliestStartFromPredecessor(
  predecessorAssignment: TaskAssignment,
  snapshot: ScheduleSnapshot
): Date {
  const predecessorEnd = parseTimestamp(predecessorAssignment.scheduledEnd);

  if (!predecessorAssignment.isOutsourced && isPrintingStation(snapshot, predecessorAssignment.targetId)) {
    const dryingEnd = new Date(predecessorEnd.getTime() + DRY_TIME_MS);
    const station = findStationById(snapshot, predecessorAssignment.targetId);
    return station ? snapToNextWorkingTime(dryingEnd, station) : dryingEnd;
  }

  const station = predecessorAssignment.isOutsourced
    ? undefined
    : findStationById(snapshot, predecessorAssignment.targetId);
  return station ? snapToNextWorkingTime(predecessorEnd, station) : predecessorEnd;
}

// ============================================================================
// Public API: constraint Y positions
// ============================================================================

/**
 * Calculate Y position for the predecessor constraint line (purple).
 *
 * Checks both intra-element predecessor and cross-element predecessors,
 * returning the most constraining (latest / highest Y).
 */
export function getPredecessorConstraint(
  task: Task,
  snapshot: ScheduleSnapshot,
  startHour: number,
  pixelsPerHour: number,
  gridStartDate?: Date
): number | null {
  let latestEarliestStart: Date | null = null;

  // 1. Intra-element predecessor
  const predecessor = getPredecessorTask(snapshot, task);
  if (predecessor) {
    const predAssignment = findAssignmentByTaskId(snapshot, predecessor.id);
    if (predAssignment) {
      latestEarliestStart = getEarliestStartFromPredecessor(predAssignment, snapshot);
    }
  }

  // 2. Cross-element predecessors
  const crossPreds = getCrossElementPredecessors(snapshot, task);
  for (const crossPred of crossPreds) {
    const crossAssignment = findAssignmentByTaskId(snapshot, crossPred.id);
    if (crossAssignment) {
      const earliest = getEarliestStartFromPredecessor(crossAssignment, snapshot);
      if (!latestEarliestStart || earliest > latestEarliestStart) {
        latestEarliestStart = earliest;
      }
    }
  }

  if (!latestEarliestStart) return null;

  return timeToYPosition(latestEarliestStart, startHour, pixelsPerHour, gridStartDate);
}

/** Information about drying time for visualization */
export interface DryingTimeInfo {
  /** Station ID where the predecessor is scheduled (where to show the indicator) */
  predecessorStationId: string;
  /** Y position of predecessor task end */
  predecessorEndY: number;
  /** Y position where drying time ends */
  dryingEndY: number;
}

/**
 * Calculate Y position for the successor constraint line (orange).
 *
 * Checks both intra-element successor and cross-element successors,
 * returning the most constraining (earliest / lowest Y).
 */
export function getSuccessorConstraint(
  task: Task,
  snapshot: ScheduleSnapshot,
  startHour: number,
  pixelsPerHour: number,
  gridStartDate?: Date
): number | null {
  let earliestLatestStart: Date | null = null;

  // Helper to calculate latest start from a successor
  const calcLatestStart = (currentTask: Task, successorAssignment: TaskAssignment): Date => {
    const successorStart = parseTimestamp(successorAssignment.scheduledStart);

    const taskDurationMinutes = currentTask.type === 'Internal'
      ? currentTask.duration.setupMinutes + currentTask.duration.runMinutes
      : 0;
    const taskDurationMs = taskDurationMinutes * 60 * 1000;

    let dryTimeMs = 0;
    if (currentTask.type === 'Internal' && isPrintingStation(snapshot, currentTask.stationId)) {
      dryTimeMs = DRY_TIME_MS;
    }

    const latestEnd = dryTimeMs > 0
      ? new Date(successorStart.getTime() - dryTimeMs)
      : successorStart;

    const station = currentTask.type === 'Internal' ? findStationById(snapshot, currentTask.stationId) : undefined;
    return station
      ? subtractWorkingTime(latestEnd, taskDurationMs, station)
      : new Date(latestEnd.getTime() - taskDurationMs);
  };

  // 1. Intra-element successor
  const successor = getSuccessorTask(snapshot, task);
  if (successor) {
    const succAssignment = findAssignmentByTaskId(snapshot, successor.id);
    if (succAssignment) {
      earliestLatestStart = calcLatestStart(task, succAssignment);
    }
  }

  // 2. Cross-element successors
  const crossSuccs = getCrossElementSuccessors(snapshot, task);
  for (const crossSucc of crossSuccs) {
    const crossAssignment = findAssignmentByTaskId(snapshot, crossSucc.id);
    if (crossAssignment) {
      const ls = calcLatestStart(task, crossAssignment);
      if (!earliestLatestStart || ls < earliestLatestStart) {
        earliestLatestStart = ls;
      }
    }
  }

  if (!earliestLatestStart) return null;

  return timeToYPosition(earliestLatestStart, startHour, pixelsPerHour, gridStartDate);
}

/**
 * Get drying time visualization info for a task.
 *
 * Checks both intra-element and cross-element predecessors.
 * Returns info for the most constraining printing predecessor.
 */
export function getDryingTimeInfo(
  task: Task,
  snapshot: ScheduleSnapshot,
  startHour: number,
  pixelsPerHour: number,
  gridStartDate?: Date
): DryingTimeInfo | null {
  // Collect all predecessor assignments that are printing stations
  const printingPredecessors: TaskAssignment[] = [];

  // Intra-element predecessor
  const predecessor = getPredecessorTask(snapshot, task);
  if (predecessor) {
    const predAssignment = findAssignmentByTaskId(snapshot, predecessor.id);
    if (predAssignment && !predAssignment.isOutsourced && isPrintingStation(snapshot, predAssignment.targetId)) {
      printingPredecessors.push(predAssignment);
    }
  }

  // Cross-element predecessors
  const crossPreds = getCrossElementPredecessors(snapshot, task);
  for (const crossPred of crossPreds) {
    const crossAssignment = findAssignmentByTaskId(snapshot, crossPred.id);
    if (crossAssignment && !crossAssignment.isOutsourced && isPrintingStation(snapshot, crossAssignment.targetId)) {
      printingPredecessors.push(crossAssignment);
    }
  }

  if (printingPredecessors.length === 0) return null;

  // Pick the most constraining (latest end)
  let mostConstraining = printingPredecessors[0];
  for (let i = 1; i < printingPredecessors.length; i++) {
    const currentEnd = parseTimestamp(printingPredecessors[i].scheduledEnd);
    const bestEnd = parseTimestamp(mostConstraining.scheduledEnd);
    if (currentEnd > bestEnd) {
      mostConstraining = printingPredecessors[i];
    }
  }

  const predecessorEnd = parseTimestamp(mostConstraining.scheduledEnd);
  const dryingEnd = new Date(predecessorEnd.getTime() + DRY_TIME_MS);

  return {
    predecessorStationId: mostConstraining.targetId,
    predecessorEndY: timeToYPosition(predecessorEnd, startHour, pixelsPerHour, gridStartDate),
    dryingEndY: timeToYPosition(dryingEnd, startHour, pixelsPerHour, gridStartDate),
  };
}
