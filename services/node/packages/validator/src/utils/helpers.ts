/**
 * Helper Utilities
 * Functions for looking up entities in the schedule snapshot.
 */

import type {
  ScheduleSnapshot,
  Station,
  StationGroup,
  OutsourcedProvider,
  Job,
  Task,
  TaskAssignment,
} from '@flux/types';

/**
 * Find a station by ID.
 */
export function findStation(snapshot: ScheduleSnapshot, stationId: string): Station | undefined {
  return snapshot.stations.find((s) => s.id === stationId);
}

/**
 * Find a provider by ID.
 */
export function findProvider(
  snapshot: ScheduleSnapshot,
  providerId: string
): OutsourcedProvider | undefined {
  return snapshot.providers.find((p) => p.id === providerId);
}

/**
 * Find a station group by ID.
 */
export function findGroup(snapshot: ScheduleSnapshot, groupId: string): StationGroup | undefined {
  return snapshot.groups.find((g) => g.id === groupId);
}

/**
 * Find a job by ID.
 */
export function findJob(snapshot: ScheduleSnapshot, jobId: string): Job | undefined {
  return snapshot.jobs.find((j) => j.id === jobId);
}

/**
 * Find a task by ID.
 */
export function findTask(snapshot: ScheduleSnapshot, taskId: string): Task | undefined {
  return snapshot.tasks.find((t) => t.id === taskId);
}

/**
 * Find an assignment by task ID.
 */
export function findAssignmentByTaskId(
  snapshot: ScheduleSnapshot,
  taskId: string
): TaskAssignment | undefined {
  return snapshot.assignments.find((a) => a.taskId === taskId);
}

/**
 * Get all assignments for a station.
 */
export function getStationAssignments(
  snapshot: ScheduleSnapshot,
  stationId: string
): TaskAssignment[] {
  return snapshot.assignments.filter((a) => !a.isOutsourced && a.targetId === stationId);
}

/**
 * Get all assignments for stations in a group.
 */
export function getGroupAssignments(snapshot: ScheduleSnapshot, groupId: string): TaskAssignment[] {
  const stationsInGroup = snapshot.stations.filter((s) => s.groupId === groupId).map((s) => s.id);

  return snapshot.assignments.filter(
    (a) => !a.isOutsourced && stationsInGroup.includes(a.targetId)
  );
}

/**
 * Get all tasks for a job in sequence order.
 */
export function getJobTasks(snapshot: ScheduleSnapshot, jobId: string): Task[] {
  return snapshot.tasks
    .filter((t) => t.jobId === jobId)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

/**
 * Get the predecessor task (if any) for a given task.
 */
export function getPredecessorTask(snapshot: ScheduleSnapshot, task: Task): Task | undefined {
  const jobTasks = getJobTasks(snapshot, task.jobId);
  const taskIndex = jobTasks.findIndex((t) => t.id === task.id);
  if (taskIndex > 0) {
    return jobTasks[taskIndex - 1];
  }
  return undefined;
}

/**
 * Get all stations in a specific group.
 */
export function getStationsInGroup(snapshot: ScheduleSnapshot, groupId: string): Station[] {
  return snapshot.stations.filter((s) => s.groupId === groupId);
}
