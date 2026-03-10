/**
 * Auto-Place: ALAP Backward Scheduling Algorithm
 *
 * Places unscheduled tasks as late as possible (Just-In-Time) without causing
 * deadline violations or resource conflicts. This is the backward analog of
 * compactTimeline.ts (which pushes tasks ASAP).
 *
 * Algorithm: Resource-Constrained ALAP Scheduling (Serial SGS)
 * Phase 1: Build task dependency graph
 * Phase 2: Forward pass — Earliest Start/Finish Times (EST/EFT)
 * Phase 3: Backward pass — Latest Start/Finish Times (LST/LFT)
 * Phase 4: Resource-constrained backward placement
 */

import type {
  ScheduleSnapshot,
  TaskAssignment,
  Task,
  Station,
  InternalTask,
  OutsourcedTask,
  Element,
} from '@flux/types';
import { DRY_TIME_MS, getDeadlineDate, isOutsourcedTask, isInternalTask } from '@flux/types';
import { isPrintingStation, getOutsourcedTaskReturnTime, getOutsourcedTaskDepartureTime } from './precedenceConstraints';
import { getElementTasks, createTaskToJobMap } from './taskHelpers';
import { addWorkingTime, subtractWorkingTime, snapToNextWorkingTime, snapToPreviousWorkingTime } from './workingTime';
import { calculateGroupUsageAtTime } from './groupCapacity';

// ============================================================================
// Public API
// ============================================================================

export interface AutoPlaceOptions {
  snapshot: ScheduleSnapshot;
  jobIds: string[];
  now?: Date;
  calculateEndTime: (task: InternalTask, start: string, station: Station | undefined) => string;
}

export interface AutoPlaceResult {
  snapshot: ScheduleSnapshot;
  placedCount: number;
  skippedCount: number;
  warnings: AutoPlaceWarning[];
}

export interface AutoPlaceWarning {
  taskId: string;
  jobId: string;
  type: 'infeasible' | 'placed_with_delay' | 'group_capacity_violation';
  message: string;
}

// ============================================================================
// Internal types
// ============================================================================

interface TaskNode {
  task: Task;
  jobId: string;
  elementId: string;
  stationId: string | null; // null for outsourced
  predecessors: string[]; // task IDs
  successors: string[];   // task IDs
  isOutsourced: boolean;
  isAssigned: boolean; // already has an assignment
  assignedStart?: Date;
  assignedEnd?: Date;
}

interface ForwardResult {
  est: Date;
  eft: Date;
}

interface BackwardResult {
  lst: Date;
  lft: Date;
  slack: number; // ms, negative = infeasible
}

interface FreeWindow {
  from: Date;
  to: Date;
}

// ============================================================================
// Phase 1: Build Task Dependency Graph
// ============================================================================

function buildTaskGraph(
  snapshot: ScheduleSnapshot,
  jobIds: string[]
): Map<string, TaskNode> {
  const graph = new Map<string, TaskNode>();
  const taskToJobMap = createTaskToJobMap(snapshot.tasks, snapshot.elements);
  const jobIdSet = new Set(jobIds);

  // Collect tasks belonging to target jobs
  const jobElements = snapshot.elements.filter((e) => jobIdSet.has(e.jobId));
  const elementIdSet = new Set(jobElements.map((e) => e.id));
  const relevantTasks = snapshot.tasks.filter((t) => elementIdSet.has(t.elementId));

  // Build assignment lookup
  const assignmentByTaskId = new Map<string, TaskAssignment>();
  for (const a of snapshot.assignments) {
    assignmentByTaskId.set(a.taskId, a);
  }

  // Create nodes
  for (const task of relevantTasks) {
    const jobId = taskToJobMap.get(task.id);
    if (!jobId) continue;

    const assignment = assignmentByTaskId.get(task.id);
    const node: TaskNode = {
      task,
      jobId,
      elementId: task.elementId,
      stationId: isInternalTask(task) ? task.stationId : null,
      predecessors: [],
      successors: [],
      isOutsourced: isOutsourcedTask(task),
      isAssigned: !!assignment,
      assignedStart: assignment ? new Date(assignment.scheduledStart) : undefined,
      assignedEnd: assignment ? new Date(assignment.scheduledEnd) : undefined,
    };
    graph.set(task.id, node);
  }

  // Build edges: intra-element (sequenceOrder)
  for (const element of jobElements) {
    const tasks = getElementTasks(element.id, snapshot.tasks);
    for (let i = 1; i < tasks.length; i++) {
      const pred = tasks[i - 1];
      const succ = tasks[i];
      const predNode = graph.get(pred.id);
      const succNode = graph.get(succ.id);
      if (predNode && succNode) {
        predNode.successors.push(succ.id);
        succNode.predecessors.push(pred.id);
      }
    }
  }

  // Build edges: cross-element (prerequisiteElementIds)
  for (const element of jobElements) {
    if (!element.prerequisiteElementIds || element.prerequisiteElementIds.length === 0) continue;

    const firstTasks = getElementTasks(element.id, snapshot.tasks);
    if (firstTasks.length === 0) continue;
    const firstTask = firstTasks[0];
    const firstNode = graph.get(firstTask.id);
    if (!firstNode) continue;

    for (const prereqElemId of element.prerequisiteElementIds) {
      const prereqTasks = getElementTasks(prereqElemId, snapshot.tasks);
      if (prereqTasks.length === 0) continue;
      const lastTask = prereqTasks[prereqTasks.length - 1];
      const lastNode = graph.get(lastTask.id);
      if (!lastNode) continue;

      lastNode.successors.push(firstTask.id);
      firstNode.predecessors.push(lastTask.id);
    }
  }

  return graph;
}

