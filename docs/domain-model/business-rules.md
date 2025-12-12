# Business Rules & Domain Invariants – Flux Print Shop Scheduling System

This document captures core business rules and invariants for the **print shop scheduling** domain.
These rules are technology-agnostic and must hold regardless of implementation.

---

## Station

**BR-STATION-001 – Station must have a unique identifier**
Every Station MUST have a unique ID that cannot be changed once created.

**BR-STATION-002 – Station must belong to a category**
Every Station MUST be assigned to exactly one StationCategory.

**BR-STATION-003 – Station must belong to a group**
Every Station MUST be assigned to exactly one StationGroup.

**BR-STATION-004 – Station operating schedule required**
Every Station MUST have a defined operating schedule (weekly pattern).

**BR-STATION-005 – Operating schedule slots cannot overlap**
A Station's operating schedule time slots MUST NOT overlap within the same day.

**BR-STATION-006 – One task at a time for capacity-1 stations**
A Station with capacity=1 CANNOT be assigned to multiple tasks that overlap in time.

**BR-STATION-007 – Available status for assignments**
Only Stations with status `Available` can be assigned to new tasks (not `Maintenance` or `OutOfService`).

**BR-STATION-008 – Schedule exceptions override regular schedule**
A ScheduleException for a specific date MUST override the regular operating schedule for that date.

---

## Maintenance Block — *Post-MVP*

**BR-MAINT-001 – Maintenance blocks station availability**
A MaintenanceBlock MUST prevent task assignments during its scheduled period on the same station.

**BR-MAINT-002 – No overlap with task assignments**
A MaintenanceBlock CANNOT overlap with existing TaskAssignments on the same station.

**BR-MAINT-003 – Maintenance is independent of jobs**
A MaintenanceBlock is NOT associated with any Job or Task; it exists independently as a station time block.

---

## Station Category

**BR-CATEGORY-001 – Category must have similarity criteria**
Every StationCategory SHOULD define at least one similarity criterion for visual indicators.

**BR-CATEGORY-002 – Similarity criteria must be unique within category**
A StationCategory CANNOT have duplicate similarity criteria codes.

---

## Station Group

**BR-GROUP-001 – Group must have max concurrent defined**
Every StationGroup MUST have a MaxConcurrent value (integer or unlimited).

**BR-GROUP-002 – Group capacity enforcement**
At any point in time, the number of active tasks on stations in a group CANNOT exceed MaxConcurrent.

**BR-GROUP-003 – Outsourced provider groups are unlimited**
StationGroups marked as `IsOutsourcedProviderGroup` MUST have unlimited capacity.

**BR-GROUP-004 – All stations must have a group**
There MUST NOT be any station without a group assignment.

---

## Outsourced Provider

**BR-PROVIDER-001 – Provider must have unique identifier**
Every OutsourcedProvider MUST have a unique ID.

**BR-PROVIDER-002 – Provider creates own station group**
When an OutsourcedProvider is created, a corresponding StationGroup with unlimited capacity MUST be created automatically.

**BR-PROVIDER-003 – Provider has unlimited capacity**
OutsourcedProviders CAN have multiple overlapping tasks (no capacity limit).

**BR-PROVIDER-004 – Provider duration in open days**
Outsourced task durations MUST be specified in open days (JO), not minutes.

---

## Job

**BR-JOB-001 – Job must have a workshop exit date**
Every Job MUST have a defined workshopExitDate by which all tasks must be completed.

**BR-JOB-002 – Job must contain tasks**
A Job MUST contain at least one Task to be valid for scheduling.

**BR-JOB-003 – Job reference can be manipulated**
The Job reference field CAN be modified by users to manage order lines and parts.

**BR-JOB-004 – Job completion requires all tasks completed**
A Job can ONLY be marked as `Completed` when ALL its tasks are completed.

**BR-JOB-005 – Job cancellation cascades to tasks**
When a Job is cancelled, all its incomplete tasks MUST also be cancelled.

