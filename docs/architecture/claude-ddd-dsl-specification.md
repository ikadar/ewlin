# Claude-DDD DSL Specification v1.0

Átfogó Domain-Driven Design specifikációs nyelv, Claude Code kódgeneráláshoz optimalizálva.

---

## 1. Áttekintés

### 1.1 Tervezési célok

| Cél | Megvalósítás |
|-----|--------------|
| **Egyértelműség** | Minden explicit, nincs inferencia |
| **Kifejezőerő** | Business rules, validációk, error handling |
| **Olvashatóság** | Természetes angol szintaxis |
| **Generálhatóság** | Konzisztens struktúra → konzisztens kód |
| **DDD teljesség** | Strategic + Tactical patterns |

### 1.2 Fájl struktúra

```
project/
├── domain/
│   ├── _context-map.ddd        # Strategic: bounded contexts
│   ├── _shared-kernel.ddd      # Shared value objects, types
│   ├── _glossary.ddd           # Domain vocabulary
│   ├── station-management/
│   │   ├── station.ddd
│   │   ├── station-category.ddd
│   │   └── station-group.ddd
│   ├── job-management/
│   │   └── job.ddd
│   └── scheduling/
│       └── schedule.ddd
└── .ddd-config.yaml            # Generator configuration
```

---

## 2. Lexikai elemek

### 2.1 Kulcsszavak

```
// Strategic DDD
context-map  bounded-context  subdomain  relationship

// Tactical DDD
aggregate  entity  value  enum  event  command  query  service

// Modifiers
root  identity  required  optional  computed  readonly
transient  lazy  indexed  unique

// Business Logic
invariant  pre  post  validates  error  when  unless
emits  consumes  triggers  saga

// Types
String  Int  Long  Float  Double  Boolean  DateTime  Date  Time
Duration  UUID  List  Set  Map  Optional

// Relationships
upstream  downstream  conformist  anticorruption
open-host  published-language  shared-kernel  partnership
```

### 2.2 Operátorok

```
// Típus
:           # típus deklaráció
?           # nullable/optional
!           # required (explicit)
|           # union type
&           # intersection type
->          # return type / mapping
=>          # lambda / derived

// Értékek
=           # default value / assignment
==  !=      # equality
<  >  <=  >= # comparison
&&  ||  !   # logical
in  !in     # collection membership

// Annotációk
@           # annotation prefix
#           # tag/label
```

### 2.3 Literálok

```
// String
"Hello"
"""
Multiline
string
"""

// Number
42          # Int
42L         # Long
3.14        # Double
3.14f       # Float

// Boolean
true  false

// Duration
5.minutes   30.seconds   2.hours   1.days

// Date/Time
@2024-01-15              # Date
@14:30:00                # Time
@2024-01-15T14:30:00Z    # DateTime

// Collections
[1, 2, 3]                # List
{1, 2, 3}                # Set
{key: value, ...}        # Map
```

---

## 3. Strategic DDD

### 3.1 Context Map

```ddd
context-map ProjectName {
  @version "1.0"
  @description "Overall system architecture"

  // Bounded context declarations
  contexts {
    StationManagement   @team("infrastructure")
    JobManagement       @team("production")
    Scheduling          @team("production")
    Reporting           @team("analytics")
  }

  // Relationships
  relationships {
    // Upstream/Downstream with patterns
    StationManagement [upstream, open-host, published-language]
      -> Scheduling [downstream, conformist]
      via events { StationCreated, StationUpdated, StationDeleted }

    JobManagement [upstream, open-host]
      -> Scheduling [downstream, anticorruption]
      via events { JobCreated, TaskAdded, ElementUpdated }
      via api { GET /jobs/{id}, GET /tasks/{id} }

    // Partnership (symmetric)
    Scheduling <-> Reporting [partnership]
      via events { ScheduleUpdated }

    // Shared Kernel
    StationManagement -- JobManagement [shared-kernel]
      sharing { Duration, TimeSlot, DateRange }
  }
}
```

### 3.2 Bounded Context

```ddd
bounded-context Scheduling {
  @description "Task assignment and schedule management"
  @team "production"
  @technology "Kotlin/Spring"

  // Subdomain classification
  subdomain: Core

  // Module structure
  modules {
    Assignment    @description("Task-to-station assignments")
    Validation    @description("Constraint checking")
    Projection    @description("Read models for UI")
  }

  // Ubiquitous language (context-specific terms)
  vocabulary {
    Tile = "Visual representation of a task assignment on the schedule grid"
    Slot = "30-minute time interval on the schedule"
    Recall = "Remove an assignment, returning task to unscheduled state"
  }

  // External dependencies
  consumes {
    from StationManagement: Station, StationGroup, Provider
    from JobManagement: Job, Element, Task
  }

  // Exposed contracts
  exposes {
    events: TaskAssigned, TaskUnassigned, ConflictDetected
    api: ScheduleAPI @spec("openapi/schedule.yaml")
  }
}
```

### 3.3 Subdomain

```ddd
subdomain Scheduling {
  type: Core  // Core | Supporting | Generic

  @description """
    The heart of the business - assigning print tasks to stations
    while respecting all constraints and optimizing throughput.
  """

  // Strategic importance
  strategic-classification {
    complexity: High
    volatility: High
    competitive-advantage: High
  }

  // Domain experts
  experts {
    "Production Manager" @role(decision-maker)
    "Master Scheduler"   @role(daily-user)
  }
}
```

---

## 4. Tactical DDD: Aggregates

