# API / Interface Drafts – Flux Print Shop Scheduling System

This document defines **high-level API/interface contracts** for the print shop scheduling system.

These drafts are:
- **technology-agnostic** (no specific framework implied),
- focused on **endpoints, request/response shapes, and error semantics**, and
- intended as input for detailed design and implementation.

---

## 1. Station Management API

### POST /api/v1/stations
Create a new station.

**Request:**
```json
{
  "name": "Komori G37",
  "categoryId": "cat-offset-press",
  "groupId": "grp-offset",
  "capacity": 1,
  "operatingSchedule": {
    "weeklyPattern": [
      {
        "dayOfWeek": 0,
        "timeSlots": [
          {"start": "00:00", "end": "05:00"},
          {"start": "06:00", "end": "24:00"}
        ]
      }
    ]
  }
}
```

**Response (201):**
```json
{
  "stationId": "station-123",
  "name": "Komori G37",
  "categoryId": "cat-offset-press",
  "groupId": "grp-offset",
  "capacity": 1,
  "status": "Available",
  "createdAt": "2025-12-11T10:00:00Z"
}
```

### GET /api/v1/stations
List all stations.

**Response (200):**
```json
{
  "items": [
    {
      "stationId": "station-123",
      "name": "Komori G37",
      "categoryId": "cat-offset-press",
      "groupId": "grp-offset",
      "status": "Available"
    }
  ]
}
```

### POST /api/v1/stations/{stationId}/exceptions
Add a schedule exception.

**Request:**
```json
{
  "date": "2025-12-25",
  "type": "Closed",
  "reason": "Christmas holiday"
}
```

---

## 2. Station Category API

### POST /api/v1/station-categories
Create a station category.

**Request:**
```json
{
  "name": "Offset Printing Press",
  "similarityCriteria": [
    {"code": "paper_type", "name": "Same paper type", "fieldPath": "paperType"},
    {"code": "paper_size", "name": "Same paper size", "fieldPath": "paperFormat"},
    {"code": "paper_weight", "name": "Same paper weight", "fieldPath": "paperWeight"},
    {"code": "inking", "name": "Same inking", "fieldPath": "inking"}
  ]
}
```

**Notes:**
- `fieldPath`: Path to Job property for comparison (e.g., "paperType" compares job.paperType values)

**Response (201):**
```json
{
  "categoryId": "cat-offset-press",
  "name": "Offset Printing Press",
  "similarityCriteria": [...],
  "createdAt": "2025-12-11T10:00:00Z"
}
```

---

## 3. Station Group API

### POST /api/v1/station-groups
Create a station group.

**Request:**
```json
{
  "name": "Offset Presses",
  "maxConcurrent": 2
}
```

**Response (201):**
```json
{
  "groupId": "grp-offset",
  "name": "Offset Presses",
  "maxConcurrent": 2,
  "isOutsourcedProviderGroup": false,
  "createdAt": "2025-12-11T10:00:00Z"
}
```

---

## 4. Outsourced Provider API

### POST /api/v1/providers
Create an outsourced provider.

**Request:**
```json
{
  "name": "Clément",
  "supportedActionTypes": ["Pelliculage", "Dorure", "Reliure"],
  "latestDepartureTime": "14:00",
  "receptionTime": "09:00"
}
```

**Response (201):**
```json
{
  "providerId": "prov-clement",
  "name": "Clément",
  "supportedActionTypes": ["Pelliculage", "Dorure", "Reliure"],
  "latestDepartureTime": "14:00",
  "receptionTime": "09:00",
  "groupId": "grp-prov-clement",
  "status": "Active",
  "createdAt": "2025-12-11T10:00:00Z"
}
```

**Notes:**
- `latestDepartureTime`: Latest time by which work must be sent for that day to count as first business day (default: "14:00")
- `receptionTime`: Time when completed work returns from provider (default: "09:00")

---

## 5. Job Management API

### POST /api/v1/jobs
Create a new job.

**Request:**
```json
{
  "reference": "45113 A",
  "client": "Fibois Grand Est",
  "description": "Cartes de voeux - 9,9 x 21 cm - off 350g - 350 ex",
  "workshopExitDate": "2025-12-15T17:00:00Z",
  "paperType": "CB300",
  "paperFormat": "63x88",
  "paperPurchaseStatus": "InStock",
  "notes": "",
  "tasksDSL": "[Komori] 20+40 \"vernis\"\n[Massicot] 15\nST [Clément] Pelliculage 2JO"
}
```

