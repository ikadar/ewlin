---
tags:
  - specification
  - architecture
---

# Event & Message Design Specification – Flux Print Shop Scheduling System

This document defines **domain events**, **integration events**, and **message schemas** used across the Station → Job → Element → Task assignment and scheduling workflow.

The goal is to provide:
- a consistent event naming strategy,
- clear payload definitions,
- separation of domain and integration events,
- stable message contracts for inter-service communication.

---

## 1. Event Naming Conventions

### Domain Events
- Describe something that **has happened** *inside a single bounded context*.
- Are used internally within a service.
- Format: **PastTense** (e.g. `TaskAssigned`, `JobCompleted`)

### Integration Events
- Describe something that **other services must react to**.
- Are published outside the bounded context.
- Format: **<Context>.<EventName>**, e.g.:
  - `StationManagement.StationScheduleUpdated`
  - `JobManagement.TaskAddedToJob`
  - `Assignment.TaskAssigned`

---

## 2. Domain Events (Internal)

### StationRegistered
**Purpose:** Indicates that a new station has been added to the system.
**Trigger:** Emitted when the Station aggregate is created.
```json
{
  "stationId": "string",
  "name": "string",
  "categoryId": "string",
  "groupId": "string",
  "registeredAt": "ISO-8601-timestamp"
}
```

### OperatingScheduleUpdated
**Purpose:** Signals that a station's operating schedule has been modified.
**Trigger:** Emitted when weekly schedule patterns are updated.
```json
{
  "stationId": "string",
  "weeklyPattern": [
    {
      "dayOfWeek": 0,
      "timeSlots": [
        {"start": "HH:MM", "end": "HH:MM"}
      ]
    }
  ],
  "updatedAt": "ISO-8601-timestamp"
}
```

### ScheduleExceptionAdded
**Purpose:** Indicates a one-off schedule exception (holiday, maintenance).
**Trigger:** Emitted when an exception is added to a station.
```json
{
  "stationId": "string",
  "exceptionDate": "YYYY-MM-DD",
  "type": "Closed|ModifiedHours",
  "modifiedSlots": [{"start": "HH:MM", "end": "HH:MM"}],
  "reason": "string",
  "addedAt": "ISO-8601-timestamp"
}
```

### StationStatusChanged
**Purpose:** Signals station status transition.
**Trigger:** Emitted when station availability changes.
```json
{
  "stationId": "string",
  "previousStatus": "Available|InUse|Maintenance|OutOfService",
  "newStatus": "Available|InUse|Maintenance|OutOfService",
  "reason": "string",
  "changedAt": "ISO-8601-timestamp"
}
```

### StationCategoryCreated
**Purpose:** Indicates a new station category has been defined.
**Trigger:** Emitted when category is created.
```json
{
  "categoryId": "string",
  "name": "string",
  "similarityCriteria": [
    {"code": "string", "name": "string", "fieldPath": "string"}
  ],
  "createdAt": "ISO-8601-timestamp"
}
```

**Notes:**
- `fieldPath`: References a Job property for similarity comparison (e.g., "paperType")

### StationGroupCreated
**Purpose:** Indicates a new station group has been defined.
**Trigger:** Emitted when group is created.
```json
{
  "groupId": "string",
  "name": "string",
  "maxConcurrent": 2,
  "isOutsourcedProviderGroup": false,
  "createdAt": "ISO-8601-timestamp"
}
```

### ProviderRegistered
**Purpose:** Indicates an outsourced provider has been added.
**Trigger:** Emitted when provider is registered.
```json
{
  "providerId": "string",
  "name": "string",
  "supportedActionTypes": ["Pelliculage", "Dorure"],
  "latestDepartureTime": "HH:MM",
  "receptionTime": "HH:MM",
  "groupId": "string",
  "registeredAt": "ISO-8601-timestamp"
}
```

