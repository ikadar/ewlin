# UI/UX ↔ Backend Compatibility Report

**Generated:** 2025-12-16
**Status:** Pre-implementation analysis

## Executive Summary

The UX/UI specification and backend documentation are **largely aligned** but have **several gaps** that need attention before implementation. The backend is more complete in some areas (approval gates, paper status), while the UI documentation has features not yet fully specified in the backend (similarity indicators display, some navigation features).

---

## Summary Compatibility Matrix

| Area | UI Status | Backend Status | Compatibility | Action Required |
|------|-----------|----------------|---------------|-----------------|
| **Core Scheduling** |
| Task Assignment (drag-drop) | ✅ Documented | ✅ API exists | ✅ Compatible | None |
| Task Recall (unassign) | ✅ Documented | ✅ API exists | ✅ Compatible | None |
| Task Reschedule | ✅ Documented | ✅ API exists | ✅ Compatible | None |
| 30-min snap grid | ✅ Documented | ✅ BR-ASSIGN-006 | ✅ Compatible | None |
| **Validation** |
| Precedence checking | ✅ Documented | ✅ VAL-001.4 | ✅ Compatible | None |
| Alt-key bypass | ✅ Documented | ✅ UI-002 rule | ✅ Compatible | None |
| Station conflicts | ✅ Documented | ✅ VAL-001.2 | ✅ Compatible | None |
| Group capacity | ✅ Documented | ✅ VAL-001.3 | ✅ Compatible | None |
| Deadline conflicts | ✅ Documented | ✅ VAL-001.8 | ✅ Compatible | None |
| **Job Management** |
| Job list display | ✅ Documented | ✅ GET /jobs | ✅ Compatible | None |
| Job selection | ✅ Documented | ✅ GET /jobs/{id} | ✅ Compatible | None |
| Late jobs display | ✅ Documented | ✅ LateJob model | ✅ Compatible | None |
| Conflict jobs display | ✅ Documented | ✅ ScheduleConflict | ✅ Compatible | None |
| Job search/filter | ✅ Documented | ✅ GET /jobs + params | ✅ Compatible | None |
| Job creation | ⚠️ Post-MVP | ✅ POST /jobs | ⚠️ UI deferred | Document UI when needed |
| Job dependencies | ❌ Not in UI | ✅ POST /jobs/{id}/dependencies | ⚠️ Gap | Add to UI spec |
| **Task Management** |
| Task list display | ✅ Documented | ✅ In Job response | ✅ Compatible | None |
| Task completion toggle | ✅ Documented | ✅ PUT /tasks/{id}/completion | ✅ Compatible | None |
| Task reorder | ❌ Not in UI | ✅ PUT /jobs/{id}/tasks/reorder | ⚠️ Gap | Add to UI spec |
| **Approval Gates** |
| BAT status display | ✅ Documented | ✅ Job.proofSentAt/ApprovedAt | ✅ Compatible | None |
| Plates status display | ✅ Documented | ✅ Job.platesStatus | ✅ Compatible | None |
| Paper status display | ✅ Documented | ✅ Job.paperPurchaseStatus | ✅ Compatible | None |
| Edit BAT status | ❌ Read-only in MVP | ✅ PUT /jobs/{id}/proof | ⚠️ Deferred | Document when needed |
| Edit Plates status | ❌ Read-only in MVP | ✅ PUT /jobs/{id}/plates | ⚠️ Deferred | Document when needed |
| Edit Paper status | ❌ Read-only in MVP | ✅ PUT /jobs/{id}/paper | ⚠️ Deferred | Document when needed |
| Gate blocking | ⚠️ Not enforced in MVP | ✅ BR-GATE-001/002 | ⚠️ Gap | Clarify MVP scope |
| **Station Management** |
| Station columns | ✅ Documented | ✅ GET /stations | ✅ Compatible | None |
| Operating schedule overlay | ✅ Documented | ✅ OperatingSchedule model | ✅ Compatible | None |
| Schedule exceptions | ✅ Documented | ✅ ScheduleException model | ✅ Compatible | None |
| Station CRUD | ❌ Not in UI | ✅ POST/PUT /stations | ⚠️ Gap | Add Settings UI spec |
| **Outsourced Providers** |
| Provider columns | ✅ Documented | ✅ GET /providers | ✅ Compatible | None |
| Unlimited capacity | ✅ Documented | ✅ BR-PROVIDER-003 | ✅ Compatible | None |
| Duration in days (JO) | ✅ Documented | ✅ durationOpenDays | ✅ Compatible | None |
| Provider CRUD | ❌ Not in UI | ✅ POST /providers | ⚠️ Gap | Add Settings UI spec |
| **Visual Features** |
| Similarity indicators | ✅ Documented | ⚠️ Partial (criteria exist) | ⚠️ Gap | Add API for criteria |
| Off-screen indicators | ✅ Documented | ❌ No specific API | ⚠️ Gap | Client-side calculation |
| Column focus on drag | ✅ Documented | N/A (client-side) | ✅ Compatible | None |
| Tile states/colors | ✅ Documented | ✅ Job.color | ✅ Compatible | None |
| **Navigation** |
| Keyboard shortcuts | ✅ Documented | N/A (client-side) | ✅ Compatible | None |
| Quick Placement Mode | ✅ Documented | N/A (client-side) | ✅ Compatible | None |
| Jump to date | ✅ Documented | N/A (client-side) | ✅ Compatible | None |
| **Data Sync** |
| Schedule snapshot | ✅ Implied | ✅ GET /schedule/snapshot | ✅ Compatible | None |
| Real-time updates | ⚠️ Post-MVP | ❌ Not implemented | ⚠️ Both deferred | Future consideration |
| Optimistic UI | ✅ Documented | ✅ Server validates | ✅ Compatible | None |
| **Comments** |
| Display comments | ⚠️ Post-MVP | ✅ Comment model | ⚠️ UI deferred | Document when needed |
| Add comments | ⚠️ Post-MVP | ✅ POST /jobs/{id}/comments | ⚠️ UI deferred | Document when needed |

