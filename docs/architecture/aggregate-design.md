# Aggregate / Service / Repository Design – Flux Print Shop Scheduling System

This document defines **aggregate structures**, their **invariants**, and the supporting **services** and **repositories** for the Station → Job → Task assignment and scheduling domain.

It is a *technology‑agnostic* design reference used during Solution Design & Architecture.

---

## 1. Aggregates Overview

### 1.1 Station Aggregate
#### AGG-STATION-001
> **References:** [DM-AGG-STATION-001](../domain-model/domain-model.md#dm-agg-station-001), [BR-STATION-001](../domain-model/business-rules.md#br-station-001), [BR-STATION-002](../domain-model/business-rules.md#br-station-002), [BR-STATION-003](../domain-model/business-rules.md#br-station-003), [BR-STATION-004](../domain-model/business-rules.md#br-station-004)

**Purpose**
Represents a physical station (machine) that can be assigned tasks, maintaining its operating schedule, status, and availability.

**Invariants**
- A station must belong to exactly one category
- A station must belong to exactly one group
- Operating schedule time slots cannot overlap within the same day
- Schedule exceptions cannot overlap for the same date
- Status transitions must follow the complete state machine:
  - Available ↔ InUse (task execution starts/completes)
  - Available → Maintenance (scheduled maintenance)
  - InUse → Maintenance (emergency maintenance)
  - Maintenance → Available (maintenance completed)
  - Available → OutOfService (long-term unavailability)
  - Maintenance → OutOfService (major failure)
  - OutOfService → Available (repaired and restored)

**Entities and Value Objects**
- **Aggregate Root:** Station
- **Entities:** None (schedule and exceptions are value objects)
- **Value Objects:** OperatingSchedule, DaySchedule, TimeSlot, ScheduleException

**Creation Rules**
- A station is created in `Available` state with a unique name
- Must specify category and group at creation
- Operating schedule defaults to empty (always unavailable until configured)

**State Transitions (Behaviour)**
- `RegisterStation`
- `UpdateOperatingSchedule`
- `AddScheduleException`
- `RemoveScheduleException`
- `ChangeStatus` (Available/InUse/Maintenance/OutOfService)

**Events**
- `StationRegistered`
- `OperatingScheduleUpdated`
- `ScheduleExceptionAdded`
- `ScheduleExceptionRemoved`
- `StationStatusChanged`

**Boundaries and External Interaction**
- Only the StationRepository may load/save Stations
- Assignment validation happens outside this aggregate
- External systems may query availability but cannot modify directly

---

### 1.2 StationCategory Aggregate
#### AGG-CATEGORY-001
> **References:** [DM-AGG-CATEGORY-001](../domain-model/domain-model.md#dm-agg-category-001), [BR-CATEGORY-001](../domain-model/business-rules.md#br-category-001), [BR-CATEGORY-002](../domain-model/business-rules.md#br-category-002), [BR-CATEGORY-003](../domain-model/business-rules.md#br-category-003)

**Purpose**
Represents a category of stations with similarity criteria used for time-saving indicators.

**Invariants**
- Category name must be unique
- Similarity criteria codes must be unique within the category

**Entities and Value Objects**
- **Aggregate Root:** StationCategory
- **Entities:** None
- **Value Objects:** SimilarityCriterion (includes code, name, and fieldPath for Job property comparison)

**Creation Rules**
- Created with a unique name
- Similarity criteria can be added at creation or later

**State Transitions (Behaviour)**
- `CreateCategory`
- `AddSimilarityCriterion`
- `RemoveSimilarityCriterion`
- `RenameCategory`

**Events**
- `StationCategoryCreated`
- `SimilarityCriterionAdded`
- `SimilarityCriterionRemoved`

**Boundaries and External Interaction**
- Only StationCategoryRepository persists categories
- Stations reference categories by ID
- Scheduling View uses criteria for similarity calculations

---

### 1.3 StationGroup Aggregate
#### AGG-GROUP-001
> **References:** [DM-AGG-GROUP-001](../domain-model/domain-model.md#dm-agg-group-001), [BR-GROUP-001](../domain-model/business-rules.md#br-group-001), [BR-GROUP-002](../domain-model/business-rules.md#br-group-002)

**Purpose**
Represents a logical grouping of stations with capacity constraints.

**Invariants**
- Group name must be unique
- maxConcurrent must be positive integer or null (unlimited)
- If isOutsourcedProviderGroup is true, maxConcurrent must be null

**Entities and Value Objects**
- **Aggregate Root:** StationGroup
- **Entities:** None
- **Value Objects:** None

**Creation Rules**
- Created with unique name and maxConcurrent setting
- isOutsourcedProviderGroup defaults to false

**State Transitions (Behaviour)**
- `CreateGroup`
- `UpdateMaxConcurrent`
- `RenameGroup`

**Events**
- `StationGroupCreated`
- `GroupCapacityUpdated`

**Boundaries and External Interaction**
- Only StationGroupRepository persists groups
- Stations reference groups by ID
- Assignment validation checks group capacity

---

### 1.4 OutsourcedProvider Aggregate
#### AGG-PROVIDER-001
> **References:** [DM-AGG-PROVIDER-001](../domain-model/domain-model.md#dm-agg-provider-001), [BR-PROVIDER-001](../domain-model/business-rules.md#br-provider-001), [BR-PROVIDER-002](../domain-model/business-rules.md#br-provider-002), [BR-PROVIDER-003](../domain-model/business-rules.md#br-provider-003), [BR-PROVIDER-004](../domain-model/business-rules.md#br-provider-004)

**Purpose**
Represents an external provider for outsourced tasks, with its own implicit station group.

**Invariants**
- Provider name must be unique
- Each provider automatically has its own station group with unlimited capacity
- supportedActionTypes must not be empty
- latestDepartureTime must be valid HH:MM format
- receptionTime must be valid HH:MM format

**Entities and Value Objects**
- **Aggregate Root:** OutsourcedProvider
- **Entities:** None
- **Value Objects:** None

**Creation Rules**
- Created with unique name and supported action types
- Automatically creates associated station group with unlimited capacity
- latestDepartureTime defaults to "14:00" if not specified
- receptionTime defaults to "09:00" if not specified

**Timing Fields**
- `latestDepartureTime`: Time by which work must be sent for that day to count as first business day
- `receptionTime`: Time when completed work returns from provider

**State Transitions (Behaviour)**
- `RegisterProvider`
- `AddSupportedActionType`
- `RemoveSupportedActionType`
- `UpdateProviderStatus` (Active/Inactive)

**Events**
- `ProviderRegistered`
- `ProviderActionTypesUpdated`
- `ProviderStatusChanged`

**Boundaries and External Interaction**
- Only OutsourcedProviderRepository persists providers
- Tasks reference providers by ID
- Calendar service calculates open-day durations

---

### 1.5 Job Aggregate
#### AGG-JOB-001
> **References:** [DM-AGG-JOB-001](../domain-model/domain-model.md#dm-agg-job-001), [DM-ENT-TASK-001](../domain-model/domain-model.md#dm-ent-task-001), [BR-JOB-001](../domain-model/business-rules.md#br-job-001), [BR-JOB-002](../domain-model/business-rules.md#br-job-002), [BR-TASK-001](../domain-model/business-rules.md#br-task-001)

**Purpose**
Represents a print job containing multiple tasks, managing deadlines, approval gates, and workflow.

**Invariants**
- A job must have a reference, client, description, and workshopExitDate
- Tasks must be ordered by sequenceOrder
- Task sequence must form valid chain (no gaps)
- Circular job dependencies are not allowed
- Status progression: Draft → Planned → InProgress → Completed | Cancelled
- Tasks can only be added/reordered in Draft state
- BAT must be approved (or NoProofRequired) before tasks can be scheduled
- Plates must be Done before printing tasks can be scheduled

**Entities and Value Objects**
- **Aggregate Root:** Job
- **Entities:** Task (within aggregate boundary), Comment
- **Value Objects:** Duration

**Creation Rules**
- Job is created in `Draft` status with required fields
- Tasks are parsed from DSL and added incrementally
- requiredJobIds validated for cycles on each addition
- Color is randomly assigned from predefined palette
- Dependent jobs (via requiredJobIds) use shades of the same base color

**Color Assignment**
- `color`: Hex color code randomly assigned at creation
- Dependent jobs use shades of required job's color for visual grouping

**State Transitions (Behaviour)**
- `CreateJob`
- `AddTask` (only in Draft)
- `RemoveTask` (only in Draft)
- `ReorderTasks`
- `UpdateProofStatus` (proofSentAt, proofApprovedAt)
- `UpdatePlatesStatus`
- `UpdatePaperStatus`
- `AddJobDependency`
- `RemoveJobDependency`
- `AddComment`
- `PlanJob` (Draft → Planned)
- `StartJob` (Planned → InProgress, when first task starts)
- `CompleteJob` (InProgress → Completed, when all tasks complete)
- `CancelJob` (any → Cancelled)

**Cancellation Behaviour**
- When cancelled, all tasks status change to Cancelled
- Future task assignments (scheduledStart > now) are automatically recalled (removed)
- Past task assignments (scheduledStart < now) remain for historical reference
- JobCancelled event includes recalledTaskIds and preservedTaskIds

**Events**
- `JobCreated`
- `TaskAddedToJob`
- `TaskRemovedFromJob`
- `TasksReordered`
- `ProofStatusUpdated`
- `PlatesStatusUpdated`
- `PaperStatusUpdated`
- `JobDependencyAdded`
- `JobDependencyRemoved`
- `CommentAdded`
- `JobPlanned`
- `JobStarted`
- `JobCompleted`
- `JobCancelled`

**Boundaries and External Interaction**
- Only JobRepository loads/saves Jobs
- Task assignment happens in separate Schedule aggregate
- DSL parsing provides structured task input

---

### 1.6 Schedule Aggregate
#### AGG-SCHEDULE-001
> **References:** [DM-AGG-SCHEDULE-001](../domain-model/domain-model.md#dm-agg-schedule-001), [BR-SCHED-001](../domain-model/business-rules.md#br-sched-001), [BR-SCHED-002](../domain-model/business-rules.md#br-sched-002), [BR-ASSIGN-001](../domain-model/business-rules.md#br-assign-001)

**Purpose**
Represents the master schedule containing all task assignments with their timings, maintaining consistency and detecting conflicts.

**Invariants**
- No station can be double-booked (except providers with unlimited capacity)
- Station group capacity limits must be respected
- Task assignments must respect station operating schedules
- Dependent tasks cannot start before prerequisites complete (unless explicitly bypassed)
- All tasks within a job must be scheduled in sequence order
- scheduledEnd = scheduledStart + task duration (considering operating schedule)

**Entities and Value Objects**
- **Aggregate Root:** Schedule
- **Entities:** None (assignments are value objects)
- **Value Objects:** TaskAssignment (includes isCompleted, completedAt), ScheduleConflict, ValidationResult

**Creation Rules**
- Schedule is created empty or from a previous version
- Assignments are added and validated incrementally
- Version number increments on each change (for optimistic locking)

**State Transitions (Behaviour)**
- `CreateSchedule`
- `AssignTask` (validates all constraints)
- `UnassignTask` (recall)
- `RescheduleTask` (move to different time/station)
- `SwapTaskPositions` (swap two consecutive tasks)
- `ToggleTaskCompletion` (manually toggle isCompleted flag)
- `ValidateSchedule` (full revalidation)

**Task Completion**
- `isCompleted`: Manually toggled via UI checkbox, does NOT affect precedence validation
- `completedAt`: Set when isCompleted becomes true, cleared when false
- Tasks are NOT automatically marked completed based on time

**Events**
- `ScheduleCreated`
- `TaskAssigned`
- `TaskUnassigned`
- `TaskRescheduled`
- `TasksSwapped`
- `TaskCompletionToggled`
- `ConflictDetected`
- `ConflictResolved`
- `ScheduleUpdated`

**Boundaries and External Interaction**
- Only ScheduleRepository persists Schedules
- Requires read access to Job, Station aggregates
- Publishes events for downstream view generation
- MVP: Single schedule (branching is post-MVP)

---

## 2. Domain Services

### SchedulingService
Responsible for:
- Complex scheduling operations spanning multiple assignments
- End time calculations considering operating schedules
- Precedence safeguard logic (snap to valid position)
- Alt-key bypass handling for forced placements

### ValidationService
Responsible for:
- Cross-aggregate validation rules
- Station availability checking
- Group capacity checking
- Approval gate checking
- Precedence checking

### SimilarityService
Responsible for:
- Calculating similarity indicators between consecutive tiles
- Comparing job attributes against category criteria
- Generating filled/hollow circle data for UI

### BusinessCalendarService
Responsible for:
- Open day calculations for outsourced tasks
- Weekend exclusion (MVP)
- French holiday exclusion (future)
- Per-provider calendar support (future)

### DSLParsingService
Responsible for:
- Parsing task DSL syntax
- Validating station/provider references
- Providing autocomplete suggestions
- Reporting parse errors with positions

---

## 3. Repositories (Interface-Level)

Each aggregate exposes one repository interface:

### StationRepository
- `save(Station $station)`
- `get(StationId $id)`
- `findByName(string $name)`
- `findByCategory(StationCategoryId $categoryId)`
- `findByGroup(StationGroupId $groupId)`
- `findAll()`

### StationCategoryRepository
- `save(StationCategory $category)`
- `get(StationCategoryId $id)`
- `findByName(string $name)`
- `findAll()`

### StationGroupRepository
- `save(StationGroup $group)`
- `get(StationGroupId $id)`
- `findByName(string $name)`
- `findAll()`

### OutsourcedProviderRepository
- `save(OutsourcedProvider $provider)`
- `get(ProviderId $id)`
- `findByName(string $name)`
- `findByActionType(string $actionType)`
- `findAll()`

### JobRepository
- `save(Job $job)`
- `get(JobId $id)`
- `findByReference(string $reference)`
- `findByStatus(JobStatus $status)`
- `findByWorkshopExitDateBefore(DateTime $date)`
- `findWithPagination(int $page, int $limit, ?string $search)`

### ScheduleRepository
- `save(Schedule $schedule)`
- `get(ScheduleId $id)`
- `getCurrentSchedule()`
- `findAssignmentsForStation(StationId $id, DateRange $range)`
- `findAssignmentsForJob(JobId $id)`
- `findConflicts()`

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

### Examples
- When a task is assigned: Job aggregate task status update via event
- When station schedule changes: Existing assignments revalidated asynchronously
- When approval gate updates: Affected assignments flagged for review

### Read Model Consistency
- CQRS pattern for complex queries
- Eventually consistent projections
- Separate optimization for read vs write
- Schedule snapshot generation on events

---

## 5. Concurrency and Locking

### Optimistic Locking
- Version field on Schedule aggregate
- snapshotVersion in read models
- Conflict detection on concurrent updates
- Retry strategies for conflicts

### Aggregate Size Considerations
- Keep aggregates small for less contention
- Job aggregate includes tasks but not assignments
- Schedule aggregate uses versioning for updates
- Station aggregate is relatively static

### Conflict Resolution
- UI shows conflicts in real-time
- User resolves conflicts manually
- No automatic conflict resolution in MVP

---

## 6. Notes

- Aggregates are designed for a single-user scheduling environment initially
- Each aggregate maintains strong consistency internally
- Cross-aggregate workflows use domain events and eventual consistency
- The Schedule aggregate is the central coordination point for assignments
- Similarity calculations happen in read model, not during writes
- Task execution tracking is out of scope for MVP (future: separate aggregate)
