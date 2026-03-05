# Scheduling API - Manual QA Plan

> **Last Updated:** 2026-02-03
>
> **Related Features:** API-046 - API-076 (B3 batch, 31 active features)
>
> **Fixtures:** N/A (API testing, no UI fixture)

---

## Overview

The Scheduling API provides task assignment, validation, reschedule, and completion functionalities. The system consists of two components:
1. **Validation Service** (Node.js) - `@flux/schedule-validator` package as REST API
2. **PHP API** - Assignment management, Schedule aggregate, Business Calendar

**API Base URLs:**
- PHP API: `http://localhost:8080/api/v1`
- Validation Service: `http://localhost:3001`

---

## Test Fixtures

This is an API testing document, no UI fixture. Prerequisites for testing:

| Prerequisite | Description |
|--------------|-------------|
| PHP API running | `docker-compose up` in `services/php-api` directory |
| Validation Service running | `docker-compose up` or `pnpm dev` in `services/validation-service` directory |
| Database | Fresh migration run (`doctrine:migrations:migrate`) |
| Station(s) | At least 1 station exists with operating schedule |
| Job(s) | At least 1 job with tasks |
| Task(s) | At least 1 task in "Ready" status |

---

## Test Scenarios

### API-046 - Validation Service Setup

#### Scenario: Validation Service health check

**Steps:**
1. GET `http://localhost:3001/health`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `status`: "ok"
- [ ] Response contains `timestamp` (ISO 8601 format)

---

### API-047 - Health Check Endpoint

(Covered in API-046)

---

### API-048 - Request Logger Middleware

#### Scenario: Verify request logging

**Steps:**
1. Make any request to Validation Service (e.g., GET `/health`)
2. Check server console output

**Expected Results:**
- [ ] Log entry contains timestamp
- [ ] Log entry contains HTTP method
- [ ] Log entry contains path
- [ ] Log entry contains response time in ms

---

### API-049 - Error Handler Middleware

#### Scenario: Unknown route returns JSON error

**Steps:**
1. GET `http://localhost:3001/unknown-endpoint`

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Response is JSON format
- [ ] Response contains error message

---

### API-050 - POST /validate Endpoint

#### Scenario: Valid assignment returns valid: true

**Steps:**
1. POST `http://localhost:3001/validate`:

```json
{
  "proposed": {
    "taskId": "task-123",
    "targetId": "station-456",
    "isOutsourced": false,
    "scheduledStart": "2025-12-14T09:00:00.000Z",
    "bypassPrecedence": false
  },
  "snapshot": {
    "version": 1,
    "generatedAt": "2025-12-14T08:00:00.000Z",
    "stations": [],
    "categories": [],
    "groups": [],
    "providers": [],
    "jobs": [],
    "tasks": [],
    "assignments": [],
    "conflicts": [],
    "lateJobs": []
  }
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `valid`: true
- [ ] Response contains `conflicts`: []
- [ ] Response contains `validationTimeMs` (number)

#### Scenario: Station conflict - overlapping assignment on same station

**Preconditions:**
- Station "station-komori" exists
- Task "task-existing" already assigned to station-komori: 09:00-11:00
- Task "task-new" is NOT yet assigned

**Steps:**
1. POST `http://localhost:3001/validate`:

