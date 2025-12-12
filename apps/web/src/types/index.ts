// ============================================
// Domain Types for Flux Print Shop Scheduling System
// ============================================

// Status enums
export type StationStatus = 'Available' | 'InUse' | 'Maintenance' | 'OutOfService';
export type ProviderStatus = 'Active' | 'Inactive';
export type JobStatus = 'Draft' | 'Planned' | 'InProgress' | 'Delayed' | 'Completed' | 'Cancelled';
export type TaskStatus = 'Defined' | 'Ready' | 'Assigned' | 'Executing' | 'Completed' | 'Failed' | 'Cancelled';
export type TaskType = 'internal' | 'outsourced';
export type PaperPurchaseStatus = 'InStock' | 'ToOrder' | 'Ordered' | 'Received';
export type PlatesStatus = 'Todo' | 'Done';
export type ScheduleExceptionType = 'Closed' | 'ModifiedHours';
export type ConflictType =
  | 'StationConflict'
  | 'GroupCapacityConflict'
  | 'PrecedenceConflict'
  | 'ApprovalGateConflict'
  | 'AvailabilityConflict'
  | 'DeadlineConflict';
export type ConflictSeverity = 'High' | 'Medium' | 'Low';

// Time slot type
export interface TimeSlot {
  start: string; // HH:MM or ISO-8601 datetime
  end: string;   // HH:MM or ISO-8601 datetime
}

// Day schedule for weekly pattern
export interface DaySchedule {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  timeSlots: TimeSlot[];
}

// Operating schedule for stations
export interface OperatingSchedule {
  weeklyPattern: DaySchedule[];
}

// Schedule exception (holiday, maintenance, etc.)
export interface ScheduleException {
  id: string;
  stationId: string;
  date: string; // YYYY-MM-DD
  type: ScheduleExceptionType;
  reason: string;
  modifiedSlots?: TimeSlot[];
}

// Similarity criterion for station categories
export interface SimilarityCriterion {
  code: string;
  name: string;
}

// Station category (e.g., "Offset Printing Press")
export interface StationCategory {
  id: string;
  name: string;
  similarityCriteria: SimilarityCriterion[];
}

// Station group (e.g., "Offset Presses" with concurrency limit)
export interface StationGroup {
  id: string;
  name: string;
  maxConcurrent: number | null; // null = unlimited
  isOutsourcedProviderGroup: boolean;
}

// Station (e.g., "Komori G37")
export interface Station {
  id: string;
  name: string;
  categoryId: string;
  groupId: string | null;
  capacity: number;
  status: StationStatus;
  operatingSchedule: OperatingSchedule;
  exceptions: ScheduleException[];
}

// Outsourced provider (e.g., "Clément" for pelliculage)
export interface OutsourcedProvider {
  id: string;
  name: string;
  supportedActionTypes: string[];
  groupId: string;
  status: ProviderStatus;
}

// Task (internal or outsourced)
export interface Task {
  id: string;
  jobId: string;
  sequenceOrder: number;
  type: TaskType;
  // Internal task fields
  stationId: string | null;
  stationName: string | null;
  setupMinutes: number;
  runMinutes: number;
  totalMinutes: number;
  // Outsourced task fields
  providerId: string | null;
  providerName: string | null;
  actionType: string | null;
  durationOpenDays: number | null;
  // Common fields
  comment: string | null;
  status: TaskStatus;
  rawInput: string; // Original DSL line
}

// Job comment
export interface JobComment {
  author: string;
  timestamp: string; // ISO-8601
  content: string;
}

// Job (print job)
export interface Job {
  id: string;
  reference: string;
  client: string;
  description: string;
  workshopExitDate: string; // ISO-8601 datetime
  status: JobStatus;
  fullyScheduled: boolean;
  color: string; // Hex color for UI
  // Paper tracking
  paperType: string | null;
  paperFormat: string | null;
  paperPurchaseStatus: PaperPurchaseStatus;
  paperOrderedAt: string | null;
  // Approval gates
  proofSentAt: string | null; // ISO-8601 or "AwaitingFile" or "NoProofRequired"
  proofApprovedAt: string | null;
  platesStatus: PlatesStatus;
  // Notes and comments
  notes: string;
  comments: JobComment[];
  // Dependencies
  dependencies: string[]; // Job IDs
  // Tasks
  tasks: Task[];
}

