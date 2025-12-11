# Aggregate / Service / Repository Design – Operations Research System

This document defines **aggregate structures**, their **invariants**, and the supporting **services** and **repositories** for the Equipment → Operator → Job → Task assignment and validation domain.

It is a *technology‑agnostic* design reference used during Solution Design & Architecture.

---

## 1. Aggregates Overview

### 1.1 Operator Aggregate

**Purpose**  
Represents a human resource who can operate equipment and be assigned to tasks, maintaining their skills, certifications, and availability schedule.

**Invariants**  
- An operator must have at least one availability slot to be Active
- Availability slots cannot overlap for the same operator
- Skill levels must be one of: beginner, intermediate, expert
- An operator cannot be deactivated while assigned to executing tasks

**Entities and Value Objects**  
- **Aggregate Root:** Operator
- **Entities:** None (skills and availability are value objects)
- **Value Objects:** OperatorSkill, TimeSlot

**Creation Rules**  
- An operator is created in `Active` state with a unique name
- Initial availability can be empty but must be set before assignment
- Skills are optional at creation

**State Transitions (Behaviour)**  
- `RegisterOperator`
- `UpdateAvailability`
- `AddEquipmentSkill`
- `RemoveEquipmentSkill` 
- `DeactivateOperator` (only if no active assignments)
- `ReactivateOperator`

**Events**  
- `OperatorRegistered`
- `OperatorAvailabilityChanged`
- `OperatorSkillAdded`
- `OperatorSkillRemoved`
- `OperatorDeactivated`
- `OperatorReactivated`

**Boundaries and External Interaction**  
- Only the OperatorRepository may load/save Operators
- External systems may query skills and availability but cannot modify directly
- Assignment validation happens outside this aggregate

---

### 1.2 Equipment Aggregate

**Purpose**  
Represents a physical resource that can be assigned to tasks, tracking its operational status, supported task types, and maintenance schedule.

**Invariants**
- Equipment must support at least one task type
- Status transitions must follow the state machine:
  - Available ↔ InUse (task assignment/completion)
  - Available → Maintenance → Available (scheduled maintenance)
  - InUse → Maintenance (emergency maintenance)
  - Any → OutOfService (permanent/long-term unavailability)
- Equipment cannot be scheduled for maintenance while InUse (except emergency)
- Maintenance windows cannot overlap

**Entities and Value Objects**  
- **Aggregate Root:** Equipment
- **Entities:** MaintenanceWindow (tracked separately but referenced)
- **Value Objects:** Location

**Creation Rules**  
- Equipment is created in `Available` state
- Must specify supported task types at creation
- Location is optional

**State Transitions (Behaviour)**  
- `RegisterEquipment`
- `ScheduleMaintenance` (only if Available)
- `StartMaintenance`
- `CompleteMaintenance`
- `ReportBreakdown` (transitions to OutOfService)
- `RepairEquipment` (returns to Available)
- `UpdateLocation`

**Events**  
- `EquipmentRegistered`
- `MaintenanceScheduled`
- `MaintenanceStarted`
- `MaintenanceCompleted`
- `EquipmentBreakdownReported`
- `EquipmentRepaired`
- `EquipmentLocationUpdated`

**Boundaries and External Interaction**  
- Only EquipmentRepository persists Equipment
- Maintenance scheduling requires coordination with Assignment Service
- Status changes trigger revalidation of affected assignments

---

### 1.3 Job Aggregate

**Purpose**  
Represents a production job containing multiple tasks with dependencies, managing the overall workflow and deadline constraints.

**Invariants**
- A job must contain at least one task
- Task dependencies must form a directed acyclic graph (no cycles)
- Job deadline must be after all task durations on critical path
- Status progression: Draft → Planned → InProgress ↔ Delayed → Completed | Cancelled
- Tasks can only be added in Draft state
- Dependencies can only be set in Draft/Planned states
- Job can be cancelled from Draft, Planned, InProgress, or Delayed states

**Entities and Value Objects**  
- **Aggregate Root:** Job
- **Entities:** Task (within aggregate boundary)
- **Value Objects:** Duration, TaskDependency

**Creation Rules**  
- Job is created in `Draft` state with name and deadline
- Tasks are added incrementally
- Dependencies are validated for cycles on each addition

**State Transitions (Behaviour)**  
- `CreateJob`
- `AddTask` (only in Draft)
- `RemoveTask` (only in Draft)
- `SetTaskDependency`
- `RemoveTaskDependency`
- `PlanJob` (validates completeness)
- `StartJob` (when first task starts)
- `CompleteJob` (when all tasks complete)
- `DelayJob` (when deadline at risk)
- `CancelJob` (cancels job and cascades to tasks)

**Events**
- `JobCreated`
- `TaskAddedToJob`
- `TaskRemovedFromJob`
- `TaskDependencySet`
- `TaskDependencyRemoved`
- `JobPlanned`
- `JobStarted`
- `JobCompleted`
- `JobDelayed`
- `JobCancelled`

**Boundaries and External Interaction**  
- Only JobRepository loads/saves Jobs
- Task assignment happens in separate Assignment aggregate
- Critical path calculation is internal to aggregate

---

### 1.4 Schedule Aggregate

**Purpose**  
Represents the master schedule containing all task assignments with their timings, maintaining consistency and detecting conflicts.