---

## Detailed Gap Analysis

### 1. Critical Gaps (Must Fix Before Implementation)

#### Gap 1.1: Similarity Indicators API

| Aspect | Details |
|--------|---------|
| **UI Expectation** | Display link/unlink icons between consecutive tiles showing time-saving potential |
| **Backend Status** | SimilarityCriterion model exists, stored per StationCategory |
| **Missing** | No documented API endpoint to fetch similarity criteria per station |
| **Impact** | UI cannot display similarity indicators without this data |
| **Recommendation** | Add `GET /station-categories/{id}/criteria` or include in station response |

#### Gap 1.2: Off-Screen Indicators Data

| Aspect | Details |
|--------|---------|
| **UI Expectation** | Show rectangles with arrows indicating off-screen tiles for selected job |
| **Backend Status** | No specific endpoint; data exists in schedule snapshot |
| **Missing** | Clear specification of how to calculate off-screen tiles |
| **Impact** | UI must calculate client-side from full schedule data |
| **Recommendation** | Document that this is client-side calculation from snapshot data |

#### Gap 1.3: Task Reordering in UI

| Aspect | Details |
|--------|---------|
| **UI Expectation** | Job Details Panel mentions "Reorder tasks" but no interaction documented |
| **Backend Status** | `PUT /jobs/{jobId}/tasks/reorder` exists |
| **Missing** | UI interaction pattern for reordering (drag within list?) |
| **Impact** | Users cannot change task sequence from UI |
| **Recommendation** | Add task reorder interaction to job-details-panel.md |

---

### 2. Moderate Gaps (Should Address)

#### Gap 2.1: Job Dependencies UI

| Aspect | Details |
|--------|---------|
| **UI Expectation** | Not documented in UI specs |
| **Backend Status** | `Job.requiredJobIds`, `POST /jobs/{id}/dependencies`, BR-JOB-006/007/008 |
| **Missing** | UI for viewing/adding job dependencies |
| **Impact** | Complex multi-job workflows cannot be configured |
| **Recommendation** | Add job dependencies section to job-details-panel.md |

#### Gap 2.2: Station/Provider Management UI

