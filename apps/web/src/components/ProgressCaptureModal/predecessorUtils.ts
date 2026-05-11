import type { ScheduleSnapshot, InternalTask } from '@flux/types';
import { isInternalTask } from '@flux/types';
import type { PredecessorInfo } from './PredecessorCard';
import { fmtTimeMin } from './timeUtils';

function isoToMin(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Resolve the most relevant predecessor task for a given task.
 *
 * Search order:
 * 1. Intra-element: previous task by sequence order in the same element
 * 2. Inter-element: tasks in prerequisite elements (last task of each)
 *
 * Returns null if no predecessor is found or if the predecessor has no
 * assignment in the current schedule.
 */
export function resolvePredecessorInfo(
  taskId: string,
  snapshot: ScheduleSnapshot,
): PredecessorInfo | null {
  const task = snapshot.tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const element = snapshot.elements.find((e) => e.id === task.elementId);
  if (!element) return null;

  const job = snapshot.jobs.find((j) => j.elementIds?.includes(element.id));
  if (!job) return null;

  const assignmentMap = new Map(snapshot.assignments.map((a) => [a.taskId, a]));

  // 1. Intra-element: previous task by index in element.taskIds
  const taskIndex = element.taskIds.indexOf(taskId);
  if (taskIndex > 0) {
    const predTaskId = element.taskIds[taskIndex - 1];
    const info = buildInfo(predTaskId, job, snapshot, assignmentMap);
    if (info) return info;
  }

  // 2. Inter-element: last task of each prerequisite element
  if (element.prerequisiteElementIds?.length) {
    for (const prereqId of element.prerequisiteElementIds) {
      const prereqElement = snapshot.elements.find((e) => e.id === prereqId);
      if (!prereqElement?.taskIds?.length) continue;
      const lastTaskId = prereqElement.taskIds[prereqElement.taskIds.length - 1];
      const info = buildInfo(lastTaskId, job, snapshot, assignmentMap);
      if (info) return info;
    }
  }

  return null;
}

function buildInfo(
  predTaskId: string,
  job: { reference: string; client: string },
  snapshot: ScheduleSnapshot,
  assignmentMap: Map<string, { scheduledStart: string; scheduledEnd: string; operators?: Array<{ operatorId: string }> }>,
): PredecessorInfo | null {
  const predTask = snapshot.tasks.find((t) => t.id === predTaskId);
  if (!predTask || !isInternalTask(predTask)) return null;

  const predAssignment = assignmentMap.get(predTaskId);
  if (!predAssignment) return null;

  const station = snapshot.stations?.find((s) => s.id === (predTask as InternalTask).stationId);

  return {
    jobReference: job.reference,
    client: job.client,
    stationName: station?.name ?? (predTask as InternalTask).stationId,
    timeRange: `${fmtTimeMin(isoToMin(predAssignment.scheduledStart))} → ${fmtTimeMin(isoToMin(predAssignment.scheduledEnd))}`,
  };
}