```json
{
  "proposed": {
    "taskId": "task-new",
    "targetId": "station-komori",
    "isOutsourced": false,
    "scheduledStart": "2025-12-14T10:00:00.000Z",
    "bypassPrecedence": false
  },
  "snapshot": {
    "version": 1,
    "generatedAt": "2025-12-14T08:00:00.000Z",
    "stations": [
      {"id": "station-komori", "name": "Komori G37", "status": "active", "categoryId": "cat-1", "groupId": "grp-1"}
    ],
    "categories": [{"id": "cat-1", "name": "Offset Press", "similarityCriteria": []}],
    "groups": [{"id": "grp-1", "name": "Offset Group", "maxConcurrent": null}],
    "providers": [],
    "jobs": [
      {"id": "job-1", "reference": "JOB-001", "status": "planned", "workshopExitDate": "2025-12-20"}
    ],
    "tasks": [
      {"id": "task-existing", "jobId": "job-1", "elementId": "elem-1", "sequenceOrder": 1, "type": "internal", "status": "assigned", "stationId": "station-komori", "setupMinutes": 20, "runMinutes": 100},
      {"id": "task-new", "jobId": "job-1", "elementId": "elem-1", "sequenceOrder": 2, "type": "internal", "status": "ready", "stationId": "station-komori", "setupMinutes": 15, "runMinutes": 45}
    ],
    "assignments": [
      {
        "taskId": "task-existing",
        "targetId": "station-komori",
        "isOutsourced": false,
        "scheduledStart": "2025-12-14T09:00:00.000Z",
        "scheduledEnd": "2025-12-14T11:00:00.000Z",
        "isCompleted": false,
        "completedAt": null
      }
    ],
    "conflicts": [],
    "lateJobs": []
  }
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `valid`: false
- [ ] `conflicts[0].type`: "StationConflict"
- [ ] `conflicts[0].taskId`: "task-new"
- [ ] `conflicts[0].targetId`: "station-komori"
- [ ] `conflicts[0].relatedTaskId`: "task-existing"
- [ ] `conflicts[0].message` contains "already booked" or "overlap"

---

#### Scenario: Precedence conflict - task scheduled before predecessor ends

**Preconditions:**
- Job with 2 tasks: Task A (sequence 1), Task B (sequence 2)
- Task A assigned: 09:00-11:00
- Task B NOT yet assigned
- Task B proposed to start at 08:00 (BEFORE Task A ends)

**Steps:**
1. POST `http://localhost:3001/validate`:

```json
{
  "proposed": {
    "taskId": "task-b",
    "targetId": "station-456",
    "isOutsourced": false,
    "scheduledStart": "2025-12-14T08:00:00.000Z",
    "bypassPrecedence": false
  },
  "snapshot": {
    "version": 1,
    "generatedAt": "2025-12-14T07:00:00.000Z",
    "stations": [
      {"id": "station-456", "name": "Massicot", "status": "active", "categoryId": "cat-1", "groupId": "grp-1"}
    ],
    "categories": [{"id": "cat-1", "name": "Cutting", "similarityCriteria": []}],
    "groups": [{"id": "grp-1", "name": "Cutting Group", "maxConcurrent": null}],
    "providers": [],
    "jobs": [
      {"id": "job-1", "reference": "JOB-001", "status": "planned", "workshopExitDate": "2025-12-20"}
    ],
    "tasks": [
      {"id": "task-a", "jobId": "job-1", "elementId": "elem-1", "sequenceOrder": 1, "type": "internal", "status": "assigned", "stationId": "station-komori", "setupMinutes": 20, "runMinutes": 100},
      {"id": "task-b", "jobId": "job-1", "elementId": "elem-1", "sequenceOrder": 2, "type": "internal", "status": "ready", "stationId": "station-456", "setupMinutes": 15, "runMinutes": 30}
    ],
    "assignments": [
      {
        "taskId": "task-a",
        "targetId": "station-komori",
        "isOutsourced": false,
        "scheduledStart": "2025-12-14T09:00:00.000Z",
        "scheduledEnd": "2025-12-14T11:00:00.000Z",
        "isCompleted": false,
        "completedAt": null
      }
    ],
    "conflicts": [],
    "lateJobs": []
  }
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `valid`: false
- [ ] `conflicts[0].type`: "PrecedenceConflict"
- [ ] `conflicts[0].taskId`: "task-b"
- [ ] `conflicts[0].relatedTaskId`: "task-a"
- [ ] `conflicts[0].message` contains "predecessor" or "sequence"

---

#### Scenario: bypassPrecedence flag allows scheduling before predecessor

**Preconditions:**
- Same setup as precedence conflict scenario above
- But `bypassPrecedence`: true

**Steps:**
1. POST `http://localhost:3001/validate`:

