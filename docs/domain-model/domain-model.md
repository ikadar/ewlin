# Domain Model – Operations Research System

This domain model describes the core entities, value objects, and aggregates involved in the **Equipment → Operator → Job → Task** assignment and validation process.

## Aggregates and Root Entities

### Operator (Aggregate Root)
- **Identifier:** `OperatorId`
- **Responsibilities:**
  - Represents a worker who can operate equipment and perform tasks.
  - Manages their own availability schedule and equipment skills.
  - Ensures no double-booking of the operator's time.
- **Key attributes:**
  - `OperatorId` (value object)
  - `Name`
  - `AvailabilitySlots` (collection of TimeSlot value objects)
  - `Skills` (collection of EquipmentSkill value objects)
  - `Status` (Active, Inactive)

### Equipment (Aggregate Root)
- **Identifier:** `EquipmentId`
- **Responsibilities:**
  - Represents a physical machine or tool used in manufacturing.
  - Defines which task types it can perform.
  - Ensures exclusive assignment (one task at a time).
- **Key attributes:**
  - `EquipmentId` (value object)
  - `Name`
  - `SupportedTaskTypes` (collection of TaskType value objects)
  - `Status` (Available, InUse, Maintenance, OutOfService)

### Job (Aggregate Root)
- **Identifier:** `JobId`
- **Responsibilities:**
  - Represents a complete manufacturing order with a deadline.
  - Contains and manages the lifecycle of its tasks.
  - Validates task dependencies form a valid DAG.
  - Ensures all tasks complete before the job deadline.
- **Key attributes:**
  - `JobId` (value object)
  - `Name`
  - `Deadline` (DateTime)
  - `Tasks` (collection of Task entities)
  - `Status` (Draft, Planned, InProgress, Delayed, Completed, Cancelled)
  - `CreatedAt` (DateTime)

### Task (Entity within Job Aggregate)
- **Identifier:** `TaskId`
- **Responsibilities:**
  - Represents a specific manufacturing operation within a job.
  - Maintains its dependencies on other tasks.
  - Tracks its resource assignments and schedule.
- **Key attributes:**
  - `TaskId` (value object)
  - `Type` (TaskType value object)
  - `Duration` (Duration value object)
  - `RequiresOperator` (boolean)
  - `RequiresEquipment` (boolean)
  - `RequiredTaskIds` (collection of TaskId references)
  - `Assignment` (TaskAssignment value object, nullable)

### Schedule (Aggregate Root)
- **Identifier:** `ScheduleId`
- **Responsibilities:**
  - Represents the master schedule containing all assignments.
  - Validates no resource conflicts exist.
  - Ensures all constraints are satisfied.
  - Provides conflict detection and resolution information.
- **Key attributes:**
  - `ScheduleId` (value object)
  - `Assignments` (collection of validated assignments)
  - `ConflictReports` (collection of ScheduleConflict value objects)
  - `LastValidatedAt` (DateTime)
  - `Version` (for optimistic locking)

---

## Value Objects

### OperatorId / EquipmentId / JobId / TaskId / ScheduleId
- **Fields:**
  - `Value` (UUID or string)
- **Rules:**
  - Immutable once created.

### TimeSlot
- **Fields:**
  - `StartTime` (DateTime)
  - `EndTime` (DateTime)
- **Rules:**
  - StartTime must be before EndTime.
  - Represents operator availability periods.

### EquipmentSkill
- **Fields:**
  - `EquipmentId` (reference)
  - `SkillLevel` (enum: Beginner, Intermediate, Expert)
- **Rules:**
  - Skill level determines operator capability for equipment.

### TaskType
- **Fields:**
  - `Code` (string)
  - `Description` (string)
- **Rules:**
  - Defines the category of work to be performed.

### Duration
- **Fields:**
  - `Minutes` (integer)
- **Rules:**
  - Must be positive (> 0).

