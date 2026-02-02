# Milestone 5: Backend API Integration - Detailed Plan

> **Status:** Draft
>
> **Last Updated:** 2026-02-01

---

## Overview

Milestone 5 connects the React frontend to the PHP backend API. The backend API is already fully implemented (M0-M2), so this milestone focuses on:

1. Replacing mock/fixture data with real API calls
2. Error handling and loading states
3. Optimistic updates for better UX
4. E2E testing with real backend

---

## Prerequisites (M4)

Before M5 can begin, these M4 releases must be complete:

- [ ] **v0.4.36** - API Contract Documentation (TypeScript types matching backend DTOs)
- [ ] **v0.4.37** - Redux Store & RTK Query Setup (with mock adapter)
- [ ] **v0.4.38** - React Router Setup
- [ ] **v0.4.39** - SonarQube Integration

---

## Backend API Inventory

### Already Implemented

| Controller | Endpoint | Method | Description |
|------------|----------|--------|-------------|
| **Schedule** | `/api/v1/schedule/snapshot` | GET | Full snapshot (jobs, tasks, assignments, stations) |
| **Job** | `/api/v1/jobs` | POST | Create job (with JCF elements) |
| | `/api/v1/jobs` | GET | List jobs (pagination, filters) |
| | `/api/v1/jobs/{id}` | GET | Get single job |
| | `/api/v1/jobs/{id}` | PUT | Update job |
| | `/api/v1/jobs/{id}` | DELETE | Delete job |
| | `/api/v1/jobs/{id}/cancel` | POST | Cancel job (cascade to tasks) |
| | `/api/v1/jobs/clients` | GET | Client name autocomplete |
| | `/api/v1/jobs/lookup-by-reference` | GET | Lookup client by reference |
| | `/api/v1/jobs/{id}/dependencies` | GET/POST/DELETE | Job dependencies |
| | `/api/v1/jobs/{id}/comments` | GET/POST | Job comments |
| **Task** | `/api/v1/tasks/{id}/assign` | POST | Assign task to station/provider |
| | `/api/v1/tasks/{id}/assign` | DELETE | Unassign (recall) task |
| | `/api/v1/tasks/{id}/assign` | PUT | Reschedule task |
| | `/api/v1/tasks/{id}/completion` | PUT | Toggle completion |
| **Station** | `/api/v1/stations` | CRUD | Station management |
| **Provider** | `/api/v1/providers` | CRUD | Provider management |
| **Calendar** | `/api/v1/calendar/*` | Various | Calendar/schedule operations |

### Frontend → Backend Mapping

| Frontend Feature | Current Mock | Backend Endpoint |
|------------------|--------------|------------------|
| Initial data load | `getSnapshot()` | `GET /api/v1/schedule/snapshot` |
| Drag task to schedule | `createAssignment()` | `POST /api/v1/tasks/{id}/assign` |
| Move scheduled task | `updateAssignment()` | `PUT /api/v1/tasks/{id}/assign` |
| Recall task | `deleteAssignment()` | `DELETE /api/v1/tasks/{id}/assign` |
| Toggle completion | `toggleCompletion()` | `PUT /api/v1/tasks/{id}/completion` |
| JCF: Save new job | (not implemented) | `POST /api/v1/jobs` |
| JCF: Client autocomplete | hardcoded | `GET /api/v1/jobs/clients` |
| JCF: Reference lookup | (not implemented) | `GET /api/v1/jobs/lookup-by-reference` |

---

## Phase 5A: Core API Integration

### v0.5.0 - API Client Configuration

**Goal:** Configure RTK Query to call real backend instead of mocks.

**Tasks:**
- [ ] Environment-based API URL configuration (`VITE_API_URL`)
- [ ] Base query setup with proper headers (Content-Type, Accept)
- [ ] CORS configuration verification
- [ ] Error response normalization
- [ ] Request/response logging in development

**Files:**
- `apps/web/src/store/api/baseApi.ts`
- `apps/web/.env.development`
- `apps/web/.env.production`

**Testing:**
- [ ] API client can reach backend
- [ ] Error responses are normalized
- [ ] Environment switching works

---

### v0.5.1 - Snapshot Loading

**Goal:** Replace mock `getSnapshot()` with real API call.

**Tasks:**
- [ ] Update `scheduleApi.getSnapshot` to use real endpoint
- [ ] Handle loading state (show skeleton or spinner)
- [ ] Handle error state (show error message with retry)
- [ ] Verify data structure matches frontend expectations
- [ ] Remove or flag mock fallback for development