**Response (201):**
```json
{
  "jobId": "job-456",
  "reference": "45113 A",
  "client": "Fibois Grand Est",
  "description": "Cartes de voeux...",
  "workshopExitDate": "2025-12-15T17:00:00Z",
  "status": "Draft",
  "fullyScheduled": false,
  "color": "#3B82F6",
  "tasks": [
    {
      "taskId": "task-001",
      "sequenceOrder": 1,
      "type": "internal",
      "stationId": "station-komori",
      "setupMinutes": 20,
      "runMinutes": 40,
      "comment": "vernis",
      "status": "Defined"
    },
    {
      "taskId": "task-002",
      "sequenceOrder": 2,
      "type": "internal",
      "stationId": "station-massicot",
      "setupMinutes": 0,
      "runMinutes": 15,
      "status": "Defined"
    },
    {
      "taskId": "task-003",
      "sequenceOrder": 3,
      "type": "outsourced",
      "providerId": "prov-clement",
      "actionType": "Pelliculage",
      "durationOpenDays": 2,
      "status": "Defined"
    }
  ],
  "createdAt": "2025-12-11T10:00:00Z"
}
```

### GET /api/v1/jobs
List jobs with filtering.

**Query Parameters:**
- `status`: Filter by status
- `search`: Search in reference, client, description
- `page`, `limit`: Pagination

**Response (200):**
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

### PUT /api/v1/jobs/{jobId}
Update job details.

### PUT /api/v1/jobs/{jobId}/proof
Update BAT status.

**Request:**
```json
{
  "proofSentAt": "2025-12-11T14:00:00Z"
}
```
Or:
```json
{
  "proofSentAt": "NoProofRequired"
}
```
Or:
```json
{
  "proofApprovedAt": "2025-12-12T09:00:00Z"
}
```

### PUT /api/v1/jobs/{jobId}/plates
Update plates status.

**Request:**
```json
{
  "platesStatus": "Done"
}
```

### PUT /api/v1/jobs/{jobId}/paper
Update paper procurement status.

**Request:**
```json
{
  "paperPurchaseStatus": "Ordered"
}
```

**Response (200):**
```json
{
  "paperPurchaseStatus": "Ordered",
  "paperOrderedAt": "2025-12-11T10:30:00Z"
}
```

### POST /api/v1/jobs/{jobId}/dependencies
Add job dependency.

**Request:**
```json
{
  "requiredJobId": "job-123"
}
```

### POST /api/v1/jobs/{jobId}/comments
Add comment to job.

**Request:**
```json
{
  "content": "Client confirmed color specs"
}
```

**Response (201):**
```json
{
  "author": "user@example.com",
  "timestamp": "2025-12-11T10:00:00Z",
  "content": "Client confirmed color specs"
}
```

### POST /api/v1/jobs/{jobId}/cancel
Cancel a job.

**Request:** None (empty body)

**Response (200):**
```json
{
  "jobId": "job-456",
  "status": "Cancelled",
  "recalledAssignments": ["task-002", "task-003"],
  "preservedAssignments": ["task-001"],
  "cancelledAt": "2025-12-11T10:00:00Z"
}
```

**Notes:**
- `recalledAssignments`: Tasks with future assignments that were automatically removed
- `preservedAssignments`: Tasks with past assignments that remain for historical reference

---

## 6. Task Management API

### PUT /api/v1/jobs/{jobId}/tasks/reorder
Reorder tasks within a job.

**Request:**
```json
{
  "taskOrder": ["task-002", "task-001", "task-003"]
}
```

### PUT /api/v1/tasks/{taskId}
Update task details.

### PUT /api/v1/tasks/{taskId}/completion
Toggle task completion status.

**Request:**
```json
{
  "isCompleted": true
}
```

**Response (200):**
```json
{
  "taskId": "task-001",
  "isCompleted": true,
  "completedAt": "2025-12-11T10:00:00Z"
}
```

**Notes:**
- `isCompleted`: Boolean flag for tracking purposes only
- `completedAt`: Set when isCompleted becomes true, cleared when false
- Does NOT affect precedence validation

---

## 7. Assignment / Scheduling API

### POST /api/v1/tasks/{taskId}/assign
Create or update task assignment.

**Request:**
```json
{
  "stationId": "station-komori",
  "scheduledStart": "2025-12-12T09:00:00Z"
}
```

**Response (201) - Valid:**
```json
{
  "taskId": "task-001",
  "assignment": {
    "stationId": "station-komori",
    "scheduledStart": "2025-12-12T09:00:00Z",
    "scheduledEnd": "2025-12-12T10:00:00Z"
  },
  "status": "Assigned",
  "validationResult": {
    "valid": true,
    "conflicts": []
  }
}
```

**Response (200) - Invalid:**
```json
{
  "taskId": "task-001",
  "validationResult": {
    "valid": false,
    "conflicts": [
      {
        "type": "StationConflict",
        "description": "Station Komori already booked 09:00-10:30",
        "affectedTaskIds": ["task-001", "task-existing"],
        "severity": "High"
      }
    ]
  }
}
```

### DELETE /api/v1/tasks/{taskId}/assign
Remove task assignment (recall tile).

**Response (200):**
```json
{
  "taskId": "task-001",
  "status": "Ready"
}
```

### POST /api/v1/assignments/validate
Validate a proposed assignment without saving.

