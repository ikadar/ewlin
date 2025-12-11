// ============================================
// Domain Types for Operations Research System
// ============================================

// Status enums
export type OperatorStatus = 'Active' | 'Inactive' | 'Deactivated';
export type EquipmentStatus = 'Available' | 'InUse' | 'Maintenance' | 'OutOfService';
export type JobStatus = 'Draft' | 'Planned' | 'InProgress' | 'Delayed' | 'Completed' | 'Cancelled';
export type TaskStatus = 'Defined' | 'Ready' | 'Assigned' | 'Executing' | 'Completed' | 'Failed' | 'Cancelled';
export type SkillLevel = 'beginner' | 'intermediate' | 'expert';
export type ConflictType = 'ResourceConflict' | 'AvailabilityConflict' | 'DependencyConflict' | 'DeadlineConflict' | 'SkillConflict';

// Time slot type
export interface TimeSlot {
  start: string; // ISO-8601 datetime
  end: string;   // ISO-8601 datetime
}

// Operator types
export interface OperatorSkill {
  equipmentId: string;
  level: SkillLevel;
}

export interface Operator {
  id: string;
  name: string;
  status: OperatorStatus;
  availability: TimeSlot[];
  skills: OperatorSkill[];
}

// Equipment types
export interface Equipment {
  id: string;
  name: string;
  status: EquipmentStatus;
  supportedTaskTypes: string[];
  location: string;
  maintenanceWindows: TimeSlot[];
}

// Job types
export interface Job {
  id: string;
  name: string;
  description: string;
  deadline: string; // ISO-8601 datetime
  status: JobStatus;
}

// Task types
export interface Task {
  id: string;
  jobId: string;
  type: string;
  duration: number; // minutes
  requiresOperator: boolean;
  requiresEquipment: boolean;
  dependencies: string[]; // task IDs
  status: TaskStatus;
}

// Assignment types
export interface Assignment {
  id: string;
  taskId: string;
  operatorId: string | null;
  equipmentId: string | null;
  scheduledStart: string; // ISO-8601 datetime
  scheduledEnd: string;   // ISO-8601 datetime
}

// Schedule conflict types
export interface ScheduleConflict {
  type: ConflictType;
  resource: string;
  tasks: string[];
  message: string;
  overlapStart?: string;
  overlapEnd?: string;
}

// Schedule snapshot for client-side validation
export interface ScheduleSnapshot {
  assignments: Assignment[];
  operators: Operator[];
  equipment: Equipment[];
  tasks: Task[];
  jobs: Job[];
  snapshotVersion: number;
  generatedAt: string;
}

// Proposed assignment for drag & drop
export interface ProposedAssignment {
  taskId: string;
  operatorId?: string | null;
  equipmentId?: string | null;
  scheduledStart: string;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  conflicts: ScheduleConflict[];
}

// Grid view types
export type GridViewType = 'equipment' | 'operator';

// UI state types
export interface SelectedTask {
  taskId: string;
  task: Task;
  assignment?: Assignment;
}

// CRUD DTOs
export interface CreateOperatorDto {
  name: string;
  availability: TimeSlot[];
  skills: OperatorSkill[];
}

export interface UpdateOperatorDto {
  name?: string;
  status?: OperatorStatus;
  availability?: TimeSlot[];
  skills?: OperatorSkill[];
}

export interface CreateEquipmentDto {
  name: string;
  supportedTaskTypes: string[];
  location: string;
}

export interface UpdateEquipmentDto {
  name?: string;
  status?: EquipmentStatus;
  supportedTaskTypes?: string[];
  location?: string;
}

export interface CreateJobDto {
  name: string;
  description: string;
  deadline: string;
}

export interface UpdateJobDto {
  name?: string;
  description?: string;
  deadline?: string;
  status?: JobStatus;
}

export interface CreateTaskDto {
  type: string;
  duration: number;
  requiresOperator: boolean;
  requiresEquipment: boolean;
  dependencies: string[];
}
