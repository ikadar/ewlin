# RTK Query Endpoint Design

> **Version:** 1.0
>
> **Created:** 2026-02-02
>
> **Related Release:** v0.4.36 (API Contract Design), v0.4.37 (RTK Query Implementation)

---

## Overview

This document defines the RTK Query API slice structure for the Flux Scheduler frontend. The design uses a mock adapter pattern in M4 (v0.4.37), which will be replaced with real API calls in M5.

---

## API Slice Structure

```typescript
// apps/web/src/store/api/scheduleApi.ts

import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  ScheduleSnapshot,
  CreateJobRequest,
  AssignTaskRequest,
  AssignmentResponse,
  CompletionResponse,
  UnassignmentResponse,
  ClientSuggestionsResponse,
  ReferenceLookupResponse,
} from '@flux/types';

export const scheduleApi = createApi({
  reducerPath: 'scheduleApi',
  baseQuery: fakeBaseQuery(), // M4: mock adapter, M5: fetchBaseQuery
  tagTypes: ['Snapshot', 'ClientSuggestions'],

  endpoints: (builder) => ({
    // Queries
    getSnapshot: builder.query<ScheduleSnapshot, void>({ ... }),
    getClientSuggestions: builder.query<ClientSuggestionsResponse, string>({ ... }),
    lookupByReference: builder.query<ReferenceLookupResponse, string>({ ... }),

    // Mutations
    createJob: builder.mutation<void, CreateJobRequest>({ ... }),
    assignTask: builder.mutation<AssignmentResponse, { taskId: string; body: AssignTaskRequest }>({ ... }),
    rescheduleTask: builder.mutation<AssignmentResponse, { taskId: string; body: AssignTaskRequest }>({ ... }),
    unassignTask: builder.mutation<UnassignmentResponse, string>({ ... }),
    toggleCompletion: builder.mutation<CompletionResponse, string>({ ... }),
  }),
});

export const {
  useGetSnapshotQuery,
  useGetClientSuggestionsQuery,
  useLookupByReferenceQuery,
  useCreateJobMutation,
  useAssignTaskMutation,
  useRescheduleTaskMutation,
  useUnassignTaskMutation,
  useToggleCompletionMutation,
} = scheduleApi;
```

---

## Endpoint Specifications

### Queries

#### getSnapshot

Fetches the complete schedule snapshot for rendering the scheduling grid.

| Property | Value |
|----------|-------|
| **Hook** | `useGetSnapshotQuery()` |
| **Args** | `void` |
| **Returns** | `ScheduleSnapshot` |
| **Tags** | `providesTags: ['Snapshot']` |
| **Backend** | `GET /api/v1/schedule/snapshot` |

**M4 Implementation (Mock Adapter):**
```typescript
getSnapshot: builder.query<ScheduleSnapshot, void>({
  queryFn: () => {
    const snapshot = getSnapshot(); // from mock/snapshot.ts
    return { data: snapshot };
  },
  providesTags: ['Snapshot'],
}),
```

**M5 Implementation (Real API):**
```typescript
getSnapshot: builder.query<ScheduleSnapshot, void>({
  query: () => '/schedule/snapshot',
  providesTags: ['Snapshot'],
}),
```

---

#### getClientSuggestions

Fetches client name suggestions for autocomplete.

| Property | Value |
|----------|-------|
| **Hook** | `useGetClientSuggestionsQuery(prefix)` |
| **Args** | `string` (search prefix) |
| **Returns** | `string[]` |
| **Tags** | `providesTags: ['ClientSuggestions']` |
| **Backend** | `GET /api/v1/jobs/clients?q={prefix}` |

**Request Example:**
```
GET /api/v1/jobs/clients?q=Dup
```

**Response Example:**
```json
["Dupont", "Dupuis", "Durand"]
```

---

#### lookupByReference

Looks up client name by job reference (for auto-fill).

| Property | Value |
|----------|-------|
| **Hook** | `useLookupByReferenceQuery(reference)` |
| **Args** | `string` (job reference) |
| **Returns** | `{ client: string | null }` |
| **Backend** | `GET /api/v1/jobs/lookup-by-reference?ref={reference}` |

**Request Example:**
```
GET /api/v1/jobs/lookup-by-reference?ref=JOB-001
```

**Response Example (found):**
```json
{ "client": "Acme Corp" }
```

**Response Example (not found):**
```json
{ "client": null }
```

---

### Mutations

#### createJob

Creates a new job from JCF form data.

