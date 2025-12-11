# Sequence Design — Operations Research System

This document provides both **textual** and **Mermaid‑based** sequence specifications for key interactions in the Equipment → Operator → Job → Task assignment and validation workflow.

Each sequence describes:
- **Trigger** — what starts the interaction
- **Participants** — components involved in the sequence
- **Validation & state transitions**
- **Domain events** emitted internally
- **Integration events** published for other services
- **Outcome** — the resulting system state
- **Visual representation** — a Mermaid sequence diagram aligned with the textual steps

---

## 1. Task Assignment and Scheduling

**Trigger:** Scheduler requests to assign resources and set timing for a task.

**Participants:**
- Production Scheduler (user)
- Assignment & Validation Service
- Resource Management Service
- Job Management Service
- Scheduling View Service

**Sequence:**
1. Scheduler sends `AssignResources(taskId, operatorId, equipmentId, scheduledStart)` to **Assignment & Validation Service**.
2. Assignment Service queries **Job Management Service** for task details:
   - Task requirements (duration, equipment type)
   - Task dependencies
   - Job deadline
3. Assignment Service queries **Resource Management Service**:
   - Operator skills and availability
   - Equipment capabilities and status
4. Assignment Service validates:
   - Operator has required skills for equipment
   - Resources available at scheduled time
   - No scheduling conflicts exist
   - Dependencies satisfied (prerequisites completed)
   - Job deadline can be met
5. If valid:
   - Assignment Service creates ValidatedAssignment
   - Updates Schedule aggregate
   - Calculates scheduledEnd = scheduledStart + duration
6. Assignment Service emits domain event `TaskAssigned`.
7. Assignment Service publishes integration event **`Assignment.TaskScheduled`**.
8. Scheduling View Service receives event and updates read models.

**Outcome:**
Task is successfully scheduled with resources and timing, visible in all views.

**Exceptions:**
- **SkillMismatch:** Operator lacks certification → Reject with suggested operators
- **ResourceConflict:** Double-booking detected → Show conflicting assignments
- **DependencyViolation:** Prerequisites incomplete → Show blocking tasks

```mermaid
sequenceDiagram
    participant Scheduler
    participant Assignment as Assignment & Validation Service
    participant Job as Job Management Service
    participant Resource as Resource Management Service
    participant View as Scheduling View Service

    Scheduler->>Assignment: AssignResources(taskId, operatorId,<br>equipmentId, scheduledStart)
    Assignment->>Job: GetTaskDetails(taskId)
    Job-->>Assignment: Task(duration, requirements,<br>dependencies, jobDeadline)
    Assignment->>Resource: CheckOperator(operatorId)
    Resource-->>Assignment: Operator(skills, availability)
    Assignment->>Resource: CheckEquipment(equipmentId)
    Resource-->>Assignment: Equipment(capabilities, status)
    Assignment->>Assignment: Validate all constraints<br>(skills, availability, conflicts,<br>dependencies, deadline)
    alt Validation Success
        Assignment->>Assignment: Create ValidatedAssignment<br>Update Schedule aggregate<br>Calculate scheduledEnd
        Assignment-->>Assignment: TaskAssigned<br>(domain event)
        Assignment-->>View: Assignment.TaskScheduled<br>(integration event)
        View->>View: Update read models
    else Validation Failure
        Assignment-->>Scheduler: Reject with reason<br>and suggestions
    end
```

---

## 2. Task Execution Start

**Trigger:** Operator begins executing an assigned task.

**Participants:**
- Operator (user)
- Execution Tracking Service
- Assignment & Validation Service
- Job Management Service

**Sequence:**
1. Operator sends `StartTaskExecution(taskId, operatorId)` to **Execution Tracking Service**.
2. Execution Service queries **Assignment Service** for task assignment:
   - Verify operator is assigned
   - Get scheduled start time
3. Execution Service validates:
   - Current time within allowed window (±15 minutes of scheduled)
   - Task status is Assigned (not already started)
4. Execution Service creates TaskExecution:
   - Records actual start time
   - Calculates start variance
5. Execution Service emits domain event `TaskStarted`.
6. Execution Service publishes integration event **`Execution.TaskProgressUpdate`**.
7. Job Management Service receives event:
   - Updates task status to Executing
   - Checks if job should transition to InProgress

**Outcome:**
Task execution is tracked with actual timing, job status updated if needed.

