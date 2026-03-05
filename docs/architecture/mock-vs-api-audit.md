# Mock vs API Behavioral Audit

> **Date:** 2026-02-17
> **Last updated:** 2026-02-17
> **Purpose:** Identify all business logic divergences between mock mode (`mockBaseQuery.ts`) and API mode (PHP backend) to ensure consistent behavior.

## Principle

The mock implementation is the **reference implementation** (manually tested and verified). The PHP API must produce identical behavior for all mutation endpoints.

## Endpoints Audited

### 1. POST /tasks/:taskId/assign — Assign Task

| Aspect | Mock (`handleAssignTask`) | PHP (`AssignmentService::assignTask`) |
|--------|---------------------------|---------------------------------------|
| End time calculation | `calculateEndTime()` JS | `EndTimeCalculator::calculateForInternalTask()` PHP |
| Overlap handling | Push-down: shifts overlapping tiles forward (`applyPushDown()`) | Hybrid: validation service first, then `PushDownService` for `StationConflict` types |
| Outsourced auto-assignment | `autoAssignOutsourcedSuccessors()` | `OutsourcedAutoAssignmentService::autoAssignSuccessors()` |

**Divergence: NONE** — Resolved in PR #16 (outsourced auto-assignment) and PR #17 (hybrid push-down). Both implementations now auto-assign outsourced successors and handle station overlaps via push-down.

---

### 2. PUT /tasks/:taskId/assign — Reschedule Task

| Aspect | Mock (`handleRescheduleTask`) | PHP (`RescheduleService::rescheduleTask`) |
|--------|-------------------------------|-------------------------------------------|
| End time calculation | `calculateEndTime()` JS | `EndTimeCalculator` PHP |
| Overlap handling | Push-down (`applyPushDown()`) | Hybrid: validation + `PushDownService` for `StationConflict` |
| Outsourced auto-assignment | Same as assign | `OutsourcedAutoAssignmentService::autoAssignSuccessors()` |

**Divergence: NONE** — Resolved in PR #16 and PR #17. Same fixes as assign endpoint.

---

### 3. DELETE /tasks/:taskId/assign — Unassign Task

| Aspect | Mock (`handleUnassignTask`) | PHP (`UnassignmentService::unassignTask`) |
|--------|-----------------------------|--------------------------------------------|
| Assignment removal | Removes from snapshot | Removes from schedule, reverts task to "ready" |
| Cascading removal | `getOutsourcedTasksToRemoveOnUnassign()` removes orphaned outsourced tasks | `OutsourcedAutoAssignmentService::removeOrphanedAssignments()` |

**Divergence: NONE** — Resolved in PR #16. Both implementations cascade-remove orphaned outsourced tasks when all predecessors become unscheduled.

---

### 4. PUT /tasks/:taskId/completion — Toggle Completion

| Aspect | Mock (`handleToggleCompletion`) | PHP (`CompletionService::toggleCompletion`) |
|--------|----------------------------------|----------------------------------------------|
| Toggle logic | Flips `isCompleted`, sets/clears `completedAt` | Same |
| Cascading effects | None | None |

**Divergence: NONE** — Both implementations are functionally identical.

---

### 5. POST /stations/:stationId/compact — Compact Station

| Aspect | Mock (`handleCompactStation`) | PHP (`CompactStationService::compactStation`) |
|--------|-------------------------------|------------------------------------------------|
| Sort by start time | Yes | Yes |
| Station constraint (previous tile end) | Yes | Yes |
| Predecessor constraint (precedence) | Yes, via `getCompactPredecessorEnd()` | Yes, via `getPredecessorEnd()` |
| Drying time after offset printing | Yes (`DRY_TIME_MS` = 4h) | Yes (`DRY_TIME_MINUTES` = 240m) |
| Current time floor | No — first tile stays in place | Yes — `$now` prevents past scheduling |
| Operating hours snapping | **Not implemented** (assumes 24/7) | **Implemented** (`snapToNextWorkingTime()`) |
| Updated end time tracking | `updatedEndTimes` Map for cascading within pass | Reads fresh from schedule after `rescheduleTask()` |

**Divergence: MEDIUM (PHP is more correct)** — PHP respects operating hours and uses `$now` as floor; mock does not. The PHP behavior is the desired target; mock should be updated to match (Phase 2).

---

### 6. POST /jobs — Create Job