| Property | Value |
|----------|-------|
| **Hook** | `useCreateJobMutation()` |
| **Args** | `CreateJobRequest` |
| **Returns** | `void` (or `JobResponse` if needed) |
| **Invalidates** | `invalidatesTags: ['Snapshot']` |
| **Backend** | `POST /api/v1/jobs` |

**Request Example:**
```json
{
  "reference": "JOB-2024-001",
  "client": "Acme Corp",
  "description": "Flyers A5 5000pcs",
  "workshopExitDate": "2024-02-15",
  "status": "draft",
  "elements": [
    {
      "name": "INT",
      "label": "A5 | Couche 135g | Q/Q",
      "sequence": "[Offset] 30+45 | [Massicot] 15",
      "prerequisiteNames": []
    },
    {
      "name": "COUV",
      "label": "A5 | Couche 300g | 4+0",
      "sequence": "[Offset] 20+30 | [Pelliculage] 1JO",
      "prerequisiteNames": ["INT"]
    }
  ]
}
```

**Error Response (400 - DSL Validation):**
```json
{
  "error": "DslValidationError",
  "message": "Invalid DSL syntax",
  "errors": [
    { "line": 1, "message": "Unknown station: [Offse]" }
  ]
}
```

---

#### assignTask

Assigns a task to a station or provider.

| Property | Value |
|----------|-------|
| **Hook** | `useAssignTaskMutation()` |
| **Args** | `{ taskId: string; body: AssignTaskRequest }` |
| **Returns** | `AssignmentResponse` |
| **Invalidates** | `invalidatesTags: ['Snapshot']` |
| **Backend** | `POST /api/v1/tasks/{taskId}/assign` |

**Request Example:**
```json
{
  "targetId": "550e8400-e29b-41d4-a716-446655440000",
  "scheduledStart": "2024-02-10T08:00:00+01:00",
  "bypassPrecedence": false
}
```

**Success Response (201):**
```json
{
  "taskId": "task-uuid-123",
  "targetId": "station-uuid-456",
  "isOutsourced": false,
  "scheduledStart": "2024-02-10T08:00:00+01:00",
  "scheduledEnd": "2024-02-10T09:15:00+01:00",
  "isCompleted": false,
  "completedAt": null
}
```

**Error Response (409 - Validation Conflict):**
```json
{
  "error": "ValidationFailed",
  "message": "Assignment violates scheduling rules",
  "conflicts": [
    {
      "type": "PrecedenceConflict",
      "message": "Task must start after predecessor completes",
      "taskId": "task-uuid-123",
      "relatedTaskId": "task-uuid-100",
      "targetId": null,
      "details": null
    }
  ],
  "suggestedStart": "2024-02-10T10:00:00+01:00"
}
```

---

#### rescheduleTask

Reschedules an existing task assignment.

| Property | Value |
|----------|-------|
| **Hook** | `useRescheduleTaskMutation()` |
| **Args** | `{ taskId: string; body: AssignTaskRequest }` |
| **Returns** | `AssignmentResponse` |
| **Invalidates** | `invalidatesTags: ['Snapshot']` |
| **Backend** | `PUT /api/v1/tasks/{taskId}/assign` |

Same request/response format as `assignTask`.

---

#### unassignTask

Removes a task assignment (recall).

| Property | Value |
|----------|-------|
| **Hook** | `useUnassignTaskMutation()` |
| **Args** | `string` (taskId) |
| **Returns** | `UnassignmentResponse` |
| **Invalidates** | `invalidatesTags: ['Snapshot']` |
| **Backend** | `DELETE /api/v1/tasks/{taskId}/assign` |

**Success Response (200):**
```json
{
  "taskId": "task-uuid-123",
  "status": "ready",
  "message": "Task unassigned successfully"
}
```

---

#### toggleCompletion

Toggles the completion status of an assigned task.

| Property | Value |
|----------|-------|
| **Hook** | `useToggleCompletionMutation()` |
| **Args** | `string` (taskId) |
| **Returns** | `CompletionResponse` |
| **Invalidates** | `invalidatesTags: ['Snapshot']` |
| **Backend** | `PUT /api/v1/tasks/{taskId}/completion` |

**Success Response (200):**
```json
{
  "taskId": "task-uuid-123",
  "isCompleted": true,
  "completedAt": "2024-02-10T14:30:00+01:00"
}
```

---

## Cache Invalidation Strategy

### Tag-Based Invalidation