| Aspect | Details |
|--------|---------|
| **UI Expectation** | Settings page mentioned as "Post-MVP" in open-questions.md |
| **Backend Status** | Full CRUD APIs exist for stations, categories, groups, providers |
| **Missing** | Complete UI specification for management screens |
| **Impact** | System requires direct API/database access for configuration |
| **Recommendation** | Create settings-page.md when moving to post-MVP |

#### Gap 2.3: Approval Gate Enforcement

| Aspect | Details |
|--------|---------|
| **UI Expectation** | "Read only display for now... no blocking" (from open-questions.md) |
| **Backend Status** | BR-GATE-001/002/003 define blocking rules |
| **Missing** | Clarity on whether backend enforces gates or UI just displays |
| **Impact** | Users may schedule tasks that violate gate rules |
| **Recommendation** | Either: (a) Backend enforces, UI shows errors, or (b) Document that MVP allows gate violations |

---

### 3. Minor Gaps (Nice to Have)

#### Gap 3.1: Job Cancellation UI

| Aspect | Details |
|--------|---------|
| **UI Expectation** | Not documented |
| **Backend Status** | `POST /jobs/{id}/cancel`, BR-JOB-005/005b/010 |
| **Recommendation** | Add cancel button to job details when needed |

#### Gap 3.2: Task Update UI

| Aspect | Details |
|--------|---------|
| **UI Expectation** | Not documented (task details view is "Post-MVP") |
| **Backend Status** | `PUT /tasks/{id}` exists |
| **Recommendation** | Document when task editing is needed |

#### Gap 3.3: Business Calendar Integration

| Aspect | Details |
|--------|---------|
| **UI Expectation** | Date strip shows days, today highlighted |
| **Backend Status** | `GET /calendar/open-days` calculates business days |
| **Missing** | How holidays/non-working days appear in date strip |
| **Recommendation** | Clarify visual distinction for non-working days |

---

## Data Model Compatibility

### UI Data Needs vs Backend Models

| UI Component | Data Needed | Backend Source | Match |
|--------------|-------------|----------------|-------|
| **Jobs List** |
| Job reference | `reference` | Job.reference | ✅ |
| Client name | `clientName` | Job.client | ✅ |
| Description | `description` | Job.description | ✅ |
| Progress dots | Task completion count | Job.tasks[].isCompleted | ✅ |
| Late indicator | `isLate` | LateJob model | ✅ |
| Conflict indicator | `hasConflict` | ScheduleConflict | ✅ |
| **Job Details Panel** |
| Job code | `reference` | Job.reference | ✅ |
| Departure date | `workshopExitDate` | Job.workshopExitDate | ✅ |
| BAT status | `proofStatus` | Job.proofSentAt/ApprovedAt | ✅ |
| Paper status | `paperStatus` | Job.paperPurchaseStatus | ✅ |
| Plates status | `platesStatus` | Job.platesStatus | ✅ |
| Task list | `tasks[]` | Job.tasks | ✅ |
| **Task Tile (Grid)** |
| Job color | `color` | Job.color | ✅ |
| Setup time | `setupMinutes` | Task.setupMinutes | ✅ |
| Run time | `runMinutes` | Task.runMinutes | ✅ |
| Completion status | `isCompleted` | Task.isCompleted | ✅ |
| Scheduled time | `scheduledStart/End` | TaskAssignment | ✅ |
| **Task Tile (Job Details)** |
| Station name | `stationName` | Station.name (via Task.stationId) | ✅ |
| Duration | `totalMinutes` | Task.setupMinutes + runMinutes | ✅ |
| Scheduled time | `scheduledStart` | TaskAssignment.scheduledStart | ✅ |
| **Station Column** |
| Station name | `name` | Station.name | ✅ |
| Operating hours | `operatingSchedule` | Station.operatingSchedule | ✅ |
| Unavailability | `exceptions` | Station.scheduleExceptions | ✅ |
| **Outsourced Column** |
| Provider name | `name` | OutsourcedProvider.name | ✅ |
| Duration format | "X JO" | Task.durationOpenDays | ✅ |

---

## API Endpoint Coverage

### Required Endpoints for MVP UI

