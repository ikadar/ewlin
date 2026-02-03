# Station Management API - Manual QA Plan

> **Last Updated:** 2026-02-03
>
> **Related Features:** API-001 through API-021
>
> **Test Environment:** PHP API at `http://localhost:8080`

---

## Overview

Ez a QA dokumentum a Station Management API végpontok manuális tesztelését fedi le. A B1 batch 21 feature-je 4 fő entitás köré szerveződik: Station, StationCategory, StationGroup és OutsourcedProvider.

A tesztelés Postman collection-nel és/vagy curl parancsokkal végezhető.

---

## Test Prerequisites

| Követelmény | Leírás |
|-------------|--------|
| Docker | Futó konténerek (MariaDB, PHP-FPM, Nginx) |
| Migrations | `php bin/console doctrine:migrations:migrate` lefuttatva |
| Swagger UI | Elérhető: `http://localhost:8080/api/doc` |

### Test Data Setup

A teszteléshez szükséges alapadatok:

```bash
# 1. Create a test category
curl -X POST http://localhost:8080/api/v1/station-categories \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Category", "similarityCriteria": []}'

# 2. Create a test group
curl -X POST http://localhost:8080/api/v1/station-groups \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Group", "maxConcurrent": 5}'
```

---

## Test Scenarios

### API-001, API-002 - Station Entity & Status

#### Scenario: Verify station status values

**Preconditions:**
- Station exists

**Steps:**
1. PUT `/api/v1/stations/{id}` with each status value

**Expected Results:**
- [ ] `active` - Accepted
- [ ] `inactive` - Accepted
- [ ] `maintenance` - Accepted
- [ ] `out_of_service` - Accepted
- [ ] Invalid status - 400 Bad Request

---

### API-003 - Station CRUD API

#### Scenario: Create Station

**Preconditions:**
- StationCategory létezik (ID ismert)
- StationGroup létezik (ID ismert)

**Steps:**
1. POST `/api/v1/stations`
```bash
curl -X POST http://localhost:8080/api/v1/stations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Komori G37",
    "categoryId": "{category-uuid}",
    "groupId": "{group-uuid}",
    "capacity": 1,
    "status": "active"
  }'
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `id` (UUID format)
- [ ] Response contains `createdAt` and `updatedAt` timestamps
- [ ] `operatingSchedule` is null

---

#### Scenario: Create Station with duplicate name

**Preconditions:**
- Station "Komori G37" already exists

**Steps:**
1. POST `/api/v1/stations` with same name

**Expected Results:**
- [ ] HTTP 409 Conflict
- [ ] Error code: `CONFLICT`
- [ ] Error message mentions duplicate name

---

#### Scenario: Create Station with invalid categoryId

**Steps:**
1. POST `/api/v1/stations` with non-existent categoryId

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Error: "Station category not found"

---

#### Scenario: Create Station with invalid groupId

**Steps:**
1. POST `/api/v1/stations` with non-existent groupId

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Error: "Station group not found"

---

#### Scenario: Get Station by ID

**Steps:**
1. GET `/api/v1/stations/{id}`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] All station fields returned
- [ ] Category and group IDs present

---

#### Scenario: Get non-existent Station

**Steps:**
1. GET `/api/v1/stations/{random-uuid}`

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Error code: `NOT_FOUND`

---

#### Scenario: Update Station

**Steps:**
1. PUT `/api/v1/stations/{id}`
```json
{
  "name": "Komori G37 XL",
  "status": "maintenance"
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Name updated to "Komori G37 XL"
- [ ] Status updated to "maintenance"
- [ ] `updatedAt` timestamp changed

---

#### Scenario: Delete Station

**Preconditions:**
- Station exists with no assigned tasks

**Steps:**
1. DELETE `/api/v1/stations/{id}`

**Expected Results:**
- [ ] HTTP 204 No Content
- [ ] Subsequent GET returns 404

---

### API-004 - Station List Filtering

#### Scenario: List all stations

**Steps:**
1. GET `/api/v1/stations`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `items` array
- [ ] Response contains pagination: `total`, `page`, `limit`, `pages`

---

#### Scenario: List stations with status filter

**Preconditions:**
- Multiple stations exist with different statuses

**Steps:**
1. GET `/api/v1/stations?status=active`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] All returned stations have `status: "active"`

