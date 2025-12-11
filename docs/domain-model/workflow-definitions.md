# Workflow & State-Transition Definitions – Operations Research System

This document provides **text-based workflow and lifecycle definitions** for the Equipment → Operator → Job → Task assignment and validation domain.  
These replace UML/activity/state diagrams and are optimized for AI processing and small-team collaboration.

---

# 1. Operator Workflow

## State Machine: Operator

```
STATE MACHINE: Operator
Initial: Active

Active → Inactive         (when operator is temporarily unavailable)
Inactive → Active         (when operator returns to work)
Active → Deactivated     (when operator permanently leaves)
Inactive → Deactivated   (when inactive operator is removed)
```

### Notes
- Only **Active** operators can be assigned to new tasks.
- **Inactive** preserves history but prevents new assignments.
- **Deactivated** is terminal state for audit trail.

---

# 2. Equipment Workflow

## State Machine: Equipment

```
STATE MACHINE: Equipment
Initial: Available

Available → InUse        (when assigned to a task)
InUse → Available        (when task completes)
Available → Maintenance  (scheduled or urgent maintenance)
InUse → Maintenance      (emergency maintenance, affects current task)
Maintenance → Available  (maintenance completed)
Available → OutOfService (permanent or long-term unavailability)
Maintenance → OutOfService (major failure during maintenance)
```

### Notes
- **InUse** equipment cannot be assigned to other tasks.
- Transition to **Maintenance** triggers conflict detection.
- **OutOfService** requires manual intervention to return.

---

# 3. Job Workflow

## State Machine: Job

```
STATE MACHINE: Job
Initial: Draft

Draft → Planned          (when all tasks defined with dependencies)
Planned → InProgress     (when first task starts)
InProgress → Completed   (when all tasks complete)
InProgress → Delayed     (when deadline at risk)
Delayed → InProgress     (when back on track)
Delayed → Completed      (completed despite delay)
Draft → Cancelled        (early cancellation)
Planned → Cancelled      (before execution)
InProgress → Cancelled   (abort during execution)
```

### Notes
- **Planned** requires valid task dependency graph (DAG).
- **InProgress** triggered by first task assignment execution.
- **Delayed** is warning state, not terminal.

---

# 4. Task Workflow (within Job)

## State Machine: Task

```
STATE MACHINE: Task
Initial: Defined

Defined → Ready          (when all dependencies completed)
Ready → Assigned         (when resources allocated)
Assigned → Executing     (when scheduled time arrives)
Executing → Completed    (normal completion)
Executing → Failed       (execution problem)
Failed → Ready           (retry after fixing issue)
Defined → Cancelled      (job cancellation cascade)
Ready → Cancelled        (job cancellation cascade)
Assigned → Cancelled     (job cancellation cascade)
Executing → Cancelled    (job cancellation during execution)
```

### Notes
- **Ready** means dependencies satisfied but no resources yet.
- **Assigned** means resources allocated but not started.
- **Failed** tasks can be retried by returning to Ready.

---

# 5. Assignment Process Workflow

## Process: Task Assignment

```
PROCESS: Task Assignment

1. Check task is in Ready state (dependencies completed)
2. Identify resource requirements:
   a) requires_operator → find available operators
   b) requires_equipment → find compatible equipment
3. For each candidate assignment:
   a) Validate operator skills match equipment
   b) Check operator availability covers task duration
   c) Check no scheduling conflicts
   d) Verify job deadline can still be met
4. If valid assignment found:
   a) Create TaskAssignment with scheduled_start and scheduled_end
   b) Update task state → Assigned
   c) Reserve operator/equipment time slots for the scheduled period
   d) Publish TaskAssigned event with timing information
5. If no valid assignment:
   a) Report conflicts
   b) Task remains in Ready state
```

### Notes
- Assignment is atomic - either complete or rollback.
- Partial assignments not allowed in base workflow.

---

# 6. Validation Workflow

## Process: Assignment Validation