### 4.1 Aggregate Declaration

```ddd
aggregate Schedule in Scheduling {
  @description "Master schedule containing all task assignments"
  @lifecycle { Created -> Active -> Archived }

  // Aggregate configuration
  config {
    optimistic-locking: true
    event-sourced: false        // or true for ES
    snapshot-frequency: 100     // for ES
  }

  // Root entity
  root ScheduleEntity { ... }

  // Internal entities
  entity TaskAssignment { ... }

  // Value objects
  value ProposedAssignment { ... }
  value ValidationResult { ... }

  // Enums
  enum ConflictType { ... }

  // Domain events
  event TaskAssigned { ... }
  event ConflictDetected { ... }

  // Business rules (aggregate-level)
  invariants { ... }

  // Commands
  commands { ... }

  // Queries
  queries { ... }

  // Saga/Process managers
  sagas { ... }
}
```

### 4.2 Root Entity

```ddd
root Schedule {
  // === IDENTITY ===
  id: ScheduleId @identity @generated(UUID)

  // === STATE ===
  name: String @required @max-length(100)
  assignments: List<TaskAssignment> @ordered
  version: Int @optimistic-locking @initial(1)
  status: ScheduleStatus = Active

  // === TIMESTAMPS ===
  createdAt: DateTime @auto(on-create)
  updatedAt: DateTime @auto(on-update)

  // === COMPUTED ===
  conflicts: List<ScheduleConflict> @computed => detectAllConflicts()
  isValid: Boolean @computed => conflicts.isEmpty()
  assignmentCount: Int @computed => assignments.size()

  // === TRANSIENT (not persisted) ===
  @transient validationCache: Map<TaskId, ValidationResult>?
}
```

---

## 5. Tactical DDD: Entities & Value Objects

### 5.1 Entity

```ddd
entity TaskAssignment {
  // Identity (local within aggregate)
  id: AssignmentId @identity @generated(UUID)

  // Core attributes
  taskId: TaskId @required @indexed
  targetId: StationId | ProviderId  // Union type
  isOutsourced: Boolean

  // Time slot
  scheduledStart: DateTime @required
  scheduledEnd: DateTime @computed => calculateEndTime()

  // Completion tracking
  isCompleted: Boolean = false
  completedAt: DateTime?

  // Audit
  createdAt: DateTime @auto(on-create)
  updatedAt: DateTime @auto(on-update)

  // Derived/computed
  duration: Duration @computed => scheduledEnd - scheduledStart
  effectiveEnd: DateTime @computed =>
    if isPrintingTask() then scheduledEnd + DRY_TIME else scheduledEnd

  // Methods
  methods {
    fun overlaps(other: TaskAssignment): Boolean =>
      this.scheduledStart < other.scheduledEnd &&
      this.scheduledEnd > other.scheduledStart

    fun isPrintingTask(): Boolean =>
      !isOutsourced && station.category.code == "cat-offset"
  }
}
```

### 5.2 Value Object

```ddd
value ProposedAssignment {
  @description "Input for assignment validation and creation"
  @immutable  // All value objects are immutable by default

  taskId: TaskId @required
  targetId: StationId | ProviderId @required
  isOutsourced: Boolean @required
  scheduledStart: DateTime @required
  bypassPrecedence: Boolean = false
    @description "Set to true when Alt-key held during drag"

  // Validation rules
  validate {
    scheduledStart >= now()
      @error "Cannot schedule in the past"

    scheduledStart.minute % 30 == 0
      @error "Must align to 30-minute grid"
  }
}

value TimeSlot {
  @description "A time range with start and end"

  start: DateTime @required
  end: DateTime @required

  validate {
    end > start @error "End must be after start"
  }

  methods {
    fun duration(): Duration => end - start
    fun contains(point: DateTime): Boolean => point >= start && point < end
    fun overlaps(other: TimeSlot): Boolean =>
      this.start < other.end && this.end > other.start
  }
}

value Money {
  @description "Monetary value with currency"

  amount: Decimal @required @min(0)
  currency: Currency @required

  operators {
    fun +(other: Money): Money {
      @pre this.currency == other.currency
      => Money(this.amount + other.amount, this.currency)
    }

    fun *(factor: Decimal): Money =>
      Money(this.amount * factor, this.currency)
  }
}
```

### 5.3 Identity Value Objects

```ddd
value ScheduleId {
  @identity-type
  @description "Unique identifier for Schedule aggregate"

  value: UUID

  factory {
    fun generate(): ScheduleId => ScheduleId(UUID.randomUUID())
    fun from(string: String): ScheduleId => ScheduleId(UUID.parse(string))
  }

  format {
    toString => value.toString()
    toSlug => "schedule-${value.toString().take(8)}"
  }
}
```

---

## 6. Enums & Types

### 6.1 Enum Declaration

