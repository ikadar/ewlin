/**
 * Split / Fuse snapshot mutation helpers.
 *
 * Pure functions that operate on a mutable Immer draft of ScheduleSnapshot.
 * Shared between scheduleApi (optimistic updates) and mockBaseQuery (mock handlers).
 */

import type { InternalTask, ScheduleSnapshot } from '@flux/types';
import { calculateEndTime } from './timeCalculations';

// ============================================================================
// Split
// ============================================================================

export interface SplitParams {
  taskId: string;
  ratio: number;
  partAId: string;
  partBId: string;
  now: string;
}

export interface SplitResult {
  partA: InternalTask;
  partB: InternalTask;
  splitGroupId: string;
}

/**
 * Apply a split mutation to a snapshot draft.
 * Returns null if the task is not found or not an InternalTask.
 */
export function applySplitToSnapshot(
  draft: ScheduleSnapshot,
  params: SplitParams,
): SplitResult | null {
  const { taskId, ratio, partAId, partBId, now } = params;

  const task = draft.tasks.find((t) => t.id === taskId) as InternalTask | undefined;
  if (!task || task.type !== 'Internal') return null;

  const runMinutes = task.duration.runMinutes;
  const runA = Math.round(runMinutes * ratio);
  const runB = runMinutes - runA;

  const splitGroupId = task.splitGroupId ?? task.id;
  const originalRunMinutes = task.originalRunMinutes ?? runMinutes;

  // Determine current group state
  const existingGroupMembers = draft.tasks.filter(
    (t) => t.type === 'Internal' && (t as InternalTask).splitGroupId === splitGroupId,
  ) as InternalTask[];
  const currentTotal = existingGroupMembers.length > 0 ? existingGroupMembers.length : 1;
  const currentIndex = task.splitIndex ?? 0;
  const newTotal = currentTotal + 1;

  const partA: InternalTask = {
    ...task,
    id: partAId,
    duration: { ...task.duration, runMinutes: runA },
    splitGroupId,
    splitIndex: currentIndex,
    splitTotal: newTotal,
    originalRunMinutes,
    updatedAt: now,
  };

  const partB: InternalTask = {
    ...task,
    id: partBId,
    duration: { ...task.duration, runMinutes: runB },
    splitGroupId,
    splitIndex: currentIndex + 1,
    splitTotal: newTotal,
    originalRunMinutes,
    updatedAt: now,
  };

  // Update existing group members' splitTotal and shift indexes
  for (const t of draft.tasks) {
    if (t.type === 'Internal') {
      const it = t as InternalTask;
      if (it.splitGroupId === splitGroupId && it.id !== taskId) {
        it.splitTotal = newTotal;
        if ((it.splitIndex ?? 0) > currentIndex) {
          it.splitIndex = (it.splitIndex ?? 0) + 1;
        }
      }
    }
  }

  // Replace original task with two parts
  const taskIndex = draft.tasks.findIndex((t) => t.id === taskId);
  if (taskIndex !== -1) {
    draft.tasks.splice(taskIndex, 1, partA, partB);
  }

  // Update element.taskIds
  for (const element of draft.elements) {
    const idx = element.taskIds.indexOf(taskId);
    if (idx !== -1) {
      element.taskIds.splice(idx, 1, partAId, partBId);
    }
  }

  // Update job.taskIds
  for (const job of draft.jobs) {
    const idx = job.taskIds.indexOf(taskId);
    if (idx !== -1) {
      job.taskIds.splice(idx, 1, partAId, partBId);
    }
  }

  // If assigned: Part A keeps assignment, Part B is unassigned
  const assignmentIdx = draft.assignments.findIndex((a) => a.taskId === taskId);
  if (assignmentIdx !== -1) {
    const assignment = draft.assignments[assignmentIdx];
    assignment.taskId = partAId;
    const station = draft.stations.find((s) => s.id === assignment.targetId);
    assignment.scheduledEnd = calculateEndTime(partA, assignment.scheduledStart, station);
    assignment.updatedAt = now;
  }

  return { partA, partB, splitGroupId };
}

