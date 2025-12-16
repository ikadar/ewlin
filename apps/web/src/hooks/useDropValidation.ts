import { useMemo } from 'react';
import { validateAssignment, isValidAssignment } from '@flux/schedule-validator';
import type {
  ScheduleSnapshot,
  ProposedAssignment,
  ValidationResult,
  Task,
} from '@flux/types';

export interface DropValidationParams {
  /** Current schedule snapshot */
  snapshot: ScheduleSnapshot;
  /** Task being dragged */
  task: Task | null;
  /** Target station ID */
  targetStationId: string | null;
  /** Proposed scheduled start time (ISO string) */
  scheduledStart: string | null;
  /** Whether Alt key is pressed (bypass precedence) */
  bypassPrecedence?: boolean;
}

export interface DropValidationResult {
  /** Whether the drop is valid */
  isValid: boolean;
  /** Whether there's a precedence conflict */
  hasPrecedenceConflict: boolean;
  /** Suggested start time if precedence conflict exists */
  suggestedStart: string | null;
  /** Full validation result */
  validationResult: ValidationResult | null;
  /** All conflicts */
  conflicts: ValidationResult['conflicts'];
}

/**
 * Hook for validating drop positions during drag operations.
 * Provides real-time validation feedback (<10ms target).
 */
export function useDropValidation({
  snapshot,
  task,
  targetStationId,
  scheduledStart,
  bypassPrecedence = false,
}: DropValidationParams): DropValidationResult {
  // Build proposed assignment from drag state
  const proposedAssignment = useMemo((): ProposedAssignment | null => {
    if (!task || !targetStationId || !scheduledStart) {
      return null;
    }

    // Only internal tasks for now (outsourced handled differently)
    if (task.type !== 'Internal') {
      return null;
    }

    return {
      taskId: task.id,
      targetId: targetStationId,
      isOutsourced: false,
      scheduledStart,
      bypassPrecedence,
    };
  }, [task, targetStationId, scheduledStart, bypassPrecedence]);

  // Perform validation
  const validationResult = useMemo((): ValidationResult | null => {
    if (!proposedAssignment) {
      return null;
    }

    return validateAssignment(proposedAssignment, snapshot);
  }, [proposedAssignment, snapshot]);

  // Extract relevant information
  const result = useMemo((): DropValidationResult => {
    if (!validationResult) {
      return {
        isValid: false,
        hasPrecedenceConflict: false,
        suggestedStart: null,
        validationResult: null,
        conflicts: [],
      };
    }

    const hasPrecedenceConflict = validationResult.conflicts.some(
      (c) => c.type === 'PrecedenceConflict'
    );

    return {
      isValid: validationResult.valid,
      hasPrecedenceConflict,
      suggestedStart: validationResult.suggestedStart ?? null,
      validationResult,
      conflicts: validationResult.conflicts,
    };
  }, [validationResult]);

  return result;
}

/**
 * Quick validation check for performance-critical paths.
 * Returns true/false without detailed conflict information.
 */
export function quickValidate(
  snapshot: ScheduleSnapshot,
  task: Task,
  targetStationId: string,
  scheduledStart: string,
  bypassPrecedence: boolean = false
): boolean {
  if (task.type !== 'Internal') {
    return false;
  }

  const proposed: ProposedAssignment = {
    taskId: task.id,
    targetId: targetStationId,
    isOutsourced: false,
    scheduledStart,
    bypassPrecedence,
  };

  return isValidAssignment(proposed, snapshot);
}
