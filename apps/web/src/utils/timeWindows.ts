/**
 * Time Window Computation for Intelligent Compaction
 *
 * Computes [earliestStart, latestEnd] windows for each assigned task
 * by building a dependency DAG and performing forward + backward passes.
 */

import type { ScheduleSnapshot, Task, Element, Station } from '@flux/types';
import { DRY_TIME_MS, isOutsourcedTask, getDeadlineDate } from '@flux/types';
import { snapToNextWorkingTime, addWorkingTime } from './workingTime';
import { isPrintingStation } from './precedenceConstraints';
import { getElementTasks } from './taskHelpers';

export interface TimeWindow {
  earliestStart: number; // ms timestamp
  latestEnd: number; // ms timestamp
  slack: number; // latestStart - earliestStart (ms)
}

export interface TimeWindowMap {
  /** taskId → TimeWindow */
  windows: Map<string, TimeWindow>;
}

interface DAGNode {
  taskId: string;
  task: Task;
  element: Element;
  assignment: { scheduledStart: string; scheduledEnd: string; targetId: string };
  station: Station | undefined;
  /** Predecessor task IDs (edges INTO this node) */
  predecessors: string[];
  /** Successor task IDs (edges OUT of this node) */
  successors: string[];
  /** Whether predecessor edge requires dry time */
  dryTimeFromPred: Map<string, boolean>;
}

/**
 * Build the dependency DAG over all assigned internal tasks.
 */
function buildDAG(snapshot: ScheduleSnapshot): Map<string, DAGNode> {
  const nodes = new Map<string, DAGNode>();
  const elementMap = new Map(snapshot.elements.map((e) => [e.id, e]));
  const stationMap = new Map(snapshot.stations.map((s) => [s.id, s]));
  const assignmentByTask = new Map(snapshot.assignments.map((a) => [a.taskId, a]));

  // Create nodes for all assigned internal tasks
  for (const task of snapshot.tasks) {
    const assignment = assignmentByTask.get(task.id);
    if (!assignment || assignment.isOutsourced) continue;
    if (task.type !== 'Internal') continue;

    const element = elementMap.get(task.elementId);
    if (!element) continue;

    nodes.set(task.id, {
      taskId: task.id,
      task,
      element,
      assignment,
      station: stationMap.get(assignment.targetId),
      predecessors: [],
      successors: [],
      dryTimeFromPred: new Map(),
    });
  }

  // Build edges
  for (const [taskId, node] of nodes) {
    const elementTasks = getElementTasks(node.element.id, snapshot.tasks);
    const taskIndex = elementTasks.findIndex((t) => t.id === taskId);

    // 1. Intra-element predecessor (same element, previous sequenceOrder)
    if (taskIndex > 0) {
      const pred = elementTasks[taskIndex - 1];
      const predAssignment = assignmentByTask.get(pred.id);

      if (pred.type === 'Outsourced' && isOutsourcedTask(pred)) {
        // Outsourced predecessor: use its return time as anchor but don't add as DAG node
        // Handled separately in forward pass
      } else if (nodes.has(pred.id)) {
        node.predecessors.push(pred.id);
        const predNode = nodes.get(pred.id)!;
        predNode.successors.push(taskId);
        // Check if predecessor is on a printing station
        const needsDryTime = predAssignment
          ? isPrintingStation(snapshot, predAssignment.targetId)
          : false;
        node.dryTimeFromPred.set(pred.id, needsDryTime);
      }
    }

    // 2. Cross-element predecessors (first task of element → last task of prereq elements)
    if (taskIndex === 0 && node.element.prerequisiteElementIds.length > 0) {
      for (const prereqElemId of node.element.prerequisiteElementIds) {
        const prereqTasks = getElementTasks(prereqElemId, snapshot.tasks);
        if (prereqTasks.length === 0) continue;

        const lastPrereqTask = prereqTasks[prereqTasks.length - 1];
        const lastPrereqAssignment = assignmentByTask.get(lastPrereqTask.id);

        if (lastPrereqTask.type === 'Outsourced') {
          // Outsourced: handled separately
          continue;
        }

        if (nodes.has(lastPrereqTask.id)) {
          node.predecessors.push(lastPrereqTask.id);
          const predNode = nodes.get(lastPrereqTask.id)!;
          predNode.successors.push(taskId);
          const needsDryTime = lastPrereqAssignment
            ? isPrintingStation(snapshot, lastPrereqAssignment.targetId)
            : false;
          node.dryTimeFromPred.set(lastPrereqTask.id, needsDryTime);
        }
      }
    }
  }

  return nodes;
}

/**
 * Get the return time for an outsourced predecessor of a task.
 */
function getOutsourcedPredecessorEnd(
  task: Task,
  snapshot: ScheduleSnapshot
): number | null {
  const elementMap = new Map(snapshot.elements.map((e) => [e.id, e]));
  const assignmentByTask = new Map(snapshot.assignments.map((a) => [a.taskId, a]));
  const element = elementMap.get(task.elementId);
  if (!element) return null;

  const elementTasks = getElementTasks(element.id, snapshot.tasks);
  const taskIndex = elementTasks.findIndex((t) => t.id === task.id);

  // Check intra-element outsourced predecessor
  if (taskIndex > 0) {
    const pred = elementTasks[taskIndex - 1];
    if (isOutsourcedTask(pred)) {
      if (pred.manualReturn) return new Date(pred.manualReturn).getTime();
      const predAssignment = assignmentByTask.get(pred.id);
      if (predAssignment) return new Date(predAssignment.scheduledEnd).getTime();
    }
  }

  // Check cross-element outsourced predecessors (first task of element)
  if (taskIndex === 0 && element.prerequisiteElementIds.length > 0) {
    let latestEnd: number | null = null;
    for (const prereqElemId of element.prerequisiteElementIds) {
      const prereqTasks = getElementTasks(prereqElemId, snapshot.tasks);
      if (prereqTasks.length === 0) continue;
      const lastTask = prereqTasks[prereqTasks.length - 1];
      if (isOutsourcedTask(lastTask)) {
        let end: number;
        if (lastTask.manualReturn) {
          end = new Date(lastTask.manualReturn).getTime();
        } else {
          const assignment = assignmentByTask.get(lastTask.id);
          if (!assignment) continue;
          end = new Date(assignment.scheduledEnd).getTime();
        }
        if (latestEnd === null || end > latestEnd) latestEnd = end;
      }
    }
    return latestEnd;
  }

  return null;
}

