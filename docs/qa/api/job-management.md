# Job Management API - Manual QA Plan

> **Last Updated:** 2026-02-03
>
> **Related Features:** API-021 - API-045 (B2 batch, aktív: 21 feature, deprecated: 4)
>
> **Fixtures:** N/A (API tesztelés, nincs UI fixture)

---

## Overview

A Job Management API a nyomdaipari munkarendelések (job-ok) kezelését biztosítja. Tartalmazza a job CRUD műveleteket, a task entity-ket, a DSL alapú task létrehozást, az autocomplete endpoint-okat, a job függőségeket, a kommenteket, a domain event-eket és a job törlés funkcionalitást.

**API Base URL:** `http://localhost:8080/api/v1`

---

## Test Fixtures

Ez egy API tesztelési dokumentum, nincs UI fixture. A teszteléshez szükséges előfeltételek:

| Előfeltétel | Leírás |
|-------------|--------|
| PHP API futás | `docker-compose up` a `services/php-api` könyvtárban |
| Adatbázis | Friss migráció futtatva (`doctrine:migrations:migrate`) |
| Station(s) | Legalább 1 station létezik (DSL teszteléshez) |
| Provider(s) | Legalább 1 outsourced provider létezik (DSL teszteléshez) |

---

## Test Scenarios

### API-021 - Job Entity

#### Scenario: Job alapmezők validálása

