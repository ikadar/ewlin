# Manual QA Plan: Station Management API

> **QA Group:** station-management
>
> **Feature Catalog Batch:** B1
>
> **Features Covered:** API-001 to API-020
>
> **Created:** 2026-02-03
>
> **Status:** Draft

---

## Overview

This QA plan covers the Station Management API endpoints and domain model, including:
- Station entity CRUD operations
- Operating Schedules (TimeSlot, DaySchedule)
- Schedule Exceptions (CLOSED, MODIFIED)
- Station Categories with Similarity Criteria
- Station Groups with concurrency limits
- Outsourced Providers
- Domain Events

---

## Prerequisites

- PHP API running locally (`services/php-api`)
- Database seeded with test data
- Swagger UI available at `/api/doc`
- Tools: curl, Postman, or Swagger UI

---

## Features Covered

| ID | Feature Name | Release | Status |
|----|--------------|---------|--------|
| API-001 | Station Entity (Aggregate Root) | v0.1.0 | Active |
| API-002 | StationStatus Enum | v0.1.0 | Active |
| API-003 | Station CRUD - Create | v0.1.1 | Active |
| API-004 | Station CRUD - Read (Single) | v0.1.1 | Active |
| API-005 | Station CRUD - Read (List) | v0.1.1 | Active |
| API-006 | Station CRUD - Update | v0.1.1 | Active |
| API-007 | Station CRUD - Delete | v0.1.1 | Active |
| API-008 | TimeSlot Value Object | v0.1.2 | Active |
| API-009 | DaySchedule Value Object | v0.1.2 | Active |
| API-010 | Operating Schedule API | v0.1.2 | Active |
| API-011 | ExceptionType Enum | v0.1.3 | Active |
| API-012 | Schedule Exception - CLOSED | v0.1.3 | Active |
| API-013 | Schedule Exception - MODIFIED | v0.1.3 | Active |
| API-014 | Station Category Entity | v0.1.4 | Active |
| API-015 | SimilarityCriterion Value Object | v0.1.4 | Active |
| API-016 | Station Group Entity | v0.1.5 | Active |
| API-017 | Concurrency Limit (Group) | v0.1.5 | Active |
| API-018 | Outsourced Provider Entity | v0.1.6 | Active |
| API-019 | Auto-create StationGroup for Provider | v0.1.6 | Active |
| API-020 | Domain Events (Station lifecycle) | v0.1.7 | Active |

---

## Test Scenarios

### 1. Station Entity & Status (v0.1.0)

#### API-001 - Station Entity (Aggregate Root)

##### Scenario: Station entity contains all required fields

**Steps:**
1. Create a station via POST `/api/v1/stations`:

```json
{
  "name": "Test Station",
  "categoryId": "550e8400-e29b-41d4-a716-446655440001",
  "groupId": "550e8400-e29b-41d4-a716-446655440002",
  "capacity": 1,
  "status": "active"
}
```

2. GET `/api/v1/stations/{id}` to retrieve the created station

