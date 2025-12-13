# Domain Model – Flux Print Shop Scheduling System

This domain model describes the core entities, value objects, and aggregates for the **print shop scheduling** system.

---

## Aggregates and Root Entities

### Station (Aggregate Root)
> **DM-AGG-STATION-001**

- **Identifier:** `StationId`
- **Responsibilities:**
  - Represents a physical machine or workstation in the print shop.
  - Manages its operating schedule (when it's available for work).
  - Belongs to exactly one station category and one station group.
  - Tracks capacity (typically 1 for internal stations).
- **Key attributes:**
  - `StationId` (value object)
  - `Name`
  - `CategoryId` (reference to StationCategory)
  - `GroupId` (reference to StationGroup)
  - `Capacity` (integer, typically 1)
  - `OperatingSchedule` (value object)
  - `ScheduleExceptions` (collection of ScheduleException value objects)
  - `Status` (Available, InUse, Maintenance, OutOfService)

### StationCategory (Aggregate Root)
> **DM-AGG-CATEGORY-001**

- **Identifier:** `StationCategoryId`
- **Responsibilities:**
  - Classifies stations by type of work performed.
  - Defines similarity criteria for time-saving indicators.
- **Key attributes:**
  - `StationCategoryId` (value object)
  - `Name` (e.g., "Offset Printing Press", "Finishing")
  - `SimilarityCriteria` (collection of SimilarityCriterion value objects)

### StationGroup (Aggregate Root)
> **DM-AGG-GROUP-001**

- **Identifier:** `StationGroupId`
- **Responsibilities:**
  - Groups stations with a shared concurrency limit.
  - Enforces maximum simultaneous running station count.
- **Key attributes:**
  - `StationGroupId` (value object)
  - `Name`
  - `MaxConcurrent` (integer, null for unlimited)
  - `IsOutsourcedProviderGroup` (boolean)

### OutsourcedProvider (Aggregate Root)
> **DM-AGG-PROVIDER-001**

- **Identifier:** `ProviderId`
- **Responsibilities:**
  - Represents an external company that performs outsourced tasks.
  - Acts as a special station with unlimited capacity.
  - Has its own station group with unlimited concurrency.
- **Key attributes:**
  - `ProviderId` (value object)
  - `Name`
  - `SupportedActionTypes` (collection of strings)
  - `StationGroupId` (its own dedicated group)
  - `Status` (Active, Inactive)

### Job (Aggregate Root)
> **DM-AGG-JOB-001**

- **Identifier:** `JobId`
- **Responsibilities:**
  - Represents a complete print order with deadline.
  - Contains and manages its sequential tasks.
  - Tracks approval gates (BAT, Plates).
  - Manages job-level dependencies on other jobs.
- **Key attributes:**
  - `JobId` (value object)
  - `Reference` (user-manipulated order reference)
  - `Client` (customer name)
  - `Description` (product description)
  - `Notes` (free-form comments)
  - `WorkshopExitDate` (deadline for leaving factory)
  - `FullyScheduled` (boolean, computed)
  - `PaperPurchaseStatus` (enum: InStock, ToOrder, Ordered, Received)
  - `PaperOrderedAt` (DateTime, nullable)
  - `PaperType` (string, e.g., "CB300")
  - `PaperFormat` (string, e.g., "63x88")
  - `ProofSentAt` (DateTime or special value: AwaitingFile, NoProofRequired)
  - `ProofApprovedAt` (DateTime, nullable)
  - `PlatesStatus` (enum: Todo, Done)
  - `RequiredJobIds` (collection of JobId references)
  - `Tasks` (ordered collection of Task entities)
  - `Comments` (collection of Comment value objects)
  - `Status` (Draft, Planned, InProgress, Delayed, Completed, Cancelled)
  - `Color` (hex string, e.g., "#3B82F6", randomly assigned at creation; dependent jobs use shades of the same color)
  - `CreatedAt` (DateTime)

### Task (Entity within Job Aggregate)
> **DM-ENT-TASK-001**

- **Identifier:** `TaskId`
- **Responsibilities:**
  - Represents a specific production operation within a job.
  - Can be internal (on a station) or outsourced (to a provider).
  - Tracks its assignment and schedule.
- **Key attributes (common):**
  - `TaskId` (value object)
  - `SequenceOrder` (integer, position in job's task list)
  - `Comment` (string, nullable)
  - `RawDSLInput` (original DSL line for reference)
  - `Assignment` (TaskAssignment value object, nullable)
  - `Status` (Defined, Ready, Assigned, Executing, Completed, Failed, Cancelled)
- **Key attributes (internal task):**
  - `Type`: 'internal'
  - `StationId` (reference to Station)
  - `SetupMinutes` (integer, 0 if not specified)
  - `RunMinutes` (integer)
  - `TotalMinutes` (computed: SetupMinutes + RunMinutes)
- **Key attributes (outsourced task):**
  - `Type`: 'outsourced'
  - `ProviderId` (reference to OutsourcedProvider)
  - `ActionType` (string, e.g., "Pelliculage")
  - `DurationOpenDays` (integer) — lead time in business days
  - `LatestDepartureTime` (time, e.g., "14:00") — latest time to send work to provider for that day to count as first business day
  - `ReceptionTime` (time, e.g., "10:00") — time when completed work is received back from provider

### Schedule (Aggregate Root)
> **DM-AGG-SCHEDULE-001**

- **Identifier:** `ScheduleId`
- **Responsibilities:**
  - Represents the master schedule containing all assignments.
  - Validates no station conflicts exist.
  - Validates station group capacity limits.
  - Ensures all constraints are satisfied.
  - Provides conflict detection and resolution information.
- **Key attributes:**
  - `ScheduleId` (value object)
  - `Name` (string)
  - `IsProd` (boolean, only one can be true) — *Future*
  - `Assignments` (collection of validated assignments)
  - `ConflictReports` (collection of ScheduleConflict value objects)
  - `LastValidatedAt` (DateTime)
  - `Version` (for optimistic locking)
  - `CreatedAt` (DateTime)

---

## Value Objects

### StationId / StationCategoryId / StationGroupId / ProviderId / JobId / TaskId / ScheduleId
- **Fields:**
  - `Value` (UUID or string)
- **Rules:**
  - Immutable once created.

### OperatingSchedule
> **DM-VO-SCHEDULE-001**

- **Fields:**
  - `WeeklyPattern` (collection of DaySchedule)
- **Rules:**
  - Defines recurring weekly availability pattern.
  - DaySchedule specifies available time slots for each day of week.

### DaySchedule
> **DM-VO-SCHEDULE-002**

- **Fields:**
  - `DayOfWeek` (Monday-Sunday)
  - `TimeSlots` (collection of TimeSlot)
- **Rules:**
  - Time slots cannot overlap within same day.

### TimeSlot
> **DM-VO-SCHEDULE-003**

- **Fields:**
  - `StartTime` (time of day)
  - `EndTime` (time of day)
- **Rules:**
  - StartTime must be before EndTime.
  - Can span midnight (e.g., 22:00-06:00).

### ScheduleException
> **DM-VO-SCHEDULE-004**

- **Fields:**
  - `Id` (string)
  - `Date` (ISO date string)
  - `Schedule` (DaySchedule, defines operating state for this date)
  - `Reason` (string, optional)
- **Rules:**
  - Overrides the regular operating schedule for that date.
  - Use `Schedule.isOperating = false` for closed days.
  - Use `Schedule.isOperating = true` with custom slots for modified hours.

### SimilarityCriterion
> **DM-VO-CATEGORY-001**

- **Fields:**
  - `Code` (string, unique within category, lowercase with underscores, e.g., "paper_type")
  - `Name` (string, human-readable, e.g., "Same paper type")
  - `FieldPath` (string, Job field path for comparison, e.g., "paperType")
- **Rules:**
  - Used to determine visual indicators between consecutive tiles.
  - FieldPath references a property on the Job entity.
  - When comparing consecutive tasks, the system reads the FieldPath value from each job and checks equality.
  - Match → filled circle; no match → hollow circle.

### StationTimeBlock (Abstract Concept)
> **DM-VO-ASSIGN-001**

- **Definition:** An abstract representation of any time period during which a station is occupied.
- **Subtypes:**
  - `TaskAssignment` – station occupied by production work
  - `MaintenanceBlock` – station occupied by scheduled maintenance (*Post-MVP*)
- **Common Fields:**
  - `StationId` (reference to Station)
  - `ScheduledStart` (ISO timestamp)
  - `ScheduledEnd` (ISO timestamp)
- **Rules:**
  - Both subtypes block station availability during their scheduled period.
  - Used for unified station availability calculations.

### TaskAssignment
> **DM-VO-ASSIGN-002**

- **Extends:** StationTimeBlock
- **Fields:**
  - `Id` (string)
  - `TaskId` (reference to Task)
  - `TargetId` (StationId or ProviderId)
  - `IsOutsourced` (boolean)
  - `ScheduledStart` (ISO timestamp)
  - `ScheduledEnd` (ISO timestamp)
  - `IsCompleted` (boolean, default false)
  - `CompletedAt` (ISO timestamp, nullable)
  - `CreatedAt` (ISO timestamp)
  - `UpdatedAt` (ISO timestamp)
- **Rules:**
  - ScheduledEnd = ScheduledStart + Task duration (accounting for operating schedule gaps).
  - IsCompleted is manually toggled via UI checkbox; does not affect precedence validation.
  - Tasks in the past are NOT automatically marked as completed.

### MaintenanceBlock — *Post-MVP*
> **DM-VO-ASSIGN-003**

- **Extends:** StationTimeBlock
- **Fields:**
  - `Id` (string)
  - `StationId` (reference to Station)
  - `ScheduledStart` (ISO timestamp)
  - `ScheduledEnd` (ISO timestamp)
  - `Reason` (string, optional)
  - `Status` (Scheduled, InProgress, Completed, Cancelled)
  - `CreatedAt` (ISO timestamp)
  - `UpdatedAt` (ISO timestamp)
- **Rules:**
  - Blocks station availability during scheduled period.
  - Not associated with any Job or Task.
  - Cannot overlap with TaskAssignments on the same station.

### Comment
> **DM-VO-JOB-001**

- **Fields:**
  - `Author` (string)
  - `Timestamp` (DateTime)
  - `Content` (string)
- **Rules:**
  - Immutable once created.
  - Simple thread, no replies (MVP).

### ScheduleConflict
> **DM-VO-CONFLICT-001**

- **Fields:**
  - `Type` (enum: StationConflict, GroupCapacityConflict, PrecedenceConflict, ApprovalGateConflict, AvailabilityConflict, DeadlineConflict)
  - `AffectedTaskIds` (collection)
  - `Description` (string)
  - `Severity` (High, Medium, Low)

### ScheduleSnapshot
> **DM-VO-VIEW-001**

- **Fields:**
  - `Version` (integer, for optimistic locking)
  - `GeneratedAt` (ISO timestamp)
  - `Stations` (collection of Station)
  - `Categories` (collection of StationCategory)
  - `Groups` (collection of StationGroup)
  - `Providers` (collection of OutsourcedProvider)
  - `Jobs` (collection of Job)
  - `Tasks` (collection of Task)
  - `Assignments` (collection of TaskAssignment)
  - `Conflicts` (collection of ScheduleConflict)
  - `LateJobs` (collection of LateJob)
- **Rules:**
  - Complete read-only view of schedule state for frontend rendering.
  - Used by client-side validation to check constraints during drag.
  - Version increments on each schedule modification for optimistic locking.

### LateJob
> **DM-VO-VIEW-002**

- **Fields:**
  - `JobId` (reference to Job)
  - `Deadline` (ISO date string, workshopExitDate)
  - `ExpectedCompletion` (ISO date string)
  - `DelayDays` (integer, number of days late)
- **Rules:**
  - Generated when job's last task completes after workshopExitDate.
  - Displayed in "Late Jobs" panel in UI.

### ProposedAssignment
> **DM-VO-VALID-001**

- **Fields:**
  - `TaskId` (reference to Task)
  - `TargetId` (StationId or ProviderId)
  - `IsOutsourced` (boolean)
  - `ScheduledStart` (ISO timestamp)
  - `BypassPrecedence` (boolean, optional, Alt-key held)
- **Rules:**
  - Input to validation functions before assignment is persisted.
  - BypassPrecedence allows precedence rule to be ignored with warning.

### ValidationResult
> **DM-VO-VALID-002**

- **Fields:**
  - `Valid` (boolean)
  - `Conflicts` (collection of ScheduleConflict)
  - `SuggestedStart` (ISO timestamp, optional)
- **Rules:**
  - Returned by validateAssignment function.
  - SuggestedStart provided when precedence conflict can be auto-corrected.

### JobStatus
> **DM-ENUM-JOB-001**

- **Allowed values:** Draft, Planned, InProgress, Delayed, Completed, Cancelled
- Represents the lifecycle state of a Job.

### StationStatus
> **DM-ENUM-STATION-001**

- **Allowed values:** Available, InUse, Maintenance, OutOfService
- Represents the operational state of a Station.

### TaskStatus
> **DM-ENUM-TASK-001**

- **Allowed values:** Defined, Ready, Assigned, Executing, Completed, Failed, Cancelled
- Represents the lifecycle state of a Task within a Job.

### PaperPurchaseStatus
> **DM-ENUM-PAPER-001**

- **Allowed values:** InStock, ToOrder, Ordered, Received
- Represents the paper procurement state for a Job.

### PlatesStatus
> **DM-ENUM-GATE-001**

- **Allowed values:** Todo, Done
- Represents the plates preparation approval gate.

### ProofStatus (Special Values)
> **DM-ENUM-GATE-002**

- `ProofSentAt` can be:
  - A DateTime (actual date sent)
  - `AwaitingFile` (waiting for client to provide file)
  - `NoProofRequired` (no proof needed for this job)

---

## Relationships and Invariants

### Within Aggregates

- A **Job** owns its **Tasks** completely — tasks cannot exist without a job.
- **Tasks** within a job are ordered (sequence) and must have unique IDs.
- Tasks within a job follow a single straight sequence (linear dependencies).
- All tasks in a job must complete before the job workshop exit date.

### Between Aggregates

- A **Station** belongs to exactly one **StationCategory**.
- A **Station** belongs to exactly one **StationGroup**.
- An **OutsourcedProvider** has its own dedicated **StationGroup** with unlimited capacity.
- A **Task** (within Job) references **Station** or **OutsourcedProvider** by ID only.
- A **Job** can reference other **Jobs** as prerequisites (requiredJobIds).
- **Schedule** references Jobs, Tasks, Stations, and Providers by ID to maintain aggregate boundaries.

### Business Invariants

1. **No Station Double Booking:**
   - A station cannot be assigned to overlapping tasks.

2. **Station Group Capacity:**
   - At any time, the number of active tasks on stations in a group cannot exceed MaxConcurrent.
   - Outsourced provider groups have unlimited capacity.

3. **Task Sequencing:**
   - Within a job, tasks must be executed in sequence order.
   - Task N cannot start before Task N-1 completes.

4. **Job Dependencies:**
   - A job cannot start until all required jobs are completed.

5. **Approval Gates:**
   - Tasks requiring BAT cannot start until proof is approved (or marked NoProofRequired).
   - Tasks requiring plates cannot start until plates are Done.

6. **Deadline Constraints:**
   - All tasks must complete before the job's workshop exit date.

7. **Operating Schedule Compliance:**
   - Tasks are only scheduled during station operating hours.
   - Tasks spanning non-operating periods are stretched accordingly.

---

## Domain Events

### Station Events
- `StationCreated`
- `StationScheduleUpdated`
- `StationExceptionAdded`
- `StationStatusChanged`

### StationCategory Events
- `StationCategoryCreated`
- `SimilarityCriteriaUpdated`

### StationGroup Events
- `StationGroupCreated`
- `MaxConcurrentUpdated`

### Job Events
- `JobCreated`
- `TaskAddedToJob`
- `TaskRemovedFromJob`
- `TasksReordered`
- `JobDependencyAdded`
- `ApprovalGateUpdated`
- `PaperStatusChanged`
- `CommentAdded`
- `JobPlanned`
- `JobStarted`
- `JobCompleted`
- `JobDelayed`
- `JobCancelled`

### Schedule Events
- `ScheduleCreated`
- `TaskAssigned`
- `TaskUnassigned`
- `TaskRescheduled`
- `ConflictDetected`
- `ScheduleValidated`

---

## Aggregate Design Rationale

1. **Station as Aggregate Root:**
   - Stations manage their own operating schedules and exceptions.
   - Changes to station configuration don't cascade to other aggregates.

2. **StationCategory as Aggregate Root:**
   - Categories are independent reference data.
   - Similarity criteria may be updated independently.

3. **StationGroup as Aggregate Root:**
   - Groups enforce capacity across multiple stations.
   - Concurrency limits are managed at group level.

4. **OutsourcedProvider as Aggregate Root:**
   - Providers have their own lifecycle.
   - Each provider creates its own station group automatically.

5. **Job as Aggregate Root containing Tasks:**
   - Tasks are meaningless without their parent job.
   - Job deadline affects all contained tasks.
   - Task sequencing is a job-internal concern.

6. **Schedule as Separate Aggregate:**
   - Schedule validation requires cross-aggregate data.
   - Conflicts and assignments need centralized management.
   - Schedule changes don't modify core job/task definitions.

This design ensures clear boundaries, minimal coupling between aggregates, and efficient validation of complex constraints.

---

## Implementation Notes

### Current Implementation Status (@flux/types)

As of v0.0.7, the `@flux/types` package is fully aligned with this domain model. All documented fields are implemented:

| Entity | Field | Status |
|--------|-------|--------|
| Station | `capacity` | ✅ Implemented |
| StationGroup | `isOutsourcedProviderGroup` | ✅ Implemented |
| OutsourcedProvider | `status` (ProviderStatus) | ✅ Implemented |
| ScheduleSnapshot | Full structure | ✅ Implemented |
| LateJob | Full structure | ✅ Implemented |
| ProposedAssignment | Full structure | ✅ Implemented |
| ValidationResult | Full structure | ✅ Implemented |

### Timestamp Fields

All entities in the implementation include `createdAt` and `updatedAt` timestamps for audit purposes. This is consistent with the types defined in `@flux/types`.

### Type Guards

The implementation includes type guard functions for runtime type checking:
- `isInternalTask(task)` - Check if task is internal
- `isOutsourcedTask(task)` - Check if task is outsourced
