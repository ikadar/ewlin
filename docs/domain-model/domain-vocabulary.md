# Domain Vocabulary – Operations Research System

This document defines the core domain terms used in the **Equipment → Operator → Job → Task** assignment and validation process.

## Equipment

- **Definition:** A physical machine or tool used in manufacturing processes that can perform specific types of tasks.
- **Notes:** Each equipment has a unique identifier and supports specific task types. Equipment can only be assigned to one task at a time.
- **Typical fields:** equipment id, name, supported task types, status.
- **Status values:**
    - `Available` – ready for assignment.
    - `InUse` – currently executing a task.
    - `Maintenance` – undergoing scheduled or unscheduled maintenance.
    - `OutOfService` – permanently or long-term unavailable.
- **Related terms:** Task, Assignment, EquipmentTaskType.

## Operator

- **Definition:** A worker who can operate equipment and perform tasks based on their skills and availability.
- **Notes:** Operators have defined availability periods and skill levels for different equipment. An operator can only work on one task at a time.
- **Typical fields:** operator id, name, availability schedule, equipment skills, status.
- **Status values:**
    - `Active` – available for task assignment.
    - `Inactive` – temporarily unavailable (e.g., leave, sick).
    - `Deactivated` – permanently removed from active workforce (terminal state for audit trail).
- **Related terms:** OperatorSkill, OperatorAvailability, Task, Assignment.

## OperatorSkill

- **Definition:** The competency level an operator has for operating specific equipment.
- **Allowed values:**
    - `beginner` – basic operational knowledge.
    - `intermediate` – proficient in standard operations.
    - `expert` – capable of advanced operations and troubleshooting.
- **Notes:** Skills determine which equipment an operator can be assigned to for tasks requiring that equipment.
- **Related terms:** Operator, Equipment, Assignment.

## OperatorAvailability

- **Definition:** A time period during which an operator is available to work on tasks.
- **Notes:** Represented as start and end datetime pairs. Operators can only be scheduled for tasks within their availability periods.
- **Typical fields:** start time, end time, operator reference.
- **Related terms:** Operator, Schedule, Assignment.

## Job

- **Definition:** A complete manufacturing order consisting of one or more tasks that must be completed by a deadline.
- **Notes:** Jobs group related tasks together and define the overall completion deadline. All tasks within a job must complete before the job deadline.
- **Typical fields:** job id, name, deadline, task list, status.
- **Status values:**
    - `Draft` – job is being defined, tasks can be added/removed.
    - `Planned` – job definition complete, ready for scheduling.
    - `InProgress` – at least one task has started execution.
    - `Delayed` – job is at risk of missing deadline or already late.
    - `Completed` – all tasks successfully completed.
    - `Cancelled` – job was cancelled before completion.
- **Related terms:** Task, Deadline, JobCreated (event).

## Task

- **Definition:** A specific manufacturing operation that is part of a job and may require an operator, equipment, or both.
- **Notes:** Tasks can have dependencies on other tasks (must complete before starting). Tasks define what type of work needs to be done and resource requirements.
- **Typical fields:** task id, type, duration, requires operator (boolean), requires equipment (boolean), required tasks (dependencies), status.
- **Status values:**
    - `Defined` – task created but dependencies not yet satisfied.
    - `Ready` – all dependencies completed, waiting for resource assignment.
    - `Assigned` – resources allocated but execution not started.
    - `Executing` – task is currently being performed.
    - `Completed` – task finished successfully.
    - `Failed` – task encountered an error during execution.
    - `Cancelled` – task was cancelled (typically due to job cancellation).
- **Related terms:** Job, Assignment, TaskDependency, Operator, Equipment.

## TaskDependency

- **Definition:** A relationship indicating that one task must be completed before another task can begin.
- **Notes:** Dependencies form a directed acyclic graph (DAG) - circular dependencies are not allowed. Multiple tasks can depend on one task, and one task can depend on multiple tasks.
- **Related terms:** Task, Schedule, CriticalPath.

## Assignment

- **Definition:** The allocation of an operator and/or equipment to a specific task with scheduled start and end times.
- **Notes:** Assignments must respect all constraints: operator skills, equipment compatibility, availability, dependencies, and no double-booking. The scheduling of start/end times is the core function that transforms a plan into an executable schedule.
- **Typical fields:** task reference, assigned operator, assigned equipment, scheduled start, scheduled end.
- **Related terms:** Task, Operator, Equipment, Schedule, Validation.

## TaskScheduling

- **Definition:** The process of determining specific start and end times for tasks within their constraints.
- **Notes:** This is the primary value-generating activity of the system. Scheduling must consider operator availability, equipment availability, task dependencies, and job deadlines simultaneously.
- **Key constraints:**
    - Tasks cannot start before dependencies complete
    - Resources must be available for the entire duration
    - No double-booking of resources
    - Must complete before job deadline
- **Related terms:** Assignment, TaskAssignment, Schedule, TimeSlot.

## Schedule

- **Definition:** The time-based plan showing when each task will be executed with its assigned resources.
- **Notes:** Schedules must satisfy all dependencies, resource availability, and deadline constraints. Can be visualized as Gantt charts or calendars.
- **Typical fields:** task schedules, resource allocations, timeline view.
- **Related terms:** Assignment, Task, ScheduleConflict.

## Validation

- **Definition:** The process of verifying that assignments and schedules meet all business rules and constraints.
- **Validation checks include:**
    - Required resources are assigned (operator/equipment as needed).
    - Operator has necessary skills for assigned equipment.
    - No scheduling conflicts (double-booking).
    - Operator availability is respected.
    - Task dependencies are satisfied.
    - Job deadlines can be met.
- **Related terms:** Assignment, ValidationResult, ScheduleConflict.

## ScheduleConflict

- **Definition:** A situation where validation fails due to overlapping resource assignments or constraint violations.
- **Types of conflicts:**
    - `ResourceConflict` – operator or equipment double-booked.
    - `AvailabilityConflict` – assignment outside operator's availability.
    - `DependencyConflict` – task scheduled before its dependencies complete.
    - `DeadlineConflict` – task completion exceeds job deadline.
    - `SkillConflict` – operator lacks required skill for equipment.
- **Related terms:** Validation, Assignment, Schedule.

## CriticalPath

- **Definition:** The longest sequence of dependent tasks that determines the minimum time to complete a job.
- **Notes:** Tasks on the critical path have no scheduling flexibility - any delay directly impacts the job completion time. Used for identifying bottlenecks and optimization opportunities.
- **Related terms:** Task, TaskDependency, Job, Schedule.
