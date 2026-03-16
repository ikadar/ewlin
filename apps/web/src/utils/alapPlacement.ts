import type { ScheduleSnapshot, TaskAssignment, Element, Task, InternalTask, OutsourcedTask, Station } from '@flux/types';
import { isInternalTask, DRY_TIME_MINUTES } from '@flux/types';
import { getSuggestedStartForPrecedence, isPrintingTask } from '@flux/schedule-validator';
import { calculateEndTime, calculateStartTime } from './timeCalculations';
import { calculateOutsourcingDates, calculateOutsourcingDatesBackward } from './outsourcingCalculation';
import { computeAsapPlacements } from './asapPlacement';
import { isLastTaskOfJob, compareTaskOrder } from './taskHelpers';
import { snapToNextWorkingTime, snapToPreviousWorkingTime } from './workingTime';

export interface AlapPlacementResult {
  placements: { taskId: string; targetId: string; isOutsourced: boolean; scheduledStart: string }[];
  skippedCount: number;
}

/**
 * Compute ALAP placements for all unscheduled tasks of a job.
 *
 * Two-pass approach:
 * 1. Run ASAP as a phantom to find the job's earliest possible completion
 * 2. Run ALAP backward from max(ASAP_completion, workshopExitDate)
 */
export function computeAlapPlacements(
  jobId: string,
  snapshot: ScheduleSnapshot,
): AlapPlacementResult {
  const job = snapshot.jobs.find(j => j.id === jobId);
  if (!job) return { placements: [], skippedCount: 0 };

  const jobElements = snapshot.elements.filter(e => e.jobId === jobId);
  const jobTasks = snapshot.tasks.filter(t => jobElements.some(e => e.id === t.elementId));
  const elementMap = new Map<string, Element>(jobElements.map(e => [e.id, e]));

  // === Phase 1: ASAP Phantom ===
  const phantomSnapshot = deepCopySnapshot(snapshot);
  const asapResult = computeAsapPlacements(jobId, phantomSnapshot);

  // Find the latest end time from phantom ASAP assignments
  let asapLatestEndMs = 0;
  for (const p of asapResult.placements) {
    // Find the assignment in phantom snapshot
    const phantomAssignment = phantomSnapshot.assignments.find(a => a.taskId === p.taskId);
    if (phantomAssignment?.scheduledEnd) {
      const endMs = new Date(phantomAssignment.scheduledEnd).getTime();
      if (endMs > asapLatestEndMs) asapLatestEndMs = endMs;
    }
  }

  // === Phase 2: Ceiling ===
  const workshopExitMs = job.workshopExitDate
    ? new Date(job.workshopExitDate).getTime()
    : 0;
  const ceilingMs = Math.max(asapLatestEndMs, workshopExitMs) || (Date.now() + 30 * 24 * 60 * 60 * 1000);
  const ceiling = new Date(ceilingMs).toISOString();

  // === Phase 3: ALAP Backward ===
  // Reverse topological sort (leaves first), tasks by descending sequenceOrder
  const sortedElements = reverseTopologicalSort(jobElements);

  const orderedTasks: Task[] = [];
  for (const element of sortedElements) {
    const elementTasks = jobTasks
      .filter(t => t.elementId === element.id)
      .sort((a, b) => compareTaskOrder(b, a));
    orderedTasks.push(...elementTasks);
  }

  // Filter to unscheduled only
  const assignedTaskIds = new Set(snapshot.assignments.map(a => a.taskId));
  const unscheduledTasks = orderedTasks.filter(t => !assignedTaskIds.has(t.id));

  if (unscheduledTasks.length === 0) {
    return { placements: [], skippedCount: 0 };
  }

  // Work on a mutable snapshot so each placement informs the next
  const workingSnapshot = deepCopySnapshot(snapshot);
  const placements: AlapPlacementResult['placements'] = [];
  let skippedCount = 0;

  const now = new Date().toISOString();

  for (const task of unscheduledTasks) {
    if (isInternalTask(task)) {
      const placement = placeInternalTaskAlap(task, workingSnapshot, ceiling, now);
      if (placement) {
        placements.push(placement);
        addSyntheticAssignment(workingSnapshot, placement);
      } else {
        skippedCount++;
      }
    } else {
      const placement = placeOutsourcedTaskAlap(task, workingSnapshot, ceiling, now);
      if (placement) {
        // ALAP places ALL outsourced tasks backward (unlike ASAP which
        // only dispatches root-element outsourced tasks and relies on
        // autoAssignSuccessors for the rest). In ALAP, autoAssignSuccessors
        // would use forward logic, producing lateness.
        placements.push(placement);
        addSyntheticAssignment(workingSnapshot, placement);
      } else {
        skippedCount++;
      }
    }
  }

  return { placements, skippedCount };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function placeInternalTaskAlap(
  task: InternalTask,
  snapshot: ScheduleSnapshot,
  ceiling: string,
  now: string,
): AlapPlacementResult['placements'][0] | null {
  const station = snapshot.stations.find(s => s.id === task.stationId);
  if (!station) return null;

  // Get precedence ceiling from already-placed successors
  const precedenceCeiling = getSuggestedEndForPrecedenceCeiling(task, snapshot);
  const effectiveCeiling = precedenceCeiling
    ? earlierOf(precedenceCeiling, ceiling)
    : ceiling;

  // Snap ceiling backward to working hours
  const snappedCeiling = snapToPreviousWorkingTime(new Date(effectiveCeiling), station);

  // Find latest gap on station
  const scheduledEnd = findLatestGap(task, station, snappedCeiling.toISOString(), snapshot);

  // Calculate start from end
  const scheduledStart = calculateStartTime(task, scheduledEnd, station);

  // If start is before now, skip (infeasible)
  if (new Date(scheduledStart).getTime() < new Date(now).getTime()) {
    return null;
  }

  return { taskId: task.id, targetId: task.stationId, isOutsourced: false, scheduledStart };
}

function placeOutsourcedTaskAlap(
  task: OutsourcedTask,
  snapshot: ScheduleSnapshot,
  ceiling: string,
  now: string,
): AlapPlacementResult['placements'][0] | null {
  const provider = snapshot.providers?.find(p => p.id === task.providerId);
  if (!provider) return null;

  const precedenceCeiling = getSuggestedEndForPrecedenceCeiling(task, snapshot);
  const effectiveCeiling = precedenceCeiling
    ? earlierOf(precedenceCeiling, ceiling)
    : ceiling;

  const oneWay = isLastTaskOfJob(task.id, snapshot.elements, snapshot.tasks);
  const dates = calculateOutsourcingDatesBackward(effectiveCeiling, {
    workDays: task.duration.openDays,
    latestDepartureTime: provider.latestDepartureTime,
    receptionTime: provider.receptionTime,
    transitDays: provider.transitDays,
    oneWay,
  });

  if (!dates) return null;

  const departureIso = dates.departure.toISOString();
  if (new Date(departureIso).getTime() < new Date(now).getTime()) {
    return null;
  }

  return {
    taskId: task.id,
    targetId: task.providerId,
    isOutsourced: true,
    scheduledStart: departureIso,
  };
}

/**
 * Find the latest gap on a station where `task` fits, ending at or before `ceiling`.
 * Scans existing assignments from latest to earliest.
 */
function findLatestGap(
  task: InternalTask,
  station: Station,
  ceiling: string,
  snapshot: ScheduleSnapshot,
): string {
  const stationAssignments = snapshot.assignments
    .filter(a => a.targetId === station.id && !a.isOutsourced)
    .sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime());

  let end = ceiling;
  let endMs = new Date(ceiling).getTime();

  for (const assignment of stationAssignments) {
    const aStart = new Date(assignment.scheduledStart).getTime();
    const aEnd = new Date(assignment.scheduledEnd).getTime();

    // Calculate start for current end position
    const startTime = calculateStartTime(task, end, station);
    const startMs = new Date(startTime).getTime();

    // Check overlap
    if (startMs < aEnd && endMs > aStart) {
      // Overlap — move end to before this assignment
      end = assignment.scheduledStart;
      endMs = aStart;

      // Snap backward to working hours
      const snapped = snapToPreviousWorkingTime(new Date(end), station);
      end = snapped.toISOString();
      endMs = snapped.getTime();
    }
  }

  return end;
}

