/**
 * Approval Gate Validator
 * Checks that BAT (proof) and Plates approvals are satisfied.
 */

import type { ScheduleSnapshot, ScheduleConflict, ProposedAssignment, Job } from '@flux/types';
import { findTask, findJob } from '../utils/helpers.js';

/**
 * Validate that approval gates are satisfied for the task's job.
 */
export function validateApprovalGates(
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

  // Check BAT (proof) approval
  const batConflict = checkBatApproval(proposed.taskId, job);
  if (batConflict) {
    return batConflict;
  }

  // Check Plates approval (for printing tasks)
  // In a full implementation, we'd check if this is a printing task
  // For MVP, we check plates for all tasks
  const platesConflict = checkPlatesApproval(proposed.taskId, job);
  if (platesConflict) {
    return platesConflict;
  }

  return null;
}

/**
 * Check BAT (proof) approval status.
 */
function checkBatApproval(taskId: string, job: Job): ScheduleConflict | null {
  const { proofApproval } = job;

  // If no proof required, it's OK
  if (proofApproval.sentAt === 'NoProofRequired') {
    return null;
  }

  // If proof is approved, it's OK
  if (proofApproval.approvedAt !== null) {
    return null;
  }

  // If awaiting file, blocking
  if (proofApproval.sentAt === 'AwaitingFile') {
    return {
      type: 'ApprovalGateConflict',
      message: `Job is awaiting client file for proof`,
      taskId,
      details: {
        gate: 'BAT',
        status: 'AwaitingFile',
        jobId: job.id,
      },
    };
  }

  // If proof sent but not approved
  if (proofApproval.sentAt !== null) {
    return {
      type: 'ApprovalGateConflict',
      message: `Proof (BAT) sent but not yet approved`,
      taskId,
      details: {
        gate: 'BAT',
        status: 'Pending',
        sentAt: proofApproval.sentAt,
        jobId: job.id,
      },
    };
  }

  // Proof not sent yet
  return {
    type: 'ApprovalGateConflict',
    message: `Proof (BAT) has not been sent to client`,
    taskId,
    details: {
      gate: 'BAT',
      status: 'NotSent',
      jobId: job.id,
    },
  };
}

/**
 * Check Plates approval status.
 */
function checkPlatesApproval(taskId: string, job: Job): ScheduleConflict | null {
  // Plates must be Done
  if (job.platesStatus === 'Done') {
    return null;
  }

  return {
    type: 'ApprovalGateConflict',
    message: `Plates preparation is not complete`,
    taskId,
    details: {
      gate: 'Plates',
      status: job.platesStatus,
      jobId: job.id,
    },
  };
}
