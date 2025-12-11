# Initial Data Model – Operations Research System

This initial data model provides a **technology‑agnostic**, early‑stage description  
of the core data structures for the Equipment → Operator → Job → Task assignment and validation flow.

The goal is to ensure **consistency** between:
- domain vocabulary,
- user stories,
- acceptance criteria,
- workflow definitions,
- API/interface drafts.

This is not a final database schema — it is an early conceptual reference.

---

## 1. Entity Overview

### Operator
- **operatorId** (string)
- **name** (string)
- **status**: Active | Inactive | Deactivated
  - `Active` – available for task assignment
  - `Inactive` – temporarily unavailable
  - `Deactivated` – permanently removed (terminal state)
- **availability** (list of TimeSlot)
- **skills** (list of OperatorSkill)
- **createdAt** (datetime)
- **updatedAt** (datetime)

### TimeSlot (Value Object)
- start (datetime)
- end (datetime)

### OperatorSkill (Value Object)
- equipmentId (string)
- level: beginner | intermediate | expert
- certificationDate (date)

---

## 2. Equipment
- **equipmentId** (string)
- **name** (string)
- **status**: Available | InUse | Maintenance | OutOfService
  - `Available` – ready for assignment
  - `InUse` – currently executing a task
  - `Maintenance` – undergoing maintenance
  - `OutOfService` – permanently or long-term unavailable
- **supportedTaskTypes** (list of string)
- **location** (string)
- **createdAt** (datetime)
- **updatedAt** (datetime)

---

## 3. Job
- **jobId** (string)
- **name** (string)
- **description** (string)
- **deadline** (datetime)
- **status**: Draft | Planned | InProgress | Delayed | Completed | Cancelled
  - `Draft` – job is being defined
  - `Planned` – definition complete, ready for scheduling
  - `InProgress` – at least one task started
  - `Delayed` – job at risk of missing deadline
  - `Completed` – all tasks successfully completed
  - `Cancelled` – job was cancelled
- **tasks** (list of Task)
- **createdAt** (datetime)
- **updatedAt** (datetime)

---

## 4. Task
- **taskId** (string)
- **jobId** (string, reference)
- **type** (string)
- **duration** (Duration)
- **requiresOperator** (boolean)
- **requiresEquipment** (boolean)
- **dependencies** (list of string)
- **status**: Defined | Ready | Assigned | Executing | Completed | Failed | Cancelled
  - `Defined` – task created, dependencies not yet satisfied
  - `Ready` – dependencies completed, waiting for assignment
  - `Assigned` – resources allocated, not yet started
  - `Executing` – task in progress
  - `Completed` – finished successfully
  - `Failed` – error during execution
  - `Cancelled` – cancelled (typically via job cancellation)
- **assignment** (TaskAssignment | null)

### Duration (Value Object)
- minutes (integer)

### TaskAssignment (Value Object)
- assignedOperatorId (string | null)
- assignedEquipmentId (string | null)
- scheduledStart (datetime)
- scheduledEnd (datetime)

---

## 5. Schedule
- **scheduleId** (string)
- **assignments** (list of ValidatedAssignment)
- **conflicts** (list of ScheduleConflict)
- **lastValidatedAt** (datetime)
- **version** (integer)

### ValidatedAssignment (Value Object)
- taskId (string)
- operatorId (string | null)
- equipmentId (string | null)
- scheduledStart (datetime)
- scheduledEnd (datetime)
- validationStatus: Valid | Invalid

### ScheduleConflict (Value Object)
- type: ResourceConflict | AvailabilityConflict | DependencyConflict | DeadlineConflict | SkillConflict
- affectedTaskIds (list of string)
- description (string)
- severity: High | Medium | Low

---

## 6. Supporting Entities

### MaintenanceWindow
- **maintenanceId** (string)
- **equipmentId** (string, reference)
- **start** (datetime)
- **end** (datetime)
- **description** (string)
- **status**: Scheduled | InProgress | Completed | Cancelled
- **createdAt** (datetime)

### TaskDependency
- **fromTaskId** (string, reference)
- **toTaskId** (string, reference)
- **dependencyType**: FinishToStart | StartToStart | FinishToFinish
- **lagTime** (Duration | null)

---

## 7. Value Objects

### Money (for future use)
- amount (decimal)
- currency (string)

### Location
- building (string)
- floor (string)
- zone (string)

### TimeRange
- start (datetime)
- end (datetime)

---

## 8. Relationships Summary

### Primary Relationships
1. **Job → Task** (1:N)
   - A job contains multiple tasks
   - Tasks cannot exist without a job

2. **Task → Task** (N:M via TaskDependency)
   - Tasks can depend on multiple other tasks
   - Forms a directed acyclic graph (DAG)

3. **Task → Assignment** (1:0..1)
   - A task may have zero or one assignment
   - Assignment includes operator, equipment, and timing

4. **Assignment → Operator** (N:1)
   - Multiple assignments can reference the same operator
   - No overlapping time periods allowed

5. **Assignment → Equipment** (N:1)
   - Multiple assignments can reference the same equipment
   - No overlapping time periods allowed

6. **Operator → Equipment** (N:M via OperatorSkill)
   - Operators can be skilled in multiple equipment
   - Equipment can be operated by multiple operators

---

## Notes

- IDs remain strings in this draft; concrete types (UUID, etc.) are defined during implementation
- Value objects enforce immutability and domain constraints
- The model intentionally mirrors the terms defined in *domain-vocabulary.md* to ensure coherence
- Temporal data (datetime, date) follows ISO 8601 format
- Status enumerations are exhaustive and match workflow definitions
- This model supports the critical **task scheduling** functionality as the core system feature