```ddd
enum JobStatus {
  @description "Lifecycle states of a Job"

  Draft {
    @description "Initial state, job can be modified"
    @initial
    transitions-to [Planned, Cancelled]
  }

  Planned {
    @description "Job is finalized, ready for scheduling"
    transitions-to [InProgress, Cancelled]
  }

  InProgress {
    @description "At least one task has started"
    transitions-to [Delayed, Completed, Cancelled]
  }

  Delayed {
    @description "Job will miss deadline based on current schedule"
    @visual "Warning indicator"
    transitions-to [InProgress, Completed, Cancelled]
  }

  Completed {
    @description "All tasks finished successfully"
    @terminal
  }

  Cancelled {
    @description "Job was cancelled"
    @terminal
  }
}

enum ConflictType {
  @description "Types of scheduling conflicts"
  @tagged  // Each value can have associated data

  StationConflict {
    @from-rule "BR-SCHED-001"
    @severity High
    @visual "Red highlight on both tiles"
    data {
      existingAssignmentId: AssignmentId
      overlap: TimeSlot
    }
  }

  GroupCapacityConflict {
    @from-rule "BR-SCHED-002"
    @severity High
    @visual "Orange time region"
    data {
      groupId: StationGroupId
      currentCount: Int
      maxAllowed: Int
    }
  }

  PrecedenceConflict {
    @from-rule "BR-SCHED-003"
    @severity Medium
    @visual "Red halo on tile"
    @bypassable  // Can be overridden by user
    data {
      predecessorTaskId: TaskId
      requiredStart: DateTime
      suggestedStart: DateTime
    }
  }
}
```

### 6.2 Type Aliases

```ddd
types {
  // Simple aliases
  Email = String @pattern("^[\\w.-]+@[\\w.-]+\\.\\w+$")
  Phone = String @pattern("^\\+?[0-9]{10,14}$")
  Percentage = Decimal @min(0) @max(100)
  PositiveInt = Int @min(1)

  // Duration aliases
  Minutes = Int @unit("minutes")
  Hours = Int @unit("hours")
  OpenDays = Int @unit("business-days") @min(1)

  // Parameterized types
  NonEmptyList<T> = List<T> @min-size(1)
  UniqueList<T> = List<T> @unique
  OrderedSet<T> = Set<T> @ordered
}
```

---

## 7. Business Rules & Invariants

### 7.1 Invariants

```ddd
invariants in Schedule {

  @invariant("BR-SCHED-001")
  @description "No station double-booking"
  @severity Critical
  NoStationDoubleBooking {
    forall a1, a2 in assignments
    where a1.id != a2.id
      && a1.targetId == a2.targetId
      && !a1.isOutsourced:

    !a1.overlaps(a2)

    @on-violation {
      conflict: StationConflict
      message: "Station {a1.targetId} is double-booked between {a1} and {a2}"
    }
  }

  @invariant("BR-SCHED-002")
  @description "Station group capacity respected"
  @severity Critical
  GroupCapacityRespected {
    forall group in stationGroups,
           timePoint in schedule.timePoints:

    let activeCount = count(
      assignments where
        group.contains(a.station) &&
        a.isActiveAt(timePoint)
    )

    group.maxConcurrent == null || activeCount <= group.maxConcurrent

    @on-violation {
      conflict: GroupCapacityConflict(
        groupId: group.id,
        currentCount: activeCount,
        maxAllowed: group.maxConcurrent
      )
    }
  }

  @invariant("BR-SCHED-003")
  @description "Task sequence respected within elements"
  @severity High
  @bypassable with Alt-key
  TaskSequenceRespected {
    forall task in assignments
    where task.predecessor != null
      && task.predecessor.isScheduled:

    task.scheduledStart >= task.predecessor.effectiveEnd

    @on-violation {
      conflict: PrecedenceConflict(
        predecessorTaskId: task.predecessor.id,
        requiredStart: task.predecessor.effectiveEnd,
        suggestedStart: calculateEarliestStart(task)
      )
    }
  }

  @invariant("BR-ELEM-005")
  @description "Dry time after printing tasks"
  @severity High
  DryTimeRespected {
    forall task in assignments
    where task.predecessor?.isPrintingTask() == true:

    task.scheduledStart >= task.predecessor.scheduledEnd + DRY_TIME

    @constants {
      DRY_TIME = 4.hours
    }
  }
}
```

### 7.2 Cross-Aggregate Rules

```ddd
cross-aggregate-rules {

  @rule("BR-JOB-006")
  @description "Job dependencies are finish-to-start"
  @contexts [JobManagement, Scheduling]
  JobDependencyEnforcement {
    forall job in jobs
    where job.requiredJobs.isNotEmpty():

    let lastTasks = job.requiredJobs.flatMap { it.lastTasksPerElement }
    let firstTasks = job.firstTasksPerElement

    forall first in firstTasks, last in lastTasks:
      !first.isScheduled || !last.isScheduled ||
      first.scheduledStart >= last.effectiveEnd
  }
}
```

---

## 8. Commands

### 8.1 Command Declaration