**RTK Query:**
```typescript
getSnapshot: builder.query<ScheduleSnapshot, void>({
  query: () => '/schedule/snapshot',
  providesTags: ['Snapshot'],
}),
```

**Testing:**
- [ ] App loads with real data
- [ ] Loading spinner shows during fetch
- [ ] Error message shows on failure
- [ ] Retry button works

---

### v0.5.2 - Assignment Operations

**Goal:** Connect drag-drop scheduling to real API.

**Endpoints:**
- `POST /api/v1/tasks/{taskId}/assign`
- `PUT /api/v1/tasks/{taskId}/assign`
- `DELETE /api/v1/tasks/{taskId}/assign`

**Tasks:**
- [ ] `createAssignment` mutation
- [ ] `rescheduleAssignment` mutation
- [ ] `unassignTask` mutation
- [ ] Handle 409 Conflict (validation errors)
- [ ] Display validation error messages (French)
- [ ] Handle `suggestedStart` from backend
- [ ] Invalidate snapshot cache on success

**Error Handling:**
```typescript
// 409 Conflict response structure
{
  error: 'ValidationFailed',
  message: 'Scheduling conflict',
  conflicts: [
    { type: 'StationConflict', message: '...', taskId, relatedTaskId }
  ],
  suggestedStart: '2025-01-15T10:00:00+00:00'
}
```

**Testing:**
- [ ] Drag task creates assignment via API
- [ ] Move task updates assignment via API
- [ ] Right-click recall deletes assignment via API
- [ ] Validation errors display correctly
- [ ] Alt-key bypass precedence works

---

### v0.5.3 - Completion Toggle

**Goal:** Connect completion checkbox to real API.

**Endpoint:** `PUT /api/v1/tasks/{taskId}/completion`

**Tasks:**
- [ ] `toggleCompletion` mutation
- [ ] Optimistic update (immediate UI feedback)
- [ ] Rollback on error
- [ ] Invalidate snapshot cache

**Testing:**
- [ ] Checkbox toggle calls API
- [ ] UI updates immediately (optimistic)
- [ ] Error rolls back checkbox state

---

## Phase 5B: JCF API Integration

### v0.5.4 - Job Creation via API

**Goal:** JCF form saves jobs to real backend.

**Endpoint:** `POST /api/v1/jobs`

**Request Body:**
```json
{
  "reference": "JOB-001",
  "client": "Acme Corp",
  "description": "Flyers 5000pcs",
  "workshopExitDate": "2025-02-01",
  "elements": [
    {
      "name": "element_1",
      "label": "Flyer A5",
      "sequence": "[Offset] 30 | [Massicot] 15",
      "prerequisiteNames": []
    }
  ]
}
```

**Tasks:**
- [ ] Map JCF form state to `CreateJobRequest` DTO
- [ ] `createJob` mutation
- [ ] Handle DSL validation errors from backend
- [ ] Display validation errors inline
- [ ] On success: close modal, invalidate snapshot, select new job
- [ ] Handle network errors

**Testing:**
- [ ] Form submission creates job via API
- [ ] Validation errors display correctly
- [ ] Success closes modal and shows new job
- [ ] Elements with sequences create tasks

---

### v0.5.5 - Client Autocomplete via API

**Goal:** JCF client field autocomplete uses real data.

**Endpoint:** `GET /api/v1/jobs/clients?q={prefix}`

**Tasks:**
- [ ] `getClientSuggestions` query with debounce
- [ ] Replace hardcoded client list
- [ ] Handle empty results
- [ ] Cache results for performance

**Testing:**
- [ ] Typing in client field fetches suggestions
- [ ] Suggestions appear in dropdown
- [ ] Selecting suggestion fills field

---

### v0.5.6 - Reference Lookup via API

**Goal:** Entering job reference auto-fills client name.

**Endpoint:** `GET /api/v1/jobs/lookup-by-reference?ref={reference}`

**Tasks:**
- [ ] `lookupByReference` query
- [ ] On reference blur, lookup client
- [ ] Auto-fill client field if found
- [ ] Handle 404 (no existing job with reference)

**Testing:**
- [ ] Entering existing reference fills client
- [ ] New reference leaves client empty
- [ ] Works with copy-paste

---

## Phase 5C: Error Handling & UX

### v0.5.7 - Global Error Handling

**Goal:** Consistent error handling across all API calls.

**Tasks:**
- [ ] Error boundary for API errors
- [ ] Toast notifications for transient errors
- [ ] Inline error messages for form validation
- [ ] Network error detection and retry UI
- [ ] 503 Service Unavailable handling