```json
{
  "proposed": {
    "taskId": "task-b",
    "targetId": "station-456",
    "isOutsourced": false,
    "scheduledStart": "2025-12-14T08:00:00.000Z",
    "bypassPrecedence": true
  },
  "snapshot": {
    "version": 1,
    "generatedAt": "2025-12-14T07:00:00.000Z",
    "stations": [{"id": "station-456", "name": "Massicot", "status": "active", "categoryId": "cat-1", "groupId": "grp-1"}],
    "categories": [{"id": "cat-1", "name": "Cutting", "similarityCriteria": []}],
    "groups": [{"id": "grp-1", "name": "Cutting Group", "maxConcurrent": null}],
    "providers": [],
    "jobs": [{"id": "job-1", "reference": "JOB-001", "status": "planned", "workshopExitDate": "2025-12-20"}],
    "tasks": [
      {"id": "task-a", "jobId": "job-1", "elementId": "elem-1", "sequenceOrder": 1, "type": "internal", "status": "assigned", "stationId": "station-komori", "setupMinutes": 20, "runMinutes": 100},
      {"id": "task-b", "jobId": "job-1", "elementId": "elem-1", "sequenceOrder": 2, "type": "internal", "status": "ready", "stationId": "station-456", "setupMinutes": 15, "runMinutes": 30}
    ],
    "assignments": [
      {"taskId": "task-a", "targetId": "station-komori", "isOutsourced": false, "scheduledStart": "2025-12-14T09:00:00.000Z", "scheduledEnd": "2025-12-14T11:00:00.000Z", "isCompleted": false, "completedAt": null}
    ],
    "conflicts": [],
    "lateJobs": []
  }
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `valid`: true (precedence ignored due to bypass flag)
- [ ] `conflicts`: [] (empty - precedence not checked)

---

### API-051 - Zod Request Validation

#### Scenario: Missing required field returns 400

**Steps:**
1. POST `http://localhost:3001/validate`:

```json
{
  "proposed": {
    "targetId": "station-456"
  },
  "snapshot": {}
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Response contains `error`: "ValidationError"
- [ ] Response contains `details` with path to missing field

---

### API-052 - Schedule Entity

#### Scenario: Schedule created with version 1

**Preconditions:**
- Fresh database (no previous schedule)
- Station "Komori G37" exists with ID `550e8400-e29b-41d4-a716-446655440010`
- Task exists with ID `550e8400-e29b-41d4-a716-446655440020` in "Ready" status

**Steps:**
1. Create first assignment - POST `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440020/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T08:00:00+00:00"
}
```

2. GET `http://localhost:8080/api/v1/schedule/snapshot`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `version`: 1
- [ ] `generatedAt`: ISO 8601 timestamp (close to current time)

---

### API-053 - TaskAssignment Value Object

#### Scenario: TaskAssignment fields in snapshot

**Preconditions:**
- Task `550e8400-e29b-41d4-a716-446655440020` assigned to station `550e8400-e29b-41d4-a716-446655440010`
- Assignment created at 08:00, task duration 60 minutes

**Steps:**
1. GET `http://localhost:8080/api/v1/schedule/snapshot`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `assignments` array contains at least 1 element
- [ ] Find assignment where `taskId`: "550e8400-e29b-41d4-a716-446655440020"
- [ ] That assignment contains:
  - `taskId`: "550e8400-e29b-41d4-a716-446655440020"
  - `targetId`: "550e8400-e29b-41d4-a716-446655440010"
  - `isOutsourced`: false
  - `scheduledStart`: "2025-01-15T08:00:00+00:00"
  - `scheduledEnd`: "2025-01-15T09:00:00+00:00"
  - `isCompleted`: false
  - `completedAt`: null

---

### API-054 - TaskAssigned Event

#### Scenario: Event emitted on assignment

**Preconditions:**
- Task `550e8400-e29b-41d4-a716-446655440025` exists in "Ready" status
- Station `550e8400-e29b-41d4-a716-446655440010` exists

**Steps:**
1. POST `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440025/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T10:00:00+00:00"
}
```

2. **Unit test verification:** Check `Schedule::pullDomainEvents()` or event dispatcher

**Expected Results:**
- [ ] HTTP 201 Created (API response)
- [ ] TaskAssigned event emitted with:
  - `scheduleId`: current schedule UUID
  - `taskId`: "550e8400-e29b-41d4-a716-446655440025"
  - `targetId`: "550e8400-e29b-41d4-a716-446655440010"
  - `scheduledStart`: "2025-01-15T10:00:00+00:00"

---

### API-055 - TaskUnassigned Event

#### Scenario: Event emitted on unassignment

**Preconditions:**
- Task `550e8400-e29b-41d4-a716-446655440026` is currently "Assigned"
- Task has existing assignment

**Steps:**
1. DELETE `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440026/assign`

2. **Unit test verification:** Check `Schedule::pullDomainEvents()` or event dispatcher

**Expected Results:**
- [ ] HTTP 200 OK (API response)
- [ ] TaskUnassigned event emitted with:
  - `scheduleId`: current schedule UUID
  - `taskId`: "550e8400-e29b-41d4-a716-446655440026"

---

### API-056 - TaskCompletionToggled Event

