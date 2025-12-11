# Initial Data Model – Flux Print Shop Scheduling System

This initial data model provides a **technology‑agnostic**, early‑stage description
of the core data structures for the print shop scheduling system.

The goal is to ensure **consistency** between:
- domain vocabulary,
- user stories,
- acceptance criteria,
- workflow definitions,
- API/interface drafts.

This is not a final database schema — it is an early conceptual reference.

---

## 1. Station

- **stationId** (string)
- **name** (string)
- **categoryId** (string, reference to StationCategory)
- **groupId** (string, reference to StationGroup)
- **capacity** (integer, typically 1)
- **operatingSchedule** (OperatingSchedule)
- **scheduleExceptions** (list of ScheduleException)
- **status**: Available | InUse | Maintenance | OutOfService
  - `Available` – ready for assignment
  - `InUse` – currently executing a task
  - `Maintenance` – undergoing maintenance
  - `OutOfService` – permanently or long-term unavailable
- **createdAt** (datetime)
- **updatedAt** (datetime)

---

## 2. StationCategory

- **categoryId** (string)
- **name** (string, e.g., "Offset Printing Press", "Finishing")
- **similarityCriteria** (list of SimilarityCriterion)
- **createdAt** (datetime)

### SimilarityCriterion (Value Object)
- **code** (string, e.g., "paper_type", "paper_size", "paper_weight", "inking")
- **name** (string, e.g., "Same paper type")

---

## 3. StationGroup

- **groupId** (string)
- **name** (string)
- **maxConcurrent** (integer | null, null = unlimited)
- **isOutsourcedProviderGroup** (boolean)
- **createdAt** (datetime)

---

## 4. OutsourcedProvider

- **providerId** (string)
- **name** (string)
- **supportedActionTypes** (list of string, e.g., ["Pelliculage", "Dorure", "Reliure"])
- **groupId** (string, reference to auto-created StationGroup)
- **status**: Active | Inactive
- **createdAt** (datetime)
- **updatedAt** (datetime)

---

## 5. OperatingSchedule (Value Object)

- **weeklyPattern** (list of DaySchedule)

### DaySchedule (Value Object)
- **dayOfWeek** (integer, 0=Monday to 6=Sunday)
- **timeSlots** (list of TimeSlot)

### TimeSlot (Value Object)
- **start** (time, HH:MM)
- **end** (time, HH:MM)

### ScheduleException (Value Object)
- **date** (date)
- **type**: Closed | ModifiedHours
- **timeSlots** (list of TimeSlot, for ModifiedHours type)
- **reason** (string, optional)

---

## 6. Job

- **jobId** (string)
- **reference** (string, user-manipulated order reference)
- **client** (string, customer name)
- **description** (string, product description)
- **notes** (string, free-form notes)
- **workshopExitDate** (datetime, deadline for leaving factory)
- **fullyScheduled** (boolean, computed: all tasks have assignments)
- **paperPurchaseStatus**: InStock | ToOrder | Ordered | Received
- **paperOrderedAt** (datetime | null)
- **paperType** (string, e.g., "CB300")
- **paperFormat** (string, e.g., "63x88")
- **proofSentAt** (datetime | "AwaitingFile" | "NoProofRequired")
- **proofApprovedAt** (datetime | null)
- **platesStatus**: Todo | Done
- **requiredJobIds** (list of string, job references that must complete first)
- **tasks** (list of Task, ordered by sequence)
- **comments** (list of Comment)
- **status**: Draft | Planned | InProgress | Delayed | Completed | Cancelled
  - `Draft` – job is being defined
  - `Planned` – definition complete, ready for scheduling
  - `InProgress` – at least one task has started
  - `Delayed` – job at risk of missing deadline
  - `Completed` – all tasks successfully completed
  - `Cancelled` – job was cancelled
- **createdAt** (datetime)
- **updatedAt** (datetime)

---

## 7. Task

Tasks are polymorphic (internal or outsourced).