```
PROCESS: Assignment Validation

1. Receive validation request with proposed assignments
2. Load current schedule state
3. For each assignment, validate:
   
   [Resource Validation]
   - Operator exists and is Active
   - Equipment exists and is Available
   - Task type matches equipment capabilities
   
   [Skill Validation]
   - If task needs both operator and equipment:
     → Operator has skill for assigned equipment
   
   [Time Validation]
   - Scheduled time within operator availability
   - No operator double-booking
   - No equipment double-booking
   
   [Dependency Validation]
   - All required tasks completed before start
   - No circular dependencies
   
   [Deadline Validation]
   - Task completes before job deadline
   
4. Return validation result:
   - Valid → proceed with assignment
   - Invalid → list all conflicts found
```

---

# 7. Schedule Management Workflow

## Process: Schedule Update

```
PROCESS: Schedule Update

TRIGGER: Resource availability change / Task modification / New assignment

1. Identify affected tasks:
   a) Tasks assigned to changed resource
   b) Tasks dependent on modified task
   c) Tasks in same job as modified task

2. For each affected task:
   a) Re-validate current assignment
   b) If invalid:
      - Mark conflict
      - Optionally suggest alternatives

3. Cascade checks:
   a) Check job deadline still achievable
   b) Update critical path if needed
   c) Notify affected operators

4. Publish events:
   - ScheduleUpdated
   - ConflictDetected (if any)
   - JobAtRisk (if deadline threatened)
```

---

# 8. End-to-End Business Workflow

```
OperatorCreated
→ EquipmentCreated
→ JobCreated
→ TasksAddedToJob
→ DependenciesSet
→ JobPlanned
→ TaskReady
→ ResourcesAssigned
→ AssignmentValidated
→ TaskExecuting
→ TaskCompleted
→ AllTasksCompleted
→ JobCompleted
```

---

# 9. Domain Events (for integration)

```
// Resource Events
OperatorCreated
OperatorActivated
OperatorDeactivated
OperatorAvailabilityChanged
OperatorSkillAdded

EquipmentCreated
EquipmentStatusChanged
EquipmentMaintenanceScheduled
EquipmentMaintenanceCompleted

// Job & Task Events
JobCreated
JobPlanned
JobStarted
JobCompleted
JobCancelled
JobDelayed

TaskCreated
TaskDependencyAdded
TaskReady
TaskAssigned
TaskStarted
TaskCompleted
TaskFailed
TaskCancelled

// Assignment & Schedule Events
AssignmentProposed
AssignmentValidated
AssignmentRejected
ConflictDetected
ScheduleUpdated
ScheduleOptimized

// Alert Events
DeadlineAtRisk
ResourceConflict
DependencyViolation
```

---

# 10. Conflict Resolution Workflow

## Process: Conflict Resolution

```
PROCESS: Conflict Resolution

TRIGGER: ConflictDetected event

1. Categorize conflict:
   - ResourceConflict → overlapping assignments
   - AvailabilityConflict → outside working hours
   - DependencyConflict → wrong execution order
   - DeadlineConflict → cannot meet deadline
   - SkillConflict → missing qualifications

2. Resolution strategies:
   
   [ResourceConflict]
   - Find alternative operator/equipment
   - Reschedule one of conflicting tasks
   - Split task if allowed by policy
   
   [AvailabilityConflict]
   - Find alternative operator
   - Negotiate overtime (if policy allows)
   - Reschedule to available time
   
   [DependencyConflict]
   - Reorder task execution
   - Fast-track prerequisite tasks
   
   [DeadlineConflict]
   - Add resources (parallel execution)
   - Negotiate deadline extension
   - Reduce task scope if possible

3. Apply resolution:
   - Update assignments
   - Re-validate entire schedule
   - Notify affected parties

4. If unresolvable:
   - Escalate to human planner
   - Mark job as "at risk"
```

---

This document defines the complete workflow and state transitions for the Operations Research system. Implementation should enforce these state machines and processes while allowing for configuration of specific policies.