// ============================================================================
// Topological Sort (Kahn's algorithm)
// ============================================================================

function topologicalSort(graph: Map<string, TaskNode>): string[] {
  const inDegree = new Map<string, number>();
  for (const [id, node] of graph) {
    inDegree.set(id, node.predecessors.filter((p) => graph.has(p)).length);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    const node = graph.get(id)!;
    for (const succId of node.successors) {
      if (!graph.has(succId)) continue;
      const newDeg = (inDegree.get(succId) ?? 0) - 1;
      inDegree.set(succId, newDeg);
      if (newDeg === 0) queue.push(succId);
    }
  }

  return sorted;
}

// ============================================================================
// Phase 2: Forward Pass (EST/EFT)
// ============================================================================

function getStationForTask(task: Task, snapshot: ScheduleSnapshot): Station | undefined {
  if (!isInternalTask(task)) return undefined;
  return snapshot.stations.find((s) => s.id === task.stationId);
}

function getTaskDurationMs(task: Task): number {
  if (isInternalTask(task)) {
    return (task.duration.setupMinutes + task.duration.runMinutes) * 60 * 1000;
  }
  return 0; // outsourced tasks aren't placed — duration doesn't apply here
}

/**
 * Get the effective end time after a task, including drying time if printing station.
 */
function getEffectiveEndTime(endTime: Date, task: Task, snapshot: ScheduleSnapshot): Date {
  if (isInternalTask(task) && isPrintingStation(snapshot, task.stationId)) {
    return new Date(endTime.getTime() + DRY_TIME_MS);
  }
  return endTime;
}

/**
 * Get the return time of an outsourced predecessor task.
 */
function getOutsourcedReturnTime(
  task: OutsourcedTask,
  predecessorEndTime: Date | undefined,
  snapshot: ScheduleSnapshot
): Date | null {
  const provider = snapshot.providers.find((p) => p.id === task.providerId);
  return getOutsourcedTaskReturnTime(task, predecessorEndTime, provider);
}

/**
 * Get the departure time of an outsourced successor task.
 */
function getOutsourcedDepartureTimeForSuccessor(
  task: OutsourcedTask,
  predecessorEndTime: Date | undefined
): Date | null {
  return getOutsourcedTaskDepartureTime(task, predecessorEndTime);
}

