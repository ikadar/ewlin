/**
 * @flux/schedule-validator
 * Isomorphic schedule validation for Flux Print Shop Scheduling System
 *
 * This package provides schedule validation that runs identically in
 * the browser (for real-time drag feedback) and on the server (for
 * authoritative validation before persisting assignments).
 */

// Main validation functions
export { validateAssignment, validateAssignments, isValidAssignment } from './validate.js';

// Individual validators (for advanced usage)
export { validateStationConflict } from './validators/station.js';
export { validateGroupCapacity } from './validators/group.js';
export { validatePrecedence, getSuggestedStartForPrecedence } from './validators/precedence.js';
export { validateApprovalGates } from './validators/approval.js';
export { validateAvailability } from './validators/availability.js';
export { validateDeadline } from './validators/deadline.js';

// Utility functions
export {
  rangesOverlap,
  parseTimestamp,
  formatTimestamp,
  calculateInternalEndTime,
  calculateOutsourcedEndTime,
  isWithinRange,
  getOverlap,
  countActiveAtTime,
  getMaxConcurrent,
  type TimeRange,
} from './utils/time.js';

// Re-export types from @flux/types for convenience
export type {
  ScheduleSnapshot,
  ProposedAssignment,
  ValidationResult,
  ScheduleConflict,
  ConflictType,
} from '@flux/types';
