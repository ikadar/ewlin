/**
 * Precedence Constraint Utilities
 *
 * Calculate Y positions for precedence constraint visualization lines.
 * REQ-10: Precedence Constraint Visualization
 * v0.3.53: Precedence Lines + Working Hours (REQ-03)
 * v0.5.12: Outsourcing Precedence Calculation
 *
 * Element-scoped: predecessor/successor are within the same element.
 * Cross-element: prerequisiteElementIds define finish-to-start dependencies.
 */

import type { ScheduleSnapshot, Task, TaskAssignment, Station, Element, OutsourcedTask, OutsourcedProvider, InternalTask } from '@flux/types';
import { isOutsourcedTask, DRY_TIME_MS } from '@flux/types';
import { parseTimestamp } from '@flux/schedule-validator';
import { timeToYPosition } from '../components/TimelineColumn/utils';
import { subtractWorkingTime, snapToNextWorkingTime } from './workingTime';
import { getElementTasks } from './taskHelpers';
import { calculateDepartureDate, calculateReturnDate } from './outsourcingCalculation';

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

function findTaskById(snapshot: ScheduleSnapshot, taskId: string): Task | undefined {
  return snapshot.tasks.find((t) => t.id === taskId);
}

/**
 * Check if a station is a printing (offset) station that requires dry time.
 */
export function isPrintingStation(snapshot: ScheduleSnapshot, stationId: string): boolean {
  const station = snapshot.stations.find((s) => s.id === stationId);
  if (!station) return false;

  const category = snapshot.categories.find((c) => c.id === station.categoryId);
  if (!category) return false;

  return category.name.toLowerCase().includes('offset');
}

// ============================================================================
// Outsourced task date helpers (v0.5.12)
// ============================================================================

/**
 * Get the effective return time for an outsourced task.
 * Uses manualReturn if set, otherwise calculates from predecessor end time.
 *
 * @param task - The outsourced task
 * @param predecessorEndTime - When the predecessor task ends (needed for calculation)
 * @param provider - The outsourced provider (for transit days and reception time)
 * @returns Return date/time, or null if cannot be determined
 */
export function getOutsourcedTaskReturnTime(
  task: OutsourcedTask,
  predecessorEndTime: Date | string | undefined,
  provider: OutsourcedProvider | undefined
): Date | null {
  // Priority 1: Manual return override
  if (task.manualReturn) {
    return new Date(task.manualReturn);
  }

  // Priority 2: Calculate from predecessor end time
  if (!predecessorEndTime || !provider) {
    return null;
  }

  // Calculate departure first
  const departure = task.manualDeparture
    ? new Date(task.manualDeparture)
    : calculateDepartureDate(predecessorEndTime, task.duration.latestDepartureTime);

  // Calculate return from departure
  return calculateReturnDate(departure, {
    workDays: task.duration.openDays,
    transitDays: provider.transitDays,
    receptionTime: task.duration.receptionTime,
  });
}

/**
 * Get the effective departure time for an outsourced task.
 * Uses manualDeparture if set, otherwise calculates from predecessor end time.
 *
 * @param task - The outsourced task
 * @param predecessorEndTime - When the predecessor task ends (needed for calculation)
 * @returns Departure date/time, or null if cannot be determined
 */
export function getOutsourcedTaskDepartureTime(
  task: OutsourcedTask,
  predecessorEndTime: Date | string | undefined
): Date | null {
  // Priority 1: Manual departure override
  if (task.manualDeparture) {
    return new Date(task.manualDeparture);
  }

  // Priority 2: Calculate from predecessor end time
  if (!predecessorEndTime) {
    return null;
  }

  return calculateDepartureDate(predecessorEndTime, task.duration.latestDepartureTime);
}

/**
 * Calculate the latest end time for a predecessor when the successor is outsourced.
 * The predecessor must end before the outsourced successor's departure time.
 *
 * @param successorTask - The outsourced successor task
 * @param predecessorTask - The predecessor task (internal or outsourced)
 * @param snapshot - Full schedule snapshot
 * @returns Latest end time for predecessor, or null if cannot be determined
 */
export function getLatestEndBeforeOutsourcedSuccessor(
  successorTask: OutsourcedTask,
  predecessorTask: Task,
  snapshot: ScheduleSnapshot
): Date | null {
  // Get successor's departure time
  // For backward calculation, we need to find what would be the departure time
  // based on the successor's assignment (if any) or its predecessor's end time

  const successorAssignment = findAssignmentByTaskId(snapshot, successorTask.id);

  // If successor has manual departure, use that as the constraint
  if (successorTask.manualDeparture) {
    const departureTime = new Date(successorTask.manualDeparture);
    return calculateLatestPredecessorEnd(departureTime, predecessorTask, snapshot);
  }

  // If successor is assigned, we can calculate its departure from its scheduled start
  // But for outsourced tasks, the assignment's scheduledStart IS the departure
  if (successorAssignment) {
    const departureTime = parseTimestamp(successorAssignment.scheduledStart);
    return calculateLatestPredecessorEnd(departureTime, predecessorTask, snapshot);
  }

  return null;
}