#### Scenario: Event emitted on completion toggle

**Preconditions:**
- Task `550e8400-e29b-41d4-a716-446655440027` is "Assigned" with `isCompleted`: false

**Steps:**
1. PUT `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440027/completion`

2. **Unit test verification:** Check `Schedule::pullDomainEvents()` or event dispatcher

**Expected Results:**
- [ ] HTTP 200 OK (API response)
- [ ] TaskCompletionToggled event emitted with:
  - `scheduleId`: current schedule UUID
  - `taskId`: "550e8400-e29b-41d4-a716-446655440027"
  - `isCompleted`: true

---

### API-057 - POST /tasks/{id}/assign Endpoint

#### Scenario: Successful task assignment to station

**Preconditions:**
- Station "Komori G37" exists with ID `550e8400-e29b-41d4-a716-446655440010`
- Job "JOB-2025-001" exists with task in "Ready" status
- Task ID: `550e8400-e29b-41d4-a716-446655440020`
- Task has setupMinutes: 20, runMinutes: 40 (total 60 minutes)
- Station operating hours: 08:00-17:00 (Mon-Fri)

**Steps:**
1. POST `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440020/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T08:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] `taskId`: "550e8400-e29b-41d4-a716-446655440020"
- [ ] `targetId`: "550e8400-e29b-41d4-a716-446655440010"
- [ ] `isOutsourced`: false
- [ ] `scheduledStart`: "2025-01-15T08:00:00+00:00"
- [ ] `scheduledEnd`: "2025-01-15T09:00:00+00:00" (08:00 + 60 min)
- [ ] `isCompleted`: false
- [ ] `completedAt`: null
- [ ] GET `/api/v1/tasks/550e8400-e29b-41d4-a716-446655440020` shows `status`: "assigned"

---

#### Scenario: Task not found returns 404

**Steps:**
1. POST `http://localhost:8080/api/v1/tasks/00000000-0000-0000-0000-000000000000/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T08:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Response contains `error` or `message` field
- [ ] Error message mentions "Task not found"

---

#### Scenario: Station not found returns 404

**Preconditions:**
- Task exists with ID `550e8400-e29b-41d4-a716-446655440020` in "Ready" status

**Steps:**
1. POST `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440020/assign`:

```json
{
  "targetId": "00000000-0000-0000-0000-000000000000",
  "scheduledStart": "2025-01-15T08:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Error message mentions "Station not found" or "Target not found"

---

#### Scenario: Validation conflict returns 409 with conflict details

**Preconditions:**
- Station "Komori G37" (ID: `station-komori`) exists
- Task A already assigned to station-komori: 08:00-10:00
- Task B exists in "Ready" status (ID: `task-b`)

**Steps:**
1. POST `http://localhost:8080/api/v1/tasks/task-b/assign`:

```json
{
  "targetId": "station-komori",
  "scheduledStart": "2025-01-15T09:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 409 Conflict
- [ ] Response contains `error`: "ValidationFailed"
- [ ] Response contains `message`: "Assignment validation failed"
- [ ] Response contains `conflicts` array with at least 1 element
- [ ] `conflicts[0].type`: "StationConflict"
- [ ] `conflicts[0].taskId`: "task-b"
- [ ] `conflicts[0].targetId`: "station-komori"

---

#### Scenario: Task not in Ready status returns 400

**Preconditions:**
- Task exists with ID `task-defined` in "Defined" status (dependencies not satisfied)

**Steps:**
1. POST `http://localhost:8080/api/v1/tasks/task-defined/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T08:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error message mentions "Task must be in Ready status" or similar

---

### API-058 - AssignmentService

(Covered in API-057 integration tests)

---

### API-059 - ValidationServiceClient

(Covered in API-057 - internal service, tested via integration)

---

### API-060 - EndTimeCalculator Service

#### Scenario: Internal task spanning overnight

**Preconditions:**
- Station "Komori G37" exists with ID `550e8400-e29b-41d4-a716-446655440010`
- Station operating hours: 08:00-17:00 (Mon-Fri)
- Task "task-overnight" exists with ID `550e8400-e29b-41d4-a716-446655440030`
- Task has setupMinutes: 20, runMinutes: 100 (total 120 minutes)
- Task is in "Ready" status