```ddd
commands in Schedule {

  @command AssignTask {
    @description "Assign a task to a station at a specific time"
    @idempotent by request.taskId
    @transactional

    // Input
    input {
      proposal: ProposedAssignment @required
    }

    // Authorization
    @authorize {
      role: [Scheduler, Admin]
      permission: "schedule:write"
    }

    // Output
    output: ValidationResult

    // Validation
    @validates [BR-SCHED-001, BR-SCHED-002, BR-SCHED-003, BR-ELEM-005]

    // Preconditions
    @pre {
      taskExists(proposal.taskId)
        @error TaskNotFound(proposal.taskId)

      targetExists(proposal.targetId)
        @error TargetNotFound(proposal.targetId)

      proposal.scheduledStart >= now()
        @error CannotScheduleInPast

      !isAlreadyAssigned(proposal.taskId) || @allow-reassign
        @error TaskAlreadyAssigned(proposal.taskId)
    }

    // Behavior specification
    @behavior {
      1. Validate against all business rules
      2. If valid:
         - Create TaskAssignment
         - Add to assignments collection
         - Increment version
         - Emit TaskAssigned event
      3. If invalid:
         - Collect all conflicts
         - Calculate suggested start time
         - Emit ConflictDetected event
      4. Return ValidationResult
    }

    // Events
    @emits TaskAssigned when result.valid
    @emits ConflictDetected when !result.valid

    // Error cases
    errors {
      TaskNotFound(taskId: TaskId)
        @http-status 404
        @message "Task {taskId} not found"

      TargetNotFound(targetId: String)
        @http-status 404
        @message "Station or provider {targetId} not found"

      CannotScheduleInPast
        @http-status 400
        @message "Cannot schedule tasks in the past"

      TaskAlreadyAssigned(taskId: TaskId)
        @http-status 409
        @message "Task {taskId} is already assigned"
    }
  }

  @command UnassignTask {
    @description "Remove a task assignment (recall)"
    @idempotent

    input {
      taskId: TaskId @required
    }

    output: Unit

    @pre {
      isAssigned(taskId) @error TaskNotAssigned(taskId)
    }

    @emits TaskUnassigned

    @behavior {
      1. Find assignment by taskId
      2. Remove from assignments collection
      3. Increment version
      4. Emit TaskUnassigned event
    }
  }

  @command RescheduleTask {
    @description "Move an existing assignment to new time/station"
    @idempotent

    input {
      taskId: TaskId @required
      newStart: DateTime @required
      newTargetId: StationId | ProviderId @optional  // null = same station
    }

    output: ValidationResult

    @validates [BR-SCHED-001, BR-SCHED-002, BR-SCHED-003]

    @emits TaskRescheduled when result.valid
    @emits ConflictDetected when !result.valid
  }

  @command ToggleTaskCompletion {
    @description "Manually toggle completion status"

    input {
      taskId: TaskId @required
    }

    output: TaskAssignment

    @emits TaskCompletionToggled

    @note """
      Completion flag is for tracking only.
      Does NOT affect precedence validation.
      Tasks are never auto-completed based on time.
    """
  }
}
```

### 8.2 Command Handlers (hint for generation)

```ddd
command-handler AssignTaskHandler {
  @handles AssignTask
  @style ApplicationService  // or CommandHandler, Aggregate method

  dependencies {
    scheduleRepository: ScheduleRepository
    stationRepository: StationRepository @readonly
    taskRepository: TaskRepository @readonly
    eventPublisher: EventPublisher
  }

  @transaction-boundary Aggregate  // or UseCase, None
  @retry { max: 3, backoff: exponential, on: [OptimisticLockException] }
}
```

---

## 9. Queries

### 9.1 Query Declaration

```ddd
queries in Scheduling {

  @query GetScheduleSnapshot {
    @description "Get complete schedule state for UI rendering"
    @cacheable ttl: 30.seconds

    input {
      scheduleId: ScheduleId @required
      timeRange: DateRange @optional
      includeConflicts: Boolean = true
    }

    output: ScheduleSnapshot

    @authorize {
      role: [Scheduler, Viewer, Admin]
      permission: "schedule:read"
    }
  }

  @query GetAssignmentsForStation {
    @description "Get all assignments for a station in a time range"
    @pagination { default-size: 50, max-size: 200 }

    input {
      stationId: StationId @required
      range: DateRange @required
    }

    output: List<TaskAssignment>
  }

  @query GetLateJobs {
    @description "Get jobs that will miss their deadline"

    input {
      scheduleId: ScheduleId @required
      asOf: DateTime = now()
    }

    output: List<LateJob>

    projection {
      LateJob {
        jobId: JobId
        jobReference: String
        deadline: Date
        expectedCompletion: Date
        delayDays: Int @computed => expectedCompletion - deadline
        criticalPath: List<TaskAssignment>
      }
    }
  }

  @query FindAvailableSlots {
    @description "Find available time slots for a task"

    input {
      taskId: TaskId @required
      stationId: StationId @required
      searchRange: DateRange @required
      minDuration: Duration @optional
    }

    output: List<TimeSlot>

    @note "Considers operating hours, existing assignments, and group capacity"
  }
}
```

---

## 10. Domain Events

### 10.1 Event Declaration

```ddd
events in Scheduling {

  @event TaskAssigned {
    @description "Emitted when a task is successfully assigned"
    @topic "scheduling.assignments"
    @version 2

    // Event identity
    eventId: UUID @generated
    occurredAt: DateTime @auto

    // Aggregate reference
    aggregateId: ScheduleId
    aggregateVersion: Int

    // Payload
    payload {
      taskId: TaskId
      targetId: StationId | ProviderId
      targetName: String  // Denormalized for consumers
      isOutsourced: Boolean
      scheduledStart: DateTime
      scheduledEnd: DateTime

      // Context (for consumers that need it)
      jobId: JobId
      jobReference: String
      elementId: ElementId
    }

    // Metadata
    metadata {
      correlationId: UUID @optional
      causationId: UUID @optional
      userId: UserId
      source: String = "SchedulingService"
    }
  }

  @event TaskUnassigned {
    @description "Emitted when an assignment is recalled"
    @topic "scheduling.assignments"

    eventId: UUID @generated
    occurredAt: DateTime @auto
    aggregateId: ScheduleId
    aggregateVersion: Int

    payload {
      taskId: TaskId
      previousTargetId: StationId | ProviderId
      previousTimeSlot: TimeSlot
      reason: UnassignReason?
    }
  }

  @event ConflictDetected {
    @description "Emitted when an assignment would violate constraints"
    @topic "scheduling.conflicts"

    eventId: UUID @generated
    occurredAt: DateTime @auto
    aggregateId: ScheduleId

    payload {
      attemptedAssignment: ProposedAssignment
      conflicts: List<ScheduleConflict>
      suggestedStart: DateTime?
    }
  }

  enum UnassignReason {
    UserRecall       @description "User explicitly recalled"
    JobCancelled     @description "Parent job was cancelled"
    StationRemoved   @description "Station no longer available"
    Rescheduling     @description "Being moved to new time/station"
  }
}
```

