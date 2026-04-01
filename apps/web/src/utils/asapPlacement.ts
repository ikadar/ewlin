import type { ScheduleSnapshot, TaskAssignment, Element, Task, InternalTask, OutsourcedTask, Station } from '@flux/types';
import { isInternalTask } from '@flux/types';
import { getSuggestedStartForPrecedence } from '@flux/schedule-validator';
import { calculateEndTime } from './timeCalculations';
import { calculateOutsourcingDates } from './outsourcingCalculation';
import { isLastTaskOfJob, compareTaskOrder } from './taskHelpers';
import { snapToNextWorkingTime, ceilToQuarterHour, roundToNearestQuarterHour } from './workingTime';

export interface AsapPlacementResult {
  placements: { taskId: string; targetId: string; isOutsourced: boolean; scheduledStart: string }[];
  skippedCount: number;
}

/**
 * Compute ASAP placements for all unscheduled tasks of a job.
 *
 * Tasks are placed in topological order (by element precedence, then sequenceOrder),
 * each on its pre-assigned station, finding the earliest gap that respects both
 * precedence constraints and station availability.
 */
export function computeAsapPlacements(
  jobId: string,
  snapshot: ScheduleSnapshot,
): AsapPlacementResult {
  const jobElements = snapshot.elements.filter(e => e.jobId === jobId);
  const jobTasks = snapshot.tasks.filter(t => jobElements.some(e => e.id === t.elementId));

  // Topological sort of elements using Kahn's algorithm
  const sortedElements = topologicalSortElements(jobElements);

  // Build ordered task list: elements in topo order, tasks within each element by sequenceOrder
  const orderedTasks: Task[] = [];
  for (const element of sortedElements) {
    const elementTasks = jobTasks
      .filter(t => t.elementId === element.id)
      .sort(compareTaskOrder);
    orderedTasks.push(...elementTasks);
  }

  // Filter to unscheduled only
  const assignedTaskIds = new Set(snapshot.assignments.map(a => a.taskId));
  const unscheduledTasks = orderedTasks.filter(t => !assignedTaskIds.has(t.id));

  if (unscheduledTasks.length === 0) {
    return { placements: [], skippedCount: 0 };
  }

  // Work on a mutable snapshot copy so each placement informs the next
  const workingSnapshot = deepCopySnapshot(snapshot);
  const placements: AsapPlacementResult['placements'] = [];
  let skippedCount = 0;

  const now = roundToNearestQuarterHour(new Date()).toISOString();

  for (const task of unscheduledTasks) {
    if (isInternalTask(task)) {
      const placement = placeInternalTask(task, workingSnapshot, now);
      if (placement) {
        placements.push(placement);
        addSyntheticAssignment(workingSnapshot, placement);
      } else {
        skippedCount++;
      }
    } else {
      const placement = placeOutsourcedTask(task, workingSnapshot, now);
      if (placement) {
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

function topologicalSortElements(elements: Element[]): Element[] {
  const idToElement = new Map(elements.map(e => [e.id, e]));
  const elementIds = new Set(elements.map(e => e.id));

  // Only count prerequisites within the job's elements
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

function placeInternalTask(
  task: InternalTask,
  snapshot: ScheduleSnapshot,
  now: string,
): AsapPlacementResult['placements'][0] | null {
  const station = snapshot.stations.find(s => s.id === task.stationId);
  if (!station) return null;

  // Get precedence floor
  const proposed = { taskId: task.id, targetId: task.stationId, isOutsourced: false, scheduledStart: now };
  const precedenceFloor = getSuggestedStartForPrecedence(proposed, snapshot);
  // Snap to station working hours — ensures we never propose a start outside operating hours
  // Triple-snap: working hours → quarter-hour boundary → working hours (ceil may push past shift end)
  const snappedToWork = snapToNextWorkingTime(
    new Date(laterOf(precedenceFloor ?? now, now)),
    station,
  );
  const candidateStart = snapToNextWorkingTime(
    ceilToQuarterHour(snappedToWork),
    station,
  ).toISOString();

  // Find earliest gap on station
  const scheduledStart = findEarliestGap(task, station, candidateStart, snapshot);

  return { taskId: task.id, targetId: task.stationId, isOutsourced: false, scheduledStart };
}

function placeOutsourcedTask(
  task: OutsourcedTask,
  snapshot: ScheduleSnapshot,
  now: string,
): AsapPlacementResult['placements'][0] | null {
  const provider = snapshot.providers?.find(p => p.id === task.providerId);
  if (!provider) return null;

  // Honor manual dates if set
  if (task.manualDeparture) {
    return {
      taskId: task.id,
      targetId: task.providerId,
      isOutsourced: true,
      scheduledStart: task.manualDeparture,
    };
  }

  // Get precedence floor from working snapshot
  const proposed = { taskId: task.id, targetId: task.providerId, isOutsourced: true, scheduledStart: now };
  const precedenceFloor = getSuggestedStartForPrecedence(proposed, snapshot);
  const predecessorEnd = precedenceFloor ?? now;

  const oneWay = isLastTaskOfJob(task.id, snapshot.elements, snapshot.tasks);
  const dates = calculateOutsourcingDates(predecessorEnd, {
    workDays: task.duration.openDays,
    latestDepartureTime: provider.latestDepartureTime,
    receptionTime: provider.receptionTime,
    transitDays: provider.transitDays,
    oneWay,
  });

  if (!dates) return null;

  return {
    taskId: task.id,
    targetId: task.providerId,
    isOutsourced: true,
    scheduledStart: dates.departure.toISOString(),
  };
}

/**
 * Find the earliest gap on a station where `task` fits, starting from `candidateStart`.
 */
function findEarliestGap(
  task: InternalTask,
  station: Station,
  candidateStart: string,
  snapshot: ScheduleSnapshot,
): string {
  const stationAssignments = snapshot.assignments
    .filter(a => a.targetId === station.id && !a.isOutsourced)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  let start = candidateStart;
  let startMs = new Date(candidateStart).getTime();

  for (const assignment of stationAssignments) {
    const aStart = new Date(assignment.scheduledStart).getTime();
    const aEnd = new Date(assignment.scheduledEnd).getTime();

    const endTime = calculateEndTime(task, start, station);
    const endMs = new Date(endTime).getTime();

    if (startMs < aEnd && endMs > aStart) {
      // Overlap — move start to after this assignment
      start = assignment.scheduledEnd;
      startMs = aEnd;

      // Triple-snap: working hours → quarter-hour → working hours
      const snapped = snapToNextWorkingTime(
        ceilToQuarterHour(snapToNextWorkingTime(new Date(start), station)),
        station,
      );
      start = snapped.toISOString();
      startMs = snapped.getTime();
    }
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
    // Outsourced: use manualReturn if set, otherwise calculate return date
    const outsourcedTask = task as OutsourcedTask;
    if (outsourcedTask.manualReturn) {
      scheduledEnd = outsourcedTask.manualReturn;
    } else {
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
    }
  } else {
    scheduledEnd = placement.scheduledStart;
  }

  const syntheticAssignment: TaskAssignment = {
    id: `synthetic-${placement.taskId}`,
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

function deepCopySnapshot(snapshot: ScheduleSnapshot): ScheduleSnapshot {
  return {
    ...snapshot,
    assignments: [...snapshot.assignments],
    // Other arrays are read-only in our algorithm
  };
}

function laterOf(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}
