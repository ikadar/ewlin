/**
 * Assignment and Schedule Types
 * An assignment is the placement of a task onto a station at a specific time.
 */

import type { Job } from './job.js';
import type { Station, StationCategory, StationGroup, OutsourcedProvider } from './station.js';
import type { Task } from './task.js';

/** Assignment of a task to a time slot */
export interface TaskAssignment {
  id: string;
  taskId: string;
  /** Station or provider ID */
  targetId: string;
  /** Whether assigned to provider (true) or station (false) */
  isOutsourced: boolean;
  /** Scheduled start time (ISO timestamp) */
  scheduledStart: string;
  /** Scheduled end time (ISO timestamp) */
  scheduledEnd: string;
  /** Creation timestamp (ISO) */
  createdAt: string;
  /** Last update timestamp (ISO) */
  updatedAt: string;
}

/** Types of schedule conflicts */
export type ConflictType =
  | 'StationConflict'
  | 'GroupCapacityConflict'
  | 'PrecedenceConflict'
  | 'ApprovalGateConflict'
  | 'AvailabilityConflict'
  | 'DeadlineConflict';

/** A scheduling conflict */
export interface ScheduleConflict {
  type: ConflictType;
  /** Human-readable description */
  message: string;
  /** Task ID that has the conflict */
  taskId: string;
  /** Related task ID (for precedence conflicts) */
  relatedTaskId?: string;
  /** Station or provider ID */
  targetId?: string;
  /** Additional conflict details */
  details?: Record<string, unknown>;
}

/** A job that will miss its deadline */
export interface LateJob {
  jobId: string;
  /** Workshop exit date (ISO date string) */
  deadline: string;
  /** Expected completion date (ISO date string) */
  expectedCompletion: string;
  /** Delay in days */
  delayDays: number;
}

/** Complete schedule snapshot for client-side rendering and validation */
export interface ScheduleSnapshot {
  /** Snapshot version for optimistic locking */
  version: number;
  /** Timestamp when snapshot was generated (ISO) */
  generatedAt: string;
  /** All stations */
  stations: Station[];
  /** Station categories */
  categories: StationCategory[];
  /** Station groups */
  groups: StationGroup[];
  /** Outsourced providers */
  providers: OutsourcedProvider[];
  /** All jobs */
  jobs: Job[];
  /** All tasks */
  tasks: Task[];
  /** All assignments */
  assignments: TaskAssignment[];
  /** Current conflicts */
  conflicts: ScheduleConflict[];
  /** Jobs that will miss deadlines */
  lateJobs: LateJob[];
}

/** Proposed assignment for validation */
export interface ProposedAssignment {
  taskId: string;
  targetId: string;
  isOutsourced: boolean;
  scheduledStart: string;
  /** Whether precedence safeguard is bypassed (Alt key held) */
  bypassPrecedence?: boolean;
}

/** Result of validating a proposed assignment */
export interface ValidationResult {
  /** Whether the assignment is valid */
  valid: boolean;
  /** List of conflicts if invalid */
  conflicts: ScheduleConflict[];
  /** Suggested corrected start time (for precedence snapping) */
  suggestedStart?: string;
}