### 10.2 Event Handlers & Reactions

```ddd
event-handlers {

  @handler UpdateJobStatusOnAssignment {
    @subscribes TaskAssigned from Scheduling
    @in-context JobManagement

    @behavior {
      When first task of job is assigned:
        transition job from Draft/Planned to InProgress

      When all tasks assigned:
        update job.fullyScheduled = true
    }
  }

  @handler ProjectScheduleSnapshot {
    @subscribes [TaskAssigned, TaskUnassigned, TaskRescheduled]
    @in-context Scheduling
    @projection ScheduleSnapshotProjection

    @behavior {
      Update denormalized read model for UI consumption
    }
  }

  @handler DetectLateJobs {
    @subscribes [TaskAssigned, TaskRescheduled]
    @in-context Scheduling

    @behavior {
      Recalculate job completion times
      If any job now late: emit JobDelayed event
    }
  }
}
```

---

## 11. Domain Services

```ddd
services in Scheduling {

  @service ValidationService {
    @description "Stateless validation of assignments against all rules"
    @stateless
    @pure  // No side effects, same input = same output

    operations {
      fun validate(
        proposal: ProposedAssignment,
        snapshot: ScheduleSnapshot
      ): ValidationResult

      fun validateBatch(
        proposals: List<ProposedAssignment>,
        snapshot: ScheduleSnapshot
      ): List<ValidationResult>

      fun calculateEarliestStart(
        taskId: TaskId,
        targetId: StationId,
        snapshot: ScheduleSnapshot
      ): DateTime
    }

    @isomorphic {
      // Runs on both client and server
      platforms: [Browser, Server]
      package: "@flux/schedule-validator"
    }
  }

  @service EndTimeCalculator {
    @description "Calculate task end times considering operating schedules"
    @stateless

    operations {
      fun calculateEndTime(
        start: DateTime,
        duration: Duration,
        operatingSchedule: OperatingSchedule
      ): DateTime

      fun calculateOutsourcedEndTime(
        start: DateTime,
        openDays: OpenDays,
        provider: OutsourcedProvider,
        calendar: BusinessCalendar
      ): DateTime
    }
  }

  @service SimilarityCalculator {
    @description "Calculate similarity indicators between consecutive tiles"
    @stateless

    operations {
      fun calculateSimilarity(
        task1: Task,
        task2: Task,
        criteria: List<SimilarityCriterion>
      ): List<SimilarityIndicator>
    }
  }
}
```

---

## 12. Repositories

```ddd
repositories {

  @repository ScheduleRepository {
    @for-aggregate Schedule

    // Standard operations
    operations {
      fun save(schedule: Schedule): Schedule
      fun findById(id: ScheduleId): Schedule?
      fun findByIdOrThrow(id: ScheduleId): Schedule
        @throws ScheduleNotFound
    }

    // Custom queries
    queries {
      fun findCurrent(): Schedule?
        @description "Get the active production schedule"

      fun findAssignmentsForStation(
        stationId: StationId,
        range: DateRange
      ): List<TaskAssignment>
        @indexed-by [stationId, scheduledStart]

      fun findAssignmentsForJob(jobId: JobId): List<TaskAssignment>
        @indexed-by [jobId]

      fun findConflicts(): List<ScheduleConflict>
    }

    // Locking
    @locking {
      strategy: Optimistic
      version-field: version
      on-conflict: throw OptimisticLockException
    }
  }
}
```

---

## 13. APIs & Contracts

### 13.1 REST API

```ddd
api ScheduleAPI {
  @style REST
  @version "v1"
  @base-path "/api/v1/schedules"

  @authentication {
    type: Bearer
    scheme: JWT
  }

  resources {

    @resource Schedule {
      @path "/{scheduleId}"

      GET -> GetScheduleSnapshot
        @response 200: ScheduleSnapshot
        @response 404: ScheduleNotFound

      @path "/{scheduleId}/assignments"

      GET -> GetAssignmentsForStation
        @query stationId: StationId @required
        @query from: DateTime @required
        @query to: DateTime @required
        @response 200: List<TaskAssignment>

      POST -> AssignTask
        @body ProposedAssignment
        @response 201: ValidationResult @when valid
        @response 409: ValidationResult @when !valid
        @response 400: ValidationError

      @path "/{scheduleId}/assignments/{taskId}"

      DELETE -> UnassignTask
        @response 204: Unit
        @response 404: TaskNotAssigned

      PUT -> RescheduleTask
        @body RescheduleRequest
        @response 200: ValidationResult
    }
  }

  // Error responses
  errors {
    ValidationError {
      @http-status 400
      code: String
      message: String
      details: Map<String, String>?
    }

    ScheduleNotFound {
      @http-status 404
      scheduleId: ScheduleId
    }
  }
}
```

### 13.2 Event API (Async)