**Steps:**
1. POST `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440030/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T16:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] `scheduledStart`: "2025-01-15T16:00:00+00:00"
- [ ] `scheduledEnd`: "2025-01-16T09:00:00+00:00" (NOT 18:00!)
  - Reasoning: 16:00-17:00 = 60 min worked, 60 min remaining
  - Next day 08:00-09:00 = remaining 60 min
- [ ] Task work stretched across non-operating hours (overnight)

#### Scenario: Task spanning weekend

**Preconditions:**
- Station "Massicot" exists with ID `550e8400-e29b-41d4-a716-446655440011`
- Station operating hours: 08:00-17:00 (Mon-Fri, closed Sat-Sun)
- Task "task-weekend" exists with ID `550e8400-e29b-41d4-a716-446655440031`
- Task has setupMinutes: 30, runMinutes: 570 (total 600 minutes = 10 hours)
- Friday date: 2025-01-17

**Steps:**
1. POST `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440031/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440011",
  "scheduledStart": "2025-01-17T14:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] `scheduledStart`: "2025-01-17T14:00:00+00:00" (Friday 14:00)
- [ ] `scheduledEnd`: "2025-01-20T11:00:00+00:00" (Monday 11:00)
  - Reasoning: Friday 14:00-17:00 = 180 min worked, 420 min remaining
  - Saturday-Sunday skipped (non-operating)
  - Monday 08:00-15:00 = remaining 420 min (7 hours)
- [ ] Task work skips Saturday and Sunday

---

### API-061 - BusinessCalendar Service

#### Scenario: Get business days in range

**Steps:**
1. GET `http://localhost:8080/api/v1/calendar/open-days?from=2025-12-15&to=2025-12-31`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `from`: "2025-12-15"
- [ ] `to`: "2025-12-31"
- [ ] `businessDays` array contains dates (strings in YYYY-MM-DD format)
- [ ] Array does NOT include weekends:
  - NOT "2025-12-20" (Saturday)
  - NOT "2025-12-21" (Sunday)
  - NOT "2025-12-27" (Saturday)
  - NOT "2025-12-28" (Sunday)
- [ ] `count`: 11 (business days in this range, excluding weekends)

---

### API-062 - DELETE /tasks/{id}/assign Endpoint

#### Scenario: Successful unassignment

**Preconditions:**
- Task "task-assigned" exists with ID `550e8400-e29b-41d4-a716-446655440040`
- Task is currently in "Assigned" status
- Task has an existing assignment to station "Komori G37"
- Current assignment: scheduledStart 08:00, scheduledEnd 09:30

**Steps:**
1. DELETE `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440040/assign`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `taskId`: "550e8400-e29b-41d4-a716-446655440040"
- [ ] `status`: "ready"
- [ ] `previousAssignment` object present (optional, for audit):
  - `targetId`: original station ID
  - `scheduledStart`: "2025-01-15T08:00:00+00:00"
  - `scheduledEnd`: "2025-01-15T09:30:00+00:00"
- [ ] GET `/api/v1/tasks/550e8400-e29b-41d4-a716-446655440040` shows `status`: "ready"
- [ ] GET `/api/v1/schedule/snapshot` no longer contains this assignment

#### Scenario: Task not assigned returns 400

**Preconditions:**
- Task "task-ready" exists with ID `550e8400-e29b-41d4-a716-446655440041`
- Task is in "Ready" status (NOT assigned)

**Steps:**
1. DELETE `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440041/assign`

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `error`: "InvalidOperation" or "BadRequest"
- [ ] `message`: "Task is not assigned" or similar

#### Scenario: Task not found returns 404

**Steps:**
1. DELETE `http://localhost:8080/api/v1/tasks/00000000-0000-0000-0000-000000000000/assign`

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] `message`: "Task not found"

---

### API-063 - UnassignmentService

(Covered in API-062)

---

### API-064 - Task.markUnassigned()

(Covered in API-062 - state transition tested)

---

### API-065 - PUT /tasks/{id}/assign Endpoint

#### Scenario: Reschedule to new time (same station)

**Preconditions:**
- Station "Komori G37" exists with ID `550e8400-e29b-41d4-a716-446655440010`
- Task "task-reschedule" exists with ID `550e8400-e29b-41d4-a716-446655440050`
- Task has setupMinutes: 20, runMinutes: 40 (total 60 minutes)
- Task is currently assigned to Komori G37: 08:00-09:00
- No other assignments on Komori G37 at 10:00-11:00