---

#### Scenario: List stations with category filter

**Steps:**
1. GET `/api/v1/stations?categoryId={uuid}`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] All returned stations have matching `categoryId`

---

#### Scenario: List stations with group filter

**Steps:**
1. GET `/api/v1/stations?groupId={uuid}`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] All returned stations have matching `groupId`

---

#### Scenario: List stations with search

**Steps:**
1. GET `/api/v1/stations?search=Komori`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Only stations with "Komori" in name returned

---

#### Scenario: List stations with pagination

**Steps:**
1. GET `/api/v1/stations?page=2&limit=5`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `page` = 2
- [ ] `limit` = 5
- [ ] `items` contains at most 5 stations

---

### API-005 - OpenAPI Documentation

#### Scenario: Access Swagger UI

**Steps:**
1. Navigate to `http://localhost:8080/api/doc`

**Expected Results:**
- [ ] Swagger UI loads
- [ ] All Station endpoints documented
- [ ] All StationCategory endpoints documented
- [ ] All StationGroup endpoints documented
- [ ] All Provider endpoints documented
- [ ] Request/response schemas visible

---

### API-006, API-007 - TimeSlot & OperatingSchedule Value Objects

#### Scenario: Valid time slot formats

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule` with various time formats

**Expected Results:**
- [ ] "06:00" - Accepted
- [ ] "17:30" - Accepted
- [ ] "00:00" - Accepted
- [ ] "24:00" as end time - Accepted
- [ ] "6:00" (missing leading zero) - Rejected (400)
- [ ] "25:00" - Rejected (400)
- [ ] "17:60" - Rejected (400)

---

### API-008 - Operating Schedule API

#### Scenario: Update station operating schedule

**Preconditions:**
- Station exists

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule`
```json
{
  "operatingSchedule": {
    "monday": {"isOperating": true, "slots": [{"start": "06:00", "end": "12:00"}, {"start": "13:00", "end": "17:00"}]},
    "tuesday": {"isOperating": true, "slots": [{"start": "06:00", "end": "12:00"}, {"start": "13:00", "end": "17:00"}]},
    "wednesday": {"isOperating": true, "slots": [{"start": "06:00", "end": "12:00"}, {"start": "13:00", "end": "17:00"}]},
    "thursday": {"isOperating": true, "slots": [{"start": "06:00", "end": "12:00"}, {"start": "13:00", "end": "17:00"}]},
    "friday": {"isOperating": true, "slots": [{"start": "06:00", "end": "12:00"}, {"start": "13:00", "end": "17:00"}]},
    "saturday": {"isOperating": false, "slots": []},
    "sunday": {"isOperating": false, "slots": []}
  }
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Station returned with updated `operatingSchedule`
- [ ] All 7 days present in response
- [ ] `updatedAt` changed

---

#### Scenario: Set 24/7 schedule

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule` with all days operating 00:00-24:00

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Each day has `isOperating: true`
- [ ] Each day has single slot "00:00"-"24:00"

---

### API-009 - Schedule Slot Validation

#### Scenario: Overlapping time slots rejected

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
- [ ] Error mentions "overlap"
- [ ] Error details include day name ("monday")

---

#### Scenario: Contiguous slots accepted

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule` with contiguous slots (end = next start)

```json
"slots": [{"start": "06:00", "end": "12:00"}, {"start": "12:00", "end": "17:00"}]
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Slots are NOT considered overlapping

---

#### Scenario: Start time must be before end time

**Steps:**
1. PUT `/api/v1/stations/{id}/schedule` with start > end