```ddd
async-api SchedulingEvents {
  @protocol Kafka
  @version "1.0"

  channels {
    "scheduling.assignments.v1" {
      publish: [TaskAssigned, TaskUnassigned, TaskRescheduled]
      @partitioned-by aggregateId
      @retention 7.days
    }

    "scheduling.conflicts.v1" {
      publish: [ConflictDetected]
      @partitioned-by aggregateId
      @retention 1.days
    }
  }

  @schema-registry {
    url: "http://schema-registry:8081"
    format: Avro
  }
}
```

---

## 14. Sagas & Process Managers

```ddd
sagas {

  @saga JobCancellationSaga {
    @description "Handle cascading effects when a job is cancelled"
    @triggered-by JobCancelled from JobManagement

    @state {
      jobId: JobId
      assignmentsToRecall: List<AssignmentId>
      recalledCount: Int = 0
      status: SagaStatus = Started
    }

    @steps {
      1. OnJobCancelled(event: JobCancelled) {
         // Find all future assignments for this job
         assignmentsToRecall = findFutureAssignments(event.jobId)

         if assignmentsToRecall.isEmpty() {
           complete()
         } else {
           foreach assignment in assignmentsToRecall {
             dispatch UnassignTask(taskId: assignment.taskId)
           }
         }
      }

      2. OnTaskUnassigned(event: TaskUnassigned) {
         recalledCount++

         if recalledCount == assignmentsToRecall.size {
           complete()
         }
      }

      @timeout 5.minutes {
        // Handle partial completion
        emit JobCancellationPartiallyComplete(
          jobId: jobId,
          recalledCount: recalledCount,
          expectedCount: assignmentsToRecall.size
        )
        complete()
      }

      @compensation {
        // No compensation needed - recalls are idempotent
      }
    }
  }
}
```

---

## 15. Glossary & Vocabulary

```ddd
glossary {
  @language "en"
  @domain "Print Shop Scheduling"

  terms {
    Station {
      @definition "A physical machine or workstation that can execute tasks"
      @synonyms ["Machine", "Workstation", "Poste"]
      @examples ["Offset Press #1", "Folding Machine", "Guillotine"]
      @translations {
        fr: "Poste de travail"
        hu: "Munkahely"
      }
    }

    Task {
      @definition "A single unit of work within an element, executed on a station"
      @synonyms ["Operation", "Step"]
      @translations {
        fr: "Tâche"
        hu: "Feladat"
      }
    }

    Tile {
      @definition "Visual representation of a task assignment on the schedule grid"
      @context "UI terminology"
      @note "Internal term, not used in domain model directly"
    }

    BAT {
      @definition "Bon à Tirer - proof approval from client before production"
      @acronym-for "Bon à Tirer"
      @translations {
        en: "Proof Approval"
        hu: "Nyomtatási engedély"
      }
    }

    OpenDay {
      @definition "A business day (Monday-Friday, excluding holidays)"
      @synonyms ["Business Day", "Working Day", "JO"]
      @note "Used for outsourced task duration calculation"
      @translations {
        fr: "Jour Ouvré (JO)"
        hu: "Munkanap"
      }
    }
  }

  abbreviations {
    JO = "Jour Ouvré (Open Day)"
    BR = "Business Rule"
    AR = "Architectural Refactoring"
    ACL = "Anti-Corruption Layer"
    BC = "Bounded Context"
  }
}
```

---

## 16. Configuration & Constants

```ddd
configuration {

  @constants Scheduling {
    DRY_TIME = 4.hours
      @description "Drying time after offset printing"
      @rule BR-ELEM-005

    GRID_SNAP_INTERVAL = 30.minutes
      @description "UI snaps assignments to this interval"
      @rule BR-ASSIGN-006

    DEFAULT_OPERATING_HOURS {
      start: @08:00
      end: @18:00
    }

    MAX_SCHEDULE_HORIZON = 90.days
      @description "How far in advance tasks can be scheduled"
  }

  @feature-flags {
    ENABLE_AUTO_SCHEDULING = false
      @description "AI-powered automatic scheduling suggestions"
      @rollout gradual

    ENABLE_MULTI_SCHEDULE = false
      @description "Support for multiple schedule versions/branches"
      @rollout internal-only
  }

  @environment {
    development {
      VALIDATION_STRICT_MODE = false
      ALLOW_PAST_SCHEDULING = true  // For testing
    }

    production {
      VALIDATION_STRICT_MODE = true
      ALLOW_PAST_SCHEDULING = false
    }
  }
}
```

---

## 17. Generator Configuration

```yaml
# .ddd-config.yaml

version: "1.0"
project:
  name: "flux-scheduling"
  description: "Print Shop Scheduling System"

generation:
  target-language: kotlin  # kotlin | typescript | java | csharp | go

  kotlin:
    package-base: "com.flux.scheduling"
    frameworks:
      - spring-boot: "3.3"
      - arrow: "1.2"  # For Either, Option
      - jooq: "3.19"  # For type-safe SQL
    patterns:
      aggregate-style: "data-class-with-companion"
      value-object-style: "value-class"  # Kotlin inline class
      error-handling: "arrow-either"  # or "exceptions" or "result"
      event-style: "sealed-class"
    output:
      domain: "src/main/kotlin/{package}/domain"
      application: "src/main/kotlin/{package}/application"
      infrastructure: "src/main/kotlin/{package}/infrastructure"
      api: "src/main/kotlin/{package}/api"

  typescript:
    package-base: "@flux"
    frameworks:
      - fp-ts: true
      - zod: true  # For validation
    patterns:
      immutability: "readonly-deep"
      error-handling: "fp-ts-either"
    output:
      types: "packages/types/src"
      validator: "packages/validator/src"

validation:
  strict-mode: true
  check-invariant-coverage: true
  require-documentation: true

documentation:
  generate:
    - openapi: "docs/api/openapi.yaml"
    - asyncapi: "docs/api/asyncapi.yaml"
    - markdown: "docs/domain/"
    - diagrams: "docs/diagrams/"
```