### TaskAssignment
- **Fields:**
  - `AssignedOperatorId` (nullable)
  - `AssignedEquipmentId` (nullable)
  - `ScheduledStart` (DateTime)
  - `ScheduledEnd` (DateTime)
- **Rules:**
  - If task requires operator, AssignedOperatorId must be set.
  - If task requires equipment, AssignedEquipmentId must be set.
  - ScheduledEnd = ScheduledStart + Task.Duration.

### ScheduleConflict
- **Fields:**
  - `Type` (enum: ResourceConflict, AvailabilityConflict, DependencyConflict, DeadlineConflict, SkillConflict)
  - `AffectedTaskIds` (collection)
  - `Description` (string)
  - `Severity` (High, Medium, Low)

### JobStatus
- **Allowed values:** Draft, Planned, InProgress, Delayed, Completed, Cancelled
- Represents the lifecycle state of a Job.

### EquipmentStatus
- **Allowed values:** Available, InUse, Maintenance, OutOfService
- Represents the operational state of Equipment.

### TaskStatus
- **Allowed values:** Defined, Ready, Assigned, Executing, Completed, Failed, Cancelled
- Represents the lifecycle state of a Task within a Job.

### OperatorStatus
- **Allowed values:** Active, Inactive, Deactivated
- Represents the availability state of an Operator.

---

## Relationships and Invariants

### Within Aggregates

- A **Job** owns its **Tasks** completely - tasks cannot exist without a job.
- **Tasks** within a job must have unique IDs.
- Task dependencies must form a Directed Acyclic Graph (no circular dependencies).
- All tasks in a job must complete before the job deadline.

### Between Aggregates

- An **Operator** can be referenced by many **TaskAssignments** but cannot have overlapping assignments.
- **Equipment** can be referenced by many **TaskAssignments** but cannot have overlapping assignments.
- A **Task** (within Job) references **Operators** and **Equipment** by ID only.
- **Schedule** references Jobs, Tasks, Operators, and Equipment by ID to maintain aggregate boundaries.

### Business Invariants

1. **No Double Booking:**
   - An operator cannot be assigned to overlapping tasks.
   - Equipment cannot be assigned to overlapping tasks.

2. **Skill Requirements:**
   - If a task requires both operator and equipment, the operator must have the skill for that equipment.

3. **Availability Constraints:**
   - Operators can only be scheduled within their availability slots.

4. **Dependency Ordering:**
   - A task can only start after all its required tasks have completed.

5. **Deadline Constraints:**
   - All tasks must complete before their job's deadline.

---

## Domain Events

### Operator Events
- `OperatorCreated`
- `OperatorAvailabilityChanged`
- `OperatorSkillAdded`
- `OperatorDeactivated`

### Equipment Events
- `EquipmentCreated`
- `EquipmentMaintenanceScheduled`
- `EquipmentStatusChanged`

### Job Events
- `JobCreated`
- `TaskAddedToJob`
- `TaskDependencySet`
- `JobScheduled`
- `JobCompleted`

### Schedule Events
- `TaskAssigned`
- `AssignmentValidated`
- `ConflictDetected`
- `ScheduleOptimized`

---

## Aggregate Design Rationale

1. **Operator as Aggregate Root:**
   - Operators manage their own availability and skills.
   - Changes to operator properties don't cascade to other aggregates.

2. **Equipment as Aggregate Root:**
   - Equipment has its own lifecycle (maintenance, status).
   - Equipment configuration is independent of jobs or operators.

3. **Job as Aggregate Root containing Tasks:**
   - Tasks are meaningless without their parent job.
   - Job deadline affects all contained tasks.
   - Task dependencies are job-internal concerns.

4. **Schedule as Separate Aggregate:**
   - Schedule validation requires cross-aggregate data.
   - Conflicts and assignments need centralized management.
   - Schedule changes don't modify the core job/task definitions.

This design ensures clear boundaries, minimal coupling between aggregates, and efficient validation of complex constraints.