/**
 * Topological sort of DAG nodes. Returns task IDs in topological order.
 * Returns null if a cycle is detected.
 */
function topologicalSort(nodes: Map<string, DAGNode>): string[] | null {
  const inDegree = new Map<string, number>();
  for (const [id, node] of nodes) {
    inDegree.set(id, node.predecessors.filter((p) => nodes.has(p)).length);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);

    const node = nodes.get(id)!;
    for (const succId of node.successors) {
      if (!nodes.has(succId)) continue;
      const newDegree = (inDegree.get(succId) ?? 0) - 1;
      inDegree.set(succId, newDegree);
      if (newDegree === 0) queue.push(succId);
    }
  }

  if (sorted.length !== nodes.size) return null; // Cycle detected
  return sorted;
}

/**
 * Get the task duration in milliseconds.
 */
function getTaskDurationMs(task: Task): number {
  if (task.type !== 'Internal') return 0;
  return (task.duration.setupMinutes + task.duration.runMinutes) * 60 * 1000;
}

/**
 * Compute time windows for all assigned internal tasks.
 *
 * Forward pass: compute earliestStart (when can this task start at the earliest?)
 * Backward pass: compute latestEnd (when must this task finish at the latest?)
 * Slack: latestStart - earliestStart
 */
export function computeTimeWindows(
  snapshot: ScheduleSnapshot,
  now: Date
): TimeWindowMap {
  const dag = buildDAG(snapshot);
  const topoOrder = topologicalSort(dag);

  if (!topoOrder) {
    // Cycle detected — return empty windows (algorithm will fall back to original order)
    return { windows: new Map() };
  }

  const jobMap = new Map(snapshot.jobs.map((j) => [j.id, j]));
  const earliestStart = new Map<string, number>();
  const latestEnd = new Map<string, number>();
  const nowMs = now.getTime();

  // === Forward Pass: earliestStart ===
  for (const taskId of topoOrder) {
    const node = dag.get(taskId)!;
    let earliest = nowMs;

    // From DAG predecessors
    for (const predId of node.predecessors) {
      if (!dag.has(predId)) continue;
      const predNode = dag.get(predId)!;
      const predDuration = getTaskDurationMs(predNode.task);
      let predEnd = (earliestStart.get(predId) ?? nowMs) + predDuration;

      // Add working time if station is available
      if (predNode.station) {
        predEnd = addWorkingTime(new Date(earliestStart.get(predId) ?? nowMs), predDuration, predNode.station).getTime();
      }

      // Add dry time if predecessor is on printing station
      if (node.dryTimeFromPred.get(predId)) {
        predEnd += DRY_TIME_MS;
      }

      if (predEnd > earliest) earliest = predEnd;
    }

    // From outsourced predecessors (not in DAG)
    const outsourcedEnd = getOutsourcedPredecessorEnd(node.task, snapshot);
    if (outsourcedEnd !== null && outsourcedEnd > earliest) {
      earliest = outsourcedEnd;
    }

    // Snap to station operating hours
    if (node.station) {
      earliest = snapToNextWorkingTime(new Date(earliest), node.station).getTime();
    }

    earliestStart.set(taskId, earliest);
  }

  // === Backward Pass: latestEnd ===
  const reverseOrder = [...topoOrder].reverse();
  for (const taskId of reverseOrder) {
    const node = dag.get(taskId)!;
    const job = jobMap.get(node.element.jobId);
    let latest = job ? getDeadlineDate(job.workshopExitDate).getTime() : Infinity;

    // From DAG successors
    for (const succId of node.successors) {
      if (!dag.has(succId)) continue;
      const succNode = dag.get(succId)!;
      const succLatestEnd = latestEnd.get(succId);
      if (succLatestEnd === undefined) continue;

      // Successor's latestStart = latestEnd - duration (in working time)
      const succDuration = getTaskDurationMs(succNode.task);
      let succLatestStart: number;
      if (succNode.station) {
        // For working time subtraction, we approximate: latestStart ≈ latestEnd - durationMs
        // This is a simplified approach - exact working time subtraction would be more complex
        succLatestStart = succLatestEnd - succDuration;
      } else {
        succLatestStart = succLatestEnd - succDuration;
      }

      // Subtract dry time if THIS task is on a printing station
      if (succNode.dryTimeFromPred.get(taskId)) {
        succLatestStart -= DRY_TIME_MS;
      }

      if (succLatestStart < latest) latest = succLatestStart;
    }

    latestEnd.set(taskId, latest);
  }

  // === Compute Windows ===
  const windows = new Map<string, TimeWindow>();
  for (const taskId of topoOrder) {
    const es = earliestStart.get(taskId) ?? nowMs;
    const le = latestEnd.get(taskId) ?? Infinity;
    const duration = getTaskDurationMs(dag.get(taskId)!.task);
    const latestStart = le - duration;
    const slack = latestStart - es;

    windows.set(taskId, {
      earliestStart: es,
      latestEnd: le,
      slack,
    });
  }

  return { windows };
}