function computeForwardPass(
  graph: Map<string, TaskNode>,
  topoOrder: string[],
  snapshot: ScheduleSnapshot,
  now: Date
): Map<string, ForwardResult> {
  const results = new Map<string, ForwardResult>();

  for (const taskId of topoOrder) {
    const node = graph.get(taskId)!;

    // Already-assigned tasks: use fixed times
    if (node.isAssigned && node.assignedStart && node.assignedEnd) {
      results.set(taskId, { est: node.assignedStart, eft: node.assignedEnd });
      continue;
    }

    // Outsourced tasks: compute based on predecessor end
    if (node.isOutsourced && isOutsourcedTask(node.task)) {
      let predecessorEnd: Date | undefined;
      for (const predId of node.predecessors) {
        const predResult = results.get(predId);
        if (predResult) {
          const predNode = graph.get(predId)!;
          const effectiveEnd = getEffectiveEndTime(predResult.eft, predNode.task, snapshot);
          if (!predecessorEnd || effectiveEnd > predecessorEnd) {
            predecessorEnd = effectiveEnd;
          }
        }
      }

      const returnTime = getOutsourcedReturnTime(node.task, predecessorEnd, snapshot);
      const departureTime = getOutsourcedDepartureTimeForSuccessor(node.task, predecessorEnd);

      if (departureTime && returnTime) {
        results.set(taskId, { est: departureTime, eft: returnTime });
      } else {
        // Can't compute — use now as fallback
        results.set(taskId, { est: now, eft: now });
      }
      continue;
    }

    // Internal tasks
    let est = new Date(now);

    for (const predId of node.predecessors) {
      const predResult = results.get(predId);
      if (!predResult) continue;

      const predNode = graph.get(predId)!;
      const effectiveEnd = getEffectiveEndTime(predResult.eft, predNode.task, snapshot);

      if (effectiveEnd > est) {
        est = effectiveEnd;
      }
    }

    // Snap to working hours
    const station = getStationForTask(node.task, snapshot);
    if (station) {
      est = snapToNextWorkingTime(est, station);
    }

    // Calculate EFT
    const durationMs = getTaskDurationMs(node.task);
    const eft = station
      ? addWorkingTime(est, durationMs, station)
      : new Date(est.getTime() + durationMs);

    results.set(taskId, { est, eft });
  }

  return results;
}

// ============================================================================
// Phase 3: Backward Pass (LST/LFT)
// ============================================================================

function computeBackwardPass(
  graph: Map<string, TaskNode>,
  topoOrder: string[],
  snapshot: ScheduleSnapshot,
  forwardResults: Map<string, ForwardResult>
): Map<string, BackwardResult> {
  const results = new Map<string, BackwardResult>();
  const jobMap = new Map<string, import('@flux/types').Job>();
  for (const job of snapshot.jobs) {
    jobMap.set(job.id, job);
  }

  // Process in reverse topological order
  const reverseOrder = [...topoOrder].reverse();

  for (const taskId of reverseOrder) {
    const node = graph.get(taskId)!;
    const job = jobMap.get(node.jobId);

    // Already-assigned tasks: use fixed times
    if (node.isAssigned && node.assignedStart && node.assignedEnd) {
      const fr = forwardResults.get(taskId)!;
      results.set(taskId, {
        lst: node.assignedStart,
        lft: node.assignedEnd,
        slack: node.assignedStart.getTime() - fr.est.getTime(),
      });
      continue;
    }

    // Outsourced tasks: mirror forward pass times (they're time barriers)
    if (node.isOutsourced) {
      const fr = forwardResults.get(taskId)!;
      results.set(taskId, { lst: fr.est, lft: fr.eft, slack: 0 });
      continue;
    }

    // Determine LFT from successors or job deadline
    let lft: Date;

    const successorsInGraph = node.successors.filter((s) => graph.has(s));

    if (successorsInGraph.length === 0) {
      // Terminal task — use job deadline
      lft = job ? getDeadlineDate(job.workshopExitDate) : new Date('2099-12-31T23:59:59Z');
    } else {
      lft = new Date('2099-12-31T23:59:59Z');

      for (const succId of successorsInGraph) {
        const succResult = results.get(succId);
        if (!succResult) continue;

        const succNode = graph.get(succId)!;

        let constraint: Date;

        if (succNode.isOutsourced && isOutsourcedTask(succNode.task)) {
          // Outsourced successor: constrain by departure time
          const fr = forwardResults.get(succId)!;
          constraint = fr.est; // departure time
        } else if (succNode.isAssigned && succNode.assignedStart) {
          constraint = new Date(succNode.assignedStart);
        } else {
          constraint = succResult.lst;
        }

        // Subtract drying time if current task is on a printing station
        if (isInternalTask(node.task) && isPrintingStation(snapshot, node.task.stationId)) {
          constraint = new Date(constraint.getTime() - DRY_TIME_MS);
        }

        if (constraint < lft) {
          lft = constraint;
        }
      }
    }

    // Also constrain by fixed successors outside the graph
    // (already-assigned successors are in the graph with fixed times, handled above)

    // Snap LFT to working hours (backward)
    const station = getStationForTask(node.task, snapshot);
    if (station) {
      lft = snapToPreviousWorkingTime(lft, station);
    }

    // Calculate LST
    const durationMs = getTaskDurationMs(node.task);
    const lst = station
      ? subtractWorkingTime(lft, durationMs, station)
      : new Date(lft.getTime() - durationMs);

    // Calculate slack
    const fr = forwardResults.get(taskId)!;
    const slack = lst.getTime() - fr.est.getTime();

    results.set(taskId, { lst, lft, slack });
  }

  return results;
}