**Steps:**
1. PUT `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440050/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T10:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `taskId`: "550e8400-e29b-41d4-a716-446655440050"
- [ ] `targetId`: "550e8400-e29b-41d4-a716-446655440010" (same station)
- [ ] `scheduledStart`: "2025-01-15T10:00:00+00:00" (new time)
- [ ] `scheduledEnd`: "2025-01-15T11:00:00+00:00" (recalculated)
- [ ] `isCompleted`: false (preserved)
- [ ] GET `/api/v1/schedule/snapshot` shows updated `version` (incremented by 1)

#### Scenario: Reschedule to different station

**Preconditions:**
- Station "Komori G37" exists with ID `550e8400-e29b-41d4-a716-446655440010`
- Station "Massicot" exists with ID `550e8400-e29b-41d4-a716-446655440011`
- Task "task-move" exists with ID `550e8400-e29b-41d4-a716-446655440051`
- Task has setupMinutes: 15, runMinutes: 45 (total 60 minutes)
- Task is currently assigned to Komori G37: 08:00-09:00

**Steps:**
1. PUT `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440051/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440011",
  "scheduledStart": "2025-01-15T14:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `taskId`: "550e8400-e29b-41d4-a716-446655440051"
- [ ] `targetId`: "550e8400-e29b-41d4-a716-446655440011" (Massicot, different station)
- [ ] `scheduledStart`: "2025-01-15T14:00:00+00:00"
- [ ] `scheduledEnd`: "2025-01-15T15:00:00+00:00"
- [ ] Old slot on Komori G37 (08:00-09:00) is now free

#### Scenario: Reschedule causes station conflict returns 409

**Preconditions:**
- Station "Komori G37" exists with ID `550e8400-e29b-41d4-a716-446655440010`
- Task A "task-blocking" assigned to Komori G37: 10:00-12:00
- Task B "task-reschedule-conflict" currently assigned to Komori G37: 08:00-09:00
- Task B ID: `550e8400-e29b-41d4-a716-446655440052`

**Steps:**
1. PUT `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440052/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T11:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 409 Conflict
- [ ] `error`: "ValidationFailed"
- [ ] `message`: "Assignment validation failed"
- [ ] `conflicts` array with at least 1 element:
  - `conflicts[0].type`: "StationConflict"
  - `conflicts[0].taskId`: "550e8400-e29b-41d4-a716-446655440052"
  - `conflicts[0].targetId`: "550e8400-e29b-41d4-a716-446655440010"
  - `conflicts[0].relatedTaskId`: ID of task-blocking
- [ ] Original assignment UNCHANGED (still at 08:00-09:00)

#### Scenario: Reschedule unassigned task returns 400

**Preconditions:**
- Task "task-not-assigned" exists with ID `550e8400-e29b-41d4-a716-446655440053`
- Task is in "Ready" status (not assigned)

**Steps:**
1. PUT `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440053/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T10:00:00+00:00"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `message`: "Task is not assigned" or "Use POST to create assignment"

---

### API-066 - RescheduleService

(Covered in API-065)

---

### API-067 - Schedule.rescheduleTask()

(Covered in API-065 - tested via integration)

---

### API-068 - TaskRescheduled Event

#### Scenario: Event emitted on reschedule

**Preconditions:**
- Task `550e8400-e29b-41d4-a716-446655440050` is "Assigned" to station `550e8400-e29b-41d4-a716-446655440010`
- Current assignment: scheduledStart 08:00, scheduledEnd 09:00

**Steps:**
1. PUT `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440050/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440011",
  "scheduledStart": "2025-01-15T14:00:00+00:00"
}
```

2. **Unit test verification:** Check `Schedule::pullDomainEvents()` or event dispatcher

**Expected Results:**
- [ ] HTTP 200 OK (API response)
- [ ] TaskRescheduled event emitted with:
  - `scheduleId`: current schedule UUID
  - `taskId`: "550e8400-e29b-41d4-a716-446655440050"
  - `oldTargetId`: "550e8400-e29b-41d4-a716-446655440010"
  - `newTargetId`: "550e8400-e29b-41d4-a716-446655440011"
  - `oldScheduledStart`: "2025-01-15T08:00:00+00:00"
  - `newScheduledStart`: "2025-01-15T14:00:00+00:00"

---

### API-069 - GET /schedule/snapshot Endpoint

#### Scenario: Full snapshot retrieval

**Preconditions:**
- At least 1 station exists
- At least 1 job with tasks exists
- At least 1 task is assigned