---

## 18. Példa: Teljes Aggregate

```ddd
// domain/scheduling/schedule.ddd

@file-version "1.0"
@context Scheduling

import { TaskId, ElementId, JobId } from "../job-management/job.ddd"
import { StationId, ProviderId, OperatingSchedule } from "../station-management/station.ddd"
import { Duration, TimeSlot, DateRange } from "../_shared-kernel.ddd"

/**
 * Schedule Aggregate
 *
 * The master schedule containing all task assignments.
 * Central coordination point for the scheduling domain.
 */
aggregate Schedule {
  @description "Master schedule for task assignments"
  @owner "production-team"

  config {
    optimistic-locking: true
    event-sourced: false
  }

  // ============================================================
  // ROOT ENTITY
  // ============================================================

  root Schedule {
    id: ScheduleId @identity @generated(UUID)
    name: String @required @max-length(100)
    status: ScheduleStatus = Active
    assignments: List<TaskAssignment> @ordered
    version: Int @optimistic-locking @initial(1)

    createdAt: DateTime @auto(on-create)
    updatedAt: DateTime @auto(on-update)

    // Computed
    conflicts: List<ScheduleConflict> @computed => detectAllConflicts()
    isValid: Boolean @computed => conflicts.isEmpty()
  }

  // ============================================================
  // ENTITIES
  // ============================================================

  entity TaskAssignment {
    id: AssignmentId @identity @generated(UUID)
    taskId: TaskId @required @indexed
    targetId: StationId | ProviderId @required
    isOutsourced: Boolean @required

    scheduledStart: DateTime @required
    scheduledEnd: DateTime @required

    isCompleted: Boolean = false
    completedAt: DateTime?

    createdAt: DateTime @auto(on-create)
    updatedAt: DateTime @auto(on-update)

    effectiveEnd: DateTime @computed =>
      if isPrintingTask() then scheduledEnd + DRY_TIME else scheduledEnd

    methods {
      fun overlaps(other: TaskAssignment): Boolean =>
        this.scheduledStart < other.scheduledEnd &&
        this.scheduledEnd > other.scheduledStart

      fun isPrintingTask(): Boolean =>
        !isOutsourced && getStation().category.code == "cat-offset"

      fun isActiveAt(point: DateTime): Boolean =>
        scheduledStart <= point && point < scheduledEnd
    }
  }

  // ============================================================
  // VALUE OBJECTS
  // ============================================================

  value ScheduleId { value: UUID }
  value AssignmentId { value: UUID }

  value ProposedAssignment {
    taskId: TaskId @required
    targetId: StationId | ProviderId @required
    isOutsourced: Boolean @required
    scheduledStart: DateTime @required
    bypassPrecedence: Boolean = false

    validate {
      scheduledStart.minute % GRID_SNAP_MINUTES == 0
        @error "Must align to {GRID_SNAP_MINUTES}-minute grid"
    }
  }

  value ValidationResult {
    valid: Boolean
    conflicts: List<ScheduleConflict>
    suggestedStart: DateTime?
  }

  value ScheduleConflict {
    type: ConflictType
    taskId: TaskId
    message: String
    relatedTaskId: TaskId?
    details: Map<String, Any>?
  }

  // ============================================================
  // ENUMS
  // ============================================================

  enum ScheduleStatus {
    Active { @initial }
    Archived { @terminal }
  }

  enum ConflictType {
    StationConflict       @from-rule(BR-SCHED-001) @severity(Critical)
    GroupCapacityConflict @from-rule(BR-SCHED-002) @severity(Critical)
    PrecedenceConflict    @from-rule(BR-SCHED-003) @severity(High) @bypassable
    PrerequisiteConflict  @from-rule(BR-PREREQ-001) @severity(Medium)
    DeadlineConflict      @from-rule(BR-SCHED-005) @severity(Medium)
  }

  // ============================================================
  // INVARIANTS
  // ============================================================

  invariants {
    @invariant("BR-SCHED-001") NoStationDoubleBooking {
      forall a1, a2 in assignments
      where a1.id != a2.id && a1.targetId == a2.targetId && !a1.isOutsourced:
      !a1.overlaps(a2)
    }

    @invariant("BR-SCHED-003") TaskSequenceRespected {
      forall task in assignments
      where task.predecessor?.isScheduled == true:
      task.scheduledStart >= task.predecessor.effectiveEnd
    }
  }

  // ============================================================
  // COMMANDS
  // ============================================================

  commands {
    @command AssignTask {
      input { proposal: ProposedAssignment }
      output: ValidationResult
      @validates [BR-SCHED-001, BR-SCHED-002, BR-SCHED-003]
      @emits TaskAssigned when result.valid
      @emits ConflictDetected when !result.valid
      @idempotent by proposal.taskId

      errors {
        TaskNotFound @http(404)
        TargetNotFound @http(404)
        CannotScheduleInPast @http(400)
      }
    }

    @command UnassignTask {
      input { taskId: TaskId }
      output: Unit
      @emits TaskUnassigned

      errors {
        TaskNotAssigned @http(404)
      }
    }
  }

  // ============================================================
  // QUERIES
  // ============================================================

  queries {
    @query GetSnapshot {
      input { timeRange: DateRange? }
      output: ScheduleSnapshot
    }

    @query GetAssignmentsForStation {
      input { stationId: StationId, range: DateRange }
      output: List<TaskAssignment>
    }
  }

  // ============================================================
  // EVENTS
  // ============================================================

  events {
    @event TaskAssigned {
      taskId: TaskId
      targetId: StationId | ProviderId
      isOutsourced: Boolean
      scheduledStart: DateTime
      scheduledEnd: DateTime
      scheduleVersion: Int
    }

    @event TaskUnassigned {
      taskId: TaskId
      previousTargetId: StationId | ProviderId
      previousTimeSlot: TimeSlot
    }

    @event ConflictDetected {
      attemptedAssignment: ProposedAssignment
      conflicts: List<ScheduleConflict>
      suggestedStart: DateTime?
    }
  }

  // ============================================================
  // CONSTANTS
  // ============================================================

  constants {
    DRY_TIME = 4.hours @rule(BR-ELEM-005)
    GRID_SNAP_MINUTES = 30 @rule(BR-ASSIGN-006)
  }
}
```

