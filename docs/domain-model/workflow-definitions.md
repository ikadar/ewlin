# Workflow & State-Transition Definitions – Flux Print Shop Scheduling System

This document provides **text-based workflow and lifecycle definitions** for the print shop scheduling domain.
These replace UML/activity/state diagrams and are optimized for AI processing and small-team collaboration.

---

# 1. Station Workflow

## State Machine: Station
#### WF-STATION-SM-001
> **References:** [DM-ENUM-STATION-001](domain-model.md#dm-enum-station-001), [BR-STATION-004](business-rules.md#br-station-004)

```
STATE MACHINE: Station
Initial: Available

Available → InUse           (when task execution starts on station)
InUse → Available           (when task completes)
Available → Maintenance     (scheduled or urgent maintenance)
InUse → Maintenance         (emergency maintenance, affects current task)
Maintenance → Available     (maintenance completed)
Available → OutOfService    (permanent or long-term unavailability)
Maintenance → OutOfService  (major failure during maintenance)
OutOfService → Available    (repaired and restored)
```

### Notes
- **InUse** stations cannot be assigned to other tasks (capacity=1).
- Transition to **Maintenance** triggers conflict detection for scheduled tasks.
- **OutOfService** requires manual intervention to return.
- Outsourced providers don't use this state machine (always available with unlimited capacity).

---

# 2. Job Workflow

## State Machine: Job
#### WF-JOB-SM-001
> **References:** [DM-ENUM-JOB-001](domain-model.md#dm-enum-job-001), [BR-JOB-005](business-rules.md#br-job-005)

```
STATE MACHINE: Job
Initial: Draft

Draft → Planned          (when all tasks defined and approval gates acceptable)
Planned → InProgress     (when first task starts)
InProgress → Completed   (when all tasks complete)
InProgress → Delayed     (when deadline at risk)
Delayed → InProgress     (when back on track)
Delayed → Completed      (completed despite delay)
Draft → Cancelled        (early cancellation)
Planned → Cancelled      (before execution)
InProgress → Cancelled   (abort during execution)
Delayed → Cancelled      (abort during delay)
```

### Notes
- **Planned** requires at least one task defined.
- **InProgress** triggered by first task assignment execution.
- **Delayed** is warning state, not terminal. Transition to Delayed is automatic when scheduled completion exceeds workshopExitDate.
- **Delayed → InProgress** transition is automatic when tasks are rescheduled to meet the deadline.
- Cancellation cascades to all tasks.

## Process: Job Cancellation
#### WF-JOB-PROC-001
> **References:** [BR-JOB-010](business-rules.md#br-job-010), [BR-JOB-010b](business-rules.md#br-job-010b)

```
PROCESS: Job Cancellation

1. User requests job cancellation
2. System changes job status to Cancelled
3. For each task in the job:
   a) If task has assignment scheduled in the FUTURE:
      → Remove assignment (recall tile)
      → Task status changes to Cancelled
   b) If task has assignment scheduled in the PAST:
      → Assignment REMAINS for historical reference
      → Task status changes to Cancelled
   c) If task is unassigned:
      → Task status changes to Cancelled
4. Publish JobCancelled event
```

### Notes
- Past assignments are preserved for reporting and historical accuracy
- Future assignments are automatically recalled to free up station time
- "Past" is determined by scheduledStart relative to current system time

---

# 3. Task Workflow (within Job)

## State Machine: Task
#### WF-TASK-SM-001
> **References:** [DM-ENUM-TASK-001](domain-model.md#dm-enum-task-001), [BR-TASK-001](business-rules.md#br-task-001), [BR-ASSIGN-007](business-rules.md#br-assign-007)

```
STATE MACHINE: Task
Initial: Defined

Defined → Ready          (when previous task completed, or first task with approval gates cleared)
Ready → Assigned         (when scheduled on station with time slot)
Assigned → Executing     (when scheduled time arrives and work begins)
Executing → Completed    (normal completion)
Executing → Failed       (execution problem)
Failed → Ready           (retry after fixing issue)
Assigned → Ready         (unassign / recall tile)
Defined → Cancelled      (job cancellation cascade)
Ready → Cancelled        (job cancellation cascade)
Assigned → Cancelled     (job cancellation cascade)
Executing → Cancelled    (job cancellation during execution)
```

### Notes
- **Ready** means previous task completed and approval gates satisfied.
- **Assigned** means scheduled with specific time slot on station.
- **Failed** tasks can be retried by returning to Ready.
- Recalling a tile moves from Assigned back to Ready.
- **IsCompleted** is a separate tracking flag (not a state). Tasks can be marked completed via UI checkbox regardless of their state. This does NOT affect precedence validation.

---

# 4. Approval Gate Workflows

## Process: BAT (Proof) Approval
#### WF-GATE-PROC-001
> **References:** [BR-GATE-001](business-rules.md#br-gate-001), [BR-GATE-003](business-rules.md#br-gate-003)

```
PROCESS: BAT Approval

1. Job created with proofSentAt = null
2. User actions:
   a) Set proofSentAt = "AwaitingFile" → waiting for client file
   b) Set proofSentAt = "NoProofRequired" → bypass proof, tasks can be scheduled
   c) Set proofSentAt = <datetime> → proof sent to client
3. If proof sent, wait for client response:
   a) Client approves → set proofApprovedAt = <datetime>
   b) Client requests changes → send revised proof (update proofSentAt)
4. When proofApprovedAt is set (or proofSentAt = "NoProofRequired"):
   → Tasks can be scheduled
```

## Process: Plates Approval
#### WF-GATE-PROC-002
> **References:** [BR-GATE-002](business-rules.md#br-gate-002)

```
PROCESS: Plates Approval

1. Job created with platesStatus = "Todo"
2. Plates preparation work happens (external to system)
3. User marks platesStatus = "Done"
4. When platesStatus = "Done":
   → Printing tasks on offset stations can proceed
```

---

# 5. Paper Procurement Workflow

## Process: Paper Procurement
#### WF-PAPER-PROC-001
> **References:** [BR-PAPER-001](business-rules.md#br-paper-001), [BR-PAPER-002](business-rules.md#br-paper-002), [BR-PAPER-003](business-rules.md#br-paper-003)

```
PROCESS: Paper Procurement

1. Job created with paperPurchaseStatus:
   a) "InStock" → paper already available, proceed immediately
   b) "ToOrder" → paper needs to be ordered

2. If "ToOrder":
   a) User places order externally
   b) User updates status to "Ordered"
   c) System records paperOrderedAt = now()

3. When paper arrives:
   a) User updates status to "Received"

4. Production should wait until:
   → paperPurchaseStatus = "InStock" OR "Received"
```

---

# 6. Task Assignment Workflow

## Process: Task Assignment (Internal Task)
#### WF-ASSIGN-PROC-001
> **References:** [BR-ASSIGN-001](business-rules.md#br-assign-001)

```
PROCESS: Task Assignment (Internal)

1. Check task is in Ready state (previous task completed)
2. Check approval gates:
   a) proofApprovedAt is set OR proofSentAt = "NoProofRequired"
   b) platesStatus = "Done" (if printing task)
3. Check station:
   a) Station exists and is Available
   b) No conflicting assignments at proposed time
   c) Station group has capacity
4. Check job dependencies:
   a) All required jobs are completed
5. If all valid:
   a) Create TaskAssignment with scheduledStart and scheduledEnd
   b) Update task state → Assigned
   c) Reserve station time slot
   d) Publish TaskAssigned event
6. If validation fails:
   a) Report conflicts
   b) Task remains in Ready state
```

## Process: Task Assignment (Outsourced Task)
#### WF-ASSIGN-PROC-002
> **References:** [BR-TASK-008](business-rules.md#br-task-008), [BR-TASK-009](business-rules.md#br-task-009), [CAL-001](business-rules.md#cal-001)

```
PROCESS: Task Assignment (Outsourced)

1. Check task is in Ready state
2. Check approval gates
3. Check provider:
   a) Provider exists and is Active
   b) Provider supports the action type
   c) (No capacity check - unlimited)
4. Calculate scheduledEnd using business calendar:
   a) Check scheduledStart against provider's LatestDepartureTime:
      - If scheduledStart <= LatestDepartureTime: effectiveStartDay = scheduledStart date
      - If scheduledStart > LatestDepartureTime: effectiveStartDay = next business day
   b) Calculate end day: effectiveStartDay + durationOpenDays (business days)
   c) scheduledEnd = end day at provider's ReceptionTime
5. Create assignment and update state
```

### Notes (Outsourced Timing)
- **LatestDepartureTime**: Time by which work must be sent for that day to count as first business day (e.g., 14:00)
- **ReceptionTime**: Time when completed work returns from provider (e.g., 09:00)
- Example: Task scheduled at 15:00 on Monday with LatestDepartureTime=14:00 and 2JO → work leaves Tuesday, returns Thursday at ReceptionTime

---

# 6b. Task Completion Workflow

## Process: Mark Task as Completed
#### WF-ASSIGN-PROC-003
> **References:** [BR-ASSIGN-007](business-rules.md#br-assign-007), [BR-ASSIGN-008](business-rules.md#br-assign-008)

```
PROCESS: Mark Task as Completed

1. User toggles completion checkbox on tile
2. System updates task:
   a) Set IsCompleted = true
   b) Set CompletedAt = current timestamp
3. UI updates:
   a) Tile shows completion indicator
4. Precedence validation:
   a) IsCompleted does NOT affect precedence calculations
   b) Schedule continues to use scheduled times, not completion status
5. User can toggle off:
   a) Set IsCompleted = false
   b) Set CompletedAt = null
```

### Notes
- Completion is purely for tracking purposes
- Tasks in the past are NOT automatically marked as completed
- Precedence rules always use scheduled times, assuming tasks will happen as planned

---

# 7. Scheduling Validation Workflow

## Process: Assignment Validation
#### WF-VALID-PROC-001
> **References:** [VAL-001](business-rules.md#val-001)

```
PROCESS: Assignment Validation

1. Receive validation request with proposed assignment
2. Load current schedule state
3. Validate:

   [Station Validation]
   - Station exists and is Available
   - Station capacity not exceeded

   [Group Validation]
   - Station group MaxConcurrent not exceeded at proposed time

   [Time Validation]
   - Scheduled time within station operating hours
   - Task stretched correctly across non-operating periods
   - No station double-booking

   [Sequence Validation]
   - Previous task in job completed (or this is first task)
   - All required jobs completed

   [Gate Validation]
   - Proof approved or not required
   - Plates done (for printing tasks)

   [Deadline Validation]
   - Task completes before job workshopExitDate

4. Return validation result:
   - Valid → proceed with assignment
   - Invalid → list all conflicts found
```

---

# 8. Schedule Conflict Detection Workflow

## Process: Conflict Detection
#### WF-CONFLICT-PROC-001
> **References:** [BR-SCHED-001](business-rules.md#br-sched-001), [BR-SCHED-002](business-rules.md#br-sched-002), [BR-SCHED-003](business-rules.md#br-sched-003)

```
PROCESS: Conflict Detection

TRIGGER: Station availability change / Task modification / New assignment

1. Identify affected tasks:
   a) Tasks assigned to changed station
   b) Tasks in same station group
   c) Tasks in same job (sequence dependencies)
   d) Tasks in dependent jobs

2. For each affected task:
   a) Re-validate current assignment
   b) If invalid:
      - Create ScheduleConflict
      - Mark task assignment as invalid

3. Conflict types to detect:
   - StationConflict: double-booking
   - GroupCapacityConflict: exceeds MaxConcurrent
   - PrecedenceConflict: wrong sequence order
   - ApprovalGateConflict: gates not satisfied
   - AvailabilityConflict: outside station operating hours
   - DeadlineConflict: exceeds workshopExitDate

4. Publish events:
   - ConflictDetected (for each conflict)
   - ScheduleUpdated
```

---

# 9. End-to-End Business Workflow

```
StationCategoryCreated
→ StationGroupCreated
→ StationCreated
→ ProviderCreated (optional)
→ JobCreated
→ TasksDefinedFromDSL
→ ProofSent (or NoProofRequired)
→ ProofApproved
→ PlatesDone
→ PaperReceived
→ JobPlanned
→ TaskReady
→ TaskAssigned (tile placed)
→ TaskExecuting
→ TaskCompleted
→ AllTasksCompleted
→ JobCompleted
```

---

# 10. Domain Events (for integration)

```
// Station Events
StationCreated
StationScheduleUpdated
StationExceptionAdded
StationStatusChanged

// Category & Group Events
StationCategoryCreated
StationGroupCreated
MaxConcurrentUpdated

// Provider Events
ProviderCreated
ProviderStatusChanged

// Job Events
JobCreated
JobUpdated
JobPlanned
JobStarted
JobCompleted
JobCancelled
JobDelayed

// Task Events
TaskAddedToJob
TaskRemovedFromJob
TasksReordered
TaskReady
TaskAssigned
TaskUnassigned
TaskStarted
TaskCompleted
TaskFailed
TaskCancelled

// Approval Gate Events
ProofSent
ProofApproved
PlatesCompleted
PaperStatusChanged

// Comment Events
CommentAdded

// Schedule Events
ScheduleCreated
ScheduleUpdated
ConflictDetected
ConflictResolved

// Alert Events
DeadlineAtRisk
GroupCapacityExceeded
```

---

# 11. Tile Interaction Workflow (UI)

## Process: Drag and Drop Assignment
#### WF-UI-PROC-001
> **References:** [UI-001](business-rules.md#ui-001), [UI-002](business-rules.md#ui-002), [UI-003](business-rules.md#ui-003)

```
PROCESS: Drag and Drop Assignment

1. User starts dragging task from left panel (unscheduled) or center grid (reschedule)
2. During drag:
   a) System validates proposed drop location in real-time (<10ms)
   b) Valid locations highlighted
   c) Invalid locations shown with red indicator
   d) If precedence violation detected:
      → Snap to nearest valid timeslot (safeguard)
      → Unless Alt key held (bypass safeguard)
3. On drop:
   a) Server validates assignment (authoritative)
   b) If valid: create/update assignment
   c) If invalid: show conflict resolution panel (MVP: visual warning only, no hard block)
4. Assignment created:
   a) Tile appears on grid at scheduled position
   b) Tile in left panel becomes semi-transparent with "recall" button
```

## Process: Tile Insertion (Push-Down Behavior)
#### WF-UI-PROC-002
> **References:** [BR-ASSIGN-009](business-rules.md#br-assign-009), [BR-PROVIDER-003](business-rules.md#br-provider-003)

```
PROCESS: Tile Insertion

1. User drops tile at position on a station
2. System checks station capacity:

   [Capacity-1 Station]:
   a) Tiles CANNOT overlap on same station
   b) If dropped position overlaps existing tiles:
      → Insert new tile at dropped position
      → Push ALL subsequent tiles down (later in time)
      → Recalculate scheduledStart/End for all affected tiles
   c) Gap handling:
      → If dropped into empty slot, no push needed
      → If dropped between tiles, subsequent tiles push down

   [Capacity > 1 Station (or Provider)]:
   a) Tiles CAN overlap up to capacity limit
   b) If capacity allows: place tile at dropped position
   c) If capacity exceeded: show conflict warning

3. After insertion:
   a) Revalidate all affected tiles for precedence
   b) Show visual warnings for any new violations
```

### Notes (Tile Insertion)
- MVP validation is warnings-only; no hard blocks prevent user from creating assignments
- Push-down ensures no overlap on capacity-1 stations
- Users can intentionally create precedence violations (Alt+drag) but will see visual warnings

## Process: Recall Tile
#### WF-UI-PROC-003
> **References:** [UI-004](business-rules.md#ui-004)

```
PROCESS: Recall Tile

1. User hovers over semi-transparent tile in left panel
2. "Recall" button appears
3. User clicks "Recall"
4. System removes assignment:
   a) Task status changes from Assigned to Ready
   b) Tile disappears from center grid
   c) Tile in left panel becomes fully opaque (unscheduled)
   d) Only this tile is recalled (not siblings)
5. Station time slot is freed
```

## Process: Swap Position
#### WF-UI-PROC-004
> **References:** [BR-SCHED-003](business-rules.md#br-sched-003)

```
PROCESS: Swap Position

1. User clicks swap shortcut on tile (up or down arrow)
2. System swaps with adjacent tile:
   a) Validates swap doesn't violate constraints
   b) Updates scheduledStart/End for both tiles
   c) Re-validates schedule
3. If swap would violate constraints:
   a) Show warning
   b) Require confirmation or cancel
```

---

# 12. Similarity Indicators Workflow

## Process: Display Similarity Indicators
#### WF-SIM-PROC-001
> **References:** [BR-CATEGORY-001](business-rules.md#br-category-001), [BR-CATEGORY-003](business-rules.md#br-category-003), [UI-005](business-rules.md#ui-005)

```
PROCESS: Display Similarity Indicators

1. For each station column:
   a) Get ordered list of tiles (by scheduledStart)
   b) For each consecutive pair of tiles:
      - Get jobs for both tiles
      - Get station category
      - For each similarity criterion in category:
        - Read criterion's fieldPath (e.g., "paperType")
        - Get value from Job A at fieldPath
        - Get value from Job B at fieldPath
        - Compare values:
          → If values match: add filled circle (●)
          → If values differ: add hollow circle (○)
      - Position indicators between the two tiles

2. Visual representation:
   - Circles displayed vertically between tiles
   - Equal overlap on both tiles
   - Number of circles = number of criteria in category
```

### Notes (Similarity Comparison)
- Each SimilarityCriterion has a `fieldPath` that references a Job property
- Example: criterion with `fieldPath="paperType"` compares `job1.paperType` vs `job2.paperType`
- If Job A has `paperType="CB 300g"` and Job B has `paperType="CB 135g"` → hollow circle (not matching)

---

This document defines the complete workflow and state transitions for the Flux print shop scheduling system. Implementation should enforce these state machines and processes while allowing for configuration of specific policies.
