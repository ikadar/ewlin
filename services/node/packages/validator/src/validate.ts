/**
 * Main Validation Function
 * Orchestrates all validators and returns aggregated results.
 */

import type {
  ScheduleSnapshot,
  ScheduleConflict,
  ProposedAssignment,
  ValidationResult,
} from '@flux/types';
import { validateStationConflict } from './validators/station.js';
import { validateGroupCapacity } from './validators/group.js';
import { validatePrecedence, getSuggestedStartForPrecedence } from './validators/precedence.js';
import { validateApprovalGates } from './validators/approval.js';
import { validateAvailability } from './validators/availability.js';
import { validateDeadline } from './validators/deadline.js';

/**
 * Validate a proposed assignment against all business rules.
 *
 * @param proposed - The proposed assignment to validate
 * @param snapshot - Current schedule snapshot with all entities
 * @returns Validation result with any conflicts found
 */
export function validateAssignment(
  proposed: ProposedAssignment,
  snapshot: ScheduleSnapshot
): ValidationResult {
  const conflicts: ScheduleConflict[] = [];

  // Run all validators
  const validators = [
    validateStationConflict,
    validateGroupCapacity,
    validatePrecedence,
    validateApprovalGates,
    validateAvailability,
    validateDeadline,
  ];

  for (const validator of validators) {
    const conflict = validator(proposed, snapshot);
    if (conflict !== null) {
      conflicts.push(conflict);
    }
  }

  // Calculate suggested start if there's a precedence conflict
  const hasPrecedenceConflict = conflicts.some((c) => c.type === 'PrecedenceConflict');

  const result: ValidationResult = {
    valid: conflicts.length === 0,
    conflicts,
  };

  if (hasPrecedenceConflict) {
    const suggested = getSuggestedStartForPrecedence(proposed, snapshot);
    if (suggested !== null) {
      result.suggestedStart = suggested;
    }
  }

  return result;
}

/**
 * Validate multiple proposed assignments.
 * Useful for batch operations.
 */
export function validateAssignments(
  proposals: ProposedAssignment[],
  snapshot: ScheduleSnapshot
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();

  for (const proposed of proposals) {
    results.set(proposed.taskId, validateAssignment(proposed, snapshot));
  }

  return results;
}

/**
 * Quick validation that returns just valid/invalid.
 * Faster because it short-circuits on first conflict.
 */
export function isValidAssignment(
  proposed: ProposedAssignment,
  snapshot: ScheduleSnapshot
): boolean {
  const validators = [
    validateStationConflict,
    validateGroupCapacity,
    validatePrecedence,
    validateApprovalGates,
    validateAvailability,
    validateDeadline,
  ];

  for (const validator of validators) {
    const conflict = validator(proposed, snapshot);
    if (conflict !== null) {
      return false;
    }
  }

  return true;
}
