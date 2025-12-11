# Interface Contracts – Operations Research System

This document defines **service-to-service interface contracts** for the Equipment → Operator → Job → Task assignment and validation workflow.

The goal is to provide **stable, technology-agnostic API contracts** that describe the operations each service exposes to other services.

Interfaces are described in:
- simple textual form,
- request/response schema format,
- without binding to HTTP, RPC, or messaging.

---

## 1. Resource Management Service – Public Interface

### 1.1 RegisterOperator
**Purpose:** Add a new operator to the system with skills and availability.

**Preconditions**
- Operator name must be unique
- Skill levels must be valid (beginner|intermediate|expert)

**Request**
```json
{
  "name": "string",
  "skills": [
    {
      "equipmentId": "string",
      "level": "beginner|intermediate|expert",
      "certificationDate": "YYYY-MM-DD"
    }
  ],
  "availability": [
    {
      "start": "ISO-8601-datetime",
      "end": "ISO-8601-datetime"
    }
  ]
}
```

**Response**
```json
{
  "operatorId": "string",
  "status": "active",
  "createdAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Operator aggregate created in Active state
- Domain event `OperatorRegistered` emitted
- Availability slots stored without overlap

**Error responses**
- `OPERATOR_NAME_EXISTS` – Name already in use
- `INVALID_SKILL_LEVEL` – Unknown skill level
- `AVAILABILITY_OVERLAP` – Time slots overlap

### 1.2 UpdateOperatorAvailability
**Purpose:** Modify operator's availability schedule.

**Preconditions**
- Operator exists
- New availability slots don't overlap
- Operator is Active

**Request**
```json
{
  "operatorId": "string",
  "availability": [
    {
      "start": "ISO-8601-datetime",
      "end": "ISO-8601-datetime"
    }
  ]
}
```

**Response**
```json
{
  "status": "updated",
  "updatedAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Availability updated in Operator aggregate
- Domain event `OperatorAvailabilityChanged` emitted
- Integration event published for revalidation

**Error responses**
- `OPERATOR_NOT_FOUND` – Operator does not exist
- `AVAILABILITY_OVERLAP` – Time slots overlap
- `OPERATOR_INACTIVE` – Operator is deactivated

### 1.3 CheckOperatorAvailability
**Purpose:** Query operator availability and skills.

**Preconditions**
- Operator exists

**Request**
```json
{
  "operatorId": "string",
  "start": "ISO-8601-datetime",
  "end": "ISO-8601-datetime"
}
```

**Response**
```json
{
  "operatorId": "string",
  "name": "string",
  "status": "active|inactive",
  "availableSlots": [
    {
      "start": "ISO-8601-datetime",
      "end": "ISO-8601-datetime"
    }
  ],
  "skills": [
    {
      "equipmentId": "string",
      "equipmentName": "string",
      "level": "beginner|intermediate|expert"
    }
  ]
}
```

**Postconditions**
- None — this operation is read-only

**Error responses**
- `OPERATOR_NOT_FOUND` – Operator does not exist

### 1.4 RegisterEquipment
**Purpose:** Add new equipment to the resource pool.

**Preconditions**
- Equipment name must be unique
- At least one supported task type

**Request**
```json
{
  "name": "string",
  "supportedTaskTypes": ["type1", "type2"],
  "location": "string"
}
```

**Response**
```json
{
  "equipmentId": "string",
  "status": "available",
  "registeredAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Equipment aggregate created in Available state
- Domain event `EquipmentRegistered` emitted

**Error responses**
- `EQUIPMENT_NAME_EXISTS` – Name already in use
- `NO_TASK_TYPES` – No supported task types provided

---

## 2. Job Management Service – Public Interface

### 2.1 CreateJob
**Purpose:** Create a new production job with deadline.

**Preconditions**
- Deadline must be in the future

**Request**
```json
{
  "name": "string",
  "description": "string",
  "deadline": "ISO-8601-datetime"
}
```

**Response**
```json
{
  "jobId": "string",
  "status": "draft",
  "createdAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Job aggregate created in Draft state
- Domain event `JobCreated` emitted

**Error responses**
- `DEADLINE_IN_PAST` – Deadline is not in future

### 2.2 AddTaskToJob
**Purpose:** Add a task to an existing job.

**Preconditions**
- Job exists
- Job is in Draft state
- Task type is valid
- Duration is positive

**Request**
```json
{
  "jobId": "string",
  "name": "string",
  "type": "string",
  "duration": 120,
  "requiresOperator": true,
  "requiresEquipment": true,
  "equipmentType": "string"
}
```

**Response**
```json
{
  "taskId": "string",
  "addedAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Task added to Job aggregate
- Domain event `TaskAddedToJob` emitted

**Error responses**
- `JOB_NOT_FOUND` – Job does not exist
- `JOB_INVALID_STATE` – Job is not in Draft state
- `INVALID_DURATION` – Duration must be positive

### 2.3 SetTaskDependency
**Purpose:** Define dependency between tasks.

**Preconditions**
- Both tasks exist
- Tasks belong to same job
- No circular dependency created
- Job is in Draft or Planned state

**Request**
```json
{
  "fromTaskId": "string",
  "toTaskId": "string",
  "dependencyType": "FinishToStart"
}
```

**Response**
```json
{
  "status": "created",
  "createdAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Dependency added to Job aggregate
- DAG validated for cycles
- Domain event `TaskDependencySet` emitted

**Error responses**
- `TASK_NOT_FOUND` – One or both tasks don't exist
- `DIFFERENT_JOBS` – Tasks belong to different jobs
- `CIRCULAR_DEPENDENCY` – Would create a cycle
- `JOB_INVALID_STATE` – Job is not in Draft/Planned state

### 2.4 GetJobDetails
**Purpose:** Retrieve job with tasks and dependencies.

**Preconditions**
- Job exists

**Request**
```json
{
  "jobId": "string"
}
```

**Response**
```json
{
  "jobId": "string",
  "name": "string",
  "status": "draft|planned|inprogress|delayed|completed|cancelled",
  "deadline": "ISO-8601-datetime",
  "tasks": [
    {
      "taskId": "string",
      "name": "string",
      "type": "string",
      "duration": 120,
      "status": "defined|ready|assigned|executing|completed|failed|cancelled",
      "requiresOperator": true,
      "requiresEquipment": true
    }
  ],
  "dependencies": [
    {
      "fromTaskId": "string",
      "toTaskId": "string",
      "type": "FinishToStart"
    }
  ],
  "criticalPath": ["taskId1", "taskId2", "taskId3"]
}
```

**Postconditions**
- None — this operation is read-only

**Error responses**
- `JOB_NOT_FOUND` – Job does not exist

---

## 3. Assignment & Validation Service – Public Interface

### 3.1 AssignResourcesCommand
**Purpose:** Assign operator and equipment to a task with scheduled timing.

**Preconditions**
- Task exists and is in Ready state
- Operator has required skills for equipment
- Resources available at scheduled time
- No scheduling conflicts
- Dependencies satisfied

**Request**
```json
{
  "taskId": "string",
  "operatorId": "string",
  "equipmentId": "string",
  "scheduledStart": "ISO-8601-datetime"
}
```

**Response**
```json
{
  "assignmentId": "string",
  "scheduledEnd": "ISO-8601-datetime",
  "validationResult": {
    "valid": true,
    "conflicts": []
  }
}
```

**Postconditions**
- ValidatedAssignment created in Schedule aggregate
- Task scheduled with calculated end time
- Domain event `TaskAssigned` emitted
- Integration event `Assignment.TaskScheduled` published

**Error responses**
- `TASK_NOT_FOUND` – Task does not exist
- `TASK_NOT_READY` – Task is not in Ready state
- `SKILL_MISMATCH` – Operator lacks required skills
- `RESOURCE_UNAVAILABLE` – Resource not available at time
- `SCHEDULING_CONFLICT` – Double-booking detected
- `DEPENDENCY_VIOLATION` – Prerequisites not complete

### 3.2 RescheduleTask
**Purpose:** Change timing of existing task assignment.

**Preconditions**
- Assignment exists
- New time doesn't create conflicts
- Dependencies still satisfied

**Request**
```json
{
  "taskId": "string",
  "newScheduledStart": "ISO-8601-datetime",
  "reason": "string"
}
```

**Response**
```json
{
  "status": "rescheduled",
  "newScheduledEnd": "ISO-8601-datetime",
  "rescheduledAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Assignment updated with new timing
- Domain event `TaskRescheduled` emitted
- Dependent tasks revalidated

**Error responses**
- `ASSIGNMENT_NOT_FOUND` – No assignment for task
- `SCHEDULING_CONFLICT` – New time creates conflict
- `DEPENDENCY_VIOLATION` – Would violate dependencies

### 3.3 ValidateSchedule
**Purpose:** Perform full validation of schedule scope.

**Preconditions**
- None

**Request**
```json
{
  "scope": {
    "jobIds": ["job1", "job2"],
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD"
  }
}
```

**Response**
```json
{
  "validationId": "string",
  "status": "valid|conflicts_found",
  "conflicts": [
    {
      "type": "ResourceConflict|AvailabilityConflict|DependencyConflict|DeadlineConflict|SkillConflict",
      "severity": "high|medium|low",
      "affectedTasks": ["task1", "task2"],
      "description": "string",
      "suggestedResolution": "string"
    }
  ],
  "validatedAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Validation results cached
- Conflict events published if found

**Error responses**
- None — always returns validation result

---

## 4. Execution Tracking Service – Public Interface

### 4.1 StartTaskExecution
**Purpose:** Record actual task start by operator.

**Preconditions**
- Task is assigned
- Operator matches assignment
- Current time within allowed window

**Request**
```json
{
  "taskId": "string",
  "operatorId": "string",
  "actualStartTime": "ISO-8601-datetime"
}
```

**Response**
```json
{
  "executionId": "string",
  "startVarianceMinutes": -5,
  "status": "executing"
}
```

**Postconditions**
- TaskExecution created
- Actual start time recorded
- Domain event `TaskStarted` emitted
- Integration event published

**Error responses**
- `TASK_NOT_ASSIGNED` – Task has no assignment
- `OPERATOR_MISMATCH` – Wrong operator for task
- `OUTSIDE_TIME_WINDOW` – Too early or too late

### 4.2 CompleteTaskExecution
**Purpose:** Record task completion with quality results.

**Preconditions**
- Task execution was started
- Operator matches executor
- Quality check results valid

**Request**
```json
{
  "taskId": "string",
  "operatorId": "string",
  "actualEndTime": "ISO-8601-datetime",
  "qualityCheckResults": {
    "passed": true,
    "checks": [
      {
        "checkType": "string",
        "result": "pass|fail",
        "notes": "string"
      }
    ]
  }
}
```

**Response**
```json
{
  "status": "completed",
  "durationVarianceMinutes": 10,
  "completedAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Execution marked complete
- Quality results stored
- Domain event `TaskCompleted` emitted
- Job progress updated

**Error responses**
- `EXECUTION_NOT_FOUND` – Task not started
- `OPERATOR_MISMATCH` – Wrong operator
- `ALREADY_COMPLETED` – Task already complete

---

## 5. Common Types

### TimeSlot
```json
{
  "start": "ISO-8601-datetime",
  "end": "ISO-8601-datetime"
}
```

### Duration
```json
{
  "value": 120,
  "unit": "minutes"
}
```

### SkillLevel
```json
{
  "level": "beginner|intermediate|expert"
}
```

### TaskStatus
```json
{
  "status": "defined|ready|assigned|executing|completed|failed|cancelled"
}
```

### ConflictType
```json
{
  "type": "ResourceConflict|AvailabilityConflict|DependencyConflict|DeadlineConflict|SkillConflict"
}
```

---

## 6. Common Error Format

All services return errors using a uniform schema:

```json
{
  "errorCode": "string",
  "message": "string",
  "details": {
    "field": "additional context"
  },
  "timestamp": "ISO-8601-timestamp"
}
```

---

## 7. Versioning Rules

- API version included in header: `API-Version: 1.0`
- Breaking changes increment major version
- New optional fields are non-breaking
- Deprecation notices provided 6 months in advance
- Backward compatibility for 2 major versions

---

## 8. Security & Access Control

### Authentication
- All services require JWT bearer tokens
- Token lifetime: 30 minutes
- Refresh tokens supported

### Authorization
- Role-based access control (RBAC)
- Roles: `scheduler`, `manager`, `operator`, `admin`
- Operation-level permissions defined per role

### Rate Limiting
- 100 requests/minute per user
- 1000 requests/minute per service account
- 429 responses include retry-after header

---

## 9. Performance Expectations

### Response Times
- Read operations: < 200ms p95
- Write operations: < 500ms p95
- Validation operations: < 1000ms p95

### Timeouts
- Client timeout: 5 seconds
- Server processing: 4 seconds max

### Retry Policy
- Exponential backoff: 1s, 2s, 4s
- Max 3 retries for transient errors
- Idempotency keys for write operations

---

## 10. Notes

- These contracts are **technology-neutral** — implementation may use REST, gRPC, or message commands
- All contracts must match the **domain vocabulary** and **aggregate behaviour**
- They complement (but do not replace) the **integration event** definitions
- Security tokens and correlation IDs required but not shown in examples
- All datetime values in UTC unless specified otherwise