**BR-JOB-005b – Job Delayed status trigger**
A Job in `InProgress` status transitions to `Delayed` when:
- The scheduled completion time of the last task exceeds the workshopExitDate
- This is detected automatically by the system when:
  - A task is assigned that causes the job to become late
  - The schedule is recalculated and the job is found to be late
- The transition is automatic (not manual user action)
- A `Delayed` job can return to `InProgress` if tasks are rescheduled to meet the deadline

**BR-JOB-006 – Job dependencies are finish-to-start only**
Job dependencies (requiredJobs) are strictly finish-to-start: the first task of the dependent job cannot start until the last task of all required jobs are completed. No other dependency types (start-to-start, finish-to-finish) are supported.

**BR-JOB-007 – Required jobs must exist**
Every JobId in requiredJobs MUST reference an existing job.

**BR-JOB-008 – No circular job dependencies**
Job dependencies MUST NOT form cycles.

**BR-JOB-009 – Job color assignment**
Job color MUST be randomly assigned at creation. Dependent jobs (via requiredJobIds) SHOULD use shades of the same base color for visual grouping.

**BR-JOB-010 – Cancelled job assignment handling**
When a Job is cancelled, task assignments scheduled in the future MUST be recalled (removed). Task assignments scheduled in the past MUST remain for historical reference.

---

## Task

**BR-TASK-001 – Task must belong to exactly one job**
Every Task MUST belong to exactly one Job and cannot exist independently.

**BR-TASK-002 – Task duration must be positive**
For internal tasks: setup + run minutes MUST be greater than zero.
For outsourced tasks: durationOpenDays MUST be greater than zero.

**BR-TASK-003 – Tasks follow linear sequence**
Tasks within a job MUST follow a single straight sequence (Task N depends on Task N-1).

**BR-TASK-004 – Internal task must reference valid station**
An internal task MUST reference a Station that exists in the system.

**BR-TASK-005 – Outsourced task must reference valid provider**
An outsourced task MUST reference an OutsourcedProvider that exists in the system.

**BR-TASK-006 – Task DSL must be parseable**
The raw DSL input for a task MUST parse correctly according to the DSL specification.

**BR-TASK-007 – Previous task must complete first**
A Task can ONLY start after its predecessor task (if any) has been completed.

**BR-TASK-008 – Outsourced task departure time**
For outsourced tasks, if the task is scheduled to start after its LatestDepartureTime, the first business day of the lead time (DurationOpenDays) begins the following business day.

**BR-TASK-009 – Outsourced task end time calculation**
The end time of an outsourced task is calculated as: the ReceptionTime on the business day that is DurationOpenDays after the effective start day (considering LatestDepartureTime).

---

## Approval Gates

**BR-GATE-001 – BAT approval before scheduling**
Tasks CANNOT be scheduled until the job's proof is approved (`proofApprovedAt` is set) OR `proofSentAt` is "NoProofRequired".

**BR-GATE-002 – Plates approval before printing**
Printing tasks on offset stations CANNOT start until the job's `platesStatus` is "Done".

**BR-GATE-003 – AwaitingFile blocks BAT**
When `proofSentAt` is "AwaitingFile", the job is waiting for client file and scheduling is blocked.

---

## Paper Procurement

**BR-PAPER-001 – Paper status progression**
PaperPurchaseStatus MUST follow the progression: InStock | ToOrder → Ordered → Received.

**BR-PAPER-002 – Order timestamp on status change**
When PaperPurchaseStatus changes to "Ordered", `paperOrderedAt` MUST be set to current timestamp.

**BR-PAPER-003 – Paper required before production**
Production tasks SHOULD NOT start until paper status is "InStock" or "Received".

---

## Assignment & Schedule

**BR-ASSIGN-001 – Valid station assignment**
An assignment is valid ONLY if the referenced station exists and is Available.

**BR-ASSIGN-002 – Operating hours compliance**
Tasks MUST be scheduled only during station operating hours.