```mermaid
sequenceDiagram
    participant Operator
    participant Execution as Execution Tracking Service
    participant Assignment as Assignment Service
    participant Job as Job Management Service

    Operator->>Execution: StartTaskExecution(taskId, operatorId)
    Execution->>Assignment: GetAssignment(taskId)
    Assignment-->>Execution: Assignment(operatorId,<br>scheduledStart, scheduledEnd)
    Execution->>Execution: Validate operator match<br>Check time window<br>Verify task not started
    Execution->>Execution: Create TaskExecution<br>Record actualStart<br>Calculate variance
    Execution-->>Execution: TaskStarted<br>(domain event)
    Execution-->>Job: Execution.TaskProgressUpdate<br>(integration event)
    Job->>Job: Update task status → Executing
    Job->>Job: Check if first task<br>If yes: Job → InProgress
```

---

## 3. Resource Availability Change

**Trigger:** Operator's availability schedule is modified.

**Participants:**
- HR System or Manager
- Resource Management Service
- Assignment & Validation Service
- Notification Service

**Sequence:**
1. Manager calls `UpdateOperatorAvailability(operatorId, newAvailability)` on **Resource Management Service**.
2. Resource Service validates:
   - Availability slots don't overlap
   - Format is valid
3. Resource Service updates Operator aggregate.
4. Resource Service identifies affected period.
5. Resource Service emits domain event `OperatorAvailabilityChanged`.
6. Resource Service publishes **`ResourceManagement.OperatorAvailabilityChanged`**.
7. Assignment Service receives event:
   - Finds assignments in affected period
   - Validates each against new availability
   - Detects any new conflicts
8. For each conflict:
   - Assignment Service publishes **`Assignment.ConflictDetected`**
9. Notification Service alerts affected schedulers and operators.

**Outcome:**
Availability updated, conflicts detected and communicated to relevant parties.

```mermaid
sequenceDiagram
    participant Manager
    participant Resource as Resource Management Service
    participant Assignment as Assignment Service
    participant Notification as Notification Service

    Manager->>Resource: UpdateOperatorAvailability<br>(operatorId, newAvailability)
    Resource->>Resource: Validate slots<br>(no overlap, valid format)
    Resource->>Resource: Update Operator aggregate<br>Identify affected period
    Resource-->>Resource: OperatorAvailabilityChanged<br>(domain event)
    Resource-->>Assignment: ResourceManagement.<br>OperatorAvailabilityChanged<br>(integration event)
    Assignment->>Assignment: Find assignments in period
    Assignment->>Assignment: Validate each assignment
    loop For each conflict
        Assignment-->>Notification: Assignment.ConflictDetected<br>(integration event)
    end
    Notification->>Notification: Alert schedulers<br>Alert affected operators
```

---

## 4. Job Planning with Dependencies

**Trigger:** Production planner creates a new job with multiple interdependent tasks.

**Participants:**
- Production Planner
- Job Management Service
- Assignment & Validation Service

**Sequence:**
1. Planner calls `CreateJob(name, deadline)` on **Job Management Service**.
2. Job Service creates Job aggregate in Draft state.
3. Planner adds tasks: `AddTask(jobId, taskDetails)` multiple times.
4. For each task:
   - Job Service validates task type and duration
   - Adds task to job
   - Emits `TaskAddedToJob`
5. Planner sets dependencies: `SetTaskDependency(fromTaskId, toTaskId)`.
6. Job Service validates:
   - No circular dependencies (DAG validation)
   - Dependencies within same job
7. Planner calls `PlanJob(jobId)`.
8. Job Service:
   - Calculates critical path
   - Validates deadline achievability
   - Transitions Job to Planned state
9. Job Service publishes **`JobManagement.TaskStructureChanged`**.
10. Assignment Service receives event and prepares for scheduling.

**Outcome:**
Job created with validated task structure ready for resource assignment.

```mermaid
sequenceDiagram
    participant Planner
    participant Job as Job Management Service
    participant Assignment as Assignment Service

    Planner->>Job: CreateJob(name, deadline)
    Job->>Job: Create Job aggregate<br>Status = Draft
    Job-->>Planner: jobId

    loop Add tasks
        Planner->>Job: AddTask(jobId, taskDetails)
        Job->>Job: Validate task<br>Add to job
        Job-->>Job: TaskAddedToJob<br>(domain event)
    end

    loop Set dependencies
        Planner->>Job: SetTaskDependency<br>(fromTaskId, toTaskId)
        Job->>Job: Validate no cycles<br>Check same job
        Job-->>Job: TaskDependencySet<br>(domain event)
    end

    Planner->>Job: PlanJob(jobId)
    Job->>Job: Calculate critical path<br>Validate deadline feasible<br>Job → Planned
    Job-->>Assignment: JobManagement.<br>TaskStructureChanged<br>(integration event)
    Assignment->>Assignment: Prepare for scheduling
```

