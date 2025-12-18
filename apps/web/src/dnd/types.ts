/**
 * Shared type definitions for pragmatic-drag-and-drop integration
 */

import type { Task, Job } from '@flux/types';

/** Data attached to draggable task tiles */
export interface TaskDragData {
  type: 'task';
  task: Task;
  job: Job;
  /** Assignment ID if this is a reschedule (existing tile being repositioned) */
  assignmentId?: string;
  /** Index signature for pragmatic-dnd compatibility */
  [key: string]: unknown;
}

/** Data attached to droppable station columns */
export interface StationDropData {
  type: 'station-column';
  stationId: string;
  /** Index signature for pragmatic-dnd compatibility */
  [key: string | symbol]: unknown;
}

/** Validation state during drag */
export interface DragValidationState {
  targetStationId: string | null;
  scheduledStart: string | null;
  isValid: boolean;
  hasPrecedenceConflict: boolean;
  suggestedStart: string | null;
  hasWarningOnly: boolean;
}

/** Global drag state shared via context */
export interface DragState {
  /** Whether a drag operation is currently active */
  isDragging: boolean;
  /** The task being dragged (null when not dragging) */
  activeTask: Task | null;
  /** The job the dragged task belongs to (null when not dragging) */
  activeJob: Job | null;
  /** Whether this is a reschedule drag (grid tile) vs new placement (sidebar) */
  isRescheduleDrag: boolean;
  /** Assignment ID being rescheduled (only present for reschedule drags) */
  activeAssignmentId: string | null;
  /** Grab offset - where user grabbed within the tile (for positioning) */
  grabOffset: { x: number; y: number };
  /** Current drag validation state */
  validation: DragValidationState;
}

/** Initial drag state when no drag is active */
export const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  activeTask: null,
  activeJob: null,
  isRescheduleDrag: false,
  activeAssignmentId: null,
  grabOffset: { x: 0, y: 0 },
  validation: {
    targetStationId: null,
    scheduledStart: null,
    isValid: false,
    hasPrecedenceConflict: false,
    suggestedStart: null,
    hasWarningOnly: false,
  },
};