// ============================================================================
// Fuse
// ============================================================================

export interface FuseParams {
  taskId: string;
  restoredId: string;
  now: string;
}

export interface FuseResult {
  restoredTask: InternalTask;
  originalRunMinutes: number;
}

/**
 * Apply a fuse mutation to a snapshot draft.
 * Returns null if the task is not found, not Internal, or not split.
 */
export function applyFuseToSnapshot(
  draft: ScheduleSnapshot,
  params: FuseParams,
): FuseResult | null {
  const { taskId, restoredId, now } = params;

  const task = draft.tasks.find((t) => t.id === taskId) as InternalTask | undefined;
  if (!task || task.type !== 'Internal' || !task.splitGroupId) return null;

  const splitGroupId = task.splitGroupId;
  const groupMembers = draft.tasks.filter(
    (t) => t.type === 'Internal' && (t as InternalTask).splitGroupId === splitGroupId,
  ) as InternalTask[];

  if (groupMembers.length < 2) return null;

  const originalRunMinutes =
    groupMembers[0].originalRunMinutes ??
    groupMembers.reduce((sum, t) => sum + t.duration.runMinutes, 0);

  const base = groupMembers[0];
  const memberIds = new Set(groupMembers.map((t) => t.id));

  const restoredTask: InternalTask = {
    ...base,
    id: restoredId,
    duration: { ...base.duration, runMinutes: originalRunMinutes },
    splitGroupId: undefined,
    splitIndex: undefined,
    splitTotal: undefined,
    originalRunMinutes: undefined,
    updatedAt: now,
  };

  // Remove all group members, insert restored task
  const firstIdx = draft.tasks.findIndex((t) => memberIds.has(t.id));
  draft.tasks = draft.tasks.filter((t) => !memberIds.has(t.id));
  const insertAt = Math.min(firstIdx >= 0 ? firstIdx : draft.tasks.length, draft.tasks.length);
  draft.tasks.splice(insertAt, 0, restoredTask);

  // Update element.taskIds (immutable to work with frozen/Immer objects)
  draft.elements = draft.elements.map((element) => {
    const firstMemberIdx = element.taskIds.findIndex((id) => memberIds.has(id));
    if (firstMemberIdx !== -1) {
      const newTaskIds = element.taskIds.filter((id) => !memberIds.has(id));
      newTaskIds.splice(firstMemberIdx, 0, restoredId);
      return { ...element, taskIds: newTaskIds };
    }
    return element;
  });

  // Update job.taskIds (immutable to work with frozen/Immer objects)
  draft.jobs = draft.jobs.map((job) => {
    const firstMemberIdx = job.taskIds.findIndex((id) => memberIds.has(id));
    if (firstMemberIdx !== -1) {
      const newTaskIds = job.taskIds.filter((id) => !memberIds.has(id));
      newTaskIds.splice(firstMemberIdx, 0, restoredId);
      return { ...job, taskIds: newTaskIds };
    }
    return job;
  });

  // Keep earliest assigned part's assignment, remove rest
  const assignedMembers = draft.assignments
    .filter((a) => memberIds.has(a.taskId))
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
  draft.assignments = draft.assignments.filter((a) => !memberIds.has(a.taskId));
  if (assignedMembers.length > 0) {
    const keptAssignment = assignedMembers[0];
    keptAssignment.taskId = restoredId;
    const station = draft.stations.find((s) => s.id === keptAssignment.targetId);
    keptAssignment.scheduledEnd = calculateEndTime(restoredTask, keptAssignment.scheduledStart, station);
    keptAssignment.updatedAt = now;
    draft.assignments.push(keptAssignment);
  }

  return { restoredTask, originalRunMinutes };
}
