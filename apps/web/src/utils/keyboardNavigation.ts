/**
 * Keyboard Navigation Utilities
 * Functions for job navigation and grid scrolling calculations.
 */

import type { Job, Task, LateJob, ScheduleConflict } from '@flux/types';

/**
 * Get ordered job IDs for navigation (matching JobsList display order).
 * Problems first (late jobs, then conflict jobs), then normal jobs.
 *
 * @param jobs - All jobs
 * @param tasks - All tasks
 * @param lateJobs - Late job indicators
 * @param conflicts - Schedule conflicts
 * @returns Ordered array of job IDs
 */
export function getOrderedJobIds(
  jobs: Job[],
  tasks: Task[],
  lateJobs: LateJob[],
  conflicts: ScheduleConflict[]
): string[] {
  const lateJobIds = new Set(lateJobs.map((lj) => lj.jobId));

  // Build conflict job IDs from tasks
  const conflictJobIds = new Set<string>();
  conflicts.forEach((c) => {
    const task = tasks.find((t) => t.id === c.taskId);
    if (task) conflictJobIds.add(task.jobId);
  });

  const problems: Job[] = [];
  const normal: Job[] = [];

  jobs.forEach((job) => {
    if (lateJobIds.has(job.id) || conflictJobIds.has(job.id)) {
      problems.push(job);
    } else {
      normal.push(job);
    }
  });

  // Sort problems: late first, then conflicts
  problems.sort((a, b) => {
    const aIsLate = lateJobIds.has(a.id);
    const bIsLate = lateJobIds.has(b.id);
    if (aIsLate && !bIsLate) return -1;
    if (!aIsLate && bIsLate) return 1;
    return 0;
  });

  return [...problems.map((j) => j.id), ...normal.map((j) => j.id)];
}

/**
 * Navigate to the previous job in the ordered list.
 * Wraps from first to last job.
 *
 * @param orderedJobIds - Ordered array of job IDs
 * @param currentJobId - Currently selected job ID (null if none selected)
 * @returns The job ID to select
 */
export function getPreviousJobId(
  orderedJobIds: string[],
  currentJobId: string | null
): string | null {
  if (orderedJobIds.length === 0) {
    return null;
  }

  if (!currentJobId) {
    // No job selected, select the first one
    return orderedJobIds[0];
  }

  const currentIndex = orderedJobIds.indexOf(currentJobId);
  if (currentIndex === -1) {
    // Current job not in list, select first
    return orderedJobIds[0];
  }

  if (currentIndex > 0) {
    return orderedJobIds[currentIndex - 1];
  } else {
    // Wrap around to last job
    return orderedJobIds[orderedJobIds.length - 1];
  }
}

/**
 * Navigate to the next job in the ordered list.
 * Wraps from last to first job.
 *
 * @param orderedJobIds - Ordered array of job IDs
 * @param currentJobId - Currently selected job ID (null if none selected)
 * @returns The job ID to select
 */
export function getNextJobId(
  orderedJobIds: string[],
  currentJobId: string | null
): string | null {
  if (orderedJobIds.length === 0) {
    return null;
  }

  if (!currentJobId) {
    // No job selected, select the first one
    return orderedJobIds[0];
  }

  const currentIndex = orderedJobIds.indexOf(currentJobId);
  if (currentIndex === -1) {
    // Current job not in list, select first
    return orderedJobIds[0];
  }

  if (currentIndex < orderedJobIds.length - 1) {
    return orderedJobIds[currentIndex + 1];
  } else {
    // Wrap around to first job
    return orderedJobIds[0];
  }
}

/**
 * Calculate scroll position to show a time at the bottom of the viewport.
 *
 * @param yPosition - Y position of the target time
 * @param viewportHeight - Height of the viewport
 * @param bottomMargin - Margin from the bottom (default: 100px)
 * @returns The scroll position (clamped to non-negative)
 */
export function calculateScrollToBottom(
  yPosition: number,
  viewportHeight: number,
  bottomMargin: number = 100
): number {
  return Math.max(0, yPosition - viewportHeight + bottomMargin);
}

/**
 * Calculate scroll position to center a time in the viewport.
 *
 * @param yPosition - Y position of the target time
 * @param viewportHeight - Height of the viewport
 * @returns The scroll position (clamped to non-negative)
 */
export function calculateScrollToCenter(
  yPosition: number,
  viewportHeight: number
): number {
  return Math.max(0, yPosition - viewportHeight / 2);
}