/**
 * Calculate the latest end time for a predecessor given a successor's departure time.
 */
function calculateLatestPredecessorEnd(
  successorDepartureTime: Date,
  predecessorTask: Task,
  snapshot: ScheduleSnapshot
): Date {
  if (predecessorTask.type === 'Internal') {
    const taskDurationMinutes = predecessorTask.duration.setupMinutes + predecessorTask.duration.runMinutes;
    const taskDurationMs = taskDurationMinutes * 60 * 1000;

    // Check if predecessor is a printing station (needs dry time)
    let dryTimeMs = 0;
    if (isPrintingStation(snapshot, predecessorTask.stationId)) {
      dryTimeMs = DRY_TIME_MS;
    }

    // Latest end = departure time - dry time
    const latestEnd = dryTimeMs > 0
      ? new Date(successorDepartureTime.getTime() - dryTimeMs)
      : successorDepartureTime;

    // Subtract task duration using working time
    const station = findStationById(snapshot, predecessorTask.stationId);
    return station
      ? subtractWorkingTime(latestEnd, taskDurationMs, station)
      : new Date(latestEnd.getTime() - taskDurationMs);
  } else {
    // Predecessor is also outsourced - for now, just return the departure time
    // (outsourced predecessor's return must be before successor's departure)
    return successorDepartureTime;
  }
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
 * Check if two tasks belong to the same split group.
 */
function areSameSplitGroup(taskA: Task | undefined, taskB: Task | undefined): boolean {
  if (!taskA || !taskB) return false;
  if (taskA.type !== 'Internal' || taskB.type !== 'Internal') return false;
  const groupA = (taskA as InternalTask).splitGroupId;
  return !!groupA && groupA === (taskB as InternalTask).splitGroupId;
}

/**
 * Calculate the earliest start Date from a single predecessor assignment.
 * Handles dry time for printing stations + working hours snapping.
 * v0.5.12: Handles outsourced predecessors with manual return override.
 *
 * @param successorTask Optional successor task — when provided, dry time is
 *   skipped if predecessor and successor belong to the same split group.
 */
function getEarliestStartFromPredecessor(
  predecessorAssignment: TaskAssignment,
  snapshot: ScheduleSnapshot,
  successorTask?: Task
): Date {
  // v0.5.12: Handle outsourced predecessor with potential manual return
  if (predecessorAssignment.isOutsourced) {
    const predecessorTask = findTaskById(snapshot, predecessorAssignment.taskId);

    // Check for manual return override
    if (predecessorTask && isOutsourcedTask(predecessorTask) && predecessorTask.manualReturn) {
      return new Date(predecessorTask.manualReturn);
    }

    // Use the scheduled end (which should be the calculated return time)
    return parseTimestamp(predecessorAssignment.scheduledEnd);
  }

  // Internal predecessor
  const predecessorEnd = parseTimestamp(predecessorAssignment.scheduledEnd);

  if (isPrintingStation(snapshot, predecessorAssignment.targetId)) {
    // Skip dry time between parts of the same split group
    const predecessorTask = findTaskById(snapshot, predecessorAssignment.taskId);
    if (!areSameSplitGroup(predecessorTask, successorTask)) {
      return new Date(predecessorEnd.getTime() + DRY_TIME_MS);
    }
  }

  return predecessorEnd;
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
      latestEarliestStart = getEarliestStartFromPredecessor(predAssignment, snapshot, task);
    }
  }

  // 2. Cross-element predecessors (never same split group — different elements)
  const crossPreds = getCrossElementPredecessors(snapshot, task);
  for (const crossPred of crossPreds) {
    const crossAssignment = findAssignmentByTaskId(snapshot, crossPred.id);
    if (crossAssignment) {
      const earliest = getEarliestStartFromPredecessor(crossAssignment, snapshot, task);
      if (!latestEarliestStart || earliest > latestEarliestStart) {
        latestEarliestStart = earliest;
      }
    }
  }

  if (!latestEarliestStart) return null;

  // Snap to the successor (picked) task's station working hours
  if (task.type === 'Internal') {
    const successorStation = findStationById(snapshot, task.stationId);
    if (successorStation) {
      latestEarliestStart = snapToNextWorkingTime(latestEarliestStart, successorStation);
    }
  }

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

/** Information about outsourcing time for visualization (v0.5.13) */
export interface OutsourcingTimeInfo {
  /** Y position of outsourced task departure */
  departureY: number;
  /** Y position where outsourced task returns */
  returnY: number;
}