```json
"slots": [{"start": "17:00", "end": "06:00"}]
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error: "Start time must be before end time"

---

### API-010 - ScheduleException Value Object

#### Scenario: Valid exception types

**Steps:**
1. POST `/api/v1/stations/{id}/exceptions` with type "CLOSED"
2. POST `/api/v1/stations/{id}/exceptions` with type "MODIFIED"

**Expected Results:**
- [ ] Both types accepted
- [ ] Invalid type rejected (400)

---

### API-011 - Schedule Exception API

#### Scenario: Add CLOSED exception

**Steps:**
1. POST `/api/v1/stations/{id}/exceptions`
```json
{
  "date": "2026-12-25",
  "type": "CLOSED",
  "reason": "Christmas Day"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `date`, `type`, `reason`
- [ ] `schedule` is null

---

#### Scenario: Add MODIFIED exception

**Steps:**
1. POST `/api/v1/stations/{id}/exceptions`
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
- [ ] Response contains `schedule` with the provided slots

---

#### Scenario: MODIFIED without schedule rejected

**Steps:**
1. POST `/api/v1/stations/{id}/exceptions`
```json
{
  "date": "2026-12-24",
  "type": "MODIFIED"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error: "Schedule is required for MODIFIED exception type"

---

#### Scenario: Duplicate exception date rejected

**Preconditions:**
- Exception for 2026-12-25 already exists

**Steps:**
1. POST `/api/v1/stations/{id}/exceptions` with same date

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error: "Exception already exists for date"

---

#### Scenario: List exceptions

**Preconditions:**
- Multiple exceptions exist

**Steps:**
1. GET `/api/v1/stations/{id}/exceptions`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `data` array
- [ ] Response contains `total` count

---

#### Scenario: List exceptions with date filter

**Steps:**
1. GET `/api/v1/stations/{id}/exceptions?from=2026-12-01&to=2026-12-31`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Only exceptions within date range returned

---

#### Scenario: Delete exception

**Steps:**
1. DELETE `/api/v1/stations/{id}/exceptions/2026-12-25`

**Expected Results:**
- [ ] HTTP 204 No Content
- [ ] Subsequent GET does not include this date

---

#### Scenario: Delete non-existent exception

**Steps:**
1. DELETE `/api/v1/stations/{id}/exceptions/2099-01-01`

**Expected Results:**
- [ ] HTTP 404 Not Found
- [ ] Error: "Exception not found for date"

---

### API-012, API-013 - StationCategory & SimilarityCriterion

#### Scenario: Verify similarity criterion structure

**Steps:**
1. GET `/api/v1/station-categories/{id}`

**Expected Results:**
- [ ] Each criterion has `code` (lowercase, underscores)
- [ ] Each criterion has `name` (display name)
- [ ] Each criterion has `fieldPath` (job field reference)

---

### API-014 - Station Category CRUD API

#### Scenario: Create category

**Steps:**
1. POST `/api/v1/station-categories`
```json
{
  "name": "Offset Press",
  "description": "Large format offset presses"
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] `similarityCriteria` defaults to empty array

---

#### Scenario: Create category with similarity criteria

**Steps:**
1. POST `/api/v1/station-categories`
```json
{
  "name": "Offset Press",
  "description": "Large format offset presses",
  "similarityCriteria": [
    {"code": "paper_type", "name": "Same paper type", "fieldPath": "paperType"},
    {"code": "paper_size", "name": "Same paper size", "fieldPath": "paperSize"}
  ]
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] Response contains `similarityCriteria` array with 2 items
- [ ] Each criterion has `code`, `name`, `fieldPath`

---

#### Scenario: Duplicate criterion code rejected

**Steps:**
1. POST `/api/v1/station-categories` with duplicate codes:
```json
{
  "name": "Test",
  "similarityCriteria": [
    {"code": "paper_type", "name": "Type 1", "fieldPath": "field1"},
    {"code": "paper_type", "name": "Type 2", "fieldPath": "field2"}
  ]
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error mentions duplicate code "paper_type"

---

#### Scenario: Invalid criterion code format rejected

**Steps:**
1. POST `/api/v1/station-categories` with invalid code format:
```json
{"code": "Paper-Type", "name": "Test", "fieldPath": "field"}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error: "Must be lowercase with underscores"

---

#### Scenario: List categories

**Steps:**
1. GET `/api/v1/station-categories`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `data` array
- [ ] Response contains `total`

---

#### Scenario: List categories with search

**Steps:**
1. GET `/api/v1/station-categories?search=Offset`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Only categories with "Offset" in name returned

---

#### Scenario: Update category

**Steps:**
1. PUT `/api/v1/station-categories/{id}`
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Name and description updated
- [ ] `updatedAt` changed

---

#### Scenario: Delete category

**Preconditions:**
- Category not used by any station

**Steps:**
1. DELETE `/api/v1/station-categories/{id}`

**Expected Results:**
- [ ] HTTP 204 No Content

---

#### Scenario: Delete category in use

**Preconditions:**
- Station references this category

**Steps:**
1. DELETE `/api/v1/station-categories/{id}`

**Expected Results:**
- [ ] HTTP 409 Conflict
- [ ] Error: Category in use

---

### API-015 - StationGroup Entity

#### Scenario: Verify maxConcurrent values

**Steps:**
1. Create groups with various maxConcurrent values

**Expected Results:**
- [ ] Positive integer (e.g., 5) - Accepted
- [ ] null (unlimited) - Accepted
- [ ] 0 - Rejected (400)
- [ ] Negative number - Rejected (400)

---

### API-016 - Station Group CRUD API

#### Scenario: Create group with concurrency limit

**Steps:**
1. POST `/api/v1/station-groups`
```json
{
  "name": "Offset Press Operators",
  "description": "Limited by operator availability",
  "maxConcurrent": 2,
  "isOutsourcedProviderGroup": false
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] `maxConcurrent` = 2
- [ ] `isOutsourcedProviderGroup` = false

---

#### Scenario: Create group with unlimited capacity

**Steps:**
1. POST `/api/v1/station-groups`
```json
{
  "name": "Digital Printers",
  "maxConcurrent": null
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] `maxConcurrent` = null

---

#### Scenario: Provider group must have unlimited capacity

**Steps:**
1. POST `/api/v1/station-groups`
```json
{
  "name": "Provider Group",
  "maxConcurrent": 5,
  "isOutsourcedProviderGroup": true
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error: "Outsourced provider groups must have unlimited capacity (maxConcurrent = null)"

---

#### Scenario: Create provider group correctly

**Steps:**
1. POST `/api/v1/station-groups`
```json
{
  "name": "Provider Group",
  "maxConcurrent": null,
  "isOutsourcedProviderGroup": true
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] `isOutsourcedProviderGroup` = true
- [ ] `maxConcurrent` = null

---

#### Scenario: List groups

**Steps:**
1. GET `/api/v1/station-groups`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `data` array

---

#### Scenario: List groups with provider filter

**Steps:**
1. GET `/api/v1/station-groups?isOutsourcedProviderGroup=true`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] All returned groups have `isOutsourcedProviderGroup: true`

---

#### Scenario: Delete group in use

**Preconditions:**
- Station references this group

**Steps:**
1. DELETE `/api/v1/station-groups/{id}`

**Expected Results:**
- [ ] HTTP 409 Conflict
- [ ] Error: Group in use by stations

---

### API-017 - OutsourcedProvider Entity

#### Scenario: Verify provider fields

**Steps:**
1. GET `/api/v1/providers/{id}`

**Expected Results:**
- [ ] `name` - Provider name
- [ ] `status` - Active or Inactive
- [ ] `supportedActionTypes` - Array of strings
- [ ] `latestDepartureTime` - HH:MM format
- [ ] `receptionTime` - HH:MM format
- [ ] `groupId` - Reference to auto-created group

---

### API-018 - Provider CRUD API

#### Scenario: Create provider (auto-creates group)

**Steps:**
1. POST `/api/v1/providers`
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
- [ ] Response contains `groupId`
- [ ] `status` defaults to "Active"
- [ ] Default times applied if not provided

2. GET `/api/v1/station-groups/{groupId}`

**Expected Results:**
- [ ] Group exists
- [ ] `isOutsourcedProviderGroup` = true
- [ ] `maxConcurrent` = null (unlimited)
- [ ] Group name derived from provider name

---

#### Scenario: Create provider with defaults

**Steps:**
1. POST `/api/v1/providers`
```json
{
  "name": "Test Provider",
  "supportedActionTypes": ["Test"]
}
```

**Expected Results:**
- [ ] HTTP 201 Created
- [ ] `latestDepartureTime` = "14:00" (default)
- [ ] `receptionTime` = "09:00" (default)

---

#### Scenario: Provider without action types rejected

**Steps:**
1. POST `/api/v1/providers`
```json
{
  "name": "Test Provider",
  "supportedActionTypes": []
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error: "At least one supported action type is required"

---

#### Scenario: Invalid time format rejected

**Steps:**
1. POST `/api/v1/providers`
```json
{
  "name": "Test",
  "supportedActionTypes": ["Test"],
  "latestDepartureTime": "2:00 PM"
}
```

**Expected Results:**
- [ ] HTTP 400 Bad Request
- [ ] Error mentions "HH:MM format"

---

#### Scenario: List providers

**Steps:**
1. GET `/api/v1/providers`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] Response contains `data` array
- [ ] Response contains `total`

---

#### Scenario: List providers with status filter

**Steps:**
1. GET `/api/v1/providers?status=Active`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] All returned providers have `status: "Active"`

---

#### Scenario: List providers with action type filter

**Steps:**
1. GET `/api/v1/providers?actionType=Pelliculage`

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] All returned providers have "Pelliculage" in `supportedActionTypes`

---

#### Scenario: Update provider status

**Steps:**
1. PUT `/api/v1/providers/{id}`
```json
{
  "status": "Inactive"
}
```

**Expected Results:**
- [ ] HTTP 200 OK
- [ ] `status` = "Inactive"
- [ ] `groupId` unchanged (cannot be modified)

---

### API-019 - Auto-create Provider Group

#### Scenario: Verify auto-created group properties

**Preconditions:**
- Create a new provider

**Steps:**
1. POST `/api/v1/providers` (create provider)
2. GET `/api/v1/station-groups/{groupId}` (get auto-created group)

**Expected Results:**
- [ ] Group `name` contains provider name
- [ ] `isOutsourcedProviderGroup` = true
- [ ] `maxConcurrent` = null
- [ ] Group `description` references provider

---

### API-020, API-021 - Domain Events

#### Scenario: Verify domain events are recorded (Developer verification)

**Note:** Domain events are internal and not exposed via API. Verification requires log inspection or debugger.

**Events to verify:**
- [ ] `StationRegistered` - On station creation
- [ ] `OperatingScheduleUpdated` - On schedule update
- [ ] `ScheduleExceptionAdded` - On exception creation
- [ ] `StationStatusChanged` - On status change

---

## Edge Cases

| Eset | Elvárt viselkedés |
|------|-------------------|
| Invalid UUID format in path | 400 Bad Request |
| Empty request body | 400 Validation Error |
| Extra unknown fields in request | Ignored (no error) |
| Very long name (>100 chars) | 400 Validation Error |
| Time "24:00" as end time | Accepted (end of day) |
| Time "00:00" as start time | Accepted (midnight) |
| Past date for exception | Accepted (MVP relaxed) |
| Future date for exception | Accepted |
| Delete category in use | 409 Conflict |
| Delete group in use | 409 Conflict |
| Delete station with tasks | 409 Conflict (future) |
| Concurrent requests (same name) | One succeeds, other gets 409 |

---

## Cross-feature Interactions

| Kapcsolódó feature | Interakció típusa |
|--------------------|-------------------|
| Station + Category | Station requires valid categoryId (FK) |
| Station + Group | Station requires valid groupId (FK) |
| Provider + Group | Provider auto-creates StationGroup |
| Station + Schedule | Schedule nullable until task assignment |
| Schedule + Exception | Exception overrides weekly pattern for date |
| Group + Provider | Provider groups must have unlimited capacity |
| Category + Station | Cannot delete category with assigned stations |
| Group + Station | Cannot delete group with assigned stations |

---

## Visual Checklist (Swagger UI)

- [ ] All endpoints visible in Swagger UI
- [ ] Request schemas show required fields
- [ ] Response schemas show field types
- [ ] Error responses documented (400, 404, 409)
- [ ] Try-it-out functionality works
- [ ] Authentication not required (MVP)

---

## Summary

| Metrika | Érték |
|---------|-------|
| Feldolgozott feature-ök | 21 |
| Generált teszt szcenáriók | 52 |
| Edge case-ek | 12 |
| Cross-feature interactions | 8 |
