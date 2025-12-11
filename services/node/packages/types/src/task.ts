/**
 * Task Types
 * A task is a specific production operation within a job.
 */

/** Status of a task */
export type TaskStatus =
  | 'Defined'
  | 'Ready'
  | 'Assigned'
  | 'Executing'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

/** Type of task */
export type TaskType = 'Internal' | 'Outsourced';

/** Duration for internal tasks (in minutes) */
export interface InternalDuration {
  /** Setup time in minutes */
  setupMinutes: number;
  /** Run time in minutes */
  runMinutes: number;
}

/** Duration for outsourced tasks (in open days) */
export interface OutsourcedDuration {
  /** Duration in open days (business days) */
  openDays: number;
}

/** Base task properties */
interface BaseTask {
  id: string;
  jobId: string;
  /** Position in job's task sequence (0-indexed) */
  sequenceOrder: number;
  status: TaskStatus;
  /** Optional comment/notes for this task */
  comment?: string;
  /** Creation timestamp (ISO) */
  createdAt: string;
  /** Last update timestamp (ISO) */
  updatedAt: string;
}

/** Internal task performed on a workshop station */
export interface InternalTask extends BaseTask {
  type: 'Internal';
  /** Station ID where task will be performed */
  stationId: string;
  /** Duration with setup and run times */
  duration: InternalDuration;
}

/** Outsourced task performed by external provider */
export interface OutsourcedTask extends BaseTask {
  type: 'Outsourced';
  /** Provider ID */
  providerId: string;
  /** Type of action (e.g., "Pelliculage", "Dorure") */
  actionType: string;
  /** Duration in open days */
  duration: OutsourcedDuration;
}

/** Union type for all task types */
export type Task = InternalTask | OutsourcedTask;

/** Type guard for internal tasks */
export function isInternalTask(task: Task): task is InternalTask {
  return task.type === 'Internal';
}

/** Type guard for outsourced tasks */
export function isOutsourcedTask(task: Task): task is OutsourcedTask {
  return task.type === 'Outsourced';
}

/** Calculate total duration in minutes for internal task */
export function getTotalMinutes(duration: InternalDuration): number {
  return duration.setupMinutes + duration.runMinutes;
}
