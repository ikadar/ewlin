# API / Interface Drafts – Operations Research System

This document defines **high-level API/interface contracts** for the Equipment → Operator → Job → Task assignment and validation domain.

These drafts are:
- **technology-agnostic** (no specific framework implied),
- focused on **endpoints, request/response shapes, and error semantics**, and
- intended as input for detailed design and implementation.

---

## 1. Operator API

### 1.1 Create Operator
- **Method:** `POST`
- **Path:** `/api/v1/operators`
- **Description:** Register a new operator in the system.

**Request body (JSON):**
```json
{
  "name": "string",
  "availability": [
    {
      "start": "ISO-8601-datetime",
      "end": "ISO-8601-datetime"
    }
  ],
  "skills": [
    {
      "equipmentId": "string",
      "level": "beginner|intermediate|expert"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "operatorId": "string",
  "status": "Active",  // Active|Inactive|Deactivated
  "createdAt": "ISO-8601-timestamp"
}
```

**Error cases:**
- `400 Bad Request` – validation failed (e.g., overlapping availability).
- `409 Conflict` – operator name already exists.

---

### 1.2 Update Operator Availability
- **Method:** `PUT`
- **Path:** `/api/v1/operators/{operatorId}/availability`
- **Description:** Update operator's availability schedule.

**Request body (JSON):**
```json
{
  "availability": [
    {
      "start": "ISO-8601-datetime",
      "end": "ISO-8601-datetime"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "operatorId": "string",
  "updatedAt": "ISO-8601-timestamp",
  "affectedAssignments": 3
}
```

---

### 1.3 Add Equipment Skill
- **Method:** `POST`
- **Path:** `/api/v1/operators/{operatorId}/skills`
- **Description:** Add or update equipment certification.

**Request body (JSON):**
```json
{
  "equipmentId": "string",
  "level": "beginner|intermediate|expert",
  "certificationDate": "YYYY-MM-DD"
}
```

**Response (201 Created):**
```json
{
  "skillId": "string",
  "addedAt": "ISO-8601-timestamp"
}
```

---

## 2. Equipment API

### 2.1 Create Equipment
- **Method:** `POST`
- **Path:** `/api/v1/equipment`
- **Description:** Register new equipment.

**Request body (JSON):**
```json
{
  "name": "string",
  "supportedTaskTypes": ["type1", "type2"],
  "location": "string"
}
```

**Response (201 Created):**
```json
{
  "equipmentId": "string",
  "status": "Available",  // Available|InUse|Maintenance|OutOfService
  "createdAt": "ISO-8601-timestamp"
}
```

---

### 2.2 Schedule Maintenance
- **Method:** `POST`
- **Path:** `/api/v1/equipment/{equipmentId}/maintenance`
- **Description:** Schedule equipment maintenance window.

**Request body (JSON):**
```json
{
  "start": "ISO-8601-datetime",
  "end": "ISO-8601-datetime",
  "description": "string"
}
```

**Response (200 OK):**
```json
{
  "maintenanceId": "string",
  "status": "Scheduled",
  "conflictingTasks": [
    {
      "taskId": "string",
      "jobId": "string",
      "scheduledStart": "ISO-8601-datetime"
    }
  ]
}
```

---

## 3. Job API

### 3.1 Create Job
- **Method:** `POST`
- **Path:** `/api/v1/jobs`
- **Description:** Create a new production job.

**Request body (JSON):**
```json
{
  "name": "string",
  "description": "string",
  "deadline": "ISO-8601-datetime"
}
```

**Response (201 Created):**
```json
{
  "jobId": "string",
  "status": "Draft",  // Draft|Planned|InProgress|Delayed|Completed|Cancelled
  "createdAt": "ISO-8601-timestamp"
}
```

---

### 3.2 Add Task to Job
- **Method:** `POST`
- **Path:** `/api/v1/jobs/{jobId}/tasks`
- **Description:** Add a task to an existing job.

**Request body (JSON):**
```json
{
  "type": "string",
  "duration": 120,
  "requiresOperator": true,
  "requiresEquipment": true,
  "dependencies": ["task1", "task2"]
}
```

**Response (201 Created):**
```json
{
  "taskId": "string",
  "status": "Defined",  // Defined|Ready|Assigned|Executing|Completed|Failed|Cancelled
  "criticalPath": false
}
```

**Error cases:**
- `400 Bad Request` – circular dependency detected.
- `409 Conflict` – job not in Draft status.

---

### 3.3 Get Job with Tasks
- **Method:** `GET`
- **Path:** `/api/v1/jobs/{jobId}`
- **Description:** Get job details including all tasks.

