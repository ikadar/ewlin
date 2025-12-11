# Domain Model – Flux Print Shop Scheduling System

This domain model describes the core entities, value objects, and aggregates for the **print shop scheduling** system.

---

## Aggregates and Root Entities

### Station (Aggregate Root)
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
- **Identifier:** `StationCategoryId`
- **Responsibilities:**
  - Classifies stations by type of work performed.
  - Defines similarity criteria for time-saving indicators.
- **Key attributes:**
  - `StationCategoryId` (value object)
  - `Name` (e.g., "Offset Printing Press", "Finishing")
  - `SimilarityCriteria` (collection of SimilarityCriterion value objects)

### StationGroup (Aggregate Root)
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
  - `CreatedAt` (DateTime)

### Task (Entity within Job Aggregate)
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
  - `DurationOpenDays` (integer)

### Schedule (Aggregate Root)
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
- **Fields:**
  - `WeeklyPattern` (collection of DaySchedule)
- **Rules:**
  - Defines recurring weekly availability pattern.
  - DaySchedule specifies available time slots for each day of week.

### DaySchedule
- **Fields:**
  - `DayOfWeek` (Monday-Sunday)
  - `TimeSlots` (collection of TimeSlot)
- **Rules:**
  - Time slots cannot overlap within same day.

### TimeSlot
- **Fields:**
  - `StartTime` (time of day)
  - `EndTime` (time of day)
- **Rules:**
  - StartTime must be before EndTime.
  - Can span midnight (e.g., 22:00-06:00).

### ScheduleException
- **Fields:**
  - `Date` (date)
  - `Type` (Closed, ModifiedHours)
  - `TimeSlots` (collection of TimeSlot, for ModifiedHours)
  - `Reason` (string, optional)
- **Rules:**
  - Overrides the regular operating schedule for that date.

### SimilarityCriterion
- **Fields:**
  - `Name` (string, e.g., "Same paper type")
  - `Code` (string, for matching logic)
- **Rules:**
  - Used to determine visual indicators between consecutive tiles.

### TaskAssignment
- **Fields:**
  - `StationId` (or ProviderId for outsourced)
  - `ScheduledStart` (DateTime)
  - `ScheduledEnd` (DateTime)
- **Rules:**
  - ScheduledEnd = ScheduledStart + Task duration (accounting for operating schedule gaps).

### Comment
- **Fields:**
  - `Author` (string)
  - `Timestamp` (DateTime)
  - `Content` (string)
- **Rules:**
  - Immutable once created.
  - Simple thread, no replies (MVP).

### ScheduleConflict
- **Fields:**
  - `Type` (enum: StationConflict, GroupCapacityConflict, PrecedenceConflict, ApprovalGateConflict, AvailabilityConflict, DeadlineConflict)
  - `AffectedTaskIds` (collection)
  - `Description` (string)
  - `Severity` (High, Medium, Low)

### JobStatus
- **Allowed values:** Draft, Planned, InProgress, Delayed, Completed, Cancelled
- Represents the lifecycle state of a Job.

### StationStatus
- **Allowed values:** Available, InUse, Maintenance, OutOfService
- Represents the operational state of a Station.

### TaskStatus
- **Allowed values:** Defined, Ready, Assigned, Executing, Completed, Failed, Cancelled
- Represents the lifecycle state of a Task within a Job.

### PaperPurchaseStatus
- **Allowed values:** InStock, ToOrder, Ordered, Received
- Represents the paper procurement state for a Job.

### PlatesStatus
- **Allowed values:** Todo, Done
- Represents the plates preparation approval gate.

### ProofStatus (Special Values)
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
