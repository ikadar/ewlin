/**
 * @flux/types
 * Shared TypeScript types for Flux Print Shop Scheduling System
 */

// Station types
export type {
  StationStatus,
  TimeSlot,
  DaySchedule,
  OperatingSchedule,
  ScheduleException,
  SimilarityCriterion,
  StationCategory,
  StationGroup,
  Station,
  OutsourcedProvider,
} from './station.js';

// Job types
export type {
  JobStatus,
  PaperPurchaseStatus,
  PlatesStatus,
  ProofSentStatus,
  JobComment,
  ProofApprovalGate,
  Job,
} from './job.js';

// Task types
export type {
  TaskStatus,
  TaskType,
  InternalDuration,
  OutsourcedDuration,
  InternalTask,
  OutsourcedTask,
  Task,
} from './task.js';

export { isInternalTask, isOutsourcedTask, getTotalMinutes } from './task.js';

// Assignment and Schedule types
export type {
  TaskAssignment,
  ConflictType,
  ScheduleConflict,
  LateJob,
  ScheduleSnapshot,
  ProposedAssignment,
  ValidationResult,
} from './assignment.js';