**Steps:**
1. GET `http://localhost:8080/api/v1/schedule/snapshot`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `version`: positive integer (e.g., 1, 2, 3...)
- [ ] `generatedAt`: ISO 8601 timestamp
- [ ] `stations`: array of station objects (each with id, name, status, categoryId, groupId)
- [ ] `categories`: array of category objects
- [ ] `groups`: array of group objects
- [ ] `providers`: array of provider objects
- [ ] `jobs`: array of job objects (each with id, reference, status, workshopExitDate)
- [ ] `tasks`: array of task objects (each with id, jobId, elementId, sequenceOrder, type, status)
- [ ] `assignments`: array of assignment objects (as verified in API-053)
- [ ] `conflicts`: array (empty for MVP)
- [ ] `lateJobs`: array (empty for MVP)

#### Scenario: Empty schedule returns version 1

**Preconditions:**
- Fresh database with no previous schedule modifications
- No tasks have been assigned yet

**Steps:**
1. GET `http://localhost:8080/api/v1/schedule/snapshot`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `version`: 1
- [ ] `assignments`: [] (empty array)
- [ ] All other arrays populated from database (stations, jobs, tasks, etc.)

---

### API-070 - SnapshotBuilder.buildFullSnapshot()

(Covered in API-069)

---

### API-071 - GET /calendar/open-days Endpoint

#### Scenario: Query by date range

**Steps:**
1. GET `http://localhost:8080/api/v1/calendar/open-days?from=2025-12-15&to=2025-12-31`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `from`: "2025-12-15"
- [ ] `to`: "2025-12-31"
- [ ] `isFromBusinessDay`: true (2025-12-15 is Monday)
- [ ] `businessDays`: array of date strings
- [ ] `count`: 11

#### Scenario: Query by days count

**Steps:**
1. GET `http://localhost:8080/api/v1/calendar/open-days?from=2025-12-15&days=5`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `from`: "2025-12-15"
- [ ] `to`: calculated (2025-12-19, Friday)
- [ ] `businessDays`: exactly 5 dates:
  - "2025-12-15" (Monday)
  - "2025-12-16" (Tuesday)
  - "2025-12-17" (Wednesday)
  - "2025-12-18" (Thursday)
  - "2025-12-19" (Friday)
- [ ] `count`: 5

#### Scenario: Validation - missing from parameter

**Steps:**
1. GET `http://localhost:8080/api/v1/calendar/open-days?to=2025-12-31`

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `error`: "ValidationError"
- [ ] `message` contains "from" and "required"

#### Scenario: Validation - both to and days provided

**Steps:**
1. GET `http://localhost:8080/api/v1/calendar/open-days?from=2025-12-15&to=2025-12-31&days=5`

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `error`: "ValidationError"
- [ ] `message` contains "mutually exclusive" or "cannot specify both"

#### Scenario: Weekend start date

**Steps:**
1. GET `http://localhost:8080/api/v1/calendar/open-days?from=2025-12-13&days=3`

(Note: 2025-12-13 is Saturday)

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `from`: "2025-12-13"
- [ ] `isFromBusinessDay`: false
- [ ] `businessDays`: 3 dates starting from Monday:
  - "2025-12-15" (Monday - first business day after Saturday)
  - "2025-12-16" (Tuesday)
  - "2025-12-17" (Wednesday)
- [ ] `count`: 3

---

### API-072 - CalendarService

(Covered in API-071)

---

### API-073 - ConflictDetected Event

#### Scenario: Event emitted on validation conflict

**Preconditions:**
- Station `550e8400-e29b-41d4-a716-446655440010` exists
- Task A (`550e8400-e29b-41d4-a716-446655440070`) already assigned: 08:00-10:00
- Task B (`550e8400-e29b-41d4-a716-446655440071`) in "Ready" status

**Steps:**
1. POST `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440071/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T09:00:00+00:00"
}
```

2. **Unit test verification:** Check `Schedule::pullDomainEvents()` or event dispatcher

**Expected Results:**
- [ ] HTTP 409 Conflict (API response)
- [ ] ConflictDetected event emitted with:
  - `scheduleId`: current schedule UUID
  - `taskId`: "550e8400-e29b-41d4-a716-446655440071"
  - `targetId`: "550e8400-e29b-41d4-a716-446655440010"
  - `conflictType`: "StationConflict"
  - `message`: contains "overlap" or "already booked"
  - `relatedTaskId`: "550e8400-e29b-41d4-a716-446655440070"