/**
 * Calculate Y position for the successor constraint line (orange).
 *
 * Checks both intra-element successor and cross-element successors,
 * returning the most constraining (earliest / lowest Y).
 * v0.5.12: Handles outsourced successors with manual departure override.
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
  // v0.5.12: Updated to handle outsourced successors
  const calcLatestStart = (currentTask: Task, successorTask: Task, successorAssignment: TaskAssignment): Date => {
    // v0.5.12: Handle outsourced successor
    if (successorAssignment.isOutsourced && isOutsourcedTask(successorTask)) {
      // For outsourced successor, the constraint is the departure time
      // Check for manual departure override
      const departureTime = successorTask.manualDeparture
        ? new Date(successorTask.manualDeparture)
        : parseTimestamp(successorAssignment.scheduledStart);

      // Calculate latest end for predecessor before this departure
      return calculateLatestPredecessorEnd(departureTime, currentTask, snapshot);
    }

    // Internal successor - existing logic
    const successorStart = parseTimestamp(successorAssignment.scheduledStart);

    const taskDurationMinutes = currentTask.type === 'Internal'
      ? currentTask.duration.setupMinutes + currentTask.duration.runMinutes
      : 0;
    const taskDurationMs = taskDurationMinutes * 60 * 1000;

    let dryTimeMs = 0;
    if (currentTask.type === 'Internal' && isPrintingStation(snapshot, currentTask.stationId)
        && !areSameSplitGroup(currentTask, successorTask)) {
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
      earliestLatestStart = calcLatestStart(task, successor, succAssignment);
    }
  }

  // 2. Cross-element successors
  const crossSuccs = getCrossElementSuccessors(snapshot, task);
  for (const crossSucc of crossSuccs) {
    const crossAssignment = findAssignmentByTaskId(snapshot, crossSucc.id);
    if (crossAssignment) {
      const ls = calcLatestStart(task, crossSucc, crossAssignment);
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

  // Intra-element predecessor (skip if same split group — no drying between split parts)
  const predecessor = getPredecessorTask(snapshot, task);
  if (predecessor && !areSameSplitGroup(predecessor, task)) {
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

/**
 * Get outsourcing time visualization info for a task (v0.5.13).
 *
 * Checks both intra-element and cross-element predecessors.
 * Returns info for the most constraining outsourced predecessor.
 */
export function getOutsourcingTimeInfo(
  task: Task,
  snapshot: ScheduleSnapshot,
  startHour: number,
  pixelsPerHour: number,
  gridStartDate?: Date
): OutsourcingTimeInfo | null {
  // Collect all outsourced predecessor assignments
  const outsourcedPredecessors: { assignment: TaskAssignment; task: OutsourcedTask }[] = [];

  // Intra-element predecessor
  const predecessor = getPredecessorTask(snapshot, task);
  if (predecessor && isOutsourcedTask(predecessor)) {
    const predAssignment = findAssignmentByTaskId(snapshot, predecessor.id);
    if (predAssignment && predAssignment.isOutsourced) {
      outsourcedPredecessors.push({ assignment: predAssignment, task: predecessor });
    }
  }

  // Cross-element predecessors
  const crossPreds = getCrossElementPredecessors(snapshot, task);
  for (const crossPred of crossPreds) {
    if (isOutsourcedTask(crossPred)) {
      const crossAssignment = findAssignmentByTaskId(snapshot, crossPred.id);
      if (crossAssignment && crossAssignment.isOutsourced) {
        outsourcedPredecessors.push({ assignment: crossAssignment, task: crossPred });
      }
    }
  }

  if (outsourcedPredecessors.length === 0) return null;

  // Pick the most constraining (latest return time)
  let mostConstraining = outsourcedPredecessors[0];
  for (let i = 1; i < outsourcedPredecessors.length; i++) {
    const currentReturn = parseTimestamp(outsourcedPredecessors[i].assignment.scheduledEnd);
    const bestReturn = parseTimestamp(mostConstraining.assignment.scheduledEnd);
    if (currentReturn > bestReturn) {
      mostConstraining = outsourcedPredecessors[i];
    }
  }

  // Get departure time (scheduledStart is departure for outsourced)
  const departureTime = parseTimestamp(mostConstraining.assignment.scheduledStart);

  // Get return time - use manual override if set, otherwise scheduledEnd
  const returnTime = mostConstraining.task.manualReturn
    ? new Date(mostConstraining.task.manualReturn)
    : parseTimestamp(mostConstraining.assignment.scheduledEnd);

  return {
    departureY: timeToYPosition(departureTime, startHour, pixelsPerHour, gridStartDate),
    returnY: timeToYPosition(returnTime, startHour, pixelsPerHour, gridStartDate),
  };
}