**BR-ASSIGN-003 – Schedule time calculation**
For internal tasks: `scheduledEnd` = `scheduledStart` + task duration (stretched across non-operating periods).
For outsourced tasks: `scheduledEnd` = `scheduledStart` + (durationOpenDays × business calendar), considering LatestDepartureTime and ReceptionTime.
Tasks spanning station downtime are displayed as a single continuous tile with downtime portions having distinct visual appearance (MVP). Task interruption/splitting is Post-MVP.

**BR-ASSIGN-004 – No retrospective scheduling**
Tasks CANNOT be scheduled to start in the past (relative to current system time).

**BR-ASSIGN-005 – Assignment immutability after start**
Once a Task has started execution, its station assignment CANNOT be changed.

**BR-ASSIGN-006 – Tile snaps to 30-minute grid**
Task scheduling in the UI MUST snap to 30-minute intervals.

**BR-ASSIGN-007 – Task completion is manual**
Task completion (IsCompleted) MUST be manually toggled via UI checkbox. Tasks in the past are NOT automatically marked as completed.

**BR-ASSIGN-008 – Completion does not affect precedence**
The IsCompleted flag is for tracking purposes only and DOES NOT affect precedence validation. Precedence rules assume scheduled tasks will happen as defined.

**BR-ASSIGN-009 – Tile insertion behavior**
Tiles are inserted between existing tiles, not over them:
- On capacity-1 stations: Tiles CANNOT overlap. When a tile is inserted, subsequent tiles on the same station are automatically pushed down (later in time).
- On stations with capacity > 1: Multiple tiles CAN overlap up to the station's capacity limit.

---

## Schedule Constraints

**BR-SCHED-001 – No station double-booking**
The system MUST prevent any state where a station (capacity=1) has overlapping task assignments.

**BR-SCHED-002 – Group capacity enforcement**
The system MUST prevent any state where station group concurrent task count exceeds MaxConcurrent.

**BR-SCHED-003 – Task sequence enforcement**
The system MUST prevent scheduling a task before its predecessor task completes.

**BR-SCHED-004 – Job dependency enforcement**
The system MUST prevent starting a job's tasks before all required jobs are completed.

**BR-SCHED-005 – Deadline enforcement**
The system MUST warn when scheduled task completion exceeds the job's workshopExitDate.

**BR-SCHED-006 – Approval gate enforcement**
The system MUST prevent scheduling tasks when required approval gates are not satisfied.

---

## Cross-Entity Invariants

**INV-001 – Temporal consistency**
All datetime values must be consistent: task.scheduledEnd ≤ job.workshopExitDate, operatingSchedule.start < operatingSchedule.end, etc.

**INV-002 – Station conflict prevention**
The system MUST prevent any state where a station is double-booked.

**INV-003 – Group capacity prevention**
The system MUST prevent any state where a station group exceeds its MaxConcurrent limit.

**INV-004 – Task sequence integrity**
Task completion times within a job MUST respect the sequential order.

**INV-005 – State transition consistency**
All entities MUST follow their defined state machines; invalid transitions are not allowed.

**INV-006 – Referential integrity**
All references between entities (stationId, providerId, jobId, taskId) MUST point to existing, valid entities.

---

## Validation Rules

**VAL-001 – Complete assignment validation**
Before accepting an assignment, the system MUST verify:
- Station exists and is Available
- No scheduling conflicts exist
- Group capacity is not exceeded
- Task sequence is respected
- Job dependencies are satisfied
- Approval gates are cleared
- Workshop exit date can be met

**VAL-002 – Conflict detection**
The system MUST detect and report all types of conflicts:
- Station conflicts (double-booking)
- Group capacity conflicts (exceeds MaxConcurrent)
- Precedence conflicts (wrong task sequence order)
- Approval gate conflicts (gates not satisfied)
- Availability conflicts (outside station operating hours)
- Deadline conflicts (cannot meet workshopExitDate)

**VAL-003 – Validation on change**
Any change to station availability, schedule exceptions, or task definitions MUST trigger revalidation of affected assignments.