/**
 * Get the precedence ceiling for a task (reverse of getSuggestedStartForPrecedence).
 *
 * Looks at already-placed successors and returns the earliest start time
 * among them, reduced by dry time if this task is a printing task.
 */
function getSuggestedEndForPrecedenceCeiling(
  task: Task,
  snapshot: ScheduleSnapshot,
): string | null {
  const effectiveStarts: Date[] = [];
  const element = snapshot.elements.find(e => e.id === task.elementId);
  if (!element) return null;

  // 1. Intra-element successor
  const elementTasks = snapshot.tasks
    .filter(t => t.elementId === task.elementId)
    .sort(compareTaskOrder);

  const taskIndex = elementTasks.findIndex(t => t.id === task.id);
  if (taskIndex >= 0 && taskIndex < elementTasks.length - 1) {
    const successor = elementTasks[taskIndex + 1];
    const assignment = snapshot.assignments.find(a => a.taskId === successor.id);
    if (assignment) {
      effectiveStarts.push(getEffectiveSuccessorStart(task, assignment, snapshot));
    }
  }

  // 2. Cross-element successors (only for last task in element)
  if (taskIndex === elementTasks.length - 1) {
    const dependentElements = snapshot.elements.filter(e =>
      e.prerequisiteElementIds.includes(element.id)
    );
    for (const depElement of dependentElements) {
      const depTasks = snapshot.tasks
        .filter(t => t.elementId === depElement.id)
        .sort(compareTaskOrder);
      if (depTasks.length > 0) {
        const firstTask = depTasks[0];
        const assignment = snapshot.assignments.find(a => a.taskId === firstTask.id);
        if (assignment) {
          effectiveStarts.push(getEffectiveSuccessorStart(task, assignment, snapshot));
        }
      }
    }

    // 3. Cross-job successors (only for root element's last task)
    if (element.prerequisiteElementIds.length === 0) {
      const dependentJobs = snapshot.jobs.filter(
        j => j.requiredJobIds && j.requiredJobIds.includes(element.jobId)
      );
      for (const depJob of dependentJobs) {
        const depElements = snapshot.elements.filter(e =>
          e.jobId === depJob.id && e.prerequisiteElementIds.length === 0
        );
        for (const depElement of depElements) {
          const depTasks = snapshot.tasks
            .filter(t => t.elementId === depElement.id)
            .sort(compareTaskOrder);
          if (depTasks.length > 0) {
            const firstTask = depTasks[0];
            const assignment = snapshot.assignments.find(a => a.taskId === firstTask.id);
            if (assignment) {
              effectiveStarts.push(getEffectiveSuccessorStart(task, assignment, snapshot));
            }
          }
        }
      }
    }
  }

  if (effectiveStarts.length === 0) return null;

  // Return the most constraining (earliest) start
  const earliest = effectiveStarts.reduce((min, d) =>
    d.getTime() < min.getTime() ? d : min
  );

  return earliest.toISOString();
}

