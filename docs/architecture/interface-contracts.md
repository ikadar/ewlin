# Interface Contracts – Flux Print Shop Scheduling System

This document defines **service-to-service interface contracts** for the Station → Job → Task assignment and validation workflow.

The goal is to provide **stable, technology-agnostic API contracts** that describe the operations each service exposes to other services.

Interfaces are described in:
- simple textual form,
- request/response schema format,
- without binding to HTTP, RPC, or messaging.

---

## 1. Station Management Service – Public Interface

### 1.1 RegisterStation
#### IC-STATION-001
> **References:** [API-STATION-001](../requirements/api-interface-drafts.md#api-station-001), [AC-STATION-001](../requirements/acceptance-criteria.md#ac-station-001-station-registration), [BR-STATION-001](../domain-model/business-rules.md#br-station-001), [BR-STATION-002](../domain-model/business-rules.md#br-station-002), [BR-STATION-003](../domain-model/business-rules.md#br-station-003)

**Purpose:** Add a new station to the system with operating schedule.

**Preconditions**
- Station name must be unique
- Category must exist
- Group must exist (or null for ungrouped)

**Request**
```json
{
  "name": "string",
  "categoryId": "string",
  "groupId": "string | null",
  "capacity": 1,
  "operatingSchedule": {
    "weeklyPattern": [
      {
        "dayOfWeek": 0,
        "timeSlots": [
          {"start": "HH:MM", "end": "HH:MM"}
        ]
      }
    ]
  }
}
```

**Response**
```json
{
  "stationId": "string",
  "name": "string",
  "status": "Available",
  "createdAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Station aggregate created in Available state
- Domain event `StationRegistered` emitted
- Operating schedule stored

**Error responses**
- `STATION_NAME_EXISTS` – Name already in use
- `CATEGORY_NOT_FOUND` – Category does not exist
- `GROUP_NOT_FOUND` – Group does not exist

### 1.2 UpdateOperatingSchedule
#### IC-STATION-002
> **References:** [AC-STATION-002](../requirements/acceptance-criteria.md#ac-station-002-operating-schedule-definition), [BR-STATION-004](../domain-model/business-rules.md#br-station-004), [BR-STATION-005](../domain-model/business-rules.md#br-station-005)

**Purpose:** Modify station's weekly operating schedule.

**Preconditions**
- Station exists
- Station is not OutOfService

**Request**
```json
{
  "stationId": "string",
  "operatingSchedule": {
    "weeklyPattern": [
      {
        "dayOfWeek": 0,
        "timeSlots": [
          {"start": "HH:MM", "end": "HH:MM"}
        ]
      }
    ]
  }
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
- Operating schedule updated in Station aggregate
- Domain event `StationScheduleChanged` emitted
- Integration event published for revalidation

**Error responses**
- `STATION_NOT_FOUND` – Station does not exist
- `STATION_OUT_OF_SERVICE` – Station is out of service
- `INVALID_TIME_SLOTS` – Time slots overlap or invalid format

### 1.3 AddScheduleException
#### IC-STATION-003
> **References:** [API-STATION-003](../requirements/api-interface-drafts.md#api-station-003), [AC-STATION-003](../requirements/acceptance-criteria.md#ac-station-003-schedule-exception), [BR-STATION-008](../domain-model/business-rules.md#br-station-008)

**Purpose:** Add a one-off schedule exception (holiday, maintenance).

**Preconditions**
- Station exists
- Date is in the future or today

**Request**
```json
{
  "stationId": "string",
  "date": "YYYY-MM-DD",
  "type": "Closed | ModifiedHours",
  "reason": "string",
  "modifiedSlots": [
    {"start": "HH:MM", "end": "HH:MM"}
  ]
}
```

**Response**
```json
{
  "exceptionId": "string",
  "createdAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- ScheduleException added to Station aggregate
- Domain event `ScheduleExceptionAdded` emitted
- Affected assignments flagged for revalidation

**Error responses**
- `STATION_NOT_FOUND` – Station does not exist
- `EXCEPTION_DATE_PAST` – Date is in the past
- `MODIFIED_SLOTS_REQUIRED` – ModifiedHours type requires slots

### 1.4 GetStationAvailability
#### IC-STATION-004
> **References:** [AC-STATION-002](../requirements/acceptance-criteria.md#ac-station-002-operating-schedule-definition), [BR-STATION-004](../domain-model/business-rules.md#br-station-004)

**Purpose:** Query station availability for a time range.

**Preconditions**
- Station exists

**Request**
```json
{
  "stationId": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}
```

**Response**
```json
{
  "stationId": "string",
  "name": "string",
  "status": "Available | InUse | Maintenance | OutOfService",
  "categoryId": "string",
  "groupId": "string | null",
  "availableSlots": [
    {
      "date": "YYYY-MM-DD",
      "slots": [
        {"start": "HH:MM", "end": "HH:MM"}
      ]
    }
  ],
  "exceptions": [
    {
      "date": "YYYY-MM-DD",
      "type": "Closed | ModifiedHours",
      "reason": "string"
    }
  ]
}
```

**Postconditions**
- None — this operation is read-only

**Error responses**
- `STATION_NOT_FOUND` – Station does not exist

---

## 2. Station Category Service – Public Interface

### 2.1 CreateCategory
#### IC-CATEGORY-001
> **References:** [API-CATEGORY-001](../requirements/api-interface-drafts.md#api-category-001), [AC-STATION-004](../requirements/acceptance-criteria.md#ac-station-004-station-category-with-similarity-criteria), [BR-CATEGORY-001](../domain-model/business-rules.md#br-category-001), [BR-CATEGORY-002](../domain-model/business-rules.md#br-category-002)

**Purpose:** Create a station category with similarity criteria.

**Preconditions**
- Category name must be unique

**Request**
```json
{
  "name": "string",
  "similarityCriteria": [
    {"code": "string", "name": "string", "fieldPath": "string"}
  ]
}
```

**Notes:**
- `fieldPath`: Path to Job property for similarity comparison (e.g., "paperType")

**Response**
```json
{
  "categoryId": "string",
  "name": "string",
  "createdAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- StationCategory aggregate created
- Domain event `CategoryCreated` emitted

**Error responses**
- `CATEGORY_NAME_EXISTS` – Name already in use

### 2.2 UpdateSimilarityCriteria
#### IC-CATEGORY-002
> **References:** [AC-STATION-006](../requirements/acceptance-criteria.md#ac-station-006-similarity-criterion-comparison), [BR-CATEGORY-003](../domain-model/business-rules.md#br-category-003)

**Purpose:** Update the similarity criteria for a category.

**Preconditions**
- Category exists

**Request**
```json
{
  "categoryId": "string",
  "similarityCriteria": [
    {"code": "string", "name": "string"}
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
- Similarity criteria updated
- Domain event `CategoryCriteriaUpdated` emitted

**Error responses**
- `CATEGORY_NOT_FOUND` – Category does not exist

---

## 3. Station Group Service – Public Interface

### 3.1 CreateGroup
#### IC-GROUP-001
> **References:** [API-GROUP-001](../requirements/api-interface-drafts.md#api-group-001), [AC-STATION-005](../requirements/acceptance-criteria.md#ac-station-005-station-group-capacity), [BR-GROUP-001](../domain-model/business-rules.md#br-group-001), [BR-GROUP-002](../domain-model/business-rules.md#br-group-002)

**Purpose:** Create a station group with concurrency limits.

**Preconditions**
- Group name must be unique

**Request**
```json
{
  "name": "string",
  "maxConcurrent": "integer | null"
}
```

**Response**
```json
{
  "groupId": "string",
  "name": "string",
  "maxConcurrent": "integer | null",
  "createdAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- StationGroup aggregate created
- Domain event `GroupCreated` emitted

**Error responses**
- `GROUP_NAME_EXISTS` – Name already in use
- `INVALID_MAX_CONCURRENT` – Value must be positive or null

### 3.2 CheckGroupCapacity
#### IC-GROUP-002
> **References:** [AC-CONFLICT-002](../requirements/acceptance-criteria.md#ac-conflict-002-group-capacity-exceeded), [BR-SCHED-002](../domain-model/business-rules.md#br-sched-002)

**Purpose:** Check if group has capacity at a given time.

**Preconditions**
- Group exists

**Request**
```json
{
  "groupId": "string",
  "timeSlot": {
    "start": "ISO-8601-datetime",
    "end": "ISO-8601-datetime"
  }
}
```

**Response**
```json
{
  "groupId": "string",
  "maxConcurrent": "integer | null",
  "currentConcurrent": "integer",
  "hasCapacity": "boolean",
  "assignments": [
    {
      "taskId": "string",
      "stationId": "string",
      "scheduledStart": "ISO-8601-datetime",
      "scheduledEnd": "ISO-8601-datetime"
    }
  ]
}
```

**Postconditions**
- None — this operation is read-only

**Error responses**
- `GROUP_NOT_FOUND` – Group does not exist

---

## 4. Outsourced Provider Service – Public Interface

### 4.1 RegisterProvider
#### IC-PROVIDER-001
> **References:** [API-PROVIDER-001](../requirements/api-interface-drafts.md#api-provider-001), [AC-PROVIDER-001](../requirements/acceptance-criteria.md#ac-provider-001-provider-registration), [BR-PROVIDER-001](../domain-model/business-rules.md#br-provider-001), [BR-PROVIDER-002](../domain-model/business-rules.md#br-provider-002), [BR-PROVIDER-003](../domain-model/business-rules.md#br-provider-003)

**Purpose:** Add an external provider to the system.

**Preconditions**
- Provider name must be unique
- At least one supported action type

**Request**
```json
{
  "name": "string",
  "supportedActionTypes": ["Pelliculage", "Dorure", "Reliure"],
  "latestDepartureTime": "HH:MM",
  "receptionTime": "HH:MM"
}
```

**Response**
```json
{
  "providerId": "string",
  "name": "string",
  "latestDepartureTime": "HH:MM",
  "receptionTime": "HH:MM",
  "groupId": "string",
  "status": "Active",
  "createdAt": "ISO-8601-timestamp"
}
```

**Notes:**
- `latestDepartureTime`: Cutoff time for same-day work submission (default: "14:00")
- `receptionTime`: Time when completed work returns from provider (default: "09:00")

**Postconditions**
- OutsourcedProvider aggregate created in Active state
- Auto-generated StationGroup created (unlimited capacity)
- Domain event `ProviderRegistered` emitted

**Error responses**
- `PROVIDER_NAME_EXISTS` – Name already in use
- `NO_ACTION_TYPES` – No supported action types provided

### 4.2 GetProviderDetails
#### IC-PROVIDER-002
> **References:** [AC-PROVIDER-003](../requirements/acceptance-criteria.md#ac-provider-003-unlimited-provider-capacity), [BR-PROVIDER-002](../domain-model/business-rules.md#br-provider-002)

**Purpose:** Retrieve provider with supported action types.

**Preconditions**
- Provider exists

**Request**
```json
{
  "providerId": "string"
}
```

**Response**
```json
{
  "providerId": "string",
  "name": "string",
  "status": "Active | Inactive",
  "supportedActionTypes": ["string"],
  "groupId": "string"
}
```

**Postconditions**
- None — this operation is read-only

**Error responses**
- `PROVIDER_NOT_FOUND` – Provider does not exist

---

## 5. Job Management Service – Public Interface

### 5.1 CreateJob
#### IC-JOB-001
> **References:** [API-JOB-001](../requirements/api-interface-drafts.md#api-job-001), [AC-JOB-001](../requirements/acceptance-criteria.md#ac-job-001-job-creation), [AC-JOB-002](../requirements/acceptance-criteria.md#ac-job-002-task-dsl-parsing), [BR-JOB-001](../domain-model/business-rules.md#br-job-001), [BR-JOB-002](../domain-model/business-rules.md#br-job-002), [BR-JOB-003](../domain-model/business-rules.md#br-job-003)

**Purpose:** Create a new print job with tasks from DSL.

**Preconditions**
- Workshop exit date must be in the future
- DSL must be valid (if provided)

**Request**
```json
{
  "reference": "string",
  "client": "string",
  "description": "string",
  "workshopExitDate": "ISO-8601-datetime",
  "paperType": "string | null",
  "paperFormat": "string | null",
  "paperPurchaseStatus": "InStock | ToOrder | Ordered | Received",
  "notes": "string",
  "tasksDSL": "string"
}
```

**Response**
```json
{
  "jobId": "string",
  "reference": "string",
  "status": "Draft",
  "fullyScheduled": false,
  "color": "#RRGGBB",
  "tasks": [
    {
      "taskId": "string",
      "sequenceOrder": 1,
      "type": "internal | outsourced",
      "stationId": "string | null",
      "providerId": "string | null",
      "setupMinutes": 0,
      "runMinutes": 60,
      "durationOpenDays": "integer | null",
      "comment": "string | null",
      "status": "Defined"
    }
  ],
  "createdAt": "ISO-8601-timestamp"
}
```

**Notes:**
- `color`: Randomly assigned from predefined palette; dependent jobs use shades of required job's color

**Postconditions**
- Job aggregate created in Draft state
- Tasks created from DSL parsing
- Domain event `JobCreated` emitted

**Error responses**
- `DEADLINE_IN_PAST` – Workshop exit date is not in future
- `DSL_PARSE_ERROR` – DSL syntax error (includes line and message)
- `STATION_NOT_FOUND` – Station referenced in DSL not found
- `PROVIDER_NOT_FOUND` – Provider referenced in DSL not found

### 5.2 UpdateJobDetails
#### IC-JOB-002
> **References:** [API-JOB-003](../requirements/api-interface-drafts.md#api-job-003), [BR-JOB-001](../domain-model/business-rules.md#br-job-001)

**Purpose:** Update job metadata (not tasks).

**Preconditions**
- Job exists
- Job is not Cancelled or Completed

**Request**
```json
{
  "jobId": "string",
  "reference": "string",
  "client": "string",
  "description": "string",
  "workshopExitDate": "ISO-8601-datetime",
  "paperType": "string | null",
  "paperFormat": "string | null",
  "notes": "string"
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
- Job aggregate updated
- Domain event `JobUpdated` emitted
- If deadline changed, deadline conflicts recalculated

**Error responses**
- `JOB_NOT_FOUND` – Job does not exist
- `JOB_INVALID_STATE` – Job is Cancelled or Completed

### 5.3 ReorderTasks
#### IC-JOB-003
> **References:** [API-TASK-001](../requirements/api-interface-drafts.md#api-task-001), [BR-TASK-003](../domain-model/business-rules.md#br-task-003)

**Purpose:** Change the sequence order of tasks within a job.

**Preconditions**
- Job exists
- All task IDs belong to the job
- Job is not Completed or Cancelled

**Request**
```json
{
  "jobId": "string",
  "taskOrder": ["taskId1", "taskId2", "taskId3"]
}
```

**Response**
```json
{
  "status": "reordered",
  "updatedAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Task sequence updated
- Domain event `TasksReordered` emitted
- Existing assignments revalidated for precedence

**Error responses**
- `JOB_NOT_FOUND` – Job does not exist
- `TASK_NOT_IN_JOB` – Task ID not part of this job
- `JOB_INVALID_STATE` – Job is Completed or Cancelled

### 5.4 SetJobDependency
#### IC-JOB-004
> **References:** [API-JOB-007](../requirements/api-interface-drafts.md#api-job-007), [AC-JOB-005](../requirements/acceptance-criteria.md#ac-job-005-job-dependencies), [AC-JOB-006](../requirements/acceptance-criteria.md#ac-job-006-circular-dependency-prevention), [BR-JOB-006](../domain-model/business-rules.md#br-job-006), [BR-JOB-008](../domain-model/business-rules.md#br-job-008)

**Purpose:** Define that one job depends on another job.

**Preconditions**
- Both jobs exist
- No circular dependency created

**Request**
```json
{
  "jobId": "string",
  "requiredJobId": "string"
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
- Job dependency added
- Domain event `JobDependencySet` emitted

**Error responses**
- `JOB_NOT_FOUND` – One or both jobs don't exist
- `CIRCULAR_DEPENDENCY` – Would create a cycle

### 5.5 UpdateProofStatus
#### IC-JOB-005
> **References:** [API-JOB-004](../requirements/api-interface-drafts.md#api-job-004), [AC-GATE-001](../requirements/acceptance-criteria.md#ac-gate-001-bat-blocking), [AC-GATE-002](../requirements/acceptance-criteria.md#ac-gate-002-bat-bypass), [BR-GATE-001](../domain-model/business-rules.md#br-gate-001), [BR-GATE-003](../domain-model/business-rules.md#br-gate-003)

**Purpose:** Update BAT (Bon à Tirer) approval status.

**Preconditions**
- Job exists

**Request**
```json
{
  "jobId": "string",
  "proofSentAt": "ISO-8601-datetime | AwaitingFile | NoProofRequired",
  "proofApprovedAt": "ISO-8601-datetime | null"
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
- Proof status updated
- Domain event `ProofStatusChanged` emitted
- If proof approved, blocked tasks become schedulable

**Error responses**
- `JOB_NOT_FOUND` – Job does not exist
- `INVALID_PROOF_STATE` – Cannot approve without sending first

### 5.6 UpdatePlatesStatus
#### IC-JOB-006
> **References:** [API-JOB-005](../requirements/api-interface-drafts.md#api-job-005), [AC-GATE-003](../requirements/acceptance-criteria.md#ac-gate-003-plates-blocking), [BR-GATE-002](../domain-model/business-rules.md#br-gate-002)

**Purpose:** Update plates preparation status.

**Preconditions**
- Job exists

**Request**
```json
{
  "jobId": "string",
  "platesStatus": "Todo | Done"
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
- Plates status updated
- Domain event `PlatesStatusChanged` emitted
- If plates done, printing tasks become schedulable

**Error responses**
- `JOB_NOT_FOUND` – Job does not exist

### 5.7 UpdatePaperStatus
#### IC-JOB-007
> **References:** [API-JOB-006](../requirements/api-interface-drafts.md#api-job-006), [AC-GATE-004](../requirements/acceptance-criteria.md#ac-gate-004-paper-status-timestamp), [BR-PAPER-001](../domain-model/business-rules.md#br-paper-001), [BR-PAPER-002](../domain-model/business-rules.md#br-paper-002)

**Purpose:** Update paper procurement status.

**Preconditions**
- Job exists

**Request**
```json
{
  "jobId": "string",
  "paperPurchaseStatus": "InStock | ToOrder | Ordered | Received"
}
```

**Response**
```json
{
  "paperPurchaseStatus": "string",
  "paperOrderedAt": "ISO-8601-timestamp | null",
  "updatedAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Paper status updated
- If changed to Ordered, paperOrderedAt set
- Domain event `PaperStatusChanged` emitted

**Error responses**
- `JOB_NOT_FOUND` – Job does not exist

### 5.8 AddComment
#### IC-JOB-008
> **References:** [API-JOB-008](../requirements/api-interface-drafts.md#api-job-008), [COM-001](../domain-model/business-rules.md#com-001), [COM-002](../domain-model/business-rules.md#com-002)

**Purpose:** Add a timestamped comment to a job.

**Preconditions**
- Job exists

**Request**
```json
{
  "jobId": "string",
  "content": "string"
}
```

**Response**
```json
{
  "author": "string",
  "timestamp": "ISO-8601-timestamp",
  "content": "string"
}
```

**Postconditions**
- Comment added to job
- Domain event `CommentAdded` emitted

**Error responses**
- `JOB_NOT_FOUND` – Job does not exist
- `EMPTY_CONTENT` – Comment content is empty

### 5.9 CancelJob
#### IC-JOB-009
> **References:** [API-JOB-009](../requirements/api-interface-drafts.md#api-job-009), [AC-JOB-007](../requirements/acceptance-criteria.md#ac-job-007-job-cancellation), [BR-JOB-005](../domain-model/business-rules.md#br-job-005), [BR-JOB-010](../domain-model/business-rules.md#br-job-010), [BR-JOB-010b](../domain-model/business-rules.md#br-job-010b)

**Purpose:** Cancel a job and handle its assignments appropriately.

**Preconditions**
- Job exists
- Job is not already Completed or Cancelled

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
  "status": "Cancelled",
  "recalledTaskIds": ["task-002", "task-003"],
  "preservedTaskIds": ["task-001"],
  "cancelledAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Job status changes to Cancelled
- All task statuses change to Cancelled
- Future task assignments are recalled (removed)
- Past task assignments remain for historical reference
- Domain event `JobCancelled` emitted

**Error responses**
- `JOB_NOT_FOUND` – Job does not exist
- `JOB_INVALID_STATE` – Job is already Completed or Cancelled

### 5.10 ToggleTaskCompletion
#### IC-JOB-010
> **References:** [API-TASK-003](../requirements/api-interface-drafts.md#api-task-003), [AC-SCHED-010](../requirements/acceptance-criteria.md#ac-sched-010-task-completion-checkbox), [AC-SCHED-011](../requirements/acceptance-criteria.md#ac-sched-011-completion-does-not-auto-set), [BR-ASSIGN-007](../domain-model/business-rules.md#br-assign-007), [BR-ASSIGN-008](../domain-model/business-rules.md#br-assign-008)

**Purpose:** Toggle task completion status (manual tracking).

**Preconditions**
- Task exists
- Task is Assigned or Executing

**Request**
```json
{
  "taskId": "string",
  "isCompleted": true
}
```

**Response**
```json
{
  "taskId": "string",
  "isCompleted": true,
  "completedAt": "ISO-8601-timestamp | null"
}
```

**Postconditions**
- Task isCompleted flag updated
- Task completedAt set (if true) or cleared (if false)
- Domain event `TaskCompletionToggled` emitted
- Precedence validation is NOT affected

**Notes**
- Completion is purely for tracking purposes
- Tasks are NOT automatically marked completed based on time
- This does NOT change the task status (remains Assigned/Executing)

**Error responses**
- `TASK_NOT_FOUND` – Task does not exist
- `TASK_NOT_ASSIGNED` – Task must be Assigned or Executing to toggle completion

### 5.11 GetJobDetails
#### IC-JOB-011
> **References:** [AC-JOB-001](../requirements/acceptance-criteria.md#ac-job-001-job-creation), [BR-JOB-001](../domain-model/business-rules.md#br-job-001)

**Purpose:** Retrieve job with tasks and status.

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
  "reference": "string",
  "client": "string",
  "description": "string",
  "status": "Draft | Planned | InProgress | Delayed | Completed | Cancelled",
  "workshopExitDate": "ISO-8601-datetime",
  "fullyScheduled": "boolean",
  "paperType": "string | null",
  "paperFormat": "string | null",
  "paperPurchaseStatus": "InStock | ToOrder | Ordered | Received",
  "paperOrderedAt": "ISO-8601-timestamp | null",
  "proofSentAt": "ISO-8601-datetime | AwaitingFile | NoProofRequired | null",
  "proofApprovedAt": "ISO-8601-datetime | null",
  "platesStatus": "Todo | Done",
  "tasks": [
    {
      "taskId": "string",
      "sequenceOrder": 1,
      "type": "internal | outsourced",
      "stationId": "string | null",
      "stationName": "string | null",
      "providerId": "string | null",
      "providerName": "string | null",
      "actionType": "string | null",
      "setupMinutes": 0,
      "runMinutes": 60,
      "totalMinutes": 60,
      "durationOpenDays": "integer | null",
      "comment": "string | null",
      "status": "Defined | Ready | Assigned | Completed | Cancelled"
    }
  ],
  "dependencies": ["jobId1", "jobId2"],
  "comments": [
    {
      "author": "string",
      "timestamp": "ISO-8601-timestamp",
      "content": "string"
    }
  ]
}
```

**Postconditions**
- None — this operation is read-only

**Error responses**
- `JOB_NOT_FOUND` – Job does not exist

---

## 6. Assignment & Validation Service – Public Interface

### 6.1 AssignTask
#### IC-ASSIGN-001
> **References:** [API-ASSIGN-001](../requirements/api-interface-drafts.md#api-assign-001), [AC-SCHED-003](../requirements/acceptance-criteria.md#ac-sched-003-drag-and-drop-assignment), [BR-ASSIGN-001](../domain-model/business-rules.md#br-assign-001)

**Purpose:** Assign a task to a station/provider with scheduled timing.

**Preconditions**
- Task exists
- Station/Provider available at scheduled time
- Approval gates satisfied (BAT, Plates)
- Predecessor tasks scheduled (precedence check)
- No scheduling conflicts

**Request**
```json
{
  "taskId": "string",
  "stationId": "string",
  "scheduledStart": "ISO-8601-datetime"
}
```

**Response (Valid)**
```json
{
  "taskId": "string",
  "assignment": {
    "stationId": "string",
    "scheduledStart": "ISO-8601-datetime",
    "scheduledEnd": "ISO-8601-datetime"
  },
  "status": "Assigned",
  "validationResult": {
    "valid": true,
    "conflicts": []
  }
}
```

**Response (Invalid)**
```json
{
  "taskId": "string",
  "validationResult": {
    "valid": false,
    "conflicts": [
      {
        "type": "StationConflict | GroupCapacityConflict | PrecedenceConflict | ApprovalGateConflict | AvailabilityConflict | DeadlineConflict",
        "description": "string",
        "affectedTaskIds": ["taskId1", "taskId2"],
        "severity": "High | Medium | Low"
      }
    ]
  }
}
```

**Postconditions**
- If valid: Assignment created, task status → Assigned
- Domain event `TaskAssigned` emitted
- Integration event published

**Error responses**
- `TASK_NOT_FOUND` – Task does not exist
- `STATION_NOT_FOUND` – Station does not exist
- `STATION_MISMATCH` – Task cannot be assigned to this station

### 6.2 RecallTask
#### IC-ASSIGN-002
> **References:** [API-ASSIGN-002](../requirements/api-interface-drafts.md#api-assign-002), [AC-SCHED-007](../requirements/acceptance-criteria.md#ac-sched-007-recall-tile), [BR-ASSIGN-005](../domain-model/business-rules.md#br-assign-005)

**Purpose:** Remove task assignment (recall tile from schedule).

**Preconditions**
- Task has an assignment

**Request**
```json
{
  "taskId": "string"
}
```

**Response**
```json
{
  "taskId": "string",
  "status": "Ready",
  "recalledAt": "ISO-8601-timestamp"
}
```

**Postconditions**
- Assignment removed
- Task status → Ready
- Domain event `TaskRecalled` emitted

**Error responses**
- `TASK_NOT_FOUND` – Task does not exist
- `TASK_NOT_ASSIGNED` – Task has no assignment

### 6.3 RescheduleTask
#### IC-ASSIGN-003
> **References:** [AC-SCHED-003](../requirements/acceptance-criteria.md#ac-sched-003-drag-and-drop-assignment), [BR-ASSIGN-005](../domain-model/business-rules.md#br-assign-005)

**Purpose:** Change timing of existing task assignment.

**Preconditions**
- Assignment exists
- New time doesn't create conflicts
- Precedence still satisfied

**Request**
```json
{
  "taskId": "string",
  "newScheduledStart": "ISO-8601-datetime"
}
```

**Response**
```json
{
  "status": "rescheduled",
  "assignment": {
    "scheduledStart": "ISO-8601-datetime",
    "scheduledEnd": "ISO-8601-datetime"
  },
  "validationResult": {
    "valid": true,
    "conflicts": []
  }
}
```

**Postconditions**
- Assignment updated with new timing
- Domain event `TaskRescheduled` emitted
- Successor tasks revalidated

**Error responses**
- `TASK_NOT_FOUND` – Task does not exist
- `TASK_NOT_ASSIGNED` – Task has no assignment

### 6.4 ValidateProposedAssignment
#### IC-ASSIGN-004
> **References:** [API-ASSIGN-003](../requirements/api-interface-drafts.md#api-assign-003), [AC-SCHED-004](../requirements/acceptance-criteria.md#ac-sched-004-real-time-validation-during-drag), [VAL-001](../domain-model/business-rules.md#val-001)

**Purpose:** Validate a proposed assignment without saving (for drag preview).

**Preconditions**
- Task exists

**Request**
```json
{
  "taskId": "string",
  "stationId": "string",
  "scheduledStart": "ISO-8601-datetime"
}
```

**Response**
```json
{
  "valid": "boolean",
  "conflicts": [
    {
      "type": "string",
      "description": "string",
      "affectedTaskIds": ["string"],
      "severity": "High | Medium | Low"
    }
  ],
  "warnings": [
    {
      "type": "DeadlineRisk",
      "description": "Only 4 hours buffer before workshop exit date"
    }
  ]
}
```

**Postconditions**
- None — this operation is read-only

**Error responses**
- `TASK_NOT_FOUND` – Task does not exist
- `STATION_NOT_FOUND` – Station does not exist

### 6.5 ValidateScheduleScope
#### IC-ASSIGN-005
> **References:** [AC-CONFLICT-001](../requirements/acceptance-criteria.md#ac-conflict-001-station-double-booking), [AC-CONFLICT-002](../requirements/acceptance-criteria.md#ac-conflict-002-group-capacity-exceeded), [AC-CONFLICT-003](../requirements/acceptance-criteria.md#ac-conflict-003-precedence-violation-visual), [AC-CONFLICT-004](../requirements/acceptance-criteria.md#ac-conflict-004-late-job-detection)

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
  "status": "valid | conflicts_found",
  "conflicts": [
    {
      "type": "StationConflict | GroupCapacityConflict | PrecedenceConflict | ApprovalGateConflict | AvailabilityConflict | DeadlineConflict",
      "severity": "High | Medium | Low",
      "affectedTaskIds": ["task1", "task2"],
      "description": "string"
    }
  ],
  "lateJobs": [
    {
      "jobId": "string",
      "workshopExitDate": "ISO-8601-datetime",
      "expectedCompletion": "ISO-8601-datetime",
      "delayHours": "integer"
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

## 7. Scheduling View Service – Public Interface

### 7.1 GetScheduleSnapshot
#### IC-VIEW-001
> **References:** [API-SNAPSHOT-001](../requirements/api-interface-drafts.md#api-snapshot-001), [AC-SCHED-001](../requirements/acceptance-criteria.md#ac-sched-001-vertical-time-axis)

**Purpose:** Get complete schedule snapshot for UI rendering.

**Preconditions**
- None

**Request**
```json
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}
```

**Response**
```json
{
  "snapshotVersion": "integer",
  "generatedAt": "ISO-8601-timestamp",
  "stations": [
    {
      "stationId": "string",
      "name": "string",
      "categoryId": "string",
      "groupId": "string | null",
      "status": "Available | InUse | Maintenance | OutOfService"
    }
  ],
  "providers": [
    {
      "providerId": "string",
      "name": "string",
      "status": "Active | Inactive",
      "groupId": "string"
    }
  ],
  "categories": [
    {
      "categoryId": "string",
      "name": "string",
      "similarityCriteria": [
        {"code": "string", "name": "string"}
      ]
    }
  ],
  "groups": [
    {
      "groupId": "string",
      "name": "string",
      "maxConcurrent": "integer | null",
      "isOutsourcedProviderGroup": "boolean"
    }
  ],
  "jobs": [
    {
      "jobId": "string",
      "reference": "string",
      "client": "string",
      "color": "#RRGGBB",
      "workshopExitDate": "ISO-8601-datetime",
      "status": "string",
      "tasks": [...]
    }
  ],
  "assignments": [
    {
      "taskId": "string",
      "jobId": "string",
      "stationId": "string",
      "scheduledStart": "ISO-8601-datetime",
      "scheduledEnd": "ISO-8601-datetime"
    }
  ],
  "conflicts": [
    {
      "type": "string",
      "affectedTaskIds": ["string"],
      "description": "string",
      "severity": "string"
    }
  ],
  "lateJobs": [
    {
      "jobId": "string",
      "reference": "string",
      "workshopExitDate": "ISO-8601-datetime",
      "expectedCompletion": "ISO-8601-datetime",
      "delayHours": "integer"
    }
  ]
}
```

**Postconditions**
- None — this operation is read-only

**Error responses**
- None — always returns snapshot

---

## 8. DSL Support – Architecture Note

> **Important:** DSL syntax parsing is performed **client-side** using Lezer (see ADR-011).
> The server does NOT parse DSL syntax. Instead, it performs:
> 1. **Semantic validation** — checking that referenced stations/providers exist
> 2. **Task entity creation** — creating Task entities from validated DSL input
> 3. **Autocomplete data** — providing entity lists for client-side autocomplete UI

### 8.1 Job Creation with DSL (via Job Management Service)

DSL-based task creation is handled through the existing `CreateJob` operation
with an optional `tasksDsl` field. See Section 5.1 CreateJob.

**Extended Request (with DSL)**
```json
{
  "reference": "JOB-2024-001",
  "client": "Acme Corp",
  "description": "Catalog 500pcs",
  "workshopExitDate": "2025-01-15",
  "tasksDsl": "[Komori] 20+40 \"vernis\"\n[Massicot] 15\nST [Clément] Pelliculage 2JO"
}
```

**Semantic Validation Errors (400)**
```json
{
  "error": "validation_error",
  "message": "DSL contains invalid references",
  "details": [
    {
      "line": 2,
      "message": "Station 'UnknownStation' not found",
      "rawInput": "[UnknownStation] 20+40"
    }
  ]
}
```

### 8.2 Autocomplete Data Endpoints

These endpoints provide entity lists for the client-side autocomplete UI.
The client uses Lezer for context detection (station vs provider), then
fetches suggestions from these endpoints.

#### GetStationNames
**Purpose:** Get station names for DSL autocomplete.

**Request:** `GET /api/v1/stations/names?search={prefix}`

**Response**
```json
{
  "items": [
    {"id": "station-uuid-1", "name": "Komori", "displayName": "Komori G37"},
    {"id": "station-uuid-2", "name": "Komori XL", "displayName": "Komori XL 106"}
  ]
}
```

#### GetProviderNames
**Purpose:** Get provider names for DSL autocomplete.

**Request:** `GET /api/v1/providers/names?search={prefix}`

**Response**
```json
{
  "items": [
    {"id": "provider-uuid-1", "name": "Clément"},
    {"id": "provider-uuid-2", "name": "ABC Finishing"}
  ]
}
```

#### GetActionTypes
**Purpose:** Get action types for DSL autocomplete.

**Request:** `GET /api/v1/providers/action-types`

**Response**
```json
{
  "items": ["Pelliculage", "Dorure", "Vernis UV", "Découpe"]
}
```

**Postconditions**
- None — these operations are read-only

**Error responses**
- None — always returns results (may be empty)

---

## 9. Business Calendar Service – Public Interface

### 9.1 CalculateOpenDays
#### IC-CAL-001
> **References:** [API-CAL-001](../requirements/api-interface-drafts.md#api-cal-001), [AC-PROVIDER-002](../requirements/acceptance-criteria.md#ac-provider-002-outsourced-task-duration), [CAL-001](../domain-model/business-rules.md#cal-001)

**Purpose:** Calculate end date from start date plus open days.

**Preconditions**
- None

**Request**
```json
{
  "fromDate": "YYYY-MM-DD",
  "openDays": "integer"
}
```

**Response**
```json
{
  "fromDate": "YYYY-MM-DD",
  "openDays": "integer",
  "resultDate": "YYYY-MM-DD",
  "explanation": "Dec 13 (Fri) + 2 open days = Dec 17 (Tue), skipping Dec 14-15 (weekend)"
}
```

**Postconditions**
- None — this operation is read-only

**Error responses**
- `INVALID_DAYS` – Open days must be positive

### 9.2 CountOpenDaysBetween
#### IC-CAL-002
> **References:** [CAL-001](../domain-model/business-rules.md#cal-001)

**Purpose:** Count open days between two dates.

**Preconditions**
- None

**Request**
```json
{
  "fromDate": "YYYY-MM-DD",
  "toDate": "YYYY-MM-DD"
}
```

**Response**
```json
{
  "fromDate": "YYYY-MM-DD",
  "toDate": "YYYY-MM-DD",
  "openDays": "integer"
}
```

**Postconditions**
- None — this operation is read-only

**Error responses**
- `INVALID_DATE_RANGE` – toDate must be after fromDate

---

## 10. Common Types

### TimeSlot
```json
{
  "start": "HH:MM | ISO-8601-datetime",
  "end": "HH:MM | ISO-8601-datetime"
}
```

### OperatingSchedule
```json
{
  "weeklyPattern": [
    {
      "dayOfWeek": "0-6",
      "timeSlots": [TimeSlot]
    }
  ]
}
```

### ScheduleException
```json
{
  "date": "YYYY-MM-DD",
  "type": "Closed | ModifiedHours",
  "reason": "string",
  "modifiedSlots": [TimeSlot]
}
```

### TaskStatus
```json
{
  "status": "Defined | Ready | Assigned | Executing | Completed | Failed | Cancelled"
}
```

### JobStatus
```json
{
  "status": "Draft | Planned | InProgress | Delayed | Completed | Cancelled"
}
```

### StationStatus
```json
{
  "status": "Available | InUse | Maintenance | OutOfService"
}
```

### ConflictType
```json
{
  "type": "StationConflict | GroupCapacityConflict | PrecedenceConflict | ApprovalGateConflict | AvailabilityConflict | DeadlineConflict"
}
```

### SimilarityCriterion
```json
{
  "code": "paper_type | paper_size | paper_weight | inking",
  "name": "string"
}
```

---

## 11. Common Error Format

All services return errors using a uniform schema:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {
      "field": "additional context"
    }
  },
  "timestamp": "ISO-8601-timestamp"
}
```

### Standard Error Codes
| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Operation would create conflict |
| `CIRCULAR_DEPENDENCY` | Dependency would create cycle |
| `APPROVAL_GATE_BLOCKED` | Approval gate not satisfied |
| `INTERNAL_ERROR` | Unexpected server error |

---

## 12. Versioning Rules

- API version included in header: `API-Version: 1.0`
- Breaking changes increment major version
- New optional fields are non-breaking
- Deprecation notices provided 6 months in advance
- Backward compatibility for 2 major versions

---

## 13. Security & Access Control

### Authentication
- All services require JWT bearer tokens
- Token lifetime: 30 minutes
- Refresh tokens supported

### Authorization
- Role-based access control (RBAC)
- Roles: `scheduler`, `manager`, `admin`
- Operation-level permissions defined per role

### Rate Limiting
- 100 requests/minute per user
- 1000 requests/minute per service account
- 429 responses include retry-after header

---

## 14. Performance Expectations

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

## 15. Notes

- These contracts are **technology-neutral** — implementation may use REST, gRPC, or message commands
- All contracts must match the **domain vocabulary** and **aggregate behaviour**
- They complement (but do not replace) the **integration event** definitions
- Security tokens and correlation IDs required but not shown in examples
- All datetime values in UTC unless specified otherwise
- The **Validation Service** is implemented in Node.js as an isomorphic package (`@flux/schedule-validator`) for client-side preview and server-side validation