**Preconditions:**
- API elérhető: `http://localhost:8080/api/v1`

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs`:

```json
{
  "reference": "JOB-2024-001",
  "client": "Acme Corp",
  "description": "Business cards 500pcs",
  "workshopExitDate": "2025-02-15"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `id` (UUID format)
- [ ] Response contains `reference`: "JOB-2024-001"
- [ ] Response contains `client`: "Acme Corp"
- [ ] Response contains `description`: "Business cards 500pcs"
- [ ] Response contains `status`: "draft" (default)
- [ ] Response contains `workshopExitDate`: "2025-02-15"
- [ ] Response contains `color` (hex format, e.g., "#E53935")
- [ ] Response contains `createdAt` and `updatedAt` timestamps

---

### API-022 - JobStatus Enum

#### Scenario: All JobStatus values accepted

**Preconditions:**
- Job created with ID `550e8400-e29b-41d4-a716-446655440005`
- Initial status is `draft`

**Steps:**
1. PUT `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440005`:

```json
{"status": "planned"}
```

2. Verify HTTP 200, then PUT again:

```json
{"status": "in_progress"}
```

3. Verify HTTP 200, then PUT again:

```json
{"status": "delayed"}
```

4. Verify HTTP 200, then create NEW job and test `completed`:

```json
{"status": "completed"}
```

**Expected Results:**
- [ ] HTTP 200 for each valid status update
- [ ] `draft` → `planned` transition: HTTP 200 OK
- [ ] `planned` → `in_progress` transition: HTTP 200 OK
- [ ] `in_progress` → `delayed` transition: HTTP 200 OK
- [ ] `in_progress` → `completed` transition: HTTP 200 OK

#### Scenario: Terminal state prevents further changes

**Preconditions:**
- Job exists with ID `550e8400-e29b-41d4-a716-446655440006`
- Job status is `completed` (terminal state)

**Steps:**
1. PUT `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440006`:

```json
{"status": "in_progress"}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `error`: "InvalidOperation" or "StateTransitionError"
- [ ] `message` contains "terminal state" or "cannot change status from completed"

---

### API-023 - Job CRUD API

#### Scenario: Create Job

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs`:

```json
{
  "reference": "REF-001",
  "client": "Test Client",
  "description": "Test job description",
  "workshopExitDate": "2025-03-01"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains all submitted fields
- [ ] Response contains auto-generated `id`, `color`, timestamps

#### Scenario: Get Job by ID

**Preconditions:**
- Job created with ID `550e8400-e29b-41d4-a716-446655440001` (from previous Create Job test)

**Steps:**
1. GET `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440001`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `id`: "550e8400-e29b-41d4-a716-446655440001"
- [ ] `reference`: "REF-001"
- [ ] `client`: "Test Client"
- [ ] `description`: "Test job description"
- [ ] `workshopExitDate`: "2025-03-01"
- [ ] `status`: "draft"
- [ ] `color`: hex color string
- [ ] `createdAt`: ISO timestamp
- [ ] `updatedAt`: ISO timestamp

#### Scenario: Get non-existent Job

**Steps:**
1. GET `http://localhost:8080/api/v1/jobs/00000000-0000-0000-0000-000000000000`

**Expected Results:**
- [ ] HTTP 404 Not Found

#### Scenario: Update Job

**Preconditions:**
- Job exists with ID `550e8400-e29b-41d4-a716-446655440002`
- Original values: reference "REF-001", client "Test Client"

**Steps:**
1. PUT `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440002`:

```json
{
  "reference": "REF-001-UPDATED",
  "client": "Updated Client",
  "description": "Updated description",
  "workshopExitDate": "2025-03-15"
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `id`: "550e8400-e29b-41d4-a716-446655440002" (unchanged)
- [ ] `reference`: "REF-001-UPDATED"
- [ ] `client`: "Updated Client"
- [ ] `description`: "Updated description"
- [ ] `workshopExitDate`: "2025-03-15"
- [ ] `updatedAt`: newer timestamp than before update

#### Scenario: Delete Job

**Preconditions:**
- Job exists with ID `550e8400-e29b-41d4-a716-446655440003`

**Steps:**
1. DELETE `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440003`

**Expected Results:**
- [ ] HTTP 204 No Content (empty response body)

**Verification:**
1. GET `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440003`

**Expected:**
- [ ] HTTP 404 Not Found
- [ ] `message`: "Job not found"

---

### API-024 - Job List Filtering

#### Scenario: List all jobs with pagination

**Steps:**
1. Create 3 jobs
2. GET `http://localhost:8080/api/v1/jobs?page=1&limit=2`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `items` array with 2 jobs
- [ ] Response contains `total`: 3
- [ ] Response contains `page`: 1
- [ ] Response contains `limit`: 2
- [ ] Response contains `pages`: 2

#### Scenario: Filter by status

**Steps:**
1. Create 2 jobs with status `draft`
2. Create 1 job with status `planned`
3. GET `http://localhost:8080/api/v1/jobs?status=draft`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains only `draft` status jobs
- [ ] `total` equals 2

#### Scenario: Search in reference, client, description

**Steps:**
1. Create job with reference "SEARCH-TEST-001"
2. GET `http://localhost:8080/api/v1/jobs?search=SEARCH-TEST`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains the matching job

---

### API-025 - Task Entity

#### Scenario: Internal task creation via DSL

**Preconditions:**
- Station "Komori" exists

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs`:

```json
{
  "reference": "JOB-TASK-001",
  "client": "Task Test",
  "description": "Testing task creation",
  "workshopExitDate": "2025-03-01",
  "tasksDsl": "[Komori] 20+40 \"printing\""
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Job response includes task(s)
- [ ] Task has `sequenceOrder`: 1
- [ ] Task has `taskType`: "internal"
- [ ] Task has `setupMinutes`: 20
- [ ] Task has `runMinutes`: 40
- [ ] Task has `rawDsl`: "[Komori] 20+40 \"printing\""

---

### API-026 - TaskStatus Enum

#### Scenario: Task status workflow

**Steps:**
1. Create job with task
2. Verify task starts in `defined` status
3. (Future: verify status transitions through assignment API)

**Expected Results:**
- [ ] Initial task status is `defined`
- [ ] Valid statuses: defined, ready, assigned, completed, cancelled

---

### API-027 - TaskType Enum

#### Scenario: Internal vs Outsourced task types

**Preconditions:**
- Station "Komori" exists
- Provider "Clément" exists

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs`:

```json
{
  "reference": "JOB-TYPES-001",
  "client": "Type Test",
  "description": "Testing task types",
  "workshopExitDate": "2025-03-01",
  "tasksDsl": "[Komori] 30\nST [Clément] Pelliculage 2JO"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] First task has `taskType`: "internal"
- [ ] Second task has `taskType`: "outsourced"

---

### API-028 - Duration Value Object

#### Scenario: Internal task duration (setup + run)

**Steps:**
1. Create job with DSL: `[Komori] 20+40`

**Expected Results:**
- [ ] Task has `setupMinutes`: 20
- [ ] Task has `runMinutes`: 40
- [ ] Total duration = 60 minutes

#### Scenario: Outsourced task duration (open days)

**Steps:**
1. Create job with DSL: `ST [Clément] Pelliculage 3JO`

**Expected Results:**
- [ ] Task has `durationOpenDays`: 3

---

### API-029 - DSL Parser Service

#### Scenario: Invalid station reference

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs`:

```json
{
  "reference": "JOB-DSL-ERR",
  "client": "DSL Error Test",
  "description": "Testing DSL errors",
  "workshopExitDate": "2025-03-01",
  "tasksDsl": "[NonExistentStation] 30"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error includes line number
- [ ] Error message mentions "Station 'NonExistentStation' not found"

#### Scenario: Invalid provider reference

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs`:

```json
{
  "reference": "JOB-DSL-ERR2",
  "client": "DSL Error Test",
  "description": "Testing DSL errors",
  "workshopExitDate": "2025-03-01",
  "tasksDsl": "ST [NonExistentProvider] Action 2JO"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error message mentions provider not found

---

### API-030 - Job Creation with DSL

#### Scenario: Multi-line DSL parsing

**Preconditions:**
- Station "Komori" exists
- Station "Massicot" exists
- Provider "Clément" exists

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs`:

```json
{
  "reference": "JOB-MULTI-DSL",
  "client": "Multi DSL Test",
  "description": "Multiple tasks",
  "workshopExitDate": "2025-03-01",
  "tasksDsl": "[Komori] 20+40 \"printing\"\n[Massicot] 15 \"cutting\"\nST [Clément] Pelliculage 2JO \"coating\""
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] 3 tasks created
- [ ] Task 1: sequenceOrder=1, internal, Komori
- [ ] Task 2: sequenceOrder=2, internal, Massicot
- [ ] Task 3: sequenceOrder=3, outsourced, Clément

---

### API-031 - Station Names Autocomplete

#### Scenario: Get all station names

**Preconditions:**
- At least 2 stations exist

**Steps:**
1. GET `http://localhost:8080/api/v1/stations/names`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response is array of strings
- [ ] Array is sorted alphabetically

#### Scenario: Filter station names by prefix

**Steps:**
1. GET `http://localhost:8080/api/v1/stations/names?q=Kom`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains only stations starting with "Kom"

---

### API-032 - Provider Names Autocomplete

#### Scenario: Get all provider names

**Preconditions:**
- At least 1 provider exists

**Steps:**
1. GET `http://localhost:8080/api/v1/providers/names`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response is array of strings

#### Scenario: Filter provider names by prefix

**Steps:**
1. GET `http://localhost:8080/api/v1/providers/names?q=Cl`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains only providers starting with "Cl"

---

### API-033 - Action Types Autocomplete

#### Scenario: Get all action types

**Steps:**
1. GET `http://localhost:8080/api/v1/providers/action-types`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response is array of strings
- [ ] Contains unique action types from all providers

---

### API-037 - Job Dependencies

#### Scenario: Set job dependencies

**Preconditions:**
- Job A exists with ID `550e8400-e29b-41d4-a716-446655440100`, reference "JOB-DEP-A"
- Job B exists with ID `550e8400-e29b-41d4-a716-446655440101`, reference "JOB-DEP-B"
- Job B has no dependencies yet

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440101/dependencies`:

```json
{
  "requiredJobIds": ["550e8400-e29b-41d4-a716-446655440100"]
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response confirms dependency set
- [ ] Job B now requires Job A to complete first

#### Scenario: Get job dependencies

**Preconditions:**
- Job A (ID: `550e8400-e29b-41d4-a716-446655440100`) exists
- Job B (ID: `550e8400-e29b-41d4-a716-446655440101`) requires Job A

**Steps:**
1. GET `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440101/dependencies`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response is array with 1 element
- [ ] `[0].id`: "550e8400-e29b-41d4-a716-446655440100"
- [ ] `[0].reference`: "JOB-DEP-A"
- [ ] `[0].client`: (Job A's client)
- [ ] `[0].status`: (Job A's current status)

#### Scenario: Circular dependency detection

**Preconditions:**
- Job A exists with ID `550e8400-e29b-41d4-a716-446655440102`
- Job B exists with ID `550e8400-e29b-41d4-a716-446655440103`
- Job A already requires Job B (set via previous API call)

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440103/dependencies`:

```json
{
  "requiredJobIds": ["550e8400-e29b-41d4-a716-446655440102"]
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `error`: "ValidationError" or "CircularDependency"
- [ ] `message` contains "circular dependency" or "would create a cycle"

#### Scenario: Remove dependency

**Preconditions:**
- Job A (ID: `550e8400-e29b-41d4-a716-446655440104`) exists
- Job B (ID: `550e8400-e29b-41d4-a716-446655440105`) requires Job A

**Steps:**
1. DELETE `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440105/dependencies/550e8400-e29b-41d4-a716-446655440104`

**Expected Results:**
- [ ] HTTP 200 OK or 204 No Content

**Verification:**
1. GET `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440105/dependencies`

**Expected:**
- [ ] HTTP 200 OK
- [ ] Response is empty array `[]`

---

### API-038 - Dependencies CRUD API

(Covered in API-037 scenarios)

---

### API-039 - JobComment Entity

#### Scenario: Add comment to job

**Preconditions:**
- Job exists with ID `550e8400-e29b-41d4-a716-446655440010`

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440010/comments`:

```json
{
  "author": "John Doe",
  "content": "This is a test comment"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] `id`: UUID format (e.g., "550e8400-e29b-41d4-a716-446655440200")
- [ ] `author`: "John Doe"
- [ ] `content`: "This is a test comment"
- [ ] `createdAt`: ISO 8601 timestamp (e.g., "2025-01-15T14:30:00+00:00")

---

### API-040 - Comments API

#### Scenario: List job comments

**Preconditions:**
- Job exists with ID `550e8400-e29b-41d4-a716-446655440011`
- Job has 2 comments:
  - Comment 1: author "Alice", content "First comment", createdAt 10:00
  - Comment 2: author "Bob", content "Second comment", createdAt 11:00

**Steps:**
1. GET `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440011/comments`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response is array with 2 elements
- [ ] `[0].author`: "Bob" (newest first)
- [ ] `[0].content`: "Second comment"
- [ ] `[1].author`: "Alice"
- [ ] `[1].content`: "First comment"
- [ ] Comments ordered by `createdAt` DESC

#### Scenario: Comment validation - missing author

**Preconditions:**
- Job exists with ID `550e8400-e29b-41d4-a716-446655440012`

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440012/comments`:

```json
{
  "content": "Comment without author"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `error`: "ValidationError"
- [ ] `message` contains "author" and "required"

#### Scenario: Comment validation - content too long

**Preconditions:**
- Job exists with ID `550e8400-e29b-41d4-a716-446655440013`

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440013/comments`:

```json
{
  "author": "Test User",
  "content": "[5001 karakter - pl. 'x' ismételve 5001-szer]"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `error`: "ValidationError"
- [ ] `message` contains "content" and "5000" or "too long"

---

### API-041 - JobCreated Event

#### Scenario: Verify JobCreated event fields

**Steps:**
1. Create a job via API
2. (In unit tests) Verify event contains: jobId, reference, client, workshopExitDate

**Expected Results:**
- [ ] Event emitted on job creation
- [ ] Event contains all required fields

---

### API-042 - TaskAddedToJob Event

#### Scenario: Verify TaskAddedToJob event

**Steps:**
1. Create job with tasksDsl
2. (In unit tests) Verify event per task with: jobId, taskId, taskType, sequenceOrder

**Expected Results:**
- [ ] Event emitted per task added
- [ ] Event contains all required fields

---

### API-044 - Job Cancellation API

#### Scenario: Cancel job with tasks

**Preconditions:**
- Station "Komori" exists for DSL parsing
- Job created with ID `550e8400-e29b-41d4-a716-446655440020` via:

```json
{
  "reference": "JOB-CANCEL-001",
  "client": "Cancel Test",
  "description": "Job to cancel",
  "workshopExitDate": "2025-03-01",
  "tasksDsl": "[Komori] 20+40"
}
```

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440020/cancel`

(No request body required)

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `id`: "550e8400-e29b-41d4-a716-446655440020"
- [ ] `status`: "cancelled"
- [ ] All tasks have `status`: "cancelled"

**Verification:**
1. GET `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440020`

**Expected:**
- [ ] `status`: "cancelled"
- [ ] `tasks[0].status`: "cancelled"

#### Scenario: Cannot cancel completed job

**Preconditions:**
- Job exists with ID `550e8400-e29b-41d4-a716-446655440021`
- Job status is `completed` (terminal state)

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440021/cancel`

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `error`: "InvalidOperation"
- [ ] `message` contains "terminal state" or "cannot cancel completed job"

#### Scenario: Cannot cancel already cancelled job

**Preconditions:**
- Job exists with ID `550e8400-e29b-41d4-a716-446655440022`
- Job status is already `cancelled`

**Steps:**
1. POST `http://localhost:8080/api/v1/jobs/550e8400-e29b-41d4-a716-446655440022/cancel`

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] `error`: "InvalidOperation"
- [ ] `message` contains "already cancelled"

---

### API-045 - JobCancelled Event

#### Scenario: Verify JobCancelled event with task IDs

**Steps:**
1. Create job with 2 tasks
2. Cancel job
3. (In unit tests) Verify event contains: jobId, cancelledTaskIds

**Expected Results:**
- [ ] Event emitted on cancellation
- [ ] `cancelledTaskIds` contains both task IDs

---

## Edge Cases

| Eset | Elvárt viselkedés |
|------|-------------------|
| Empty workshopExitDate | HTTP 400 - workshopExitDate required |
| Invalid date format | HTTP 400 - Invalid date format |
| Empty reference | HTTP 400 - reference required |
| Reference > 255 chars | HTTP 400 - reference too long |
| Client > 255 chars | HTTP 400 - client too long |
| Job not found for any operation | HTTP 404 |
| DSL with empty lines | Empty lines ignored |
| DSL with only whitespace | Treated as empty, no tasks created |
| Delete job with dependencies | Dependencies removed (cascade) |
| Create job without tasksDsl | Job created with 0 tasks |

---

## Cross-feature Interactions

| Kapcsolódó feature | Interakció típusa |
|--------------------|-------------------|
| Station Entity (API-001) | Station referenced in DSL parsing |
| Provider Entity (API-015) | Provider referenced in DSL parsing |
| Assignment API (B3) | Tasks can be assigned to stations after creation |
| Element Layer (B9) | Elements sit between Job and Task |

---

## Statistics

| Metrika | Érték |
|---------|-------|
| Feldolgozott feature-ök | 21 aktív + 4 deprecated = 25 |
| Generált teszt szcenáriók | 38 |
| Edge case-ek | 10 |