---

## UI Behavior Rules

**UI-001 – Precedence safeguard during drag**
If a tile drag would violate precedence rules, the UI MUST snap to the nearest valid timeslot.

**UI-002 – Alt-key bypass**
Holding Alt during drag MUST bypass the precedence safeguard (allowing violation with warning).

**UI-003 – Precedence violation visual**
Tiles that break precedence rules MUST be shown with a red halo effect.

**UI-004 – Recall tile behavior**
Recalling a tile MUST remove the assignment entirely (tile returns to unscheduled state).

**UI-005 – Similarity indicators**
Similarity circles between tiles MUST reflect the actual matching criteria from the station category.

---

## Business Calendar Rules

**CAL-001 – Open days definition (MVP)**
An open day is Monday through Friday.

**CAL-002 – Open days definition (Future)**
An open day is Monday through Friday, excluding French public holidays.

**CAL-003 – Outsourced duration calculation**
Outsourced task duration in open days MUST be calculated using the business calendar.

---

## Comments & Audit

**COM-001 – Comment immutability**
Once a comment is added to a job, it CANNOT be edited or deleted.

**COM-002 – Comment author and timestamp**
Every comment MUST have an author and timestamp recorded.

---

## Quick Reference: Validation Rules Summary

### MVP Validation Behavior

In MVP, all validation rules result in **visual warnings only** — no hard blocks prevent the user from making assignments. The system shows visual cues (red halo, late jobs panel, similarity indicators, etc.) but allows the user to proceed with any scheduling decision. Hard blocking behavior may be introduced post-MVP.

The "Blocking?" column in the table below indicates the **intended severity** for future consideration, not MVP behavior.

### Validation Rules Table

The following table provides a quick reference for validation rules, their corresponding conflict types, and severities:

| Rule ID | Description | Conflict Type | Severity | Blocking? |
|---------|-------------|---------------|----------|-----------|
| VAL-001.1 | Station exists and is Available | AvailabilityConflict | High | Yes |
| VAL-001.2 | No station double-booking | StationConflict | High | Yes |
| VAL-001.3 | Group capacity not exceeded | GroupCapacityConflict | High | Yes |
| VAL-001.4 | Task sequence respected | PrecedenceConflict | Medium | Soft* |
| VAL-001.5 | Job dependencies satisfied | PrecedenceConflict | High | Yes |
| VAL-001.6 | Approval gates cleared (BAT) | ApprovalGateConflict | High | Yes |
| VAL-001.7 | Approval gates cleared (Plates) | ApprovalGateConflict | Medium | Warning |
| VAL-001.8 | Workshop exit date achievable | DeadlineConflict | Medium | Warning |
| BR-ASSIGN-002 | Within operating hours | AvailabilityConflict | High | Yes |
| BR-ASSIGN-004 | Not in the past | — | High | Yes |

*Soft blocking: Can be bypassed with Alt-key during drag

### Conflict Type Definitions

| Conflict Type | Description | Visual Indicator |
|---------------|-------------|------------------|
| StationConflict | Station double-booked (overlapping assignments) | Red highlight on both tiles |
| GroupCapacityConflict | Station group MaxConcurrent exceeded | Yellow/orange time slot |
| PrecedenceConflict | Task sequence violated within job | Red halo on violating tile |
| ApprovalGateConflict | BAT or Plates approval not satisfied | Tile grayed out / blocked |
| AvailabilityConflict | Outside station operating hours | Gray hatched overlay |
| DeadlineConflict | Task completion exceeds workshopExitDate | Job in "Late Jobs" panel |

### Validation Timing

| Event | Validation Scope | Response Time |
|-------|------------------|---------------|
| Drag over grid | Real-time preview | < 10ms |
| Drop on grid | Full validation | < 100ms |
| Station schedule change | Affected assignments | Background |
| Approval gate change | Job's tasks | Background |

---

This document defines the core invariants that must be maintained by the system. Implementation details may vary, but these rules must always be enforced.
