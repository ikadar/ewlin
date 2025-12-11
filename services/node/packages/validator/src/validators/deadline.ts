/**
 * Deadline Validator
 * Checks that task completion won't exceed job's workshop exit date.
 */

import type { ScheduleSnapshot, ScheduleConflict, ProposedAssignment } from '@flux/types';
import { parseTimestamp, formatTimestamp } from '../utils/time.js';
import { findTask, findJob } from '../utils/helpers.js';
import { calculateEndTime } from './shared.js';

/**
 * Validate that the proposed assignment won't cause the job to miss its deadline.
 */
export function validateDeadline(
  proposed: ProposedAssignment,
  snapshot: ScheduleSnapshot
): ScheduleConflict | null {
  const task = findTask(snapshot, proposed.taskId);
  if (!task) {
    return null;
  }

  const job = findJob(snapshot, task.jobId);
  if (!job) {
    return null;
  }

  const proposedStart = parseTimestamp(proposed.scheduledStart);
  const proposedEnd = calculateEndTime(task, proposedStart);

  // Workshop exit date is just a date, so we compare against end of that day
  const deadlineDate = new Date(job.workshopExitDate);
  // Set to end of day (23:59:59.999)
  deadlineDate.setHours(23, 59, 59, 999);

  if (proposedEnd > deadlineDate) {
    const delayMs = proposedEnd.getTime() - deadlineDate.getTime();
    const delayDays = Math.ceil(delayMs / (24 * 60 * 60 * 1000));

    return {
      type: 'DeadlineConflict',
      message: `Task completion would exceed workshop exit date by ${String(delayDays)} day(s)`,
      taskId: proposed.taskId,
      details: {
        jobId: job.id,
        workshopExitDate: job.workshopExitDate,
        expectedCompletion: formatTimestamp(proposedEnd),
        delayDays,
      },
    };
  }

  return null;
}