**Response (200 OK):**
```json
{
  "jobId": "string",
  "name": "string",
  "deadline": "ISO-8601-datetime",
  "status": "Planned",
  "tasks": [
    {
      "taskId": "string",
      "type": "string",
      "duration": 120,
      "status": "Ready",  // Defined|Ready|Assigned|Executing|Completed|Failed|Cancelled
      "assignment": {
        "operatorId": "string",
        "equipmentId": "string",
        "scheduledStart": "ISO-8601-datetime",
        "scheduledEnd": "ISO-8601-datetime"
      },
      "dependencies": ["task1", "task2"]
    }
  ],
  "criticalPath": ["task1", "task3", "task5"]
}
```

---

## 4. Assignment API

### 4.1 Assign Resources to Task
- **Method:** `POST`
- **Path:** `/api/v1/tasks/{taskId}/assignments`
- **Description:** Assign operator and/or equipment to a task.

**Request body (JSON):**
```json
{
  "operatorId": "string",
  "equipmentId": "string"
}
```

**Response (200 OK):**
```json
{
  "assignmentId": "string",
  "taskId": "string",
  "status": "Assigned",
  "validationPassed": true
}
```

**Error cases:**
- `400 Bad Request` – validation failed (skill mismatch, etc.).
- `409 Conflict` – resource already assigned for this time.

---

### 4.2 Schedule Task
- **Method:** `POST`
- **Path:** `/api/v1/tasks/{taskId}/schedule`
- **Description:** Set specific start time for a task.

**Request body (JSON):**
```json
{
  "scheduledStart": "ISO-8601-datetime"
}
```

**Response (200 OK):**
```json
{
  "taskId": "string",
  "scheduledStart": "ISO-8601-datetime",
  "scheduledEnd": "ISO-8601-datetime",
  "conflicts": []
}
```

**Error cases:**
- `409 Conflict` – scheduling conflicts detected.
```json
{
  "error": "SchedulingConflict",
  "conflicts": [
    {
      "type": "OperatorUnavailable",
      "operatorId": "string",
      "conflictingTask": "string"
    }
  ]
}
```

---

### 4.3 Validate Schedule
- **Method:** `POST`
- **Path:** `/api/v1/schedules/validate`
- **Description:** Validate entire schedule or subset.

**Request body (JSON):**
```json
{
  "jobIds": ["job1", "job2"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}
```

**Response (200 OK):**
```json
{
  "valid": false,
  "conflicts": [
    {
      "type": "ResourceConflict",
      "resource": "operator-123",
      "tasks": ["task1", "task2"],
      "overlapStart": "ISO-8601-datetime",
      "overlapEnd": "ISO-8601-datetime"
    },
    {
      "type": "DependencyViolation",
      "task": "task3",
      "dependsOn": "task2",
      "issue": "task3 scheduled before task2 completion"
    }
  ],
  "validatedAt": "ISO-8601-timestamp"
}
```

---

## 5. Execution API

### 5.1 Start Task
- **Method:** `POST`
- **Path:** `/api/v1/tasks/{taskId}/start`
- **Description:** Mark task as started.

**Request body (JSON):**
```json
{
  "actualStartTime": "ISO-8601-datetime",
  "startReason": "string"
}
```

**Response (200 OK):**
```json
{
  "taskId": "string",
  "status": "Executing",  // Defined|Ready|Assigned|Executing|Completed|Failed|Cancelled
  "actualStartTime": "ISO-8601-datetime"
}
```

---

### 5.2 Complete Task
- **Method:** `POST`
- **Path:** `/api/v1/tasks/{taskId}/complete`
- **Description:** Mark task as completed.

**Request body (JSON):**
```json
{
  "actualEndTime": "ISO-8601-datetime",
  "qualityChecks": [
    {
      "checkType": "string",
      "passed": true,
      "notes": "string"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "taskId": "string",
  "status": "Completed",  // Defined|Ready|Assigned|Executing|Completed|Failed|Cancelled
  "durationVariance": -5,
  "readyTasks": ["task4", "task5"]
}
```

---

## 6. Schedule Snapshot API

### 6.1 Get Schedule Snapshot
- **Method:** `GET`
- **Path:** `/api/v1/schedule/snapshot`
- **Query params:** `timeRange` (ISO-8601 date range, e.g., `2025-01-20/2025-02-03`)
- **Description:** Get complete snapshot of schedule data for client-side validation cache.