---

## 5. Schedule Conflict Resolution

**Trigger:** System detects scheduling conflict during validation.

**Participants:**
- Assignment & Validation Service
- Scheduling Optimization Service (internal)
- Production Scheduler
- Notification Service

**Sequence:**
1. Assignment Service detects conflict during validation.
2. Assignment Service analyzes conflict type:
   - ResourceConflict: Same resource double-booked
   - DependencyViolation: Task scheduled before prerequisite
   - DeadlineRisk: Critical path exceeds deadline
3. Assignment Service queries for alternatives:
   - Available operators with required skills
   - Alternative time slots
   - Equipment substitutes
4. Assignment Service generates suggestions.
5. Assignment Service publishes **`Assignment.ConflictDetected`** with:
   - Conflict details
   - Suggested resolutions
   - Severity level
6. Notification Service alerts scheduler.
7. Scheduler reviews suggestions.
8. Scheduler applies resolution by calling `RescheduleTask` or `ReassignTask`.

**Outcome:**
Conflict identified, alternatives suggested, and resolution applied.

```mermaid
sequenceDiagram
    participant Assignment as Assignment Service
    participant Optimizer as Optimization Logic
    participant Scheduler
    participant Notification as Notification Service

    Assignment->>Assignment: Detect conflict<br>during validation
    Assignment->>Assignment: Analyze type:<br>Resource/Dependency/Deadline
    Assignment->>Optimizer: Find alternatives<br>(operators, times, equipment)
    Optimizer-->>Assignment: Suggested resolutions
    Assignment-->>Notification: Assignment.ConflictDetected<br>(conflict + suggestions)
    Notification->>Scheduler: Alert with details
    Scheduler->>Scheduler: Review suggestions
    Scheduler->>Assignment: Apply resolution<br>(Reschedule/Reassign)
```

---

## 6. Task Completion and Progress Update

**Trigger:** Operator completes task execution.

**Participants:**
- Operator
- Execution Tracking Service
- Job Management Service
- Assignment & Validation Service

**Sequence:**
1. Operator calls `CompleteTask(taskId, qualityCheckResults)`.
2. Execution Service validates:
   - Task was started
   - Operator matches executor
3. Execution Service records:
   - Actual end time
   - Duration variance
   - Quality check results
4. Execution Service emits `TaskCompleted`.
5. Execution Service publishes **`Execution.TaskProgressUpdate`**.
6. Job Management Service:
   - Updates task status to Completed
   - Checks dependent tasks for readiness
   - Transitions ready tasks to Ready state
7. If all job tasks completed:
   - Job transitions to Completed
   - Publishes job completion event
8. Assignment Service updates schedule metrics.

**Outcome:**
Task marked complete, dependent tasks enabled, job progress updated.

```mermaid
sequenceDiagram
    participant Operator
    participant Execution as Execution Service
    participant Job as Job Management Service
    participant Assignment as Assignment Service

    Operator->>Execution: CompleteTask(taskId,<br>qualityCheckResults)
    Execution->>Execution: Validate started<br>Verify operator
    Execution->>Execution: Record actualEnd<br>Calculate variance<br>Store quality results
    Execution-->>Execution: TaskCompleted<br>(domain event)
    Execution-->>Job: Execution.TaskProgressUpdate<br>(integration event)
    Job->>Job: Task → Completed
    Job->>Job: Check dependencies<br>Enable dependent tasks
    alt All tasks completed
        Job->>Job: Job → Completed
        Job-->>Assignment: Job completed event
    end
    Assignment->>Assignment: Update metrics
```

---

## Notes
- These specifications use a **text-first structure** supplemented by **Mermaid sequence diagrams** for clarity
- They express ordering, participants, validations, and events
- Exception handling is explicitly documented where relevant
- The sequences focus on the core scheduling functionality of the system
- Integration with external systems (HR, IoT sensors) is shown where applicable