---

## 19. Összefoglaló: DSL Elemek

| Kategória | Kulcsszavak |
|-----------|-------------|
| **Strategic** | `context-map`, `bounded-context`, `subdomain`, `relationship` |
| **Aggregate** | `aggregate`, `root`, `entity`, `value`, `enum` |
| **Behavior** | `command`, `query`, `event`, `saga`, `service` |
| **Rules** | `invariant`, `validate`, `pre`, `post`, `error` |
| **Types** | `String`, `Int`, `DateTime`, `List<>`, `?`, `|` |
| **Modifiers** | `@required`, `@computed`, `@identity`, `@indexed` |
| **Events** | `@emits`, `@consumes`, `@triggered-by` |
| **API** | `@http-status`, `@path`, `@body`, `@response` |

### 19.1 Függőségi diagram

A DSL elemek **hierarchikusan és függőségileg** épülnek egymásra:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEPENDENCY GRAPH                            │
└─────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │    Strategic    │  ← Legfelső szint
                    │  context-map    │
                    │ bounded-context │
                    └────────┬────────┘
                             │ contains
                             ▼
                    ┌─────────────────┐
                    │   Aggregate     │  ← Context-en belül
                    │  root, entity   │
                    │  value, enum    │
                    └────────┬────────┘
                             │ defines
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌─────────────┐  ┌───────────┐  ┌───────────┐
     │  Behavior   │  │   Rules   │  │  Events   │
     │  command    │  │ invariant │  │  @emits   │
     │  query      │──│ validate  │──│ @consumes │
     │  service    │  │ pre/post  │  │           │
     └──────┬──────┘  └─────┬─────┘  └─────┬─────┘
            │               │              │
            └───────────────┼──────────────┘
                            │ uses
              ┌─────────────┴─────────────┐
              ▼                           ▼
     ┌─────────────────┐         ┌─────────────────┐
     │     Types       │         │   Modifiers     │  ← Alapvető építőkockák
     │ String, Int     │         │ @required       │
     │ List<>, ?, |    │         │ @computed       │
     └─────────────────┘         │ @identity       │
                                 └─────────────────┘
                                          │
                                          │ exposed via
                                          ▼
                                 ┌─────────────────┐
                                 │      API        │  ← Külső interfész
                                 │ @http-status    │
                                 │ @path, @body    │
                                 └─────────────────┘
```

### 19.2 Részletes függőségek

| Elem | Függ ezektől | Tartalmazza |
|------|--------------|-------------|
| **context-map** | - | bounded-context, relationship |
| **bounded-context** | context-map | aggregate, subdomain |
| **aggregate** | bounded-context, Types | root, entity, value, enum, commands, events |
| **entity/value** | Types, Modifiers | attributes, methods |
| **command** | entity, Rules, Events | input, output, @validates, @emits |
| **query** | entity, Types | input, output |
| **invariant** | entity attributes | forall, conditions |
| **event** | entity, Types | payload, metadata |
| **API** | command, query, Events | endpoints, responses |

### 19.3 Tanulási/implementálási sorrend

Ha valaki ezt a DSL-t szeretné megtanulni vagy implementálni, a javasolt sorrend:

```
 1. Types & Modifiers     ← Alap típusok, annotációk
    ↓
 2. value, enum           ← Egyszerű immutable objektumok
    ↓
 3. entity, root          ← Identitással rendelkező objektumok
    ↓
 4. aggregate             ← Entitások csoportosítása
    ↓
 5. invariant, validate   ← Üzleti szabályok
    ↓
 6. command, query        ← Viselkedés
    ↓
 7. event                 ← Események
    ↓
 8. bounded-context       ← Kontextus határok
    ↓
 9. context-map           ← Teljes rendszer
    ↓
10. API                   ← Külső interfészek
```

---

## 20. További lehetőségek

A DSL specifikáció alapján a következő eszközök készíthetők:

1. **VS Code syntax highlighting extension** - `.ddd` fájlok szerkesztéséhez
2. **Parser/Validator** - DSL fájlok beolvasása és validálása
3. **Teljes projekt példa** - Flux projekt átírása DSL-be

---

*Verzió: 1.0*
*Létrehozva: 2025-02-05*
*Szerző: Claude Code*