**Response (200 OK):**
```json
{
  "assignments": [
    {
      "id": "string",
      "taskId": "string",
      "operatorId": "string | null",
      "equipmentId": "string | null",
      "scheduledStart": "ISO-8601-datetime",
      "scheduledEnd": "ISO-8601-datetime"
    }
  ],
  "operators": [
    {
      "id": "string",
      "name": "string",
      "status": "Active",  // Active|Inactive|Deactivated
      "availability": [
        { "start": "ISO-8601-datetime", "end": "ISO-8601-datetime" }
      ],
      "skills": [
        { "equipmentId": "string", "level": "intermediate" }  // beginner|intermediate|expert
      ]
    }
  ],
  "equipment": [
    {
      "id": "string",
      "name": "string",
      "status": "Available",  // Available|InUse|Maintenance|OutOfService
      "supportedTaskTypes": ["CNC", "Milling"],
      "location": "string",
      "maintenanceWindows": [
        { "start": "ISO-8601-datetime", "end": "ISO-8601-datetime" }
      ]
    }
  ],
  "tasks": [
    {
      "id": "string",
      "jobId": "string",
      "type": "CNC",
      "duration": 120,  // minutes
      "requiresOperator": true,
      "requiresEquipment": true,
      "dependencies": ["task1", "task2"],
      "status": "Ready"  // Defined|Ready|Assigned|Executing|Completed|Failed|Cancelled
    }
  ],
  "jobs": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "deadline": "ISO-8601-datetime",
      "status": "Planned"  // Draft|Planned|InProgress|Delayed|Completed|Cancelled
    }
  ],
  "snapshotVersion": 12345,
  "generatedAt": "ISO-8601-timestamp"
}
```

**Notes:**
- This endpoint is used by the frontend for client-side validation caching
- Expected response size: 50-200KB for typical deployments (<100 operators, <500 tasks)
- Cache TTL recommendation: 30-60 seconds
- The `snapshotVersion` can be used for optimistic locking / conflict detection

---

## 7. Reporting API

### 7.1 Get Schedule Gantt Data
- **Method:** `GET`
- **Path:** `/api/v1/reports/gantt`
- **Query params:** `startDate`, `endDate`, `jobIds[]`
- **Description:** Get data for Gantt chart visualization.

**Response (200 OK):**
```json
{
  "jobs": [
    {
      "jobId": "string",
      "name": "string",
      "deadline": "ISO-8601-datetime",
      "tasks": [
        {
          "taskId": "string",
          "name": "string",
          "start": "ISO-8601-datetime",
          "end": "ISO-8601-datetime",
          "dependencies": ["task1"],
          "criticalPath": true,
          "assignedOperator": "string",
          "assignedEquipment": "string"
        }
      ]
    }
  ],
  "generatedAt": "ISO-8601-timestamp"
}
```

---

### 7.2 Get Resource Utilization
- **Method:** `GET`
- **Path:** `/api/v1/reports/utilization`
- **Query params:** `startDate`, `endDate`, `resourceType`
- **Description:** Get resource utilization metrics.

**Response (200 OK):**
```json
{
  "period": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD"
  },
  "operators": [
    {
      "operatorId": "string",
      "name": "string",
      "totalAvailableHours": 160,
      "scheduledHours": 120,
      "utilizationPercent": 75,
      "overtimeHours": 0
    }
  ],
  "equipment": [
    {
      "equipmentId": "string",
      "name": "string",
      "totalAvailableHours": 168,
      "scheduledHours": 140,
      "utilizationPercent": 83.3,
      "maintenanceHours": 8
    }
  ]
}
```

---

## Common Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": [
      {
        "field": "scheduledStart",
        "issue": "Must be in the future"
      }
    ],
    "timestamp": "ISO-8601-timestamp",
    "traceId": "uuid-for-debugging"
  }
}
```

---

## Pagination

List endpoints support standard pagination:

**Query parameters:**
- `page` (default: 1)
- `pageSize` (default: 20, max: 100)
- `sortBy` (field name)
- `sortOrder` (asc|desc)

**Response includes:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 150,
    "totalPages": 8
  }
}
```

---

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <token>
```

Token payload should include:
- User ID
- Roles/permissions
- Expiration time

---

## Webhooks

The system can send webhooks for major events:

**Event types:**
- `task.assigned`
- `task.started`
- `task.completed`
- `schedule.conflict`
- `job.delayed`

**Webhook payload:**
```json
{
  "eventType": "task.assigned",
  "timestamp": "ISO-8601-timestamp",
  "data": {
    "taskId": "string",
    "operatorId": "string",
    "equipmentId": "string"
  }
}
```

---

This document serves as a starting point for API implementation and should be refined based on specific technical requirements and constraints.