**Request:**
```json
{
  "taskId": "task-001",
  "stationId": "station-komori",
  "scheduledStart": "2025-12-12T09:00:00Z"
}
```

**Response (200):**
```json
{
  "valid": true,
  "conflicts": [],
  "warnings": [
    {
      "type": "DeadlineRisk",
      "description": "Only 4 hours buffer before workshop exit date"
    }
  ]
}
```

---

## 8. Schedule Snapshot API

### GET /api/v1/schedule/snapshot
Get complete schedule snapshot for UI rendering.

**Query Parameters:**
- `startDate`: Start of time range
- `endDate`: End of time range

**Response (200):**
```json
{
  "snapshotVersion": 42,
  "generatedAt": "2025-12-11T10:00:00Z",
  "stations": [
    {
      "stationId": "station-komori",
      "name": "Komori G37",
      "categoryId": "cat-offset-press",
      "groupId": "grp-offset",
      "status": "Available"
    }
  ],
  "providers": [...],
  "categories": [...],
  "groups": [...],
  "jobs": [
    {
      "jobId": "job-456",
      "reference": "45113 A",
      "client": "Fibois Grand Est",
      "color": "#3B82F6",
      "workshopExitDate": "2025-12-15T17:00:00Z",
      "tasks": [...]
    }
  ],
  "assignments": [
    {
      "taskId": "task-001",
      "jobId": "job-456",
      "stationId": "station-komori",
      "scheduledStart": "2025-12-12T09:00:00Z",
      "scheduledEnd": "2025-12-12T10:00:00Z",
      "isCompleted": false,
      "completedAt": null
    }
  ],
  "conflicts": [
    {
      "type": "StationConflict",
      "affectedTaskIds": ["task-x", "task-y"],
      "description": "...",
      "severity": "High"
    }
  ],
  "lateJobs": [
    {
      "jobId": "job-789",
      "reference": "45120",
      "workshopExitDate": "2025-12-14T17:00:00Z",
      "expectedCompletion": "2025-12-16T11:00:00Z",
      "delayHours": 42
    }
  ]
}
```

---

## 9. DSL Parsing API

### POST /api/v1/dsl/parse
Parse DSL text into structured tasks (for validation during input).

**Request:**
```json
{
  "dsl": "[Komori] 20+40 \"vernis\"\n[Massicot] 15"
}
```

**Response (200) - Valid:**
```json
{
  "valid": true,
  "tasks": [
    {
      "type": "internal",
      "stationId": "station-komori",
      "stationName": "Komori",
      "setupMinutes": 20,
      "runMinutes": 40,
      "comment": "vernis",
      "rawInput": "[Komori] 20+40 \"vernis\""
    },
    {
      "type": "internal",
      "stationId": "station-massicot",
      "stationName": "Massicot",
      "setupMinutes": 0,
      "runMinutes": 15,
      "comment": null,
      "rawInput": "[Massicot] 15"
    }
  ],
  "errors": []
}
```

**Response (200) - With Errors:**
```json
{
  "valid": false,
  "tasks": [...],
  "errors": [
    {
      "line": 2,
      "message": "Station 'UnknownStation' not found",
      "rawInput": "[UnknownStation] 20+40"
    }
  ]
}
```

### GET /api/v1/dsl/autocomplete
Get autocomplete suggestions.

**Query Parameters:**
- `prefix`: Current input prefix
- `context`: "station" or "provider"

**Response (200):**
```json
{
  "suggestions": [
    {"value": "Komori", "label": "Komori G37"},
    {"value": "Komori_XL", "label": "Komori XL 106"}
  ]
}
```

---

## 10. Business Calendar API

### GET /api/v1/calendar/open-days
Calculate open days between dates.

**Query Parameters:**
- `from`: Start date
- `days`: Number of open days to add

**Response (200):**
```json
{
  "from": "2025-12-13",
  "days": 2,
  "result": "2025-12-17",
  "explanation": "Dec 13 (Fri) + 2 open days = Dec 17 (Tue), skipping Dec 14-15 (weekend)"
}
```

---

## 11. Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Station not found",
    "details": {
      "field": "stationId",
      "value": "unknown-station"
    }
  }
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Operation would create conflict |
| `CIRCULAR_DEPENDENCY` | 400 | Dependency would create cycle |
| `APPROVAL_GATE_BLOCKED` | 400 | Approval gate not satisfied |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 12. WebSocket Events (Future)

For real-time updates:

```json
// Schedule updated
{
  "type": "schedule.updated",
  "data": {
    "snapshotVersion": 43,
    "changedTaskIds": ["task-001", "task-002"]
  }
}

// Conflict detected
{
  "type": "conflict.detected",
  "data": {
    "type": "StationConflict",
    "affectedTaskIds": ["task-001", "task-002"]
  }
}
```

---

This document defines the API contracts for the Flux print shop scheduling system. Implementation may add additional endpoints, query parameters, or response fields as needed.