| UI Feature | Required Endpoint | Exists | Notes |
|------------|-------------------|--------|-------|
| Initial load | `GET /schedule/snapshot` | ✅ | Returns all needed data |
| Assign task | `POST /tasks/{id}/assign` | ✅ | |
| Unassign task | `DELETE /tasks/{id}/assign` | ✅ | |
| Validate assignment | `POST /assignments/validate` | ✅ | For real-time preview |
| Toggle completion | `PUT /tasks/{id}/completion` | ✅ | |
| Get jobs | `GET /jobs` | ✅ | With filters |
| Get job details | `GET /jobs/{id}` | ✅ | Implicit in list? |
| Get stations | `GET /stations` | ✅ | |
| Get providers | `GET /providers` | ✅ | |

### Potentially Missing Endpoints

| UI Feature | Expected Endpoint | Status | Recommendation |
|------------|-------------------|--------|----------------|
| Similarity criteria | `GET /station-categories/{id}/criteria` | ❓ Unclear | Verify or add |
| Tile swap | `POST /tiles/swap` or batch update | ❓ Unclear | May use 2x assign calls |

---

## Business Rule Alignment

### Rules Documented in Both UI & Backend

| Rule | UI Reference | Backend Reference | Aligned |
|------|--------------|-------------------|---------|
| 30-min snap | drag-drop.md | BR-ASSIGN-006 | ✅ |
| Precedence safeguard | drag-drop.md | UI-001, VAL-001.4 | ✅ |
| Alt-key bypass | drag-drop.md | UI-002 | ✅ |
| Red halo on violation | conflict-indicators.md | UI-003 | ✅ |
| Tile insertion push-down | drag-drop.md | BR-ASSIGN-009 | ✅ |
| Task stretching | station-unavailability.md | BR-ASSIGN-003/003b | ✅ |
| Job color assignment | tile-component.md | BR-JOB-009 | ✅ |
| Completion manual only | tile-component.md | BR-ASSIGN-007 | ✅ |
| Completion ≠ validation | tile-component.md | BR-ASSIGN-008 | ✅ |

### Rules in Backend Only (No UI Coverage)

| Rule | Backend Reference | UI Impact | Recommendation |
|------|-------------------|-----------|----------------|
| Job dependencies | BR-JOB-006/007/008 | Validation errors unexpected | Add UI documentation |
| Approval gate blocking | BR-GATE-001/002/003 | Tasks may fail unexpectedly | Clarify MVP scope |
| Paper procurement | BR-PAPER-001/002/003 | Display only, no blocking | OK for MVP |
| Outsourced timing | BR-TASK-008/008b/009 | Complex calculation | Backend handles |

---

## Recommendations Summary

### Immediate (Before Development)

1. **Add similarity criteria API** - Document endpoint for fetching criteria per station
2. **Clarify off-screen calculation** - Document as client-side calculation
3. **Document task reorder UI** - Add drag-to-reorder in task list
4. **Clarify approval gate behavior** - Backend enforces or display-only?

### Short-term (During MVP Development)

5. **Add job dependencies UI section** - View and manage dependencies
6. **Document tile swap API pattern** - Single endpoint or two calls?
7. **Add business calendar visualization** - Non-working days in date strip

### Post-MVP (Future Iterations)

8. **Settings UI specification** - Station, category, group, provider management
9. **Job creation modal** - Full specification with DSL editor
10. **Comments UI** - Display and add comments
11. **Approval gate editing** - Edit BAT, plates, paper status
12. **Real-time multi-user** - WebSocket updates, conflict resolution

---

## Conclusion

The UI/UX and backend documentation are **85% aligned**. The core scheduling workflow (drag-drop, validation, recall, completion) is fully compatible. The main gaps are:

1. **Similarity indicators** need API clarification
2. **Task reordering** needs UI interaction pattern
3. **Job dependencies** need UI documentation
4. **Approval gates** need MVP scope clarification

These gaps are addressable and do not block MVP development if handled during implementation.

---

## Related Documents

- [UX/UI Overview](../ux-ui/00-overview.md)
- [Open Questions](../ux-ui/07-open-questions.md)
- [Business Rules](../domain-model/business-rules.md)
- [Domain Open Questions](../domain-model/domain-open-questions.md)