### Common Fields
- **taskId** (string)
- **jobId** (string, reference)
- **sequenceOrder** (integer, position in job's task list)
- **type**: internal | outsourced
- **comment** (string | null, from DSL)
- **rawDSLInput** (string, original DSL line)
- **status**: Defined | Ready | Assigned | Executing | Completed | Failed | Cancelled
  - `Defined` – task created
  - `Ready` – previous task completed, can be scheduled
  - `Assigned` – scheduled with time slot
  - `Executing` – currently in progress
  - `Completed` – finished successfully
  - `Failed` – error during execution
  - `Cancelled` – cancelled (typically via job cancellation)
- **assignment** (TaskAssignment | null)

### Internal Task Fields
- **stationId** (string, reference to Station)
- **setupMinutes** (integer, 0 if not specified)
- **runMinutes** (integer)
- **totalMinutes** (integer, computed: setupMinutes + runMinutes)

### Outsourced Task Fields
- **providerId** (string, reference to OutsourcedProvider)
- **actionType** (string, e.g., "Pelliculage")
- **durationOpenDays** (integer)

---

## 8. TaskAssignment (Value Object)

- **stationId** (string, for internal) | **providerId** (string, for outsourced)
- **scheduledStart** (datetime)
- **scheduledEnd** (datetime)

---

## 9. Comment (Value Object)

- **author** (string)
- **timestamp** (datetime)
- **content** (string)

---

## 10. Schedule

- **scheduleId** (string)
- **name** (string)
- **isProd** (boolean) — *Future: only one can be true*
- **assignments** (list of ValidatedAssignment)
- **conflicts** (list of ScheduleConflict)
- **lastValidatedAt** (datetime)
- **version** (integer, for optimistic locking)
- **createdAt** (datetime)

### ValidatedAssignment (Value Object)
- **taskId** (string)
- **stationId** (string) | **providerId** (string)
- **scheduledStart** (datetime)
- **scheduledEnd** (datetime)
- **validationStatus**: Valid | Invalid

### ScheduleConflict (Value Object)
- **type**: StationConflict | GroupCapacityConflict | PrecedenceConflict | ApprovalGateConflict | AvailabilityConflict | DeadlineConflict
- **affectedTaskIds** (list of string)
- **description** (string)
- **severity**: High | Medium | Low

---

## 11. Relationships Summary

### Primary Relationships

1. **Station → StationCategory** (N:1)
   - Every station belongs to exactly one category

2. **Station → StationGroup** (N:1)
   - Every station belongs to exactly one group

3. **OutsourcedProvider → StationGroup** (1:1)
   - Each provider has its own dedicated group with unlimited capacity

4. **Job → Task** (1:N, ordered)
   - A job contains multiple tasks in sequence
   - Tasks cannot exist without a job

5. **Task → Station** (N:1, for internal tasks)
   - Internal tasks reference a station

6. **Task → OutsourcedProvider** (N:1, for outsourced tasks)
   - Outsourced tasks reference a provider

7. **Task → TaskAssignment** (1:0..1)
   - A task may have zero or one assignment
   - Assignment includes station/provider and timing

8. **Job → Job** (N:M via requiredJobIds)
   - Jobs can depend on other jobs completing first

9. **Job → Comment** (1:N)
   - A job has zero or more comments

---

## 12. Status Enumerations

### StationStatus
| Value | Description |
|-------|-------------|
| Available | Ready for task assignment |
| InUse | Currently executing a task |
| Maintenance | Undergoing maintenance |
| OutOfService | Long-term unavailable |

### JobStatus
| Value | Description |
|-------|-------------|
| Draft | Being defined, tasks can be modified |
| Planned | Ready for scheduling |
| InProgress | At least one task started |
| Delayed | At risk of missing deadline |
| Completed | All tasks finished successfully |
| Cancelled | Job was cancelled |

### TaskStatus
| Value | Description |
|-------|-------------|
| Defined | Created, not yet ready |
| Ready | Previous task complete, can be scheduled |
| Assigned | Has a scheduled time slot |
| Executing | Currently in progress |
| Completed | Finished successfully |
| Failed | Error during execution |
| Cancelled | Cancelled (typically via job) |

### PaperPurchaseStatus
| Value | Description |
|-------|-------------|
| InStock | Paper already available |
| ToOrder | Paper needs to be ordered |
| Ordered | Paper order placed |
| Received | Paper received |

### PlatesStatus
| Value | Description |
|-------|-------------|
| Todo | Plates not yet prepared |
| Done | Plates ready for printing |

### ProofSentAt (Special Values)
| Value | Description |
|-------|-------------|
| *datetime* | Actual date proof was sent |
| AwaitingFile | Waiting for client file |
| NoProofRequired | No proof needed for this job |

---

## Notes

- IDs remain strings in this draft; concrete types (UUID, etc.) are defined during implementation
- Value objects enforce immutability and domain constraints
- The model intentionally mirrors the terms defined in *domain-vocabulary.md* to ensure coherence
- Temporal data (datetime, date, time) follows ISO 8601 format
- Status enumerations are exhaustive and match workflow definitions
- This model supports the critical **task scheduling** functionality as the core system feature
- Task DSL parsing transforms text input into the structured Task format