// ============================================================================
// Phase 4: Resource-Constrained Backward Placement
// ============================================================================

/**
 * Snap a date DOWN to the nearest 15-minute boundary.
 * ALAP-friendly: starts slightly earlier, guaranteed to fit.
 */
function snapToQuarterHourDown(date: Date): Date {
  const snapped = new Date(date);
  const minutes = snapped.getMinutes();
  const remainder = minutes % 15;
  if (remainder > 0) {
    snapped.setMinutes(minutes - remainder, 0, 0);
  } else {
    snapped.setSeconds(0, 0);
  }
  return snapped;
}

/**
 * Find the latest free slot on a station where a task of given duration fits,
 * ending no later than maxEnd.
 */
function findLatestFreeSlot(
  station: Station,
  maxEnd: Date,
  durationMs: number,
  assignments: TaskAssignment[]
): { start: Date; end: Date } | null {
  // Get station assignments sorted by start time ascending
  const stationAssignments = assignments
    .filter((a) => a.targetId === station.id && !a.isOutsourced)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  // Build free windows between assignments
  const windows: FreeWindow[] = [];
  let prevEnd = new Date(0); // epoch

  for (const assignment of stationAssignments) {
    const aStart = new Date(assignment.scheduledStart);
    if (aStart.getTime() > prevEnd.getTime()) {
      windows.push({ from: prevEnd, to: aStart });
    }
    const aEnd = new Date(assignment.scheduledEnd);
    if (aEnd > prevEnd) {
      prevEnd = aEnd;
    }
  }
  // Final window to infinity
  windows.push({ from: prevEnd, to: new Date('2099-12-31T23:59:59Z') });

  // Iterate windows from latest to earliest
  for (let i = windows.length - 1; i >= 0; i--) {
    const window = windows[i];
    const effectiveTo = window.to < maxEnd ? window.to : maxEnd;

    if (effectiveTo.getTime() <= window.from.getTime()) continue;

    const candidateStart = subtractWorkingTime(effectiveTo, durationMs, station);

    if (candidateStart.getTime() >= window.from.getTime()) {
      const candidateEnd = addWorkingTime(candidateStart, durationMs, station);
      return { start: candidateStart, end: candidateEnd };
    }
  }

  return null;
}

/**
 * Find the earliest free slot on a station (ASAP fallback).
 */
function findEarliestFreeSlot(
  station: Station,
  minStart: Date,
  durationMs: number,
  assignments: TaskAssignment[]
): { start: Date; end: Date } | null {
  const stationAssignments = assignments
    .filter((a) => a.targetId === station.id && !a.isOutsourced)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  // Build free windows
  const windows: FreeWindow[] = [];
  let prevEnd = new Date(0);

  for (const assignment of stationAssignments) {
    const aStart = new Date(assignment.scheduledStart);
    if (aStart.getTime() > prevEnd.getTime()) {
      windows.push({ from: prevEnd, to: aStart });
    }
    const aEnd = new Date(assignment.scheduledEnd);
    if (aEnd > prevEnd) {
      prevEnd = aEnd;
    }
  }
  windows.push({ from: prevEnd, to: new Date('2099-12-31T23:59:59Z') });

  // Iterate windows from earliest to latest
  for (const window of windows) {
    const effectiveFrom = window.from > minStart ? window.from : minStart;

    if (effectiveFrom.getTime() >= window.to.getTime()) continue;

    const snappedStart = snapToNextWorkingTime(effectiveFrom, station);
    if (snappedStart.getTime() >= window.to.getTime()) continue;

    const candidateEnd = addWorkingTime(snappedStart, durationMs, station);
    if (candidateEnd.getTime() <= window.to.getTime()) {
      return { start: snappedStart, end: candidateEnd };
    }
  }

  return null;
}