**Expected Results:**
- [ ] Response contains `id` (UUID v4 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
- [ ] Response contains `name` (string, matches input)
- [ ] Response contains `categoryId` (UUID, matches input)
- [ ] Response contains `groupId` (UUID, matches input)
- [ ] Response contains `capacity` (integer, default 1 if not provided)
- [ ] Response contains `status` (string enum value)
- [ ] Response contains `operatingSchedule` (object or null)
- [ ] Response contains `createdAt` (ISO 8601 timestamp)
- [ ] Response contains `updatedAt` (ISO 8601 timestamp)

---

##### Scenario: Station entity persists correctly after update

**Steps:**
1. Create a station
2. PUT `/api/v1/stations/{id}` with updated fields:

```json
{
  "name": "Updated Station Name",
  "capacity": 2
}
```

3. GET `/api/v1/stations/{id}` to verify

**Expected Results:**
- [ ] `id` unchanged
- [ ] `name` updated to "Updated Station Name"
- [ ] `capacity` updated to 2
- [ ] `categoryId` unchanged
- [ ] `groupId` unchanged
- [ ] `createdAt` unchanged
- [ ] `updatedAt` changed (newer than createdAt)

---

#### API-002 - StationStatus Enum

##### Scenario: All valid status values accepted on create

**Steps:**
1. POST `/api/v1/stations` with `"status": "active"`:

```json
{
  "name": "Station Active",
  "categoryId": "...",
  "groupId": "...",
  "status": "active"
}
```

2. POST `/api/v1/stations` with `"status": "inactive"`:

```json
{
  "name": "Station Inactive",
  "categoryId": "...",
  "groupId": "...",
  "status": "inactive"
}
```

3. POST `/api/v1/stations` with `"status": "maintenance"`:

```json
{
  "name": "Station Maintenance",
  "categoryId": "...",
  "groupId": "...",
  "status": "maintenance"
}
```

4. POST `/api/v1/stations` with `"status": "out_of_service"`:

```json
{
  "name": "Station Out of Service",
  "categoryId": "...",
  "groupId": "...",
  "status": "out_of_service"
}
```

**Expected Results:**
- [ ] All 4 requests return HTTP 201 Created
- [ ] Each response contains the exact status value provided
- [ ] Status values are: `active`, `inactive`, `maintenance`, `out_of_service`

---

##### Scenario: Invalid status value rejected

**Steps:**
1. POST `/api/v1/stations` with invalid status:

```json
{
  "name": "Invalid Station",
  "categoryId": "550e8400-e29b-41d4-a716-446655440001",
  "groupId": "550e8400-e29b-41d4-a716-446655440002",
  "status": "INVALID"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error message lists valid values: active, inactive, maintenance, out_of_service

---

##### Scenario: Status transition via update

**Steps:**
1. Create station with `"status": "active"`
2. PUT `/api/v1/stations/{id}` with `"status": "maintenance"`:

```json
{
  "status": "maintenance"
}
```

3. GET `/api/v1/stations/{id}` to verify

**Expected Results:**
- [ ] HTTP 200 OK on update
- [ ] `status` changed from "active" to "maintenance"
- [ ] `updatedAt` timestamp changed
- [ ] All other fields unchanged

---

##### Scenario: Default status is "active" when not provided

**Steps:**
1. POST `/api/v1/stations` without status field:

```json
{
  "name": "Station Without Status",
  "categoryId": "550e8400-e29b-41d4-a716-446655440001",
  "groupId": "550e8400-e29b-41d4-a716-446655440002"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `status`: "active" (default value)

---

### 2. Station CRUD Operations (v0.1.1)

#### API-003 - Create Station

##### Scenario: Create station with valid data

**Steps:**
1. POST `/api/v1/stations` with valid payload:

```json
{
  "name": "Komori G37",
  "categoryId": "550e8400-e29b-41d4-a716-446655440001",
  "groupId": "550e8400-e29b-41d4-a716-446655440002",
  "capacity": 1,
  "status": "active"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `id` (UUID format)
- [ ] Response contains `name`: "Komori G37"
- [ ] Response contains `status`: "active"
- [ ] Response contains `createdAt` timestamp
- [ ] Response contains `updatedAt` timestamp
- [ ] Response contains `operatingSchedule`: null

---

##### Scenario: Create station with duplicate name

**Steps:**
1. Create a station named "Komori G37"
2. POST `/api/v1/stations` with same name:

```json
{
  "name": "Komori G37",
  "categoryId": "550e8400-e29b-41d4-a716-446655440001",
  "groupId": "550e8400-e29b-41d4-a716-446655440002"
}
```

**Expected Results:**
- [ ] HTTP 409 Conflict
- [ ] Error code: "CONFLICT"
- [ ] Error message mentions "already exists"
- [ ] Error details include field "name"

---

##### Scenario: Create station with invalid category ID

**Steps:**
1. POST `/api/v1/stations` with non-existent categoryId:

```json
{
  "name": "New Station",
  "categoryId": "00000000-0000-0000-0000-000000000000",
  "groupId": "550e8400-e29b-41d4-a716-446655440002"
}
```

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Error message: "Station category not found"

---

##### Scenario: Create station with empty name

**Steps:**
1. POST `/api/v1/stations` with empty name:

```json
{
  "name": "",
  "categoryId": "550e8400-e29b-41d4-a716-446655440001",
  "groupId": "550e8400-e29b-41d4-a716-446655440002"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error message mentions "required" or "cannot be empty"

---

##### Scenario: Create station with invalid status value

**Steps:**
1. POST `/api/v1/stations` with invalid status:

```json
{
  "name": "Test Station",
  "categoryId": "550e8400-e29b-41d4-a716-446655440001",
  "groupId": "550e8400-e29b-41d4-a716-446655440002",
  "status": "INVALID_STATUS"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error mentions valid status values: active, inactive, out_of_service, maintenance

---

#### API-004 - Read Station (Single)

##### Scenario: Get existing station by ID

**Steps:**
1. GET `/api/v1/stations/{id}` with valid station ID

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains all station fields
- [ ] `id` matches requested ID
- [ ] `operatingSchedule` is object or null

---

##### Scenario: Get non-existent station

**Steps:**
1. GET `/api/v1/stations/00000000-0000-0000-0000-000000000000`

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Error code: "NOT_FOUND"
- [ ] Error message: "Station not found"

---

#### API-005 - Read Station (List)

##### Scenario: List all stations

**Steps:**
1. GET `/api/v1/stations`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `items` array
- [ ] Response contains `total` count
- [ ] Response contains `page` number
- [ ] Response contains `limit` value
- [ ] Response contains `pages` count

---

##### Scenario: List stations with status filter

**Steps:**
1. GET `/api/v1/stations?status=active`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] All items have `status`: "active"
- [ ] `total` reflects filtered count

---

##### Scenario: List stations with pagination

**Steps:**
1. GET `/api/v1/stations?page=1&limit=5`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `items` array has max 5 elements
- [ ] `page` is 1
- [ ] `limit` is 5
- [ ] `pages` calculated correctly

---

#### API-006 - Update Station

##### Scenario: Update station name

**Steps:**
1. PUT `/api/v1/stations/{id}`:

```json
{
  "name": "Komori G37 XL"
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `name` updated to "Komori G37 XL"
- [ ] `updatedAt` changed
- [ ] Other fields unchanged

---

##### Scenario: Update station status

**Steps:**
1. PUT `/api/v1/stations/{id}`:

```json
{
  "status": "maintenance"
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `status` is "maintenance"
- [ ] `updatedAt` changed

---

##### Scenario: Update non-existent station

**Steps:**
1. PUT `/api/v1/stations/00000000-0000-0000-0000-000000000000`:

```json
{
  "name": "New Name"
}
```

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Error code: "NOT_FOUND"

---

#### API-007 - Delete Station

##### Scenario: Delete existing station

**Steps:**
1. DELETE `/api/v1/stations/{id}`

**Expected Results:**
- [ ] HTTP 204 No Content
- [ ] Response body is empty
- [ ] Subsequent GET returns 404

---

##### Scenario: Delete non-existent station

**Steps:**
1. DELETE `/api/v1/stations/00000000-0000-0000-0000-000000000000`

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Error code: "NOT_FOUND"

---

### 3. Operating Schedules (v0.1.2)

#### API-008/009/010 - TimeSlot, DaySchedule, Operating Schedule

##### Scenario: Set valid operating schedule

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule`:

```json
{
  "operatingSchedule": {
    "monday": {
      "isOperating": true,
      "slots": [
        {"start": "06:00", "end": "12:00"},
        {"start": "13:00", "end": "17:00"}
      ]
    },
    "tuesday": {
      "isOperating": true,
      "slots": [
        {"start": "06:00", "end": "12:00"},
        {"start": "13:00", "end": "17:00"}
      ]
    },
    "wednesday": {
      "isOperating": true,
      "slots": [
        {"start": "06:00", "end": "12:00"},
        {"start": "13:00", "end": "17:00"}
      ]
    },
    "thursday": {
      "isOperating": true,
      "slots": [
        {"start": "06:00", "end": "12:00"},
        {"start": "13:00", "end": "17:00"}
      ]
    },
    "friday": {
      "isOperating": true,
      "slots": [
        {"start": "06:00", "end": "12:00"},
        {"start": "13:00", "end": "17:00"}
      ]
    },
    "saturday": {"isOperating": false, "slots": []},
    "sunday": {"isOperating": false, "slots": []}
  }
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains full station with `operatingSchedule`
- [ ] All 7 days present in schedule
- [ ] Monday-Friday have 2 slots each
- [ ] Saturday-Sunday have `isOperating`: false

---

##### Scenario: Overlapping time slots rejected

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule` with overlapping slots:

```json
{
  "operatingSchedule": {
    "monday": {
      "isOperating": true,
      "slots": [
        {"start": "06:00", "end": "14:00"},
        {"start": "12:00", "end": "17:00"}
      ]
    },
    "tuesday": {"isOperating": false, "slots": []},
    "wednesday": {"isOperating": false, "slots": []},
    "thursday": {"isOperating": false, "slots": []},
    "friday": {"isOperating": false, "slots": []},
    "saturday": {"isOperating": false, "slots": []},
    "sunday": {"isOperating": false, "slots": []}
  }
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error message mentions "overlap"
- [ ] Error details include day name ("monday")

---

##### Scenario: Contiguous slots accepted (not overlapping)

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule` with contiguous slots:

```json
{
  "operatingSchedule": {
    "monday": {
      "isOperating": true,
      "slots": [
        {"start": "06:00", "end": "12:00"},
        {"start": "12:00", "end": "17:00"}
      ]
    },
    "tuesday": {"isOperating": false, "slots": []},
    "wednesday": {"isOperating": false, "slots": []},
    "thursday": {"isOperating": false, "slots": []},
    "friday": {"isOperating": false, "slots": []},
    "saturday": {"isOperating": false, "slots": []},
    "sunday": {"isOperating": false, "slots": []}
  }
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Slots are NOT considered overlapping (end = next start is allowed)
- [ ] Schedule saved successfully

---

##### Scenario: Start time must be before end time

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule` with invalid time order:

```json
{
  "operatingSchedule": {
    "monday": {
      "isOperating": true,
      "slots": [{"start": "17:00", "end": "06:00"}]
    },
    "tuesday": {"isOperating": false, "slots": []},
    "wednesday": {"isOperating": false, "slots": []},
    "thursday": {"isOperating": false, "slots": []},
    "friday": {"isOperating": false, "slots": []},
    "saturday": {"isOperating": false, "slots": []},
    "sunday": {"isOperating": false, "slots": []}
  }
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error message: "Start time must be before end time"

---

##### Scenario: Invalid time format rejected

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule` with invalid time format:

```json
{
  "operatingSchedule": {
    "monday": {
      "isOperating": true,
      "slots": [{"start": "6:00", "end": "12:00"}]
    },
    "tuesday": {"isOperating": false, "slots": []},
    "wednesday": {"isOperating": false, "slots": []},
    "thursday": {"isOperating": false, "slots": []},
    "friday": {"isOperating": false, "slots": []},
    "saturday": {"isOperating": false, "slots": []},
    "sunday": {"isOperating": false, "slots": []}
  }
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error message mentions "HH:MM format"
- [ ] Error details specify invalid field

---

##### Scenario: 24-hour operation (00:00-24:00)

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule`:

```json
{
  "operatingSchedule": {
    "monday": {
      "isOperating": true,
      "slots": [{"start": "00:00", "end": "24:00"}]
    },
    "tuesday": {"isOperating": false, "slots": []},
    "wednesday": {"isOperating": false, "slots": []},
    "thursday": {"isOperating": false, "slots": []},
    "friday": {"isOperating": false, "slots": []},
    "saturday": {"isOperating": false, "slots": []},
    "sunday": {"isOperating": false, "slots": []}
  }
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] "24:00" is valid as end time
- [ ] Full day coverage saved

---

### 4. Schedule Exceptions (v0.1.3)

#### API-011/012 - CLOSED Exception

##### Scenario: Add CLOSED exception

**Steps:**
1. POST `/api/v1/stations/{id}/exceptions`:

```json
{
  "date": "2026-12-25",
  "type": "CLOSED",
  "reason": "Christmas Day"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `date`: "2026-12-25"
- [ ] Response contains `type`: "CLOSED"
- [ ] Response contains `schedule`: null
- [ ] Response contains `reason`: "Christmas Day"

---

##### Scenario: Add duplicate exception rejected

**Steps:**
1. Add CLOSED exception for "2026-12-25"
2. POST `/api/v1/stations/{id}/exceptions` again:

```json
{
  "date": "2026-12-25",
  "type": "CLOSED",
  "reason": "Another reason"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error message: "Exception already exists for date"
- [ ] Error details include the date

---

#### API-013 - MODIFIED Exception

##### Scenario: Add MODIFIED exception with schedule

**Steps:**
1. POST `/api/v1/stations/{id}/exceptions`:

```json
{
  "date": "2026-12-24",
  "type": "MODIFIED",
  "schedule": {
    "isOperating": true,
    "slots": [{"start": "06:00", "end": "12:00"}]
  },
  "reason": "Christmas Eve - morning only"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `type`: "MODIFIED"
- [ ] Response contains `schedule` object with slots
- [ ] Schedule has one slot "06:00-12:00"

---

##### Scenario: MODIFIED exception without schedule rejected

**Steps:**
1. POST `/api/v1/stations/{id}/exceptions`:

```json
{
  "date": "2026-12-24",
  "type": "MODIFIED",
  "reason": "Missing schedule"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error message: "Schedule is required for MODIFIED exception type"

---

##### Scenario: List exceptions for station

**Steps:**
1. Add 2-3 exceptions to a station
2. GET `/api/v1/stations/{id}/exceptions`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `data` array
- [ ] Response contains `total` count
- [ ] Exceptions sorted by date

---

##### Scenario: List exceptions with date filter

**Steps:**
1. GET `/api/v1/stations/{id}/exceptions?from=2026-12-01&to=2026-12-31`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Only exceptions within date range returned
- [ ] `total` reflects filtered count

---

##### Scenario: Delete exception

**Steps:**
1. Add exception for "2026-12-25"
2. DELETE `/api/v1/stations/{id}/exceptions/2026-12-25`

**Expected Results:**
- [ ] HTTP 204 No Content
- [ ] Subsequent GET for exceptions doesn't include "2026-12-25"

---

##### Scenario: Invalid date format rejected

**Steps:**
1. POST `/api/v1/stations/{id}/exceptions`:

```json
{
  "date": "25/12/2026",
  "type": "CLOSED"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error message mentions "YYYY-MM-DD format"

---

### 5. Station Categories (v0.1.4)

#### API-014/015 - Station Category with Similarity Criteria

##### Scenario: Create category with similarity criteria

**Steps:**
1. POST `/api/v1/station-categories`:

```json
{
  "name": "Offset Printing Press",
  "description": "Large format offset presses for high-volume printing",
  "similarityCriteria": [
    {"code": "paper_type", "name": "Same paper type", "fieldPath": "paperType"},
    {"code": "paper_size", "name": "Same paper size", "fieldPath": "paperSize"},
    {"code": "paper_weight", "name": "Same paper weight", "fieldPath": "paperWeight"},
    {"code": "inking", "name": "Same inking", "fieldPath": "inkingType"}
  ]
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `id` (UUID)
- [ ] Response contains `name`: "Offset Printing Press"
- [ ] Response contains `description`
- [ ] Response contains `similarityCriteria` array with 4 items
- [ ] Each criterion has `code`, `name`, `fieldPath`
- [ ] Response contains `createdAt` and `updatedAt`

---

##### Scenario: Duplicate criterion code rejected

**Steps:**
1. POST `/api/v1/station-categories`:

```json
{
  "name": "Test Category",
  "similarityCriteria": [
    {"code": "paper_type", "name": "Paper type 1", "fieldPath": "field1"},
    {"code": "paper_type", "name": "Paper type 2", "fieldPath": "field2"}
  ]
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error message: "Duplicate similarity criterion code"
- [ ] Error details include the duplicate code

---

##### Scenario: Invalid criterion code format rejected

**Steps:**
1. POST `/api/v1/station-categories`:

```json
{
  "name": "Test Category",
  "similarityCriteria": [
    {"code": "PaperType", "name": "Paper type", "fieldPath": "paperType"}
  ]
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error mentions "lowercase with underscores"

---

##### Scenario: List categories

**Steps:**
1. GET `/api/v1/station-categories`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `data` array
- [ ] Response contains `total` count
- [ ] Each category includes `similarityCriteria`

---

##### Scenario: Delete category in use rejected

**Steps:**
1. Create category
2. Create station using that category
3. DELETE `/api/v1/station-categories/{id}`

**Expected Results:**
- [ ] HTTP 409 Conflict
- [ ] Error message indicates category is in use by stations

---

### 6. Station Groups (v0.1.5)

#### API-016/017 - Station Group with Concurrency Limit

##### Scenario: Create group with concurrency limit

**Steps:**
1. POST `/api/v1/station-groups`:

```json
{
  "name": "Offset Press Operators",
  "description": "Limited by operator availability - max 2 presses at once",
  "maxConcurrent": 2,
  "isOutsourcedProviderGroup": false
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `maxConcurrent`: 2
- [ ] Response contains `isOutsourcedProviderGroup`: false

---

##### Scenario: Create group with unlimited capacity

**Steps:**
1. POST `/api/v1/station-groups`:

```json
{
  "name": "Unlimited Group",
  "maxConcurrent": null,
  "isOutsourcedProviderGroup": false
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `maxConcurrent`: null

---

##### Scenario: Provider group must have unlimited capacity

**Steps:**
1. POST `/api/v1/station-groups`:

```json
{
  "name": "Provider Group",
  "maxConcurrent": 5,
  "isOutsourcedProviderGroup": true
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error code: "VALIDATION_ERROR"
- [ ] Error message: "Outsourced provider groups must have unlimited capacity"

---

##### Scenario: maxConcurrent must be positive

**Steps:**
1. POST `/api/v1/station-groups`:

```json
{
  "name": "Invalid Group",
  "maxConcurrent": 0,
  "isOutsourcedProviderGroup": false
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error message: "maxConcurrent must be a positive integer or null"

---

##### Scenario: maxConcurrent negative rejected

**Steps:**
1. POST `/api/v1/station-groups`:

```json
{
  "name": "Invalid Group",
  "maxConcurrent": -1,
  "isOutsourcedProviderGroup": false
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error message indicates positive integer required

---

##### Scenario: List groups with filter

**Steps:**
1. GET `/api/v1/station-groups?isOutsourcedProviderGroup=false`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] All returned groups have `isOutsourcedProviderGroup`: false

---

### 7. Outsourced Providers (v0.1.6)

#### API-018/019 - Provider with Auto-created Group

##### Scenario: Create provider (auto-creates station group)

**Steps:**
1. POST `/api/v1/providers`:

```json
{
  "name": "Pelliculage Express",
  "supportedActionTypes": ["Pelliculage", "Vernis"],
  "latestDepartureTime": "14:00",
  "receptionTime": "09:00"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `id` (UUID)
- [ ] Response contains `name`: "Pelliculage Express"
- [ ] Response contains `status`: "Active"
- [ ] Response contains `groupId` (UUID)
- [ ] Response contains `supportedActionTypes` array
- [ ] Response contains `latestDepartureTime`: "14:00"
- [ ] Response contains `receptionTime`: "09:00"

---

##### Scenario: Verify auto-created group properties

**Steps:**
1. Create provider "Pelliculage Express"
2. GET `/api/v1/station-groups/{groupId}` using groupId from response

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Group `maxConcurrent`: null (unlimited)
- [ ] Group `isOutsourcedProviderGroup`: true
- [ ] Group name contains provider name

---

##### Scenario: Create provider without action types rejected

**Steps:**
1. POST `/api/v1/providers`:

```json
{
  "name": "Invalid Provider",
  "supportedActionTypes": []
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error message: "At least one supported action type is required"

---

##### Scenario: Create provider with invalid time format

**Steps:**
1. POST `/api/v1/providers`:

```json
{
  "name": "Invalid Provider",
  "supportedActionTypes": ["Pelliculage"],
  "latestDepartureTime": "2:00 PM"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error message: "Invalid time format. Expected HH:MM"

---

##### Scenario: Update provider status to Inactive

**Steps:**
1. Create provider
2. PUT `/api/v1/providers/{id}`:

```json
{
  "status": "Inactive"
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `status`: "Inactive"
- [ ] `groupId` unchanged

---

##### Scenario: List providers with action type filter

**Steps:**
1. Create providers with different action types
2. GET `/api/v1/providers?actionType=Pelliculage`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] All returned providers support "Pelliculage" action type

---

### 8. Domain Events (v0.1.7)

#### API-020 - Domain Events

##### Scenario: StationRegistered event on creation

**Steps:**
1. POST `/api/v1/stations` to create new station
2. Check event log/queue (implementation-specific)

**Expected Results:**
- [ ] StationRegistered event dispatched
- [ ] Event contains `stationId`
- [ ] Event contains `name`
- [ ] Event contains `categoryId`
- [ ] Event contains `groupId`
- [ ] Event contains `registeredAt` timestamp

---

##### Scenario: OperatingScheduleUpdated event

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule` with new schedule
2. Check event log/queue

**Expected Results:**
- [ ] OperatingScheduleUpdated event dispatched
- [ ] Event contains `stationId`
- [ ] Event contains `weeklyPattern` with all 7 days
- [ ] Event contains `updatedAt` timestamp

---

##### Scenario: ScheduleExceptionAdded event

**Steps:**
1. POST `/api/v1/stations/{id}/exceptions` to add exception
2. Check event log/queue

**Expected Results:**
- [ ] ScheduleExceptionAdded event dispatched
- [ ] Event contains `stationId`
- [ ] Event contains `exceptionDate`
- [ ] Event contains `type` (CLOSED or MODIFIED)
- [ ] Event contains `addedAt` timestamp

---

##### Scenario: StationStatusChanged event

**Steps:**
1. PUT `/api/v1/stations/{id}` with status change (active → maintenance)
2. Check event log/queue

**Expected Results:**
- [ ] StationStatusChanged event dispatched
- [ ] Event contains `stationId`
- [ ] Event contains `previousStatus`: "active"
- [ ] Event contains `newStatus`: "maintenance"
- [ ] Event contains `changedAt` timestamp

---

## Edge Cases

### Station Name Edge Cases

| # | Scenario | Request | Expected |
|---|----------|---------|----------|
| E1 | Name exactly 100 chars | POST with 100-char name | 201 Created |
| E2 | Name 101 chars | POST with 101-char name | 400 Bad Request |
| E3 | Name with special chars | POST with name "Station @#$%" | Depends on validation rules |
| E4 | Name with Unicode | POST with name "Machine été" | 201 Created (if supported) |

### Schedule Edge Cases

| # | Scenario | Request | Expected |
|---|----------|---------|----------|
| E5 | Schedule with 10 slots per day | PUT with many slots | 200 OK or validation limit |
| E6 | Schedule spanning midnight | slot end "24:00" | 200 OK |
| E7 | All days non-operating | All isOperating: false | 200 OK (valid schedule) |

### Exception Edge Cases

| # | Scenario | Request | Expected |
|---|----------|---------|----------|
| E8 | Exception in the past | POST with past date | Depends on validation rules |
| E9 | Exception far in future | POST with date 10 years away | 201 Created |
| E10 | MODIFIED with overlapping slots | POST MODIFIED with overlapping | 400 Bad Request |

### Group/Provider Edge Cases

| # | Scenario | Request | Expected |
|---|----------|---------|----------|
| E11 | Group with maxConcurrent 999 | POST with very high value | 201 Created |
| E12 | Provider with 20 action types | POST with many action types | 201 Created or limit error |
| E13 | Delete provider, check group | DELETE provider | Group may or may not be deleted |

---

## Cross-Feature Interactions

| Features | Interaction | Test |
|----------|-------------|------|
| Station + Category | Station must reference valid category | Create station with valid/invalid categoryId |
| Station + Group | Station must reference valid group | Create station with valid/invalid groupId |
| Schedule + Exceptions | Exception overrides regular schedule | Set regular + exception, verify effective schedule |
| Provider + Group | Provider auto-creates group | Create provider, verify group properties |
| Status + Events | Status change triggers event | Change status, verify StationStatusChanged event |
| Group + Provider | Provider groups must be unlimited | Create provider group with maxConcurrent |

---

## Test Data Requirements

### Minimum Test Fixtures

Before running tests, ensure:

- [ ] At least 2 station categories exist
- [ ] At least 2 station groups exist (1 regular, 1 provider-type)
- [ ] At least 3 stations exist (various statuses)
- [ ] At least 1 station has operating schedule set
- [ ] At least 1 station has schedule exceptions
- [ ] At least 1 outsourced provider exists

### Sample Test Data

**Station Category:**
```json
{
  "id": "cat-offset",
  "name": "Offset Press",
  "similarityCriteria": [
    {"code": "paper_type", "name": "Same paper", "fieldPath": "paperType"}
  ]
}
```

**Station Group:**
```json
{
  "id": "grp-offset",
  "name": "Offset Operators",
  "maxConcurrent": 2,
  "isOutsourcedProviderGroup": false
}
```

**Station:**
```json
{
  "id": "station-komori",
  "name": "Komori G37",
  "categoryId": "cat-offset",
  "groupId": "grp-offset",
  "status": "active",
  "capacity": 1
}
```

---

## Verification Checklist

### API Contract

- [ ] All endpoints return correct HTTP status codes
- [ ] All endpoints return `application/json` content type
- [ ] Error responses follow standard format: `{ "error": { "code", "message", "details" } }`
- [ ] UUIDs are properly generated and formatted
- [ ] Timestamps use ISO 8601 format
- [ ] Pagination works correctly on list endpoints

### Business Rules

- [ ] BR-STATION-001: Unique station identifiers
- [ ] BR-STATION-002: Station must belong to category
- [ ] BR-STATION-003: Station must belong to group
- [ ] BR-STATION-005: Schedule slots cannot overlap
- [ ] BR-STATION-008: Exceptions override regular schedule
- [ ] BR-CATEGORY-002: Unique criterion codes within category
- [ ] BR-GROUP-003: Provider groups must be unlimited
- [ ] BR-PROVIDER-002: Provider creates own station group

### Documentation

- [ ] OpenAPI documentation accessible at /api/doc
- [ ] All endpoints documented with request/response examples
- [ ] Error codes documented

---

## Notes

- Test with both Swagger UI and curl for consistency
- Verify JSON response structure matches OpenAPI spec
- Check for proper CORS headers if testing from browser
- Domain events may be async - allow time for propagation
- Times are in 24-hour HH:MM format
- Dates are in ISO 8601 YYYY-MM-DD format