| Aspect | Mock (`handleCreateJob`) | PHP (`JobService::create`) |
|--------|--------------------------|----------------------------|
| Task status | All tasks created as `Ready` | All tasks marked `Ready` via `markReady()` |
| Quantity field | Sets `quantity` from request | Sets `quantity` from request |
| DSL pipe separator | Splits on `\|` and newlines | Splits on `\|` and newlines |
| Sequence order | 0-based indexing | 0-based indexing |
| Single-number duration | `G37(35)` → setup=35, run=0 | `G37(35)` → setup=0, run=35 |
| Station mapping | Dynamic lookup + static fallback (`getStationForAction()`) | Strict DB lookup via `StationRepository::findByName()` |
| DSL format | JCF format `StationName(duration)` + legacy bracket format | JCF format `StationName(duration)` only |
| Job color | Cycling palette (mock-only) | Random palette (FE responsibility) |

**Divergence: LOW (cosmetic)** — Resolved in PR #18 (task status, quantity, pipe separator, 0-based sequenceOrder). Two cosmetic differences remain:

1. **Single-number duration split**: Mock treats `35` as all-setup; PHP treats as all-run. Both produce identical `totalMinutes` (35), so scheduling behavior is identical. The mock behavior is arguably a bug (why would all time be setup?).
2. **Station mapping strictness**: PHP validates station exists in DB; mock has fallback strategies. PHP behavior is correct (should not create tasks for non-existent stations).

---

### 7. PUT /jobs/:jobId — Update Job

| Aspect | Mock (`handleUpdateJob`) | PHP (`JobService`) |
|--------|--------------------------|---------------------|
| Metadata update | reference, client, description, workshopExitDate, quantity | Same fields |
| Element replacement | Full rebuild with cascading assignment deletion | Handling not fully verified |

**Divergence: LOW-MEDIUM (not yet verified)** — Mock handles cascading deletion of assignments when tasks are replaced during element rebuild. PHP API handling needs verification.

---

### 8. GET /jobs/clients — Client Suggestions

| Aspect | Mock | PHP |
|--------|------|-----|
| Data source | Hardcoded `MOCK_CLIENT_NAMES` | Database query (real data) |
| Matching | Case-insensitive substring | Likely prefix match |

**Divergence: NONE (by design)** — Mock uses fixture data; API uses real data. Expected difference.

---

## Summary Matrix

| # | Endpoint | Original Status | Current Status | Resolution |
|---|----------|----------------|----------------|------------|
| 1 | Assign Task | CRITICAL | **RESOLVED** | PR #16 + PR #17 |
| 2 | Reschedule Task | CRITICAL | **RESOLVED** | PR #16 + PR #17 |
| 3 | Unassign Task | CRITICAL | **RESOLVED** | PR #16 |
| 4 | Toggle Completion | NONE | **NONE** | N/A |
| 5 | Compact Station | MEDIUM | **MEDIUM (PHP correct)** | Mock needs updating (Phase 2) |
| 6 | Create Job | LOW | **LOW (cosmetic)** | PR #18 (4 of 5 fixes) |
| 7 | Update Job | LOW-MEDIUM | **NOT VERIFIED** | Needs investigation |
| 8 | Client Suggestions | NONE | **NONE** | N/A |

## Remaining Work

### Open Items

1. **Compact Station — mock update (Phase 2, P1)**
   - Mock should respect station operating schedules, same as PHP `snapToNextWorkingTime()`
   - Mock should use `$now` as floor to prevent past scheduling

2. **Update Job — cascading assignment deletion (P2)**
   - Verify PHP handles element replacement with cascading assignment deletion
   - Compare mock `handleUpdateJob()` with PHP `JobService::update()`

3. **Contract tests (Phase 3, P3)**
   - For each mutation endpoint, create test cases with identical inputs
   - Verify mock and API produce identical outputs
   - Run as part of CI to prevent future divergence

### Accepted Cosmetic Differences

These differences have been analyzed and accepted as non-impactful:

- **Single-number duration split**: Mock=all-setup, PHP=all-run. Same `totalMinutes`, no scheduling impact.
- **Station mapping**: PHP is stricter (DB validation). This is correct behavior.
- **Legacy DSL format**: Mock supports `[StationName] duration` bracket format; PHP only supports JCF `StationName(duration)`. Legacy format is not used in production.

## Change Log

| Date | PRs | Changes |
|------|-----|---------|
| 2026-02-17 | PR #16 | Outsourced auto-assignment (assign/reschedule/unassign) |
| 2026-02-17 | PR #17 | Hybrid push-down for station conflicts (assign/reschedule) |
| 2026-02-17 | PR #18 | Create Job fixes: task status, quantity, pipe separator, 0-based sequenceOrder |
