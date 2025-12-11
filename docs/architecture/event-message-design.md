# Event & Message Design Specification – Operations Research System

This document defines **domain events**, **integration events**, and **message schemas** used across the Equipment → Operator → Job → Task assignment and validation workflow.

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
  - `ResourceManagement.OperatorAvailabilityChanged`
  - `JobManagement.TaskAddedToJob`
  - `Assignment.TaskScheduled`

---

## 2. Domain Events (Internal)

### OperatorRegistered
**Purpose:** Indicates that a new operator has been added to the system.  
**Trigger:** Emitted when the Operator aggregate is created.
```json
{
  "operatorId": "string",
  "name": "string",
  "registeredAt": "ISO-8601-timestamp"
}
```

### OperatorAvailabilityChanged
**Purpose:** Signals that an operator's availability schedule has been modified.  
**Trigger:** Emitted when availability slots are added, removed, or updated.
```json
{
  "operatorId": "string",
  "availability": [
    {
      "start": "ISO-8601-datetime",
      "end": "ISO-8601-datetime"
    }
  ],
  "changedAt": "ISO-8601-timestamp"
}
```

### OperatorSkillAdded
**Purpose:** Represents that an operator has gained certification for equipment.  
**Trigger:** Emitted when a new skill is added to operator profile.
```json
{
  "operatorId": "string",
  "equipmentId": "string",
  "level": "beginner|intermediate|expert",
  "certificationDate": "YYYY-MM-DD"
}
```

### EquipmentRegistered
**Purpose:** Indicates that new equipment has been added to the resource pool.  
**Trigger:** Emitted when the Equipment aggregate is created.
```json
{
  "equipmentId": "string",
  "name": "string",
  "supportedTaskTypes": ["type1", "type2"],
  "registeredAt": "ISO-8601-timestamp"
}
```

### MaintenanceScheduled
**Purpose:** Signals that equipment maintenance has been planned.  
**Trigger:** Emitted when maintenance window is set on equipment.
```json
{
  "equipmentId": "string",
  "maintenanceId": "string",
  "start": "ISO-8601-datetime",
  "end": "ISO-8601-datetime",
  "scheduledAt": "ISO-8601-timestamp"
}
```

### JobCreated
**Purpose:** Represents that a production job has been defined.  
**Trigger:** Emitted when the Job aggregate is created.
```json
{
  "jobId": "string",
  "name": "string",
  "deadline": "ISO-8601-datetime",
  "createdAt": "ISO-8601-timestamp"
}
```

### TaskAddedToJob
**Purpose:** Indicates that a task has been added to a job.  
**Trigger:** Emitted when task is added to job aggregate.
```json
{
  "jobId": "string",
  "taskId": "string",
  "type": "string",
  "duration": 120,
  "requiresOperator": true,
  "requiresEquipment": true,
  "addedAt": "ISO-8601-timestamp"
}
```

### TaskDependencySet
**Purpose:** Signals that a dependency between tasks has been established.  
**Trigger:** Emitted when task dependency is created.
```json
{
  "jobId": "string",
  "fromTaskId": "string",
  "toTaskId": "string",
  "dependencyType": "FinishToStart",
  "setAt": "ISO-8601-timestamp"
}
```

### TaskAssigned
**Purpose:** Indicates that resources have been assigned to a task with specific timing.  
**Trigger:** Emitted when task assignment is created in Schedule aggregate.
```json
{
  "taskId": "string",
  "operatorId": "string",
  "equipmentId": "string",
  "scheduledStart": "ISO-8601-datetime",
  "scheduledEnd": "ISO-8601-datetime",
  "assignedAt": "ISO-8601-timestamp"
}
```

### TaskStarted
**Purpose:** Represents that task execution has begun.  
**Trigger:** Emitted when operator starts executing a task.
```json
{
  "taskId": "string",
  "operatorId": "string",
  "actualStartTime": "ISO-8601-datetime",
  "varianceMinutes": -5
}
```