**Invariants**  
- No resource (operator/equipment) can be double-booked
- Task assignments must respect operator skills for equipment
- Dependent tasks cannot start before prerequisites complete
- All assignments must fit within resource availability windows
- Scheduled end time = scheduled start time + task duration

**Entities and Value Objects**  
- **Aggregate Root:** Schedule
- **Entities:** None (assignments are value objects)
- **Value Objects:** ValidatedAssignment, ScheduleConflict, TimeRange

**Creation Rules**  
- Schedule is created empty or from a previous version
- Assignments are added and validated incrementally
- Version number increments on each change

**State Transitions (Behaviour)**  
- `CreateSchedule`
- `AssignTask` (validates all constraints)
- `UnassignTask`
- `RescheduleTask`
- `ValidateSchedule` (full revalidation)
- `PublishSchedule` (locks version)
- `CreateNewVersion` (for updates)

**Events**  
- `ScheduleCreated`
- `TaskAssigned`
- `TaskUnassigned`
- `TaskRescheduled`
- `ConflictDetected`
- `ScheduleValidated`
- `SchedulePublished`

**Boundaries and External Interaction**  
- Only ScheduleRepository persists Schedules
- Requires read access to Job, Operator, Equipment aggregates
- Publishes events for downstream execution tracking

---

### 1.5 TaskExecution Aggregate

**Purpose**  
Tracks the actual execution of assigned tasks, capturing real-time progress, variances, and quality results.

**Invariants**  
- Execution can only start for Assigned tasks
- Actual start must be within ±15 minutes of scheduled start (configurable)
- Task cannot be completed without being started
- Quality checks are immutable once recorded

**Entities and Value Objects**  
- **Aggregate Root:** TaskExecution
- **Entities:** None
- **Value Objects:** ActualTiming, ExecutionVariance, QualityCheckResult

**Creation Rules**  
- Created when task is assigned
- References task ID and assignment details
- Initial state is `Pending`

**State Transitions (Behaviour)**  
- `CreateExecution` (from assignment)
- `StartExecution` (with actual start time)
- `RecordProgress` (optional progress updates)
- `RecordQualityCheck`
- `CompleteExecution` (with actual end time)
- `AbortExecution` (for failures)

**Events**  
- `ExecutionCreated`
- `TaskStarted`
- `ProgressRecorded`
- `QualityCheckRecorded`
- `TaskCompleted`
- `TaskAborted`
- `VarianceDetected`

**Boundaries and External Interaction**  
- Only TaskExecutionRepository manages executions
- Triggers job state updates via events
- May integrate with external time tracking systems

---

## 2. Domain Services

### SchedulingService
Responsible for:
- Complex scheduling algorithms
- Optimization of resource allocation
- Critical path calculations
- Conflict resolution strategies

### ValidationService
Responsible for:
- Cross-aggregate validation rules
- Dependency graph analysis
- Availability checking across time ranges
- Skill matching validation

### NotificationService
Responsible for:
- Assignment notifications to operators
- Conflict alerts to schedulers
- Deadline warnings
- Status change notifications

---

## 3. Repositories (Interface-Level)

Each aggregate exposes one repository interface:

### OperatorRepository
- `save(Operator $operator)`
- `get(OperatorId $id)`
- `findBySkill(EquipmentId $equipmentId, SkillLevel $minLevel)`
- `findAvailableBetween(DateTime $start, DateTime $end)`

### EquipmentRepository
- `save(Equipment $equipment)`
- `get(EquipmentId $id)`
- `findByTaskType(TaskType $type)`
- `findAvailableBetween(DateTime $start, DateTime $end)`

### JobRepository
- `save(Job $job)`
- `get(JobId $id)`
- `findByStatus(JobStatus $status)`
- `findByDeadlineBefore(DateTime $deadline)`

### ScheduleRepository
- `save(Schedule $schedule)`
- `get(ScheduleId $id)`
- `getCurrentVersion()`
- `findConflictsForResource(ResourceId $id, TimeRange $range)`

### TaskExecutionRepository
- `save(TaskExecution $execution)`
- `get(TaskId $taskId)`
- `findByStatus(ExecutionStatus $status)`
- `findWithVarianceAbove(int $thresholdMinutes)`

Repositories are defined at the **domain/interface level**, not as infrastructure implementations.

---

## 4. Consistency Boundaries

### Within Aggregate (Strong Consistency)
- All invariants enforced immediately
- Single transaction boundary
- No eventual consistency

### Across Aggregates (Eventual Consistency)
- Coordination through domain events
- Process managers for complex workflows
- Compensating actions for failures

### Read Model Consistency
- CQRS pattern for complex queries
- Eventually consistent projections
- Separate optimization for read vs write

---

## 5. Concurrency and Locking

### Optimistic Locking
- Version field on Schedule aggregate
- Conflict detection on concurrent updates
- Retry strategies for conflicts

### Aggregate Size Considerations
- Keep aggregates small for less contention
- Job aggregate includes tasks but not assignments
- Schedule aggregate uses versioning for updates

---

## 6. Notes

- Aggregates are designed for high concurrency environments
- Each aggregate maintains strong consistency internally
- Cross-aggregate workflows use domain events and eventual consistency
- The Schedule aggregate is the central coordination point for assignments
- Execution tracking is separate to avoid impacting planning performance
