/**
 * Local type extensions for the web application.
 *
 * Re-export shared types from @flux/types and add
 * any web-specific type definitions here.
 */

// Re-export shared types
export type {
  ScheduleSnapshot,
  Station,
  StationCategory,
  StationGroup,
  OutsourcedProvider,
  Job,
  Task,
  TaskAssignment,
  ProposedAssignment,
  ValidationResult,
  ScheduleConflict,
} from '@flux/types';

/**
 * Drag and drop related types (will be expanded in M3)
 */
export interface DragItem {
  type: 'task';
  taskId: string;
  jobId: string;
}

/**
 * Grid cell coordinates
 */
export interface GridCell {
  stationId: string;
  timestamp: string;
}