/**
 * Compute the remaining chain duration (total working time of all descendants).
 */
function computeRemainingChainDuration(
  taskId: string,
  graph: Map<string, TaskNode>,
  cache: Map<string, number>
): number {
  if (cache.has(taskId)) return cache.get(taskId)!;

  const node = graph.get(taskId);
  if (!node) { cache.set(taskId, 0); return 0; }

  let maxDescendantDuration = 0;
  for (const succId of node.successors) {
    if (!graph.has(succId)) continue;
    const succDuration = computeRemainingChainDuration(succId, graph, cache);
    if (succDuration > maxDescendantDuration) {
      maxDescendantDuration = succDuration;
    }
  }

  const own = getTaskDurationMs(node.task);
  const total = own + maxDescendantDuration;
  cache.set(taskId, total);
  return total;
}

export function autoPlace(options: AutoPlaceOptions): AutoPlaceResult {
  const { snapshot, jobIds, calculateEndTime: calculateEndTimeFn } = options;
  const now = options.now ?? new Date();
  const warnings: AutoPlaceWarning[] = [];

  // Phase 1: Build dependency graph
  const graph = buildTaskGraph(snapshot, jobIds);

  if (graph.size === 0) {
    return { snapshot, placedCount: 0, skippedCount: 0, warnings };
  }

  // Topological sort
  const topoOrder = topologicalSort(graph);

  // Phase 2: Forward pass
  const forwardResults = computeForwardPass(graph, topoOrder, snapshot, now);

  // Phase 3: Backward pass
  const backwardResults = computeBackwardPass(graph, topoOrder, snapshot, forwardResults);

  // Phase 4: Resource-constrained backward placement
  const jobMap = new Map(snapshot.jobs.map((j) => [j.id, j]));
  const stationMap = new Map(snapshot.stations.map((s) => [s.id, s]));
  const chainDurationCache = new Map<string, number>();

  // Collect placeable tasks (unassigned internal tasks)
  const placeableTasks = topoOrder.filter((id) => {
    const node = graph.get(id)!;
    return !node.isAssigned && !node.isOutsourced;
  });

  // Sort by composite priority
  placeableTasks.sort((aId, bId) => {
    const aBack = backwardResults.get(aId)!;
    const bBack = backwardResults.get(bId)!;
    const aNode = graph.get(aId)!;
    const bNode = graph.get(bId)!;

    // 1. Minimum slack first
    if (aBack.slack !== bBack.slack) return aBack.slack - bBack.slack;

    // 2. Earliest job deadline
    const aJob = jobMap.get(aNode.jobId);
    const bJob = jobMap.get(bNode.jobId);
    const aDeadline = aJob ? getDeadlineDate(aJob.workshopExitDate).getTime() : Infinity;
    const bDeadline = bJob ? getDeadlineDate(bJob.workshopExitDate).getTime() : Infinity;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    // 3. Longest remaining chain duration
    const aChain = computeRemainingChainDuration(aId, graph, chainDurationCache);
    const bChain = computeRemainingChainDuration(bId, graph, chainDurationCache);
    return bChain - aChain; // descending — longer chains first
  });

  // Track all assignments (existing + new)
  const allAssignments = [...snapshot.assignments];
  const newAssignments: TaskAssignment[] = [];
  const placedStartTimes = new Map<string, Date>(); // taskId → actual start
  let placedCount = 0;
  let skippedCount = 0;

  for (const taskId of placeableTasks) {
    const node = graph.get(taskId)!;
    const br = backwardResults.get(taskId)!;
    const station = stationMap.get(node.stationId!);

    if (!station) {
      skippedCount++;
      continue;
    }

    const durationMs = getTaskDurationMs(node.task);

    // Compute effective LFT considering already-placed successors
    let effectiveLft = new Date(br.lft);

    for (const succId of node.successors) {
      const succPlacedStart = placedStartTimes.get(succId);
      const succNode = graph.get(succId);

      let succStart: Date | undefined;
      if (succPlacedStart) {
        succStart = succPlacedStart;
      } else if (succNode?.isAssigned && succNode.assignedStart) {
        succStart = succNode.assignedStart;
      }

      if (succStart) {
        let constraint = new Date(succStart);
        if (isPrintingStation(snapshot, node.stationId!)) {
          constraint = new Date(constraint.getTime() - DRY_TIME_MS);
        }
        if (constraint < effectiveLft) {
          effectiveLft = constraint;
        }
      }

      // Handle outsourced successor departure time
      if (succNode?.isOutsourced && isOutsourcedTask(succNode.task)) {
        const fr = forwardResults.get(succId)!;
        let constraint = new Date(fr.est); // departure
        if (isPrintingStation(snapshot, node.stationId!)) {
          constraint = new Date(constraint.getTime() - DRY_TIME_MS);
        }
        if (constraint < effectiveLft) {
          effectiveLft = constraint;
        }
      }
    }

    // Snap effective LFT to working hours
    effectiveLft = snapToPreviousWorkingTime(effectiveLft, station);

    // Find latest free slot
    let slot = findLatestFreeSlot(station, effectiveLft, durationMs, allAssignments);

    // Check group capacity if slot found
    if (slot) {
      const group = snapshot.groups.find((g) => g.id === station.groupId);
      if (group && group.maxConcurrent !== null) {
        const usageAtStart = calculateGroupUsageAtTime(allAssignments, snapshot.stations, slot.start);
        const currentUsage = usageAtStart.get(group.id) || 0;
        if (currentUsage >= group.maxConcurrent) {
          // Try to find another slot — for simplicity, try ASAP fallback
          slot = null;
        }
      }
    }

    if (slot) {
      // Snap start down to quarter-hour
      const snappedStart = snapToQuarterHourDown(slot.start);
      // Recalculate end from snapped start
      const newEnd = calculateEndTimeFn(
        node.task as InternalTask,
        snappedStart.toISOString(),
        station
      );

      // Check for infeasible (placed before EST)
      const fr = forwardResults.get(taskId)!;
      if (snappedStart < fr.est) {
        warnings.push({
          taskId,
          jobId: node.jobId,
          type: 'infeasible',
          message: `Task placed before earliest possible start (EST violation)`,
        });
      }

      const assignment: TaskAssignment = {
        id: `auto-${taskId}`,
        taskId,
        targetId: station.id,
        isOutsourced: false,
        scheduledStart: snappedStart.toISOString(),
        scheduledEnd: newEnd,
        isCompleted: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      allAssignments.push(assignment);
      newAssignments.push(assignment);
      placedStartTimes.set(taskId, snappedStart);
      placedCount++;
    } else {
      // Fallback: find earliest free slot (ASAP)
      const fr = forwardResults.get(taskId)!;
      const fallbackSlot = findEarliestFreeSlot(station, fr.est, durationMs, allAssignments);

      if (fallbackSlot) {
        const snappedStart = snapToQuarterHourDown(fallbackSlot.start);
        // For ASAP fallback, snap UP instead (don't start earlier than needed)
        const asapStart = snapToNextWorkingTime(fr.est, station);
        const finalStart = asapStart > snappedStart ? asapStart : snappedStart;

        const newEnd = calculateEndTimeFn(
          node.task as InternalTask,
          finalStart.toISOString(),
          station
        );

        warnings.push({
          taskId,
          jobId: node.jobId,
          type: 'placed_with_delay',
          message: `No ALAP slot available; placed ASAP as fallback`,
        });

        const assignment: TaskAssignment = {
          id: `auto-${taskId}`,
          taskId,
          targetId: station.id,
          isOutsourced: false,
          scheduledStart: finalStart.toISOString(),
          scheduledEnd: newEnd,
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        allAssignments.push(assignment);
        newAssignments.push(assignment);
        placedStartTimes.set(taskId, finalStart);
        placedCount++;
      } else {
        skippedCount++;
        warnings.push({
          taskId,
          jobId: node.jobId,
          type: 'infeasible',
          message: `No slot found on station ${station.name}`,
        });
      }
    }
  }

  // Build updated snapshot
  const updatedSnapshot: ScheduleSnapshot = {
    ...snapshot,
    assignments: [...snapshot.assignments, ...newAssignments],
  };

  console.log('Auto-place complete:', { jobIds, placedCount, skippedCount, warnings: warnings.length });

  return {
    snapshot: updatedSnapshot,
    placedCount,
    skippedCount,
    warnings,
  };
}
