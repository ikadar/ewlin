import type { ScheduleSnapshot, TaskAssignment } from '@flux/types';
import {
  findJob,
  findElement,
  findTask,
  parseTimestamp,
  validateAssignment,
  formatTimestamp,
} from '@flux/schedule-validator';
import type { StationAnalysis } from './types.js';
import { mutateSnapshot } from './timeline.js';

// ============================================================================
// Get job's latest end time from current snapshot
// ============================================================================

export function getJobLastEndTime(
  jobId: string,
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

  const jobsToRollback = new Set<string>();

  for (const jobId of movedJobIds) {
    const job = findJob(snapshot, jobId);
    if (!job?.workshopExitDate) continue;

    // Check 1: on-time → late regression
    const deadline = parseDeadline(job.workshopExitDate);
    const originalEnd = getJobLastEndTimeFromOriginal(jobId, originalAssignments, snapshot);
    const currentEnd = getJobLastEndTime(jobId, snapshot);

    if (originalEnd && currentEnd) {
      const wasOnTime = originalEnd <= deadline;
      const isNowLate = currentEnd > deadline;
      if (wasOnTime && isNowLate) {
        jobsToRollback.add(jobId);
        continue;
      }
    }

    // Check 2: validate every moved assignment for this job.
    // If ANY has a NEW conflict (PrecedenceConflict, StationConflict, etc.),
    // rollback the entire job.
    const elements = snapshot.elements.filter(e => e.jobId === jobId);
    const jobTaskIds = new Set<string>();
    for (const el of elements) {
      for (const tid of el.taskIds) {
        jobTaskIds.add(tid);
      }
    }

    let hasNewConflict = false;
    for (const a of snapshot.assignments) {
      if (!jobTaskIds.has(a.taskId)) continue;

      const orig = originalAssignments.get(a.taskId);
      // Only validate tiles that moved or whose neighbors moved
      const task = findTask(snapshot, a.taskId);
      if (!task) continue;

      const result = validateAssignment(
        {
          taskId: a.taskId,
          targetId: a.targetId,
          isOutsourced: a.isOutsourced,
          scheduledStart: a.scheduledStart,
        },
        snapshot,
      );

      if (result.conflicts.length > 0) {
        // Check if these conflicts are NEW (didn't exist with original positions)
        // Quick check: if the assignment didn't move, the conflict is from
        // a NEIGHBOR that moved — still caused by compaction
        const blocking = result.conflicts.filter(
          c => c.type !== 'ApprovalGateConflict' && c.type !== 'DeadlineConflict'
        );
        if (blocking.length > 0) {
          hasNewConflict = true;
          break;
        }
      }
    }

    if (hasNewConflict) {
      jobsToRollback.add(jobId);
    }
  }

  if (jobsToRollback.size === 0) return 0;

  // Any conflict means partial rollback would create mixed state (some tiles
  // at original, some at compacted positions on the same station → overlaps).
  // Revert ALL moved tiles, not just the affected jobs.
  let rollbackCount = 0;
  for (const a of snapshot.assignments) {
    const orig = originalAssignments.get(a.taskId);
    if (!orig) continue;
    if (a.scheduledStart === orig.scheduledStart && a.scheduledEnd === orig.scheduledEnd) continue;

    mutateSnapshot(snapshot, a.taskId, orig.scheduledStart, orig.scheduledEnd);
    rollbackCount++;
  }

  // Do NOT re-compact after rollback — the original positions were conflict-free.

  return rollbackCount;
}