### TaskCompleted
**Purpose:** Indicates that task execution has finished successfully.
**Trigger:** Emitted when task execution is marked complete.
```json
{
  "taskId": "string",
  "actualEndTime": "ISO-8601-datetime",
  "durationVarianceMinutes": 10,
  "qualityChecksPassed": true
}
```

### TaskCancelled
**Purpose:** Indicates that a task has been cancelled.
**Trigger:** Emitted when task is cancelled (typically due to job cancellation).
```json
{
  "taskId": "string",
  "jobId": "string",
  "reason": "JobCancelled|ManualCancellation",
  "cancelledAt": "ISO-8601-timestamp"
}
```

### JobCancelled
**Purpose:** Indicates that a job has been cancelled.
**Trigger:** Emitted when job is cancelled, cascading to all tasks.
```json
{
  "jobId": "string",
  "reason": "string",
  "affectedTaskIds": ["task1", "task2"],
  "cancelledAt": "ISO-8601-timestamp"
}
```

---

## 3. Integration Events (Public)

### ResourceManagement.OperatorAvailabilityChanged
Published by: **Resource Management Service**  
Consumed by: **Assignment & Validation Service**

**Purpose:** Notifies that operator availability has changed, requiring schedule revalidation.  
**Trigger:** Domain event wrapped for external consumption.
```json
{
  "eventId": "uuid",
  "eventType": "ResourceManagement.OperatorAvailabilityChanged",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "operatorId": "string",
    "previousAvailability": [...],
    "newAvailability": [...],
    "affectedPeriod": {
      "start": "ISO-8601-datetime",
      "end": "ISO-8601-datetime"
    }
  }
}
```

### ResourceManagement.EquipmentStatusChanged
Published by: **Resource Management Service**  
Consumed by: **Assignment & Validation Service**

**Purpose:** Signals equipment status change that may affect assignments.  
**Trigger:** Equipment breakdown, maintenance start/end.
```json
{
  "eventId": "uuid",
  "eventType": "ResourceManagement.EquipmentStatusChanged",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "equipmentId": "string",
    "previousStatus": "Available",
    "newStatus": "OutOfService",
    "reason": "Breakdown",
    "estimatedReturnToService": "ISO-8601-datetime"
  }
}
```

### JobManagement.TaskStructureChanged
Published by: **Job Management Service**  
Consumed by: **Assignment & Validation Service**

**Purpose:** Notifies that job/task structure has changed, affecting scheduling.  
**Trigger:** Task added, removed, or dependencies changed.
```json
{
  "eventId": "uuid",
  "eventType": "JobManagement.TaskStructureChanged",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "jobId": "string",
    "changeType": "TaskAdded|TaskRemoved|DependencyChanged",
    "affectedTaskIds": ["task1", "task2"],
    "criticalPathChanged": true
  }
}
```

### Assignment.TaskScheduled
Published by: **Assignment & Validation Service**  
Consumed by: **Execution Tracking Service**, **Scheduling View Service**

**Purpose:** Broadcasts that a task has been scheduled with resources and timing.  
**Trigger:** Successful task assignment and scheduling.
```json
{
  "eventId": "uuid",
  "eventType": "Assignment.TaskScheduled",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "taskId": "string",
    "jobId": "string",
    "operatorId": "string",
    "operatorName": "string",
    "equipmentId": "string",
    "equipmentName": "string",
    "scheduledStart": "ISO-8601-datetime",
    "scheduledEnd": "ISO-8601-datetime",
    "location": "string"
  }
}
```

### Assignment.ConflictDetected
Published by: **Assignment & Validation Service**  
Consumed by: **Scheduling View Service**, **Notification Service**

