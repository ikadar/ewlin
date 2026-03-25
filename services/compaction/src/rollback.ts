import type { ScheduleSnapshot, TaskAssignment } from '@flux/types';
import {
  findJob,
  findElement,
  findTask,
  parseTimestamp,
} from '@flux/schedule-validator';
import type { StationAnalysis } from './types.js';
import { compactAllStations, mutateSnapshot } from './timeline.js';

// ============================================================================
// Get job's latest end time from current snapshot
// ============================================================================

export function getJobLastEndTime(
  jobId: string,
  snapshot: ScheduleSnapshot,
): Date | null {
  let latest: Date | null = null;

  // Find all elements for this job
  const elements = snapshot.elements.filter(e => e.jobId === jobId);
  const taskIds = new Set<string>();
  for (const el of elements) {
    for (const tid of el.taskIds) {
      taskIds.add(tid);
    }
  }

  // Find latest scheduledEnd among assignments for these tasks
  for (const a of snapshot.assignments) {
    if (taskIds.has(a.taskId)) {
      const end = parseTimestamp(a.scheduledEnd);
      if (latest === null || end > latest) {
        latest = end;
      }
    }
  }

  return latest;
}

// ============================================================================
// Get job's latest end time from original assignments
// ============================================================================

function getJobLastEndTimeFromOriginal(
  jobId: string,
  originalAssignments: Map<string, TaskAssignment>,
  snapshot: ScheduleSnapshot,
): Date | null {
  let latest: Date | null = null;

  const elements = snapshot.elements.filter(e => e.jobId === jobId);
  const taskIds = new Set<string>();
  for (const el of elements) {
    for (const tid of el.taskIds) {
      taskIds.add(tid);
    }
  }

  for (const [taskId, a] of originalAssignments) {
    if (taskIds.has(taskId)) {
      const end = parseTimestamp(a.scheduledEnd);
      if (latest === null || end > latest) {
        latest = end;
      }
    }
  }

  return latest;
}

// ============================================================================
// Parse deadline (workshopExitDate at 14:00)
// ============================================================================

function parseDeadline(workshopExitDate: string): Date {
  const date = new Date(workshopExitDate);
  date.setHours(14, 0, 0, 0);
  return date;
}

// ============================================================================
// Validate and rollback
// ============================================================================

export function validateAndRollback(
  snapshot: ScheduleSnapshot,
  originalAssignments: Map<string, TaskAssignment>,
  analyses: StationAnalysis[],
  now: Date,
  horizonEnd: Date,
): number {
  // Build task → job mapping
  const taskToJobId = new Map<string, string>();
  for (const element of snapshot.elements) {
    for (const taskId of element.taskIds) {
      taskToJobId.set(taskId, element.jobId);
    }
  }

  // Find jobs with moved tiles
  const movedJobIds = new Set<string>();
  for (const a of snapshot.assignments) {
    const orig = originalAssignments.get(a.taskId);
    if (orig && orig.scheduledStart !== a.scheduledStart) {
      const jobId = taskToJobId.get(a.taskId);
      if (jobId) movedJobIds.add(jobId);
    }
  }

  // Check if any moved job became late
  const jobsToRollback = new Set<string>();
  for (const jobId of movedJobIds) {
    const job = findJob(snapshot, jobId);
    if (!job?.workshopExitDate) continue;

    const deadline = parseDeadline(job.workshopExitDate);
    const originalEnd = getJobLastEndTimeFromOriginal(jobId, originalAssignments, snapshot);
    const currentEnd = getJobLastEndTime(jobId, snapshot);

    if (!originalEnd || !currentEnd) continue;

    const wasOnTime = originalEnd <= deadline;
    const isNowLate = currentEnd > deadline;

    if (wasOnTime && isNowLate) {
      jobsToRollback.add(jobId);
    }
  }

  if (jobsToRollback.size === 0) return 0;

  // Rollback: restore original assignments for all tasks of rolled-back jobs
  let rollbackCount = 0;
  for (const jobId of jobsToRollback) {
    const elements = snapshot.elements.filter(e => e.jobId === jobId);
    for (const el of elements) {
      for (const taskId of el.taskIds) {
        const orig = originalAssignments.get(taskId);
        if (!orig) continue;

        const current = snapshot.assignments.find(a => a.taskId === taskId);
        if (!current || current.scheduledStart === orig.scheduledStart) continue;

        mutateSnapshot(snapshot, taskId, orig.scheduledStart, orig.scheduledEnd);
        rollbackCount++;
      }
    }
  }

  // Re-compact after rollbacks
  if (rollbackCount > 0) {
    compactAllStations(analyses, snapshot, now, horizonEnd);
  }

  return rollbackCount;
}