// Assignment (task scheduled on station/provider)
export interface Assignment {
  id: string;
  taskId: string;
  jobId: string;
  stationId: string; // Station or Provider ID
  scheduledStart: string; // ISO-8601 datetime
  scheduledEnd: string;   // ISO-8601 datetime
}

// Schedule conflict
export interface ScheduleConflict {
  type: ConflictType;
  affectedTaskIds: string[];
  description: string;
  severity: ConflictSeverity;
}

// Late job info
export interface LateJob {
  jobId: string;
  reference: string;
  workshopExitDate: string;
  expectedCompletion: string;
  delayHours: number;
}

// Schedule snapshot for client-side rendering
export interface ScheduleSnapshot {
  snapshotVersion: number;
  generatedAt: string;
  stations: Station[];
  providers: OutsourcedProvider[];
  categories: StationCategory[];
  groups: StationGroup[];
  jobs: Job[];
  assignments: Assignment[];
  conflicts: ScheduleConflict[];
  lateJobs: LateJob[];
}

// Proposed assignment for drag & drop
export interface ProposedAssignment {
  taskId: string;
  stationId: string;
  scheduledStart: string;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  conflicts: ScheduleConflict[];
  warnings?: Array<{
    type: string;
    description: string;
  }>;
}

// DSL parsing types
export interface DSLParseError {
  line: number;
  message: string;
  rawInput: string;
}

export interface DSLParseResult {
  valid: boolean;
  tasks: Omit<Task, 'id' | 'jobId' | 'status'>[];
  errors: DSLParseError[];
}

export interface AutocompleteSuggestion {
  value: string;
  label: string;
}

// UI state types
export interface SelectedTask {
  taskId: string;
  task: Task;
  job?: Job;
  assignment?: Assignment;
}

// CRUD DTOs

// Station DTOs
export interface CreateStationDto {
  name: string;
  categoryId: string;
  groupId: string | null;
  capacity: number;
  operatingSchedule: OperatingSchedule;
}

export interface UpdateStationDto {
  name?: string;
  categoryId?: string;
  groupId?: string | null;
  capacity?: number;
  status?: StationStatus;
  operatingSchedule?: OperatingSchedule;
}

// Station Category DTOs
export interface CreateStationCategoryDto {
  name: string;
  similarityCriteria: SimilarityCriterion[];
}

export interface UpdateStationCategoryDto {
  name?: string;
  similarityCriteria?: SimilarityCriterion[];
}

// Station Group DTOs
export interface CreateStationGroupDto {
  name: string;
  maxConcurrent: number | null;
}

export interface UpdateStationGroupDto {
  name?: string;
  maxConcurrent?: number | null;
}

// Provider DTOs
export interface CreateProviderDto {
  name: string;
  supportedActionTypes: string[];
}

export interface UpdateProviderDto {
  name?: string;
  supportedActionTypes?: string[];
  status?: ProviderStatus;
}

// Schedule Exception DTOs
export interface CreateScheduleExceptionDto {
  stationId: string;
  date: string;
  type: ScheduleExceptionType;
  reason: string;
  modifiedSlots?: TimeSlot[];
}

// Job DTOs
export interface CreateJobDto {
  reference: string;
  client: string;
  description: string;
  workshopExitDate: string;
  paperType?: string;
  paperFormat?: string;
  paperPurchaseStatus?: PaperPurchaseStatus;
  notes?: string;
  tasksDSL?: string;
}

export interface UpdateJobDto {
  reference?: string;
  client?: string;
  description?: string;
  workshopExitDate?: string;
  status?: JobStatus;
  paperType?: string;
  paperFormat?: string;
  paperPurchaseStatus?: PaperPurchaseStatus;
  notes?: string;
}

export interface UpdateProofStatusDto {
  proofSentAt?: string; // ISO-8601 or "AwaitingFile" or "NoProofRequired"
  proofApprovedAt?: string;
}

export interface UpdatePlatesStatusDto {
  platesStatus: PlatesStatus;
}

export interface AddJobCommentDto {
  content: string;
}

// Task DTOs
export interface ReorderTasksDto {
  taskOrder: string[];
}