---

### API-074 - ScheduleUpdated Event

#### Scenario: Event emitted on any schedule change

**Preconditions:**
- Task `550e8400-e29b-41d4-a716-446655440072` in "Ready" status
- Current schedule version: N

**Steps:**
1. POST `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440072/assign`:

```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440010",
  "scheduledStart": "2025-01-15T14:00:00+00:00"
}
```

2. **Unit test verification:** Check `Schedule::pullDomainEvents()` or event dispatcher

**Expected Results:**
- [ ] HTTP 201 Created (API response)
- [ ] ScheduleUpdated event emitted with:
  - `scheduleId`: current schedule UUID
  - `version`: N+1 (incremented)
  - `changeType`: "TaskAssigned"
  - `affectedTaskIds`: ["550e8400-e29b-41d4-a716-446655440072"]

**Additional test cases for changeType:**
- On unassignment: `changeType`: "TaskUnassigned"
- On reschedule: `changeType`: "TaskRescheduled"
- On completion toggle: `changeType`: "TaskCompletionToggled"

---

### API-075 - PUT /tasks/{id}/completion Endpoint

#### Scenario: Toggle task to completed

**Preconditions:**
- Task "task-to-complete" exists with ID `550e8400-e29b-41d4-a716-446655440060`
- Task is in "Assigned" status
- Task has assignment with `isCompleted`: false, `completedAt`: null

**Steps:**
1. PUT `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440060/completion`

(No request body required - this is a toggle endpoint)

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `taskId`: "550e8400-e29b-41d4-a716-446655440060"
- [ ] `isCompleted`: true
- [ ] `completedAt`: ISO 8601 timestamp (e.g., "2025-01-15T14:30:00+00:00")
- [ ] GET `/api/v1/schedule/snapshot` shows assignment with `isCompleted`: true

#### Scenario: Toggle task back to uncompleted

**Preconditions:**
- Task "task-completed" exists with ID `550e8400-e29b-41d4-a716-446655440061`
- Task is in "Assigned" status
- Task has assignment with `isCompleted`: true, `completedAt`: "2025-01-15T10:00:00+00:00"

**Steps:**
1. PUT `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440061/completion`

(No request body required - this is a toggle endpoint)

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `taskId`: "550e8400-e29b-41d4-a716-446655440061"
- [ ] `isCompleted`: false
- [ ] `completedAt`: null
- [ ] Completion timestamp cleared

#### Scenario: Toggle completion on unassigned task returns 400

**Preconditions:**
- Task "task-not-assigned" exists with ID `550e8400-e29b-41d4-a716-446655440062`
- Task is in "Ready" status (not assigned)

**Steps:**
1. PUT `http://localhost:8080/api/v1/tasks/550e8400-e29b-41d4-a716-446655440062/completion`

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `error`: "InvalidOperation" or "BadRequest"
- [ ] `message`: "Task must be assigned to toggle completion" or similar

#### Scenario: Task not found returns 404

**Steps:**
1. PUT `http://localhost:8080/api/v1/tasks/00000000-0000-0000-0000-000000000000/completion`

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] `message`: "Task not found"

---

### API-076 - CompletionService

(Covered in API-075)

---

## Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Assign to non-existent station | HTTP 404 |
| Assign to non-existent provider | HTTP 404 |
| Assign task already assigned | HTTP 409 or 400 |
| Reschedule unassigned task | HTTP 400 |
| Unassign unassigned task | HTTP 400 |
| Toggle completion on unassigned task | HTTP 400 |
| Validation Service unavailable | HTTP 503 or timeout error |
| scheduledStart in the past | Validation may warn but allow |
| scheduledStart on closed day | End time calculated correctly |
| Task with 0 duration | Immediate end time |
| Calendar range > 365 days | HTTP 400 |
| Calendar negative days count | HTTP 400 |

---

## Cross-feature Interactions

| Related Feature | Interaction Type |
|-----------------|------------------|
| Station Entity (API-001) | Target for internal task assignments |
| Provider Entity (API-015) | Target for outsourced task assignments |
| Task Entity (API-025) | Subject of assignment operations |
| Job Entity (API-021) | Parent of tasks, included in snapshot |
| Operating Schedule (API-006) | Used for end time calculation |

---

## Statistics

| Metric | Value |
|--------|-------|
| Processed features | 31 |
| Generated test scenarios | 42 |
| Edge cases | 12 |
