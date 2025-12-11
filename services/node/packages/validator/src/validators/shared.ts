/**
 * Shared Validator Utilities
 */

import type { Task } from '@flux/types';
import { isInternalTask } from '@flux/types';
import { calculateInternalEndTime, calculateOutsourcedEndTime } from '../utils/time.js';

/**
 * Calculate the end time for a task given a start time.
 */
export function calculateEndTime(task: Task, start: Date): Date {
  if (isInternalTask(task)) {
    return calculateInternalEndTime(start, task.duration);
  } else {
    return calculateOutsourcedEndTime(start, task.duration);
  }
}