**Purpose:** Alerts that scheduling conflicts have been identified.  
**Trigger:** Validation detects resource conflicts or constraint violations.
```json
{
  "eventId": "uuid",
  "eventType": "Assignment.ConflictDetected",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "conflictType": "ResourceConflict|AvailabilityConflict|DependencyConflict|DeadlineConflict|SkillConflict",
    "affectedTaskIds": ["task1", "task2"],
    "resourceId": "string",
    "conflictPeriod": {
      "start": "ISO-8601-datetime",
      "end": "ISO-8601-datetime"
    },
    "severity": "High|Medium|Low",
    "suggestedResolution": "string"
  }
}
```

### Execution.TaskProgressUpdate
Published by: **Execution Tracking Service**  
Consumed by: **Job Management Service**, **Scheduling View Service**

**Purpose:** Provides real-time updates on task execution progress.  
**Trigger:** Task started, progress recorded, or completed.
```json
{
  "eventId": "uuid",
  "eventType": "Execution.TaskProgressUpdate",
  "occurredAt": "ISO-8601-timestamp",
  "data": {
    "taskId": "string",
    "jobId": "string",
    "status": "Started|InProgress|Completed|Failed",
    "progressPercent": 75,
    "actualTiming": {
      "start": "ISO-8601-datetime",
      "end": "ISO-8601-datetime"
    },
    "variance": {
      "startVarianceMinutes": -5,
      "durationVarianceMinutes": 10
    }
  }
}
```

---

## 4. Command Messages

While events describe facts about what already happened, command messages express intent: they tell a service to perform an action.

### AssignResourcesCommand
**Purpose:** Instructs the Assignment Service to assign operator and equipment to a task.  
**Expected Outcome:** Valid assignment created with scheduled times.  
**Failure Conditions:** Resource unavailable, skill mismatch, scheduling conflict.

```json
{
  "commandType": "AssignResources",
  "taskId": "string",
  "operatorId": "string",
  "equipmentId": "string",
  "scheduledStart": "ISO-8601-datetime",
  "requestedBy": "string",
  "requestedAt": "ISO-8601-timestamp"
}
```

### RescheduleTaskCommand
**Purpose:** Instructs the Assignment Service to change task timing.  
**Expected Outcome:** Task rescheduled with new start/end times.  
**Failure Conditions:** New time creates conflicts, violates dependencies.

```json
{
  "commandType": "RescheduleTask",
  "taskId": "string",
  "newScheduledStart": "ISO-8601-datetime",
  "reason": "string",
  "requestedBy": "string",
  "requestedAt": "ISO-8601-timestamp"
}
```

### ValidateScheduleCommand
**Purpose:** Triggers full validation of current schedule.  
**Expected Outcome:** Validation report with conflicts identified.  
**Failure Conditions:** None (always produces report).

```json
{
  "commandType": "ValidateSchedule",
  "scope": {
    "jobIds": ["job1", "job2"],
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD"
  },
  "requestedAt": "ISO-8601-timestamp"
}
```

### StartTaskExecutionCommand
**Purpose:** Records actual task start by operator.  
**Expected Outcome:** Task execution started and tracked.  
**Failure Conditions:** Task not assigned, wrong operator, outside time window.

```json
{
  "commandType": "StartTaskExecution",
  "taskId": "string",
  "operatorId": "string",
  "actualStartTime": "ISO-8601-datetime",
  "startReason": "OnTime|Early|Late",
  "delayReason": "string"
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
- `ConflictDetected`
- `ConflictResolved`
- `SchedulePublished`

These events form the event stream that can rebuild schedule state.

---

## 8. Dead Letter Queue Strategy

Failed event processing:
- Retry with exponential backoff (3 attempts)
- Move to DLQ after max retries
- Include failure metadata: reason, timestamp, retry count
- Alert on DLQ messages for manual intervention

---

## 9. Notes

- Domain events MUST NOT leak internal implementation details
- Integration events SHOULD be stable over time and backward compatible
- All timestamps use ISO-8601 format in UTC
- Resource IDs in events should include human-readable names where possible
- Events are technology-agnostic (Kafka, RabbitMQ, Symfony Messenger, etc.)
- The Assignment.TaskScheduled event is the most critical for system coordination