**Notes:**
- `latestDepartureTime`: Cutoff time for same-day work submission
- `receptionTime`: Time when completed work returns from provider

### JobCreated
**Purpose:** Represents that a print job has been created.
**Trigger:** Emitted when the Job aggregate is created.
```json
{
  "jobId": "string",
  "reference": "string",
  "client": "string",
  "description": "string",
  "workshopExitDate": "ISO-8601-datetime",
  "color": "#RRGGBB",
  "status": "Draft",
  "createdAt": "ISO-8601-timestamp"
}
```

**Notes:**
- `color`: Randomly assigned from predefined palette

### ElementCreated
**Purpose:** Indicates that an element has been created within a job.
**Trigger:** Emitted when an element is added to the Job aggregate.
```json
{
  "elementId": "string",
  "jobId": "string",
  "suffix": "string",
  "label": "string|null",
  "prerequisiteElementIds": [],
  "createdAt": "ISO-8601-timestamp"
}
```

**Notes:**
- At least one element (default suffix `"ELT"`) is created with every job
- Multi-element jobs have multiple elements with distinct suffixes

### ElementDependencyAdded
**Purpose:** Signals that a cross-element dependency has been established.
**Trigger:** Emitted when a prerequisite element is added to an element.
```json
{
  "elementId": "string",
  "jobId": "string",
  "prerequisiteElementId": "string",
  "addedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- Dependencies must reference elements within the same job
- Dependencies must form a DAG (no cycles)

### ElementDependencyRemoved
**Purpose:** Signals that a cross-element dependency has been removed.
**Trigger:** Emitted when a prerequisite element is removed from an element.
```json
{
  "elementId": "string",
  "jobId": "string",
  "prerequisiteElementId": "string",
  "removedAt": "ISO-8601-timestamp"
}
```

### TaskAddedToJob
**Purpose:** Indicates that a task has been added to an element within a job.
**Trigger:** Emitted when task is added to job aggregate.
```json
{
  "jobId": "string",
  "elementId": "string",
  "taskId": "string",
  "sequenceOrder": 0,
  "type": "internal|outsourced",
  "stationId": "string",
  "providerId": "string",
  "setupMinutes": 20,
  "runMinutes": 40,
  "durationOpenDays": 2,
  "actionType": "string",
  "comment": "string",
  "addedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- `elementId`: The element this task belongs to
- `sequenceOrder`: 0-indexed position within the element's task sequence

### TasksReordered
**Purpose:** Signals that tasks within an element have been reordered.
**Trigger:** Emitted when task sequence is changed within an element.
```json
{
  "jobId": "string",
  "elementId": "string",
  "newOrder": ["task-001", "task-002", "task-003"],
  "reorderedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- Reordering is element-scoped — only affects tasks within the specified element

### ElementPaperStatusUpdated (v0.4.32)
**Purpose:** Indicates element paper availability status has changed.
**Trigger:** Emitted when element paperStatus is updated.
```json
{
  "elementId": "string",
  "jobId": "string",
  "paperStatus": "none|in_stock|to_order|ordered|delivered",
  "paperOrderedAt": "ISO-8601-timestamp|null",
  "paperDeliveredAt": "ISO-8601-timestamp|null",
  "isBlocked": true,
  "updatedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- Ready states: `none`, `in_stock`, `delivered`
- Blocking states: `to_order`, `ordered`

### ElementBatStatusUpdated (v0.4.32)
**Purpose:** Indicates element BAT (proof) approval status has changed.
**Trigger:** Emitted when element batStatus is updated.
```json
{
  "elementId": "string",
  "jobId": "string",
  "batStatus": "none|waiting_files|files_received|bat_sent|bat_approved",
  "filesReceivedAt": "ISO-8601-timestamp|null",
  "batSentAt": "ISO-8601-timestamp|null",
  "batApprovedAt": "ISO-8601-timestamp|null",
  "isBlocked": true,
  "updatedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- Ready states: `none`, `bat_approved`
- Blocking states: `waiting_files`, `files_received`, `bat_sent`

### ElementPlateStatusUpdated (v0.4.32)
**Purpose:** Indicates element plates preparation status has changed.
**Trigger:** Emitted when element plateStatus is updated.
```json
{
  "elementId": "string",
  "jobId": "string",
  "plateStatus": "none|to_make|ready",
  "isBlocked": true,
  "updatedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- Ready states: `none`, `ready`
- Blocking states: `to_make`

### ElementFormeStatusUpdated (v0.4.32)
**Purpose:** Indicates element forme (die-cutting tool) status has changed.
**Trigger:** Emitted when element formeStatus is updated.
```json
{
  "elementId": "string",
  "jobId": "string",
  "formeStatus": "none|in_stock|to_order|ordered|delivered",
  "formeOrderedAt": "ISO-8601-timestamp|null",
  "formeDeliveredAt": "ISO-8601-timestamp|null",
  "isBlocked": true,
  "updatedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- Ready states: `none`, `in_stock`, `delivered`
- Blocking states: `to_order`, `ordered`
- Only relevant for elements with die-cutting tasks

### JobDependencyAdded
**Purpose:** Signals that a job dependency has been established.
**Trigger:** Emitted when job dependency is created.
```json
{
  "jobId": "string",
  "requiredJobId": "string",
  "addedAt": "ISO-8601-timestamp"
}
```

### CommentAdded
**Purpose:** Indicates a comment has been added to a job.
**Trigger:** Emitted when comment is created.
```json
{
  "jobId": "string",
  "author": "string",
  "content": "string",
  "timestamp": "ISO-8601-timestamp"
}
```

### JobStatusChanged
**Purpose:** Indicates job status transition.
**Trigger:** Emitted when job moves between states.
```json
{
  "jobId": "string",
  "previousStatus": "Draft|Planned|InProgress|Delayed|Completed|Cancelled",
  "newStatus": "Draft|Planned|InProgress|Delayed|Completed|Cancelled",
  "changedAt": "ISO-8601-timestamp"
}
```

### JobCancelled
**Purpose:** Indicates a job has been cancelled with assignment handling details.
**Trigger:** Emitted when job cancellation is processed.
```json
{
  "jobId": "string",
  "recalledTaskIds": ["task-002", "task-003"],
  "preservedTaskIds": ["task-001"],
  "cancelledAt": "ISO-8601-timestamp"
}
```

**Notes:**
- `recalledTaskIds`: Tasks with future assignments that were automatically removed
- `preservedTaskIds`: Tasks with past assignments that remain for historical reference

### TaskCompletionToggled
**Purpose:** Indicates task completion status has been manually toggled.
**Trigger:** Emitted when user toggles completion checkbox on tile.
```json
{
  "taskId": "string",
  "elementId": "string",
  "jobId": "string",
  "isCompleted": true,
  "completedAt": "ISO-8601-timestamp|null",
  "toggledAt": "ISO-8601-timestamp"
}
```

**Notes:**
- Completion is manually controlled, NOT automatic based on time
- Does NOT affect precedence validation

### TaskAssigned
**Purpose:** Indicates that a task has been assigned to a station or provider with timing.
**Trigger:** Emitted when task assignment is created in Schedule aggregate.
```json
{
  "taskId": "string",
  "elementId": "string",
  "jobId": "string",
  "targetId": "string",
  "isOutsourced": false,
  "scheduledStart": "ISO-8601-datetime",
  "scheduledEnd": "ISO-8601-datetime",
  "assignedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- `targetId`: Station ID or Provider ID depending on `isOutsourced`

### TaskUnassigned
**Purpose:** Indicates that a task has been recalled (unassigned).
**Trigger:** Emitted when task assignment is removed.
```json
{
  "taskId": "string",
  "elementId": "string",
  "jobId": "string",
  "oldTargetId": "string",
  "isOutsourced": false,
  "unassignedAt": "ISO-8601-timestamp"
}
```

### TaskRescheduled
**Purpose:** Indicates that a task has been moved to a new time or station/provider.
**Trigger:** Emitted when existing assignment is modified.
```json
{
  "taskId": "string",
  "elementId": "string",
  "jobId": "string",
  "oldTargetId": "string",
  "newTargetId": "string",
  "isOutsourced": false,
  "oldScheduledStart": "ISO-8601-datetime",
  "newScheduledStart": "ISO-8601-datetime",
  "oldScheduledEnd": "ISO-8601-datetime",
  "newScheduledEnd": "ISO-8601-datetime",
  "rescheduledAt": "ISO-8601-timestamp"
}
```

### ConflictDetected
**Purpose:** Alerts that a scheduling conflict has been identified.
**Trigger:** Emitted during validation when a constraint is violated.
```json
{
  "scheduleId": "string",
  "taskId": "string",
  "targetId": "string",
  "conflictType": "StationMismatchConflict|StationConflict|GroupCapacityConflict|PrecedenceConflict|PrerequisiteConflict|AvailabilityConflict|DeadlineConflict",
  "message": "string",
  "relatedTaskId": "string|null",
  "details": {},
  "detectedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- Fields match the `ScheduleConflict` interface (flat structure)
- `relatedTaskId`: Present for PrecedenceConflict (the predecessor task)
- `targetId`: Station or Provider ID involved in the conflict

### ScheduleUpdated
**Purpose:** Signals that the schedule has been modified.
**Trigger:** Emitted after any assignment change.
```json
{
  "scheduleId": "string",
  "version": 42,
  "changedTaskIds": ["task-001", "task-002"],
  "updatedAt": "ISO-8601-timestamp"
}
```

---

## 3. Integration Events (Public)

### StationManagement.StationScheduleUpdated
Published by: **Station Management Service**
Consumed by: **Assignment Service**, **Scheduling View Service**

**Purpose:** Notifies that station availability has changed, requiring schedule revalidation.
**Trigger:** Domain event wrapped for external consumption.
```json
{
  "eventId": "uuid",
  "eventType": "StationManagement.StationScheduleUpdated",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "stationId": "string",
    "stationName": "string",
    "changeType": "ScheduleUpdated|ExceptionAdded|StatusChanged",
    "affectedPeriod": {
      "start": "ISO-8601-datetime",
      "end": "ISO-8601-datetime"
    }
  }
}
```

### JobManagement.TaskStructureChanged
Published by: **Job Management Service**
Consumed by: **Assignment Service**, **Scheduling View Service**

**Purpose:** Notifies that job/task structure has changed, affecting scheduling.
**Trigger:** Task added, removed, or reordered within an element.
```json
{
  "eventId": "uuid",
  "eventType": "JobManagement.TaskStructureChanged",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "jobId": "string",
    "jobReference": "string",
    "elementId": "string",
    "changeType": "TaskAdded|TaskRemoved|TasksReordered",
    "affectedTaskIds": ["task-001", "task-002"]
  }
}
```

### JobManagement.ElementStructureChanged
Published by: **Job Management Service**
Consumed by: **Assignment Service**, **Scheduling View Service**

**Purpose:** Notifies that element structure has changed, affecting cross-element scheduling.
**Trigger:** Element created, or element dependency added/removed.
```json
{
  "eventId": "uuid",
  "eventType": "JobManagement.ElementStructureChanged",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "jobId": "string",
    "jobReference": "string",
    "elementId": "string",
    "changeType": "ElementCreated|DependencyAdded|DependencyRemoved",
    "prerequisiteElementId": "string|null"
  }
}
```

### JobManagement.ElementPrerequisiteChanged (v0.4.32)
Published by: **Job Management Service**
Consumed by: **Assignment Service**, **Scheduling View Service**

**Purpose:** Notifies that an element prerequisite status has changed.
**Trigger:** Element paper, BAT, plates, or forme status updated.
```json
{
  "eventId": "uuid",
  "eventType": "JobManagement.ElementPrerequisiteChanged",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "elementId": "string",
    "jobId": "string",
    "prerequisiteType": "paper|bat|plates|forme",
    "previousStatus": "string",
    "newStatus": "string",
    "isBlocked": true
  }
}
```

**Notes:**
- `isBlocked`: True if ANY element prerequisite is not in ready state
- Triggers tile blocking visual update in UI

### Assignment.TaskScheduled
Published by: **Assignment Service**
Consumed by: **Scheduling View Service**, **Job Management Service**

**Purpose:** Broadcasts that a task has been scheduled with station/provider and timing.
**Trigger:** Successful task assignment.
```json
{
  "eventId": "uuid",
  "eventType": "Assignment.TaskScheduled",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "taskId": "string",
    "elementId": "string",
    "jobId": "string",
    "jobReference": "string",
    "targetId": "string",
    "targetName": "string",
    "isOutsourced": false,
    "scheduledStart": "ISO-8601-datetime",
    "scheduledEnd": "ISO-8601-datetime"
  }
}
```

### Assignment.ConflictDetected
Published by: **Assignment Service**
Consumed by: **Scheduling View Service**

**Purpose:** Alerts that scheduling conflicts have been identified.
**Trigger:** Validation detects conflicts.
```json
{
  "eventId": "uuid",
  "eventType": "Assignment.ConflictDetected",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "type": "StationMismatchConflict|StationConflict|GroupCapacityConflict|PrecedenceConflict|PrerequisiteConflict|AvailabilityConflict|DeadlineConflict",
    "message": "string",
    "taskId": "string",
    "relatedTaskId": "string|null",
    "targetId": "string|null"
  }
}
```

### Assignment.ScheduleSnapshotUpdated
Published by: **Assignment Service**
Consumed by: **Scheduling View Service**

**Purpose:** Signals that a new schedule snapshot is available.
**Trigger:** Any schedule modification.
```json
{
  "eventId": "uuid",
  "eventType": "Assignment.ScheduleSnapshotUpdated",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "snapshotVersion": 43,
    "changedTaskIds": ["task-001", "task-002"],
    "hasNewConflicts": true,
    "lateJobCount": 2
  }
}
```

---

## 4. Command Messages

While events describe facts about what already happened, command messages express intent: they tell a service to perform an action.

### AssignTaskCommand
**Purpose:** Instructs the Assignment Service to assign a task to a station.
**Expected Outcome:** Valid assignment created with scheduled times.
**Failure Conditions:** Station unavailable, group capacity exceeded, approval gate blocked.

```json
{
  "commandType": "AssignTask",
  "taskId": "string",
  "targetId": "string",
  "isOutsourced": false,
  "scheduledStart": "ISO-8601-datetime",
  "bypassPrecedence": false,
  "requestedBy": "string",
  "requestedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- `targetId`: Station ID or Provider ID depending on `isOutsourced`
- `bypassPrecedence`: When true, skips element-scoped and cross-element precedence checks (Alt-key in UI)

### RescheduleTaskCommand
**Purpose:** Instructs the Assignment Service to move a task to a different time/station.
**Expected Outcome:** Task rescheduled with new start/end times.
**Failure Conditions:** New position creates conflicts.

```json
{
  "commandType": "RescheduleTask",
  "taskId": "string",
  "newTargetId": "string",
  "isOutsourced": false,
  "newScheduledStart": "ISO-8601-datetime",
  "bypassPrecedence": false,
  "requestedBy": "string",
  "requestedAt": "ISO-8601-timestamp"
}
```

### UnassignTaskCommand
**Purpose:** Instructs the Assignment Service to recall a task (remove assignment).
**Expected Outcome:** Task assignment removed, task returns to unscheduled state.
**Failure Conditions:** None (always succeeds for existing assignments).

```json
{
  "commandType": "UnassignTask",
  "taskId": "string",
  "requestedBy": "string",
  "requestedAt": "ISO-8601-timestamp"
}
```

### SwapTasksCommand
**Purpose:** Instructs the Assignment Service to swap two consecutive tasks.
**Expected Outcome:** Both tasks swap positions, times recalculated.
**Failure Conditions:** Tasks not consecutive, swap creates conflicts.

```json
{
  "commandType": "SwapTasks",
  "taskId1": "string",
  "taskId2": "string",
  "requestedBy": "string",
  "requestedAt": "ISO-8601-timestamp"
}
```

### ValidateAssignmentCommand
**Purpose:** Validates a proposed assignment without persisting.
**Expected Outcome:** Validation result with conflicts and optional suggested start time.
**Failure Conditions:** None (always produces result).

```json
{
  "commandType": "ValidateAssignment",
  "taskId": "string",
  "targetId": "string",
  "isOutsourced": false,
  "scheduledStart": "ISO-8601-datetime",
  "bypassPrecedence": false,
  "requestedAt": "ISO-8601-timestamp"
}
```

---

## 5. Event Metadata Standards

All integration events include standard metadata:

```json
{
  "eventId": "uuid",
  "eventType": "Context.EventName",
  "eventVersion": "1.0",
  "occurredAt": "ISO-8601-timestamp",
  "correlationId": "uuid",
  "causationId": "uuid",
  "aggregateId": "string",
  "aggregateType": "string",
  "sequenceNumber": 42,
  "metadata": {
    "userId": "string",
    "source": "service-name"
  },
  "data": { ... }
}
```

---

## 6. Message Schema Versioning

- Every integration event includes version in metadata
- Breaking changes require new event type (e.g. `Assignment.TaskScheduled.v2`)
- Non-breaking changes (adding optional fields) increment minor version
- Deprecated fields marked with `deprecated: true` in schema
- Consumers must handle unknown fields gracefully

---

## 7. Event Sourcing Considerations

For aggregates using event sourcing:

### Schedule Aggregate Events
- `ScheduleCreated`
- `TaskAssignmentAdded`
- `TaskAssignmentRemoved`
- `TaskRescheduled`
- `TasksSwapped`
- `ConflictDetected`
- `ConflictResolved`

These events form the event stream that can rebuild schedule state.

---

## 8. Dead Letter Queue Strategy

Failed event processing:
- Retry with exponential backoff (3 attempts)
- Move to DLQ after max retries
- Include failure metadata: reason, timestamp, retry count
- Alert on DLQ messages for manual intervention

---

## 9. Real-Time Updates (Future)

For WebSocket-based real-time updates:

```json
// Schedule updated notification
{
  "type": "schedule.updated",
  "data": {
    "snapshotVersion": 43,
    "changedTaskIds": ["task-001", "task-002"]
  }
}

// Conflict detected notification
{
  "type": "conflict.detected",
  "data": {
    "type": "StationConflict",
    "affectedTaskIds": ["task-001", "task-002"],
    "description": "Station Komori already booked 09:00-10:30"
  }
}

// Late job notification
{
  "type": "latejob.detected",
  "data": {
    "jobId": "job-789",
    "reference": "45120",
    "delayDays": 2
  }
}
```

---

## 10. Notes

- Domain events MUST NOT leak internal implementation details
- Integration events SHOULD be stable over time and backward compatible
- All timestamps use ISO-8601 format in UTC
- IDs in events should include human-readable names where helpful
- Events are technology-agnostic (Kafka, RabbitMQ, Symfony Messenger, etc.)
- The Assignment.TaskScheduled event is the most critical for system coordination
- Conflict events enable real-time UI updates for schedulers