/**
 * Get the effective successor start, subtracting dry time if the current task is a printing task.
 */
function getEffectiveSuccessorStart(
  currentTask: Task,
  successorAssignment: TaskAssignment,
  snapshot: ScheduleSnapshot,
): Date {
  const start = new Date(successorAssignment.scheduledStart);

  if (isInternalTask(currentTask) && isPrintingTask(snapshot, currentTask.id)) {
    return new Date(start.getTime() - DRY_TIME_MINUTES * 60 * 1000);
  }

  return start;
}

function addSyntheticAssignment(
  snapshot: ScheduleSnapshot,
  placement: { taskId: string; targetId: string; isOutsourced: boolean; scheduledStart: string },
): void {
  const task = snapshot.tasks.find(t => t.id === placement.taskId);
  let scheduledEnd: string;

  if (task && isInternalTask(task)) {
    const station = snapshot.stations.find(s => s.id === placement.targetId);
    scheduledEnd = calculateEndTime(task, placement.scheduledStart, station);
  } else if (task && !isInternalTask(task)) {
    const outsourcedTask = task as OutsourcedTask;
    const provider = snapshot.providers?.find(p => p.id === outsourcedTask.providerId);
    if (provider) {
      const oneWay = isLastTaskOfJob(task.id, snapshot.elements, snapshot.tasks);
      const dates = calculateOutsourcingDates(placement.scheduledStart, {
        workDays: outsourcedTask.duration.openDays,
        latestDepartureTime: provider.latestDepartureTime,
        receptionTime: provider.receptionTime,
        transitDays: provider.transitDays,
        oneWay,
      });
      scheduledEnd = dates ? dates.return.toISOString() : placement.scheduledStart;
    } else {
      scheduledEnd = placement.scheduledStart;
    }
  } else {
    scheduledEnd = placement.scheduledStart;
  }

  const syntheticAssignment: TaskAssignment = {
    id: `synthetic-alap-${placement.taskId}`,
    taskId: placement.taskId,
    targetId: placement.targetId,
    isOutsourced: placement.isOutsourced,
    scheduledStart: placement.scheduledStart,
    scheduledEnd,
    isCompleted: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  snapshot.assignments.push(syntheticAssignment);
}

function topologicalSortElements(elements: Element[]): Element[] {
  const idToElement = new Map(elements.map(e => [e.id, e]));
  const elementIds = new Set(elements.map(e => e.id));

  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const el of elements) {
    inDegree.set(el.id, 0);
    adjacency.set(el.id, []);
  }

  for (const el of elements) {
    for (const predId of el.prerequisiteElementIds) {
      if (elementIds.has(predId)) {
        adjacency.get(predId)!.push(el.id);
        inDegree.set(el.id, (inDegree.get(el.id) ?? 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: Element[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(idToElement.get(id)!);
    for (const neighbor of adjacency.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

function reverseTopologicalSort(elements: Element[]): Element[] {
  return [...topologicalSortElements(elements)].reverse();
}

function deepCopySnapshot(snapshot: ScheduleSnapshot): ScheduleSnapshot {
  return {
    ...snapshot,
    assignments: [...snapshot.assignments],
  };
}

function earlierOf(a: string, b: string): string {
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}
