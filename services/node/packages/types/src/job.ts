/**
 * Job Types
 * A job is a complete print order consisting of sequential tasks.
 */

/** Status of a job */
export type JobStatus = 'Draft' | 'Planned' | 'InProgress' | 'Delayed' | 'Completed' | 'Cancelled';

/** Paper purchase status for a job */
export type PaperPurchaseStatus = 'InStock' | 'ToOrder' | 'Ordered' | 'Received';

/** Plates preparation status */
export type PlatesStatus = 'Todo' | 'Done';

/** Special values for proof sent date */
export type ProofSentStatus = 'AwaitingFile' | 'NoProofRequired';

/** A comment on a job */
export interface JobComment {
  id: string;
  author: string;
  /** ISO timestamp */
  timestamp: string;
  content: string;
}

/** Approval gate status for BAT (proof) */
export interface ProofApprovalGate {
  /** Date proof sent (ISO string) or special status */
  sentAt: ProofSentStatus | (string & {}) | null;
  /** Date proof approved (ISO string) or null */
  approvedAt: string | null;
}

/** A complete print order */
export interface Job {
  id: string;
  /** Order reference (user-manipulated for order lines/parts) */
  reference: string;
  /** Customer name */
  client: string;
  /** Product description */
  description: string;
  /** Current job status */
  status: JobStatus;
  /** Date job must leave the factory (ISO date string) */
  workshopExitDate: string;
  /** Whether all tasks are scheduled */
  fullyScheduled: boolean;
  /** Assigned color for UI (hex string, e.g., "#3B82F6") */
  color: string;
  /** Paper type and weight (e.g., "CB300") */
  paperType?: string;
  /** Paper dimensions (e.g., "63x88") */
  paperFormat?: string;
  /** Paper purchase status */
  paperPurchaseStatus: PaperPurchaseStatus;
  /** When paper was ordered (ISO timestamp) */
  paperOrderedAt?: string;
  /** Proof (BAT) approval gate */
  proofApproval: ProofApprovalGate;
  /** Plates preparation status */
  platesStatus: PlatesStatus;
  /** Job IDs that must complete before this job can start */
  requiredJobIds: string[];
  /** Comments thread */
  comments: JobComment[];
  /** Free-form notes */
  notes?: string;
  /** Task IDs in execution order */
  taskIds: string[];
  /** Creation timestamp (ISO) */
  createdAt: string;
  /** Last update timestamp (ISO) */
  updatedAt: string;
}