**Error Types:**

| HTTP Status | Error Type | UI Treatment |
|-------------|------------|--------------|
| 400 | Validation | Inline field errors |
| 404 | Not Found | Toast + redirect |
| 409 | Conflict | Modal with details |
| 500 | Server Error | Toast with retry |
| 503 | Unavailable | Banner with auto-retry |
| Network | Connection | Offline indicator |

**Testing:**
- [ ] Each error type displays correctly
- [ ] Retry logic works
- [ ] User can recover from errors

---

### v0.5.8 - Optimistic Updates

**Goal:** Immediate UI feedback for common operations.

**Operations:**
- [ ] Assignment creation (show tile immediately)
- [ ] Assignment move (update position immediately)
- [ ] Completion toggle (update checkbox immediately)
- [ ] Rollback on error

**Implementation:**
```typescript
createAssignment: builder.mutation({
  // ...
  onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
    // Optimistic update
    const patch = dispatch(
      scheduleApi.util.updateQueryData('getSnapshot', undefined, (draft) => {
        // Add assignment to draft
      })
    );
    try {
      await queryFulfilled;
    } catch {
      patch.undo(); // Rollback
    }
  },
}),
```

**Testing:**
- [ ] UI updates before API response
- [ ] Failed operations roll back
- [ ] No visual glitches

---

## Phase 5D: Testing & Verification

### v0.5.9 - E2E Tests with Real Backend

**Goal:** E2E tests run against actual PHP API.

**Tasks:**
- [ ] Docker Compose setup for E2E (PHP + PostgreSQL + Frontend)
- [ ] Test database seeding
- [ ] Playwright configuration for API mode
- [ ] Convert key E2E tests to use real backend
- [ ] CI pipeline integration

**Test Scenarios:**
- [ ] Full job creation flow (JCF → API → Grid display)
- [ ] Assignment CRUD cycle
- [ ] Validation error handling
- [ ] Concurrent modification detection

**Files:**
- `docker-compose.e2e.yml`
- `apps/web/playwright/e2e-api/`
- `.github/workflows/e2e-api.yml`

---

### v0.5.10 - Performance Verification

**Goal:** Verify acceptable performance with real API.

**Metrics:**
- [ ] Snapshot load time < 2s
- [ ] Assignment operation < 500ms
- [ ] No UI jank during API calls
- [ ] Memory usage stable over time

**Tasks:**
- [ ] Performance testing with realistic data (100+ jobs, 500+ tasks)
- [ ] Identify and fix bottlenecks
- [ ] Add performance monitoring (optional)

---

## Summary

| Release | Focus | Key Deliverable |
|---------|-------|-----------------|
| v0.5.0 | API Client | Environment config, base query |
| v0.5.1 | Snapshot | Real data loading |
| v0.5.2 | Assignments | Drag-drop → API |
| v0.5.3 | Completion | Checkbox → API |
| v0.5.4 | JCF Create | Form → API |
| v0.5.5 | Client AC | Autocomplete → API |
| v0.5.6 | Ref Lookup | Reference → Client |
| v0.5.7 | Errors | Global error handling |
| v0.5.8 | Optimistic | Immediate UI updates |
| v0.5.9 | E2E | Tests with real backend |
| v0.5.10 | Perf | Performance verification |

**Total: 11 releases** (vs original 4)

---

## Dependencies

```
M4 Prerequisites
├── v0.4.36 API Contract Design
├── v0.4.37 Redux + RTK Query
├── v0.4.38 React Router
└── v0.4.39 SonarQube

M5 Phases
├── Phase 5A: Core (v0.5.0-v0.5.3)
│   └── Requires: v0.4.37 (RTK Query)
├── Phase 5B: JCF (v0.5.4-v0.5.6)
│   └── Requires: v0.5.1 (Snapshot working)
├── Phase 5C: UX (v0.5.7-v0.5.8)
│   └── Requires: v0.5.3 (Core operations working)
└── Phase 5D: Testing (v0.5.9-v0.5.10)
    └── Requires: v0.5.8 (All features complete)
```

---

## Open Questions

1. **Offline support?** - Should the app work offline with cached data?
2. **Real-time updates?** - WebSocket for multi-user awareness? (Currently Post-MVP)
3. **Data seeding** - How to populate test database for E2E?
4. **Staging environment** - Separate staging backend for testing?

---

## Next Steps

1. Review and approve this plan
2. Update `release-roadmap.md` with new M5 structure
3. Create individual release documents for v0.5.0-v0.5.10
4. Continue with M4 (v0.4.36 API Contract Design)
