# Business Rules & Domain Invariants – Operations Research System

This document captures core business rules and invariants for the **Equipment → Operator → Job → Task** assignment and validation process.
These rules are technology-agnostic and must hold regardless of implementation.

---

## Operator

**BR-OPERATOR-001 – Operator must have a unique identifier**  
Every Operator MUST have a unique ID that cannot be changed once created.

**BR-OPERATOR-002 – Operator availability must not overlap**  
An Operator's availability time slots MUST NOT overlap with each other.

**BR-OPERATOR-003 – Operator can only work during availability**  
An Operator can ONLY be scheduled for tasks within their defined availability periods.

**BR-OPERATOR-004 – One task at a time**  
An Operator CANNOT be assigned to multiple tasks that overlap in time.

**BR-OPERATOR-005 – Skill requirements**  
An Operator can ONLY be assigned to equipment they have skills for.

**BR-OPERATOR-006 – Active status for assignments**  
Only Operators with status `Active` can be assigned to new tasks.

---

## Equipment

**BR-EQUIPMENT-001 – Equipment must have supported task types**  
Every Equipment MUST define at least one supported task type.

**BR-EQUIPMENT-002 – Exclusive assignment**  
Equipment CANNOT be assigned to multiple tasks that overlap in time.

**BR-EQUIPMENT-003 – Task type compatibility**  
Equipment can ONLY be assigned to tasks whose type is in the equipment's supported task types list.

**BR-EQUIPMENT-004 – Available status for assignments**  
Only Equipment with status `Available` can be assigned to new tasks (not `Maintenance` or `OutOfService`).

**BR-EQUIPMENT-005 – Equipment maintenance conflicts**  
When Equipment enters maintenance, all affected future assignments MUST be flagged as conflicts.

---

## Job

**BR-JOB-001 – Job must have a deadline**  
Every Job MUST have a defined deadline by which all tasks must be completed.

**BR-JOB-002 – Job must contain tasks**  
A Job MUST contain at least one Task to be valid for scheduling.

**BR-JOB-003 – Job completion requires all tasks completed**  
A Job can ONLY be marked as `Completed` when ALL its tasks are completed.

**BR-JOB-004 – Job cancellation cascades**  
When a Job is cancelled, all its incomplete tasks MUST also be cancelled.

**BR-JOB-005 – Job deadline immutability**  
Once a Job is in `InProgress` status, its deadline CANNOT be moved earlier (only later with proper approval).

---

## Task

**BR-TASK-001 – Task must belong to exactly one job**  
Every Task MUST belong to exactly one Job and cannot exist independently.

**BR-TASK-002 – Task duration must be positive**  
Task duration MUST be greater than zero minutes.

**BR-TASK-003 – Resource requirements consistency**  
If a Task requires equipment (`requires_equipment = true`), it MUST have equipment assigned before execution.
If a Task requires operator (`requires_operator = true`), it MUST have an operator assigned before execution.

**BR-TASK-004 – Task dependencies form DAG**  
Task dependencies MUST form a Directed Acyclic Graph - no circular dependencies allowed.

**BR-TASK-005 – Dependency completion before start**  
A Task can ONLY start after ALL its required tasks (dependencies) have been completed.

**BR-TASK-006 – Task type definition**  
Every Task MUST have a defined type that determines equipment compatibility.

---

## Assignment & Schedule

**BR-ASSIGN-001 – Valid resource assignment**  
An assignment is valid ONLY if all resource requirements (operator, equipment) are satisfied according to task specifications.

**BR-ASSIGN-002 – Skill validation for equipment operation**  
When a Task requires both operator and equipment, the assigned operator MUST have the skill for the assigned equipment.

**BR-ASSIGN-003 – Schedule time calculation**  
`scheduled_end` MUST equal `scheduled_start` plus task `duration`.

**BR-ASSIGN-004 – No retrospective scheduling**  
Tasks CANNOT be scheduled to start in the past (relative to current system time).

**BR-ASSIGN-005 – Assignment immutability after start**  
Once a Task has started execution, its operator and equipment assignments CANNOT be changed.

---

## Cross-Entity Invariants

**INV-001 – Temporal consistency**  
All datetime values must be consistent: task.scheduled_end ≤ job.deadline, availability.start < availability.end, etc.

**INV-002 – Resource conflict prevention**  
The system MUST prevent any state where an operator or equipment is double-booked.

**INV-003 – Dependency chain integrity**  
The completion time of the last task in any dependency chain MUST NOT exceed the job deadline.

**INV-004 – State transition consistency**  
All entities MUST follow their defined state machines; invalid transitions are not allowed.

**INV-005 – Referential integrity**  
All references between entities (operator_id, equipment_id, job_id, task_id) MUST point to existing, valid entities.

---

## Validation Rules

**VAL-001 – Complete assignment validation**  
Before marking an assignment as valid, the system MUST verify:
- All resource requirements are met
- No scheduling conflicts exist
- Operator has required skills
- Equipment supports task type
- Dependencies are satisfied
- Job deadline can be met

**VAL-002 – Conflict detection**  
The system MUST detect and report all types of conflicts:
- Resource conflicts (double-booking)
- Availability conflicts (outside working hours)
- Dependency conflicts (wrong order)
- Deadline conflicts (cannot meet deadline)
- Skill conflicts (missing qualifications)

**VAL-003 – Validation on change**  
Any change to operator availability, equipment status, or task dependencies MUST trigger revalidation of affected assignments.

---

## Business Policies (Configurable)

**POL-001 – Skill level requirements**  
Whether specific skill levels (beginner/intermediate/expert) are required for certain task types (configurable per deployment).

**POL-002 – Buffer time between tasks**  
Whether to enforce minimum buffer time between consecutive tasks for the same resource (configurable).

**POL-003 – Overtime allowance**  
Whether operators can be scheduled beyond their normal availability for critical tasks (requires special approval).

**POL-004 – Partial assignment**  
Whether tasks can be partially assigned (e.g., operator assigned but equipment pending) or require complete assignment.

---

This document defines the core invariants that must be maintained by the system. Implementation details may vary, but these rules must always be enforced.