| Mutation | Invalidates | Reason |
|----------|-------------|--------|
| `createJob` | `['Snapshot']` | New job appears in snapshot |
| `assignTask` | `['Snapshot']` | Assignment added |
| `rescheduleTask` | `['Snapshot']` | Assignment updated |
| `unassignTask` | `['Snapshot']` | Assignment removed |
| `toggleCompletion` | `['Snapshot']` | Assignment state changed |

### Current Strategy (MVP)

All mutations invalidate the entire `Snapshot` tag, triggering a full refetch. This is simple but not optimal for large datasets.

### Future Optimization

For better performance, use granular tags:

```typescript
// Granular tags (post-MVP)
providesTags: (result) => [
  'Snapshot',
  ...result.jobs.map(job => ({ type: 'Job', id: job.id })),
  ...result.assignments.map(a => ({ type: 'Assignment', id: a.taskId })),
],

// Granular invalidation
invalidatesTags: (result, error, { taskId }) => [
  { type: 'Assignment', id: taskId },
],
```

---

## Error Handling

### HTTP Status → Error Type → UI Treatment

| HTTP Status | Error Type | UI Treatment |
|-------------|------------|--------------|
| 400 | `InvalidRequest` | Inline field errors, toast |
| 404 | `NotFound` | Toast notification |
| 409 | `ValidationFailed` | Modal with conflict details |
| 500 | Server Error | Toast with retry option |
| 503 | `ServiceUnavailable` | Banner with auto-retry |
| Network Error | Connection | Offline indicator |

### Error Type Guards

```typescript
import {
  isValidationError,
  isNotFoundError
} from '@flux/types';

// In component
const [assignTask, { error }] = useAssignTaskMutation();

if (error && 'data' in error) {
  const apiError = error.data as ApiErrorResponse;

  if (isValidationError(apiError)) {
    // Show conflict modal with apiError.conflicts
    // Offer suggestedStart if available
  } else if (isNotFoundError(apiError)) {
    // Show "Task not found" toast
  }
}
```

---

## Migration Path (M4 → M5)

### M4 (v0.4.37): Mock Adapter

```typescript
export const scheduleApi = createApi({
  reducerPath: 'scheduleApi',
  baseQuery: fakeBaseQuery(),
  // ...
  endpoints: (builder) => ({
    getSnapshot: builder.query<ScheduleSnapshot, void>({
      queryFn: () => {
        const snapshot = getSnapshot(); // mock function
        return { data: snapshot };
      },
      // ...
    }),
  }),
});
```

### M5 (v0.5.0+): Real API

```typescript
export const scheduleApi = createApi({
  reducerPath: 'scheduleApi',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || '/api/v1',
    prepareHeaders: (headers) => {
      headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'application/json');
      return headers;
    },
  }),
  // ...
  endpoints: (builder) => ({
    getSnapshot: builder.query<ScheduleSnapshot, void>({
      query: () => '/schedule/snapshot',
      // ...
    }),
  }),
});
```

The only change is:
1. Replace `fakeBaseQuery()` with `fetchBaseQuery()`
2. Replace `queryFn` with `query` in each endpoint

---

## Component Usage Examples

### Loading Snapshot

```typescript
function SchedulerGrid() {
  const { data: snapshot, isLoading, error } = useGetSnapshotQuery();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <Grid snapshot={snapshot} />;
}
```

### Creating Assignment

```typescript
function useDropHandler() {
  const [assignTask, { isLoading }] = useAssignTaskMutation();

  const handleDrop = async (taskId: string, targetId: string, startTime: Date) => {
    try {
      await assignTask({
        taskId,
        body: {
          targetId,
          scheduledStart: startTime.toISOString(),
          bypassPrecedence: isAltPressed,
        },
      }).unwrap();
    } catch (error) {
      // Handle validation errors
    }
  };

  return { handleDrop, isLoading };
}
```

### Toggling Completion

```typescript
function TaskTile({ taskId, isCompleted }: Props) {
  const [toggleCompletion] = useToggleCompletionMutation();

  const handleToggle = () => {
    toggleCompletion(taskId);
  };

  return (
    <Checkbox
      checked={isCompleted}
      onChange={handleToggle}
    />
  );
}
```

---

## References

- [RTK Query Documentation](https://redux-toolkit.js.org/rtk-query/overview)
- [Backend API Controllers](../../services/php-api/src/Controller/Api/V1/)
- [API Types](../../packages/types/src/api.ts)
- [Release v0.4.36](../releases/v0.4.36-api-contract-design.md)
- [Release v0.4.37](../releases/v0.4.37-redux-rtk-query-setup.md)
- [Milestone 5 Plan](../roadmap/milestone-5-plan.md)
