# Operator Scheduling — Implementation Plan

> **Status:** Draft
> **Reference:** [operator-data-model-mvp.md](operator-data-model-mvp.md)
> **Milestone:** TBD (Post-MVP or new milestone M8)
> **Estimated releases:** 12

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Decision Record](#2-architecture-decision-record)
3. [Release Graph (Single Source of Truth)](#3-release-graph-single-source-of-truth)
4. [Phase 1: Backend Foundation](#4-phase-1-backend-foundation)
5. [Phase 2: Validation & Algorithm](#5-phase-2-validation--algorithm)
6. [Phase 3: Types Package](#6-phase-3-types-package)
7. [Phase 4: Frontend — Admin](#7-phase-4-frontend--admin)
8. [Phase 5: Frontend — Schedule Integration](#8-phase-5-frontend--schedule-integration)
9. [Phase 6: Frontend — Operator Timeline](#9-phase-6-frontend--operator-timeline)
10. [Test Strategy](#10-test-strategy)
11. [Documentation Updates](#11-documentation-updates)
12. [Risk Assessment](#12-risk-assessment)
13. [Rollback Plan](#13-rollback-plan)

---

## 1. Executive Summary

### What

Add operator (workshop personnel) management to the scheduling system. Operators have work schedules, absences, and station skills. Tasks can be assigned to operators, with auto-assignment support.

### Why

The current system schedules tasks on stations but has no concept of WHO operates the machine. In reality, station availability depends on operator availability. This feature closes that gap.

### MVP scope

- Binary skills (can/cannot work a station) with primary station preference
- Uniform productivity = 1.0 (no duration variability)
- Operator assignment is optional and additive — the system works without it
- Auto-assign algorithm as a post-placement step (no change to autoplace Phase 1)

### What does NOT change

- Autoplace algorithm (Phase 1) — unchanged, uses reference durations
- Tile durations — not affected by operator assignment
- Station operating schedules — remain the primary time constraint
- Existing task placement and validation — fully backward compatible

---

## 2. Architecture Decision Record

### ADR-014 — Operator-Based Resource Scheduling

**Status:** Proposed
**Date:** 2026-03-26

#### Context

The Flux scheduler assigns tasks to stations (physical machines) but does not model who operates them. In practice:
- Stations cannot run without a qualified operator
- Operators have work schedules and vacation days
- Not every operator can run every machine
- When multiple operators can run a machine, there are preferences (primary operator)

Production managers currently track operator assignments informally (paper, memory). This leads to scheduling conflicts when operators are unavailable or double-booked.

#### Decision

We introduce an `Operator` aggregate with skills and absences, separate from but optionally linked to the existing `User` entity. Operator assignment is modeled as an optional field on `TaskAssignment`, not as a separate entity, keeping the assignment model cohesive.

Key design choices:

1. **Operator is NOT User.** An Operator represents a physical workshop person. A User represents a system account. They may be linked via `Operator.userId` but are independent aggregates. Rationale: most operators don't need system accounts; separating concerns avoids coupling workshop management to authentication.

2. **Operator assignment is optional.** Tasks can be scheduled without an operator (BR-OPER-008). This ensures backward compatibility and allows gradual adoption. Rationale: forcing operator assignment would block the existing workflow until all operators are configured.

3. **Uniform productivity in MVP.** All operator-station skills have implicit productivity = 1.0. This avoids the "jelly schedule" problem where tile durations cascade-resize on operator reassignment. Rationale: build the full operator infrastructure first, add productivity as a surgical V2 change.

4. **Two-phase scheduling.** Autoplace (Phase 1) runs unchanged with station-only constraints. Operator assignment (Phase 2) runs as a separate post-process or during smart compaction. Rationale: decomposition keeps the NP-hard scheduling problem tractable and preserves the existing algorithm's correctness.

5. **Reuse `OperatingSchedule` value object.** Operators use the same weekly schedule structure as stations. Rationale: proven pattern, shared rendering code, consistent mental model.

6. **`OperatorSkill` as a separate entity.** Not embedded JSON on Operator. Rationale: enables efficient DB queries ("which operators can work station X?"), cleaner V2 migration when adding the `productivity` column, and Doctrine relationship management.

#### Consequences

**Positive:**
- Gradual adoption — system works without any operators defined
- Clear V2 extension path for productivity coefficients
- Reuses proven patterns (OperatingSchedule, SSE streaming, validation pipeline)
- No changes to existing autoplace algorithm
- Station schedule remains the primary time constraint

**Negative:**
- MVP does not detect "no operator available" during autoplace — only flagged during auto-assign
- Adds 3 new database tables and ~15 API endpoints
- Frontend needs a new management page and badge rendering
- Auto-assign algorithm adds compute time after placement

---

## 3. Release Graph (Single Source of Truth)

> **All dependency and effort information is defined in the YAML block below.** There are no prose assertions about what depends on what elsewhere in this document. The per-OP sections (§4–§9 and §11) specify scope and implementation details but do NOT restate prerequisites — consult this block.
>
> **OP numbering groups by layer** (OP-01–03,05 backend, OP-04 validator (TS) + backend, OP-06 types bridge, OP-07–11 frontend, OP-12 docs), **not by execution order.** Consult the YAML `prerequisites` for sequencing — e.g., OP-06 must ship before OP-04.

```yaml
releases:
  OP-01:
    title: Operator Entity + Enums + Repository + CRU
    layer: Backend
    effort: 1-2 days
    prerequisites: []
  OP-02:
    title: OperatorSkill + OperatorAbsence + Nested APIs
    layer: Backend
    effort: 1-2 days
    prerequisites: [OP-01]
  OP-03:
    title: TaskAssignment.operatorId + Operator Assignment Endpoints
    layer: Backend
    effort: 1 day
    prerequisites: [OP-02]
  OP-04:
    title: Operator Validation (3 Conflict Types)
    layer: Validator (TS) + Backend
    effort: 1-2 days
    prerequisites: [OP-06, OP-03]
  OP-05:
    title: Auto-Assign Operators Algorithm + SSE Endpoint
    layer: Backend
    effort: 3-5 days
    prerequisites: [OP-04]
  OP-06:
    title: "@flux/types Operator Types + Shared OperatorBadge Component"
    layer: Types + UI
    effort: 1 day
    prerequisites: [OP-03]
  OP-07:
    title: ScheduleSnapshot Integration + Tile Operator Badges
    layer: Frontend
    effort: 1-2 days
    prerequisites: [OP-06, OP-04]
  OP-08:
    title: Operator Management Page
    layer: Frontend
    effort: 2-3 days
    prerequisites: [OP-06]
  OP-09:
    title: Manual Operator Assignment UI
    layer: Frontend
    effort: 1-2 days
    prerequisites: [OP-07, OP-08]
  OP-10:
    title: Auto-Assign Modal (SSE Progress)
    layer: Frontend
    effort: 1 day
    prerequisites: [OP-05, OP-09]
  OP-11:
    title: Operator Timeline Panel
    layer: Frontend
    effort: 2-3 days
    prerequisites: [OP-07]
  OP-12:
    title: Documentation Update
    layer: Docs
    effort: 1 day
    prerequisites: [OP-02]
```

**Derived summary:**
- **Total effort:** 16-25 person-days
- **Critical path:** OP-01 → OP-02 → OP-03 → OP-06 → OP-04 → OP-05 (8-13 days) converging with OP-04 → OP-07 + OP-06 → OP-08 → OP-09 (frontend) at OP-10
- **Wall-clock:** ≈ 9-14 days (OP-08, OP-11, OP-12 run in parallel off their respective prerequisites)

---

## 4. Phase 1: Backend Foundation

### OP-01 — Operator Entity + Enums + Repository + CRU

**Scope:** Create the Operator aggregate root with CRU API (no delete — operators use `status=Inactive` to decommission), following the exact patterns of `Station` entity.

*Release prerequisites: see §3 YAML. Additional: PHP `intl` extension (required by `Transliterator` for initials generation).*

#### In Scope
- `OperatorStatus` enum (Active, Inactive)
- `AbsenceType` enum (vacation, sick, training, other)
- `Operator` entity with all fields (id, name, initials, color, status, userId, displayOrder, operatingSchedule)
- `OperatorRepository` with standard queries
- Doctrine migration for `operators` table
- CRU controller: `OperatorController` (Create, Read, Update — **no DELETE**; operators use `status=Inactive` to decommission, preserving historical assignment data)
- Request/Response DTOs: `CreateOperatorRequest`, `UpdateOperatorRequest`, `OperatorResponse`, `OperatorListResponse`
- Initials auto-generation logic (uses `Transliterator::create('Any-Latin; Latin-ASCII')`)
- Color palette (10 colors distinct from Job palette)

#### Out of Scope
- OperatorSkill and OperatorAbsence entities (OP-02)
- Integration with TaskAssignment (OP-03)

#### Files to Create

```
services/php-api/
├── src/
│   ├── Entity/
│   │   ├── Operator.php
│   │   ├── OperatorStatus.php
│   │   └── AbsenceType.php
│   ├── Repository/
│   │   └── OperatorRepository.php
│   ├── Controller/Api/V1/
│   │   └── OperatorController.php
│   ├── DTO/Operator/
│   │   ├── CreateOperatorRequest.php
│   │   ├── UpdateOperatorRequest.php
│   │   ├── OperatorResponse.php
│   │   └── OperatorListResponse.php
│   └── Event/Operator/
│       ├── OperatorCreated.php
│       ├── OperatorUpdated.php           (name, initials, color, or schedule changes — Mercure pushes via MercureDomainEventHandler)
│       └── OperatorStatusChanged.php
├── migrations/
│   └── VersionYYYYMMDDHHmmss.php   (operators table)
└── tests/
    └── Unit/
        ├── Entity/
        │   └── OperatorTest.php
        ├── Enum/
        │   ├── OperatorStatusTest.php
        │   └── AbsenceTypeTest.php
        └── DTO/Operator/
            └── CreateOperatorRequestTest.php
```

#### Database Migration

Migration creates the `operators` table as defined in [data model §3.1](operator-data-model-mvp.md#31-operator-aggregate-root).

#### Business Rules Implemented (see [data model §7](operator-data-model-mvp.md#7-business-rules) for definitions)
- BR-OPER-001, BR-OPER-002

#### Test Requirements

**Unit Tests (~40 tests):**

| Test Class | Tests | Focus |
|------------|-------|-------|
| `OperatorTest` | ~25 | Creation, name validation (empty, too long, unique), initials generation, color assignment, status changes, operating schedule get/set, `getEffectiveScheduleForDate()`, `isAvailableOn()` stub (no skills/absences yet), displayOrder, timestamps |
| `OperatorStatusTest` | ~5 | Enum values, `canBeAssigned()` returns true only for Active |
| `AbsenceTypeTest` | ~3 | Enum values, labels |
| `CreateOperatorRequestTest` | ~7 | Validation: blank name, name too long, invalid color hex, invalid status choice, valid request passes |

**Integration Tests (~8 tests):**

| Test Class | Tests | Focus |
|------------|-------|-------|
| `OperatorControllerTest` | ~8 | POST create (success, duplicate name, validation errors), GET list (pagination, status filter, search), GET single (success, 404), PUT update (partial update, sentinel flags), PUT status to Inactive |

#### Definition of Done
- [ ] Entity with all Doctrine mappings
- [ ] Migration runs without errors
- [ ] CRU endpoints working (manual test with curl/Postman)
- [ ] OpenAPI/Swagger annotations on all new endpoints (visible at /api/doc)
- [ ] PHPStan level 8 passes
- [ ] All unit tests green
- [ ] All integration tests green
- [ ] Operator seed/fixture data for development environment (DataFixtures command creates sample operators)

---

### OP-02 — OperatorSkill + OperatorAbsence + Nested APIs

**Scope:** Add the skill and absence child entities to Operator, with nested API endpoints.

*Release prerequisites: see §3 YAML.*

#### In Scope
- `OperatorSkill` entity (id, operator, stationId, isPrimary)
- `OperatorAbsence` entity (id, operator, startDate, endDate, type, reason)
- Nested controller endpoints for skills and absences
- Operator entity methods: `hasSkillFor()`, `isPrimaryFor()`, `addSkill()`, `removeSkillFor()`, `isAbsentOn()`, `isAbsentDuring()`, `isWorkingDuring()`, `addAbsence()`, `removeAbsence()`
- Validation: at most one primary per operator (BR-OPER-010 — adding a new primary auto-clears the previous one), no duplicate station skills (BR-OPER-011), no overlapping absences (BR-OPER-012), skill removal blocked if active non-completed assignments exist for that station (BR-OPER-013)
- Update `OperatorResponse` to include embedded skills[] and absences[]
- Doctrine migrations for `operator_skills` and `operator_absences` tables
- `StationDeleted` domain event (new — does not currently exist): add dispatch to the existing `StationService::delete()` method (the `DELETE /api/v1/stations/{id}` endpoint already performs hard delete but dispatches no event)
- `StationDeletedListener`: event subscriber that removes orphaned `OperatorSkill` rows when a station is deleted (prevents stale skills from confusing auto-assign and UI)

#### Out of Scope
- Integration with TaskAssignment (OP-03)
- Validation during task assignment (OP-04)

#### Files to Create

```
services/php-api/
├── src/
│   ├── Entity/
│   │   ├── OperatorSkill.php
│   │   └── OperatorAbsence.php
│   ├── Controller/Api/V1/
│   │   ├── OperatorSkillController.php
│   │   └── OperatorAbsenceController.php
│   ├── Event/Station/
│   │   └── StationDeleted.php           (new domain event — does not exist yet)
│   ├── EventSubscriber/
│   │   └── StationDeletedListener.php
│   └── DTO/Operator/
│       ├── AddSkillRequest.php
│       ├── UpdateSkillRequest.php
│       ├── CreateAbsenceRequest.php
│       ├── UpdateAbsenceRequest.php
│       └── AbsenceListResponse.php
├── migrations/
│   └── VersionYYYYMMDDHHmmss.php   (skills + absences tables)
└── tests/
    └── Unit/
        ├── Entity/
        │   ├── OperatorSkillTest.php
        │   └── OperatorAbsenceTest.php
        └── (extend OperatorTest.php with skill/absence methods)
```

#### Files to Modify

```
services/php-api/
├── src/Entity/Operator.php           (add OneToMany relations, skill/absence methods)
├── src/Service/StationService.php               (dispatch StationDeleted event in delete() method)
├── src/DTO/Operator/OperatorResponse.php  (add skills[], absences[])
└── tests/Unit/Entity/OperatorTest.php     (add skill/absence method tests)
```

#### Database Migration

Migration creates `operator_skills` and `operator_absences` tables as defined in [data model §3.2](operator-data-model-mvp.md#32-operatorskill-entity-within-operator) and [§3.3](operator-data-model-mvp.md#33-operatorabsence-entity-within-operator).

#### Business Rules Implemented (see [data model §7](operator-data-model-mvp.md#7-business-rules))
- BR-OPER-010, BR-OPER-011, BR-OPER-012, BR-OPER-013

#### Test Requirements

**Unit Tests (~45 tests):**

| Test Class | Tests | Focus |
|------------|-------|-------|
| `OperatorSkillTest` | ~10 | Creation, isPrimary default false, getters |
| `OperatorAbsenceTest` | ~10 | Creation, `coversDate()` (before, during start, mid, during end, after), type enum, reason optional, date validation (endDate >= startDate) |
| `OperatorTest` (extended) | ~25 | `hasSkillFor()`, `isPrimaryFor()`, `addSkill()` with primary auto-clear (second primary clears first, not reject), `addSkill()` duplicate station throws, `removeSkillFor()`, `isAbsentOn()`, `isAbsentDuring()` (range-overlap: before, partial overlap start, fully within, partial overlap end, after, exact match, boundary overlap — A ends March 15 B starts March 15 → true since dates inclusive), `isWorkingDuring()` (operator covers intersection → true, operator partially covers → false, station not operating on day → operator not required, multi-day task Fri-Mon on Mon-Fri station → check only Fri+Mon, **DST transition boundary — task spanning last Sunday of March in Europe/Paris**), `addAbsence()` overlap detection, **`addAbsence()` boundary overlap (A ends March 15, B starts March 15 → rejected since both dates inclusive)**, `removeAbsence()` |

**Integration Tests (~17 tests):**

| Test Class | Tests | Focus |
|------------|-------|-------|
| `OperatorSkillControllerTest` | ~9 | POST add skill (success, duplicate station 409, second primary clears first, station not found 404), PUT update isPrimary, DELETE remove skill (success), **DELETE remove skill with active non-completed assignments → 400 (BR-OPER-013)**, **DELETE remove skill with only past assignments → success**, **DELETE remove skill with active but completed assignments → success** |
| `OperatorAbsenceControllerTest` | ~6 | POST add absence (success, overlapping dates 409, endDate < startDate 400), GET list with date filter, PUT update, DELETE remove |
| `StationDeletedListenerTest` | ~2 | Station deleted → orphaned skills removed for all operators, station deleted when no skills reference it → no-op |

#### Definition of Done
- [ ] OperatorSkill and OperatorAbsence entities with Doctrine mappings
- [ ] Migration runs cleanly
- [ ] Nested API endpoints working
- [ ] `OperatorResponse` includes embedded skills and absences
- [ ] Primary enforcement tested (add second primary clears first — auto-clear, not reject)
- [ ] Absence overlap detection tested
- [ ] `StationDeletedListener` removes orphaned skills
- [ ] OpenAPI/Swagger annotations on all new endpoints
- [ ] PHPStan level 8 passes
- [ ] All tests green

---

### OP-03 — TaskAssignment.operatorId + Operator Assignment Endpoints

**Scope:** Extend TaskAssignment with an optional operatorId field. Add dedicated endpoints for assigning/removing operators from tasks.

*Release prerequisites: see §3 YAML.*

#### In Scope
- Add `operatorId` nullable field to `TaskAssignment` value object
- `withOperator(?string)` factory method
- Updated `fromArray()` (backward compatible — missing key defaults to null)
- Updated `jsonSerialize()` to include operatorId
- Validation: outsourced tasks cannot have operatorId (BR-OPER-009)
- New endpoints: `PUT /tasks/{taskId}/operator`, `DELETE /tasks/{taskId}/operator`
- Update `AssignTaskRequest` with optional `operatorId` field
- Update `AssignmentResponse` to include `operatorId`
- Update `Schedule` entity to propagate operatorId through assign/reschedule/toggle
- New `Schedule::updateOperatorAssignment(TaskAssignment $assignment): void` — dedicated method that updates ONLY the operatorId of an existing assignment without touching scheduledStart/scheduledEnd/targetId. Used by auto-assign (OP-05) to set operators without implying a placement change. Signature: finds assignment by taskId, replaces it with the new one (which has operatorId set). Increments schedule version.
- New `Schedule::getInternalAssignments(): array` — convenience filter over `getAssignments()` returning only non-outsourced assignments (`!isOutsourced`). Used by auto-assign (OP-05).
- **NO validation of operator skill/availability yet** — that's OP-04

#### Out of Scope
- Operator validation during assignment (OP-04)
- Auto-assign algorithm (OP-05)
- SnapshotBuilder changes (OP-04, which needs operator data for validation)

#### Files to Modify

```
services/php-api/
├── src/
│   ├── ValueObject/TaskAssignment.php     (add operatorId, withOperator(), update fromArray/jsonSerialize)
│   ├── Entity/Schedule.php                (propagate operatorId in assignTask/rescheduleTask; add updateOperatorAssignment, getInternalAssignments)
│   ├── Controller/Api/V1/TaskController.php (add operator assign/unassign endpoints)
│   ├── DTO/Assignment/AssignTaskRequest.php (add optional operatorId)
│   └── DTO/Assignment/AssignmentResponse.php (add operatorId)
└── tests/
    └── Unit/
        ├── ValueObject/TaskAssignmentTest.php  (extend with operatorId tests)
        └── Entity/ScheduleTest.php             (extend with operator propagation tests)
```

#### Files to Create

```
services/php-api/
└── src/
    ├── DTO/Operator/
    │   └── AssignOperatorRequest.php    (simple: just operatorId UUID)
    └── Event/Schedule/
        ├── OperatorAssignmentChanged.php      (domain event — single manual assignment, published via Mercure)
        └── OperatorAutoAssignCompleted.php     (domain event — summary after batch auto-assign, published via Mercure)
```

#### Migration

**No schema migration needed.** `TaskAssignment` is stored as JSON inside `Schedule.assignments`. The `fromArray()` change handles backward compatibility (missing key → null).

#### Business Rules Implemented (see [data model §7](operator-data-model-mvp.md#7-business-rules))
- BR-OPER-008, BR-OPER-009

#### Test Requirements

**Unit Tests (~22 tests):**

| Test Class | Tests | Focus |
|------------|-------|-------|
| `TaskAssignmentTest` (extended) | ~12 | `forStation()` defaults operatorId to null, `withOperator()` creates copy with new operatorId, `withOperator(null)` clears, `withCompletionToggled()` preserves operatorId, `withScheduledEnd()` preserves operatorId, `fromArray()` with operatorId, `fromArray()` without operatorId (backward compat → null), `jsonSerialize()` includes operatorId, outsourced + operatorId throws, `equals()` considers operatorId, `overlapsInTime()` unchanged |
| `ScheduleTest` (extended) | ~10 | `assignTask()` with operatorId persists, `rescheduleTask()` preserves operatorId, operator assign/unassign via schedule methods, `updateOperatorAssignment()` records `OperatorAssignmentChanged` domain event, `suppressEvents()`/`releaseEvents()` batching suppresses individual events |

**Integration Tests (~6 tests):**

| Test Class | Tests | Focus |
|------------|-------|-------|
| `TaskControllerTest` (extended) | ~6 | PUT operator (success, task not assigned 404, outsourced task 400), DELETE operator (success, already null 200 idempotent), POST assign with operatorId field |

#### Definition of Done
- [ ] TaskAssignment.operatorId works end-to-end
- [ ] Backward compatible: existing assignments deserialize with null
- [ ] Outsourced validation works
- [ ] Dedicated assign/unassign endpoints working
- [ ] OpenAPI/Swagger annotations on new endpoints
- [ ] PHPStan level 8 passes
- [ ] All tests green
- [ ] Manual verification: assign operator via API, verify in schedule snapshot JSON

---

## 5. Phase 2: Validation & Algorithm

### OP-04 — Operator Validation (3 Conflict Types)

**Scope:** Add 3 new operator-specific validators to the TypeScript `@flux/schedule-validator` pipeline (`packages/validator/`). Update `SnapshotBuilder` (PHP) to include operator data in the snapshot sent to the validator.

> **Architecture note:** The validation pipeline runs in the TypeScript `@flux/schedule-validator` package (`packages/validator/`), not in PHP. These validators follow the same pattern as the existing 7 validators in `packages/validator/src/validators/` (`stationMatch.ts`, `station.ts`, etc.). The PHP API delegates validation via `ValidationServiceClient`.

*Release prerequisites: see §3 YAML.*

#### In Scope
- `operatorSkill.ts` validator — operator has no skill for the target station → `OperatorSkillConflict`
- `operatorAvailability.ts` validator — operator absent or outside work hours → `OperatorAvailabilityConflict`
- `operatorDoubleBooking.ts` validator — operator double-booked → `OperatorDoubleBookingConflict`
- Register validators 8-10 in `packages/validator` pipeline (only fire when operatorId is non-null)
- Update `SnapshotBuilder` (PHP) to include `operators[]` with skills and absences in the snapshot
- Update `ScheduleSnapshot` TypeScript type in `packages/validator` to consume operator data

#### Out of Scope
- Auto-assign algorithm (OP-05)
- `PlacementContext` operator indexes (deferred to OP-05 — auto-assign needs them, not validation)
- Frontend conflict display (OP-07)

#### Files to Create

```
packages/validator/
├── src/
│   └── validators/
│       ├── operatorSkill.ts
│       ├── operatorAvailability.ts
│       └── operatorDoubleBooking.ts
└── tests/
    └── validators/
        ├── operatorSkill.test.ts
        ├── operatorAvailability.test.ts
        └── operatorDoubleBooking.test.ts
```

#### Files to Modify

```
packages/validator/
├── src/
│   ├── pipeline.ts                     (register validators 8-10)
│   └── types.ts                        (add operator types to snapshot interface)

services/php-api/
└── src/
    └── Service/SnapshotBuilder.php     (include operators[] in full snapshot)
```

#### Business Rules Implemented (see [data model §7](operator-data-model-mvp.md#7-business-rules))
- BR-OPER-002, BR-OPER-003, BR-OPER-004, BR-OPER-005, BR-OPER-006, BR-OPER-014

#### Test Requirements

**Unit Tests (~33 tests, TypeScript):**

| Test Class | Tests | Focus |
|------------|-------|-------|
| `operatorSkill.test.ts` | ~8 | No operatorId → pass, operator has skill → pass, operator no skill → OperatorSkillConflict, operator not found in snapshot → OperatorSkillConflict (data integrity issue treated as missing skill) |
| `operatorAvailability.test.ts` | ~15 | No operatorId → pass, within hours + no absence → pass, during absence → conflict with reason='absence', outside operating hours → conflict with reason='outside_hours', multi-day task spanning absence → conflict, inactive operator → conflict with reason='inactive', **operator with null operatingSchedule → conflict with reason='no_schedule' (BR-OPER-002)** |
| `operatorDoubleBooking.test.ts` | ~10 | No operatorId → pass, no other assignments → pass, non-overlapping → pass, overlapping → conflict with relatedTaskId, adjacent (end=start) → pass (no overlap), same operator different station → conflict if overlapping |

**Integration Tests (~7 tests):**

| Test Class | Tests | Focus |
|------------|-------|-------|
| `operatorValidation.integration.test.ts` | ~3 | Full pipeline with operator: valid assignment passes all 10 validators, null operatorId skips validators 8-10 |
| `SnapshotBuilderTest.php` (extend) | ~4 | Snapshot includes operators with skills/absences, empty operators array when none configured, **serialized operators omit createdAt/updatedAt**, **minimal snapshot (for single-assignment validation) does NOT include operators** |

#### Definition of Done
- [ ] All 3 TypeScript validators implemented and registered in `packages/validator` pipeline
- [ ] SnapshotBuilder includes operator data in snapshot
- [ ] Validators only fire when operatorId is non-null
- [ ] Existing `packages/validator` tests still pass (no regression)
- [ ] PHPStan level 8 passes for SnapshotBuilder change
- [ ] All tests green

---

### OP-05 — Auto-Assign Operators Algorithm + SSE Endpoint

**Scope:** Implement the greedy chronological auto-assign algorithm with SSE streaming progress.

*Release prerequisites: see §3 YAML.*

#### In Scope
- `OperatorAutoAssignService` — core algorithm implementation
- Update `PlacementContext` with operator indexes (`operatorMap`, `skillsByStation`, `assignmentsByOperator`)
- `PlacementContext::getAvailableOperators()` method
- Update `PlacementContextBuilder` to build operator indexes from repositories
- SSE endpoint: `POST /api/v1/schedule/auto-assign-operators`
- **Concurrent SSE guard (entirely new — no existing lock pattern in codebase):** implement an `SseOperationLock` service (e.g., file-based `flock` or DB flag) that the auto-assign endpoint acquires before starting. Returns **409 Conflict** if the lock is held. The four existing SSE endpoints (`auto-place-all`, `smart-compact`, `solver/strategic`, `solver/compact`) currently have NO lock/mutex of any kind — they only set `set_time_limit()` and memory limits. Retrofitting existing endpoints to acquire this lock is **optional for MVP** (low risk in single-user workshop). Estimated: +0.5 day.
- Scope parameter: `all` (clear and reassign) vs `unassigned` (only fill gaps)
- Progress events: per-task assignment with operator name
- Conflict events: when no operator is available
- Completion event with summary statistics
- Error event on mid-operation failure (with count of assignments completed before failure)
- Ranking logic: primary first → specialists first → least loaded first
- **Progressive persistence:** assignments saved incrementally (not atomic transaction). On failure, completed assignments are retained; re-running with `scope=unassigned` picks up where it left off.
- **Shared availability rules specification:** write `docs/architecture/operator-availability-rules.md` documenting the formal availability rules (absence overlap, operating hours, assignment overlap) that both PHP auto-assign and TypeScript validators must implement identically. Include a shared set of test vectors (JSON fixtures) that both PHP and TypeScript test suites run against, asserting identical pass/fail results — this serves as an automated contract test preventing future drift.

#### Out of Scope
- Frontend modal (OP-10)
- Integration with smart compaction (future enhancement)

#### Files to Create

```
services/php-api/
├── src/
│   └── Service/
│       ├── OperatorAutoAssignService.php
│       └── SseOperationLock.php           (new: mutex for SSE operations — file lock or DB flag)
└── tests/
    └── Unit/
        └── Service/
            ├── OperatorAutoAssignServiceTest.php
            └── SseOperationLockTest.php
```

#### Files to Modify

```
services/php-api/
└── src/
    ├── Controller/Api/V1/
    │   └── ScheduleController.php        (add auto-assign-operators endpoint with SseOperationLock; retrofitting existing SSE endpoints is optional for MVP)
    ├── ValueObject/PlacementContext.php   (add operator indexes + getAvailableOperators)
    └── Service/PlacementContextBuilder.php (build operator indexes from repositories)
```

#### Business Rules Implemented (see [data model §7](operator-data-model-mvp.md#7-business-rules))
- BR-OPER-007, BR-OPER-014

#### Ranking Summary

Primary first → specialists first → least loaded first → ID (deterministic). Full pseudocode and formal definitions: see [data model §9](operator-data-model-mvp.md#9-auto-assign-algorithm).

#### Algorithm Specification

Full algorithm pseudocode, ranking tiebreakers, and implementation notes: see [data model §9](operator-data-model-mvp.md#9-auto-assign-algorithm).

Input: schedule (all current assignments), operators (with skills and absences), scope ('all' | 'unassigned'). Output: assigned count, conflict reports, skipped count.

#### SSE Event Format

See [data model §6.5](operator-data-model-mvp.md#65-auto-assign-operators--new-endpoint) for the canonical SSE event format (progress, conflict, complete, error events).

#### Test Requirements

**Unit Tests (~27 tests):**

| Test Class | Category | Tests | Focus |
|------------|----------|-------|-------|
| `OperatorAutoAssignServiceTest` | Basic | ~4 | Empty schedule → 0 assigned, all outsourced → 0 assigned + all skipped, single task + single operator → assigned, single task + no operator with skill → conflict |
| | Ranking: primary | ~2 | Primary preference (2 operators, one primary → primary chosen), both secondary → falls through to next tiebreaker |
| | Ranking: specialist | ~2 | 2 operators both secondary, one with 2 skills, one with 5 → pick the one with 2 (specialist first) |
| | Ranking: load balance | ~2 | 2 equal operators, 2 tasks → one each (least loaded first) |
| | Availability | ~8 | Absence blocks assignment, operator outside hours blocks, inactive operator skipped, operator with null schedule skipped (BR-OPER-002), multi-day task partially overlapping absence → conflict, **multi-day task Fri-Mon where operator doesn't work weekends BUT station also doesn't operate weekends → pass (operator only required during station operating hours)**, **multi-day task Fri-Mon where station operates 7 days but operator doesn't work weekends → conflict**, **absence boundary: task on day where absence ends and another begins → conflict** |
| | Scope | ~3 | scope=all clears all operatorIds upfront then processes as unassigned (excludes completed tasks), scope=unassigned skips already-assigned, default scope is unassigned |
| | Edge cases | ~4 | Chronological order (earlier task gets operator first), multi-station scenario (operator works station A 8-10, then available for station B 10-12), overlapping tasks on different stations for same operator → second gets conflict, adjacent tasks (end=start) → no conflict |
| | Idempotency | ~2 | Running twice with scope=unassigned produces same result, running after manual assignment preserves manual choices |

**Integration Tests (~5 tests):**

| Test Class | Tests | Focus |
|------------|-------|-------|
| `AutoAssignIntegrationTest` | ~5 | SSE endpoint returns valid event stream, scope=unassigned default, schedule version increments after auto-assign, **409 returned when another SSE operation is running**, **error event sent on mid-operation failure with partial assignment count** |

#### Definition of Done
- [ ] PlacementContext builds operator indexes correctly
- [ ] `getAvailableOperators()` filters by skill, status, absence, hours, and overlap
- [ ] Algorithm produces correct assignments for all test scenarios
- [ ] SSE endpoint streams progress events
- [ ] SSE endpoint returns 409 when another SSE operation is active
- [ ] Conflict reporting is accurate
- [ ] Progressive persistence: partial assignments retained on failure
- [ ] Idempotent: running twice with scope=unassigned produces same result
- [ ] Shared availability rules specification written (`docs/architecture/operator-availability-rules.md`)
- [ ] PHPStan level 8
- [ ] All tests green

---

## 6. Phase 3: Types Package

### OP-06 — @flux/types Operator Types + Shared OperatorBadge Component

**Scope:** Add TypeScript type definitions for operators, update assignment types, and create the shared `OperatorBadge` component (used by OP-07 and OP-08 in parallel).

*Release prerequisites: see §3 YAML.*

#### In Scope
- New file: `packages/types/src/operator.ts`
- Types: `Operator`, `OperatorSkill`, `OperatorAbsence`, `OperatorStatus`, `AbsenceType`
- Update `TaskAssignment` interface: add `operatorId: string | null`
- Update `ConflictType` union: add 3 new operator validation conflict types (`OperatorSkillConflict`, `OperatorAvailabilityConflict`, `OperatorDoubleBookingConflict`)
- Add separate `AutoAssignEventType` union: `NoOperatorAvailableConflict` (auto-assign SSE only, NOT a validation pipeline type)
- Update `ScheduleSnapshot` interface: add `operators: Operator[]`
- Export from `packages/types/src/index.ts`
- **Shared `OperatorBadge` component** — reusable colored circle with initials. Created here so OP-07 (tile badges) and OP-08 (admin page) can both import it without depending on each other.
- **Accessibility:** `OperatorBadge` must include `aria-label="Operator: {name}"` (or `"No operator assigned"` for unassigned state). Color contrast must meet WCAG 2.1 AA (4.5:1 for initials text against badge background). Badge must not rely on color alone for identification — initials provide the primary visual identifier.

#### Files to Create

```
packages/types/src/operator.ts
apps/web/src/components/OperatorBadge/OperatorBadge.tsx
```

#### Files to Modify

```
packages/types/src/assignment.ts    (TaskAssignment, ConflictType, ScheduleSnapshot)
packages/types/src/index.ts         (export operator types)
```

#### Test Requirements

**Type-level tests:** No runtime tests needed for interface definitions. TypeScript compiler validates structural correctness.

**OperatorBadge tests (Vitest, ~3 tests):**
- Renders initials with correct color and `aria-label`
- Renders unassigned state (dashed outline, `aria-label="No operator assigned"`)
- Color contrast meets WCAG 2.1 AA for all palette colors

> **Test ownership:** OperatorBadge rendering tests are defined HERE in OP-06 only. OP-07 and OP-08 should test their own integration (e.g., "Tile passes correct operator prop to OperatorBadge") without re-testing OperatorBadge's internal rendering.

#### Definition of Done
- [ ] `tsc --noEmit` passes
- [ ] All types exported from index
- [ ] No breaking changes to existing type consumers (operatorId is nullable, ConflictType is additive)
- [ ] `OperatorBadge` renders assigned and unassigned states with `aria-label`
- [ ] Color contrast meets WCAG 2.1 AA

---

## 7. Phase 4: Frontend — Admin

### OP-08 — Operator Management Page

**Scope:** Full CRU admin page for managing operators (no deletion — use Inactive status), their skills, and absences.

*Release prerequisites: see §3 YAML.*

#### In Scope
- New RTK Query slice: `operatorApi.ts`
- Operator list page (table view with status, initials badge, primary station)
- Create/Edit operator modal (name, initials, color picker, status, operating schedule)
- Operating schedule editor with preset options: "Copy from station" dropdown and standard defaults (e.g., `OperatingSchedule::defaultWeekday()` 06:00-14:00)
- **Non-blocking warning** when the saved schedule has zero overlap with any of the operator's skilled stations' schedules (e.g., operator set to night shift but all stations run day shifts → "This operator will not be eligible for auto-assignment on any of their stations")
- Skill management (add/remove stations, toggle primary)
- Absence management (add/edit/remove with calendar date picker)
- Access via Settings page (admin section)
- Permission: `settings.edit` required

#### Out of Scope
- Schedule integration (OP-07, OP-09)
- Operator timeline (OP-11)

#### Files to Create

```
apps/web/src/
├── store/api/
│   └── operatorApi.ts
├── components/OperatorManagement/
│   ├── OperatorManagementPage.tsx
│   ├── OperatorTable.tsx
│   ├── OperatorFormModal.tsx
│   ├── SkillManager.tsx
│   ├── AbsenceManager.tsx
│   └── OperatorScheduleEditor.tsx     (reuse station schedule editor pattern)
Note: OperatorBadge is created in OP-06 (shared component); OP-08 imports it.
└── tests/
    └── OperatorManagement/
        └── (vitest unit tests)
```

#### Test Requirements

**Unit Tests (Vitest, ~15 tests):**
- `OperatorTable` renders `OperatorBadge` for each operator (integration test — badge internals covered in OP-06)
- `OperatorTable` renders operator list with status indicators
- `SkillManager` enforces single primary constraint in UI
- `AbsenceManager` validates date range (end >= start)
- RTK Query slice: endpoint definitions match expected URLs

**Manual Tests:**
- Create operator with all fields
- Add skills to operator, toggle primary
- Add overlapping absence → expect error toast
- Edit operator name → verify update
- Set operator to Inactive → verify hidden from active views

#### Definition of Done
- [ ] Full CRU (Create, Read, Update) working through UI
- [ ] Skills and absences manageable
- [ ] Primary enforcement in UI
- [ ] Vitest tests passing
- [ ] Accessible via Settings navigation

---

## 8. Phase 5: Frontend — Schedule Integration

### OP-07 — ScheduleSnapshot Integration + Tile Operator Badges

**Scope:** Wire operator data from the snapshot into the scheduling grid and display operator badges on tiles.

*Release prerequisites: see §3 YAML.*

#### In Scope
- Update frontend snapshot consumption: build `operatorMap` from `snapshot.operators`
- Add `OperatorBadge` (from OP-06) to `Tile` component (top-right corner)
- Badge states: assigned (filled circle with initials + color) vs unassigned (dashed outline)
- Tooltip shows operator name and primary/secondary indicator
- Update `tileDataCache` in `SchedulingGrid` to include operator

> **Note:** SnapshotBuilder changes are owned by OP-04 (which needs operator data for validation). OP-07 is frontend-only. `OperatorBadge` is created in OP-06 (shared component); OP-07 imports it.

#### Frontend Files to Modify

```
apps/web/src/
├── components/
│   ├── SchedulingGrid/SchedulingGrid.tsx  (build operatorMap, pass to Tile)
│   ├── Tile/Tile.tsx                       (render OperatorBadge)
│   └── Tile/TileTooltip.tsx                (show operator info)
└── store/api/
    └── scheduleApi.ts                      (consume operators from snapshot)
```

#### Test Requirements

**Unit Tests (Vitest, ~10 tests):**
- `Tile` passes correct operator prop to `OperatorBadge` when assigned (integration — badge internals covered in OP-06)
- `Tile` passes unassigned state to `OperatorBadge` when operatorId is null
- `TileTooltip` shows operator name when assigned
- `TileTooltip` shows "No operator" when unassigned
- `SchedulingGrid` builds operatorMap correctly from snapshot
- **`SchedulingGrid` handles empty `snapshot.operators` array (backward compat with old snapshots)**

Note: SnapshotBuilder backend tests are in OP-04 (which owns the SnapshotBuilder change).

#### Definition of Done
- [ ] Tile badges visible on scheduling grid
- [ ] Assigned tiles show colored initials
- [ ] Unassigned tiles show dashed indicator
- [ ] Tooltip shows operator details
- [ ] No visual regression on existing tiles (tiles without operators show no badge)

---

### OP-09 — Manual Operator Assignment UI

**Scope:** Allow users to manually assign/change operators on placed tasks.

*Release prerequisites: see §3 YAML.*

#### In Scope
- Context menu option: "Assign operator" on right-click tile
- Operator selection dropdown (filtered by station skill)
- Shows available operators for the task's station and time range
- Visual feedback: primary operators highlighted, unavailable operators grayed out
- API call: `PUT /tasks/{taskId}/operator` on selection
- "Remove operator" option in context menu

#### Out of Scope
- Auto-assign (OP-10)
- Drag operator to tile (future enhancement)

#### Files to Create

```
apps/web/src/
└── components/
    └── ContextMenu/OperatorPicker.tsx  (dropdown with operator list)
```

#### Files to Modify

```
apps/web/src/
├── components/
│   └── ContextMenu/ContextMenu.tsx   (add "Assign operator" option)
├── store/api/
│   └── operatorApi.ts                (add assignOperator/unassignOperator mutations)
└── App.tsx                           (wire context menu handler)
```

#### Test Requirements

**Unit Tests (Vitest, ~6 tests):**
- OperatorPicker filters by station skill
- OperatorPicker highlights primary operator
- OperatorPicker grays out unavailable operators
- Context menu shows "Assign operator" only for internal tasks
- Context menu shows "Remove operator" only when operator assigned

**Manual Tests:**
- Right-click tile → select operator → badge appears
- Right-click tile → remove operator → badge disappears
- Assign operator without skill → error toast (backend validation)

#### Definition of Done
- [ ] Manual operator assignment working end-to-end
- [ ] Operator picker shows skill-filtered list
- [ ] Primary operator highlighted
- [ ] Remove operator works
- [ ] Vitest tests passing

---

### OP-10 — Auto-Assign Modal (SSE Progress)

**Scope:** Frontend modal for triggering auto-assign and displaying SSE progress.

*Release prerequisites: see §3 YAML.*

#### In Scope
- `AutoAssignModal` component (same pattern as `SmartCompactModal`)
- Trigger button in TopNavBar or schedule actions dropdown
- Scope selector: "Assign unassigned only" vs "Reassign all"
- **Confirmation dialog for "Reassign all"**: warns that N existing operator assignments will be cleared, requires explicit user confirmation before proceeding
- SSE event consumption with progress bar
- Conflict list display
- Summary on completion (assigned count, conflict count)
- Snapshot refetch on close
- **Disable auto-assign button while another SSE operation (autoplace, smart compaction) is active.** Handle 409 response gracefully with user-facing error toast.

#### Files to Create

```
apps/web/src/
└── components/
    └── AutoAssignModal/
        ├── AutoAssignModal.tsx
        └── AutoAssignProgress.tsx
```

#### Files to Modify

```
apps/web/src/
├── App.tsx or TopNavBar.tsx    (add trigger button)
└── store/api/
    └── scheduleApi.ts          (add SSE mutation for auto-assign)
```

#### Test Requirements

**Unit Tests (Vitest, ~5 tests):**
- Modal renders scope selector
- Progress bar updates on SSE events
- Conflict list renders conflict messages
- Summary shows correct counts
- Close button triggers snapshot refetch

**Manual Tests:**
- Trigger auto-assign → modal opens → progress streams → summary shows
- Verify tile badges update after close
- Verify conflicts are reported accurately

#### Definition of Done
- [ ] Modal opens and streams SSE progress
- [ ] Scope selector works
- [ ] Conflicts displayed clearly
- [ ] Tiles update after modal closes
- [ ] Vitest tests passing

---

## 9. Phase 6: Frontend — Operator Timeline

### OP-11 — Operator Timeline Panel

**Scope:** Vertical operator columns showing each operator's assignment timeline, consistent with station column layout.

*Release prerequisites: see §3 YAML.*

#### In Scope
- `OperatorTimeline` panel (toggle-able, like the job details sidebar)
- Vertical columns per operator (same visual language as station columns)
- Operator column header: name, initials badge, status indicator
- Tiles in operator columns: show what each operator is doing, on which station
- Absence blocks: hatched/colored overlay (similar to station unavailability overlay)
- Operating hours: gray overlay for non-working hours (reuse `UnavailabilityOverlay`)
- Unassigned indicator: operators with no tasks in visible range show empty column
- Keyboard shortcut to toggle: `Ctrl+Alt+O`

#### Out of Scope
- Drag-and-drop between operator columns (future)
- Operator reassignment from timeline (use context menu from OP-09)

#### Files to Create

```
apps/web/src/
└── components/
    └── OperatorTimeline/
        ├── OperatorTimeline.tsx          (container with scroll sync)
        ├── OperatorColumn.tsx            (single operator column)
        ├── OperatorColumnHeader.tsx      (name + badge + status)
        ├── AbsenceOverlay.tsx            (hatched overlay for absence periods)
        └── OperatorTile.tsx              (simplified tile showing station name)
```

#### Files to Modify

```
apps/web/src/
├── App.tsx                            (add toggle state, keyboard shortcut)
└── components/
    └── TopNavBar/TopNavBar.tsx         (add toggle button for operator panel)
```

#### Test Requirements

**Unit Tests (Vitest, ~10 tests):**
- OperatorColumn renders tiles for assigned tasks
- OperatorColumn shows absence overlay for absence periods
- OperatorColumn shows unavailability overlay for non-working hours
- OperatorColumnHeader shows name, badge, status
- OperatorTimeline renders one column per active operator
- Toggle shortcut shows/hides panel

**Manual Tests:**
- Toggle operator timeline → panel appears
- Scroll station grid → operator timeline scrolls in sync
- Operator with vacation → hatched overlay visible
- Operator with tasks → tiles show station name and time

#### Definition of Done
- [ ] Operator columns render correctly
- [ ] Absence overlays visible
- [ ] Working hours overlays visible
- [ ] Scroll synchronized with station grid
- [ ] Toggle works (button + keyboard shortcut)
- [ ] Vitest tests passing

---

## 10. Test Strategy

### General Principles

1. **Follow existing patterns exactly.** Entity tests mirror `StationTest.php` structure. Service tests mirror `AutoPlaceV1ServiceTest.php` with mocks. Integration tests use `AuthenticatedWebTestCase`.

2. **Test pyramid.** Heavy unit tests (entity invariants, algorithm correctness), lighter integration tests (API contracts), minimal E2E (deferred to manual QA for operator features).

3. **PHPStan level 8 mandatory.** Every PHP change must pass static analysis before commit.

4. **Backward compatibility tests.** Specifically test that:
   - Existing `TaskAssignment.fromArray()` without `operatorId` key → null
   - Existing assignment JSON without `operatorId` → no errors
   - Validation pipeline with null operatorId → operators validators skipped
   - ScheduleSnapshot without `operators` field → empty array in frontend

### Test Data Setup

**PHP tests:**
- Use private factory methods within test classes (existing pattern)
- Create minimal Operator/Skill/Absence objects for each test
- Mock repositories in service tests (existing pattern)
- Real `BusinessCalendar` dependency for weekday calculations (existing pattern). For timezone conversion, inject `app.business_timezone` parameter directly — `BusinessCalendar` has no timezone capability.

**Frontend tests:**
- Use `createTestStore()` from `testUtils.tsx`
- Mock RTK Query responses for operator endpoints
- Use `renderWithRedux()` for component tests

### Coverage Targets

| Layer | Target | Notes |
|-------|--------|-------|
| Entity invariants | 100% | All business rules tested |
| Enum methods | 100% | Simple, full coverage trivial |
| Validators | 100% | All branches: null operatorId, valid, each conflict type |
| Auto-assign algorithm | 95%+ | All ranking scenarios, edge cases |
| API endpoints | 80%+ | Happy path + key error cases |
| Frontend components | 70%+ | Rendering + key interactions |

---

## 11. Documentation Updates

### OP-12 — Documentation Update

*Release prerequisites: see §3 YAML.*

#### Files to Update

| Document | Changes |
|----------|---------|
| `docs/domain-model/domain-model.md` | Add Operator aggregate (DM-AGG-OPER-001), OperatorSkill (DM-ENT-OPER-001), OperatorAbsence (DM-ENT-OPER-002), OperatorStatus (DM-ENUM-OPER-001), AbsenceType (DM-ENUM-OPER-002) |
| `docs/domain-model/business-rules.md` | Add BR-OPER-001 through BR-OPER-014 |
| `docs/domain-model/domain-vocabulary.md` | Add: Operator, Operator Skill, Primary Station, Operator Absence, Operator Assignment, Auto-Assign |
| `docs/architecture/decision-records.md` | Add ADR-014 (from section 2 of this document) |
| `docs/architecture/aggregate-design.md` | Add AGG-OPER-001 (Operator aggregate) |
| `docs/architecture/service-boundaries.md` | Add SB-OPER-001 (Operator Management service boundary) |
| `docs/architecture/assignment-validation-rules.md` | Add validators 8-10, update blocking classification table |
| `docs/architecture/interface-contracts.md` | Add IC-OPER-001 through IC-OPER-003 (CRU, assignment, auto-assign) |
| `docs/roadmap/release-roadmap.md` | Add operator milestone with OP-01 through OP-12 |

#### Release Notes Draft

```markdown
## Operator Scheduling — MVP

### Summary
Tasks can now be assigned to workshop operators. Operators have work schedules,
vacation/absence tracking, and station skills with primary station preferences.
An auto-assign algorithm fills operator assignments using a greedy chronological
strategy that prioritizes primary station matches and specialists.

### What's New
- **Operator management:** Create and manage workshop operators with names,
  initials, colors, and weekly work schedules
- **Station skills:** Define which stations each operator can work, with a
  primary station preference for scheduling priority
- **Absence tracking:** Record vacation, sick leave, and training periods
- **Manual operator assignment:** Assign operators to scheduled tasks via
  context menu with skill-filtered operator picker
- **Auto-assign:** One-click operator assignment with SSE progress streaming,
  respecting skills, availability, and workload balance
- **Tile badges:** Visual operator identification on schedule tiles with
  colored initials
- **Operator timeline:** Dedicated panel showing each operator's assignment
  timeline with absence and availability overlays
- **3 new validation conflict types:** OperatorSkillConflict, OperatorAvailabilityConflict,
  OperatorDoubleBookingConflict — plus NoOperatorAvailableConflict (auto-assign only)

### Technical
- 3 new database tables: operators, operator_skills, operator_absences
- TaskAssignment extended with nullable operatorId (backward compatible)
- Validation pipeline extended from 7 to 10 validators
- ~15 new API endpoints
- New @flux/types: Operator, OperatorSkill, OperatorAbsence

### Migration Guide
- No breaking changes. Existing schedules work without operators.
- Operator assignment is optional and can be adopted gradually.
- Run `bin/console doctrine:migrations:migrate` for new tables.

### Known Limitations (MVP)
- Operator productivity is uniform (1.0) — no duration variability
- Auto-assign does not integrate with autoplace Phase 1
- No drag-and-drop operator assignment on timeline
- Full-day absence granularity only (no half-day absences)
- Fixed weekly schedule only (no rotating shifts)
- One operator per task — tasks spanning shift boundaries cannot be split between operators
- No bulk operator reassignment (e.g., "reassign all of operator X's tasks to operator Y")
- Smart compaction does not re-validate operator assignments — run auto-assign after compaction
- Operators cannot be deleted — use Inactive status to decommission
```

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Performance: auto-assign slow with many tasks** | Low | Medium | Algorithm is O(T×O) with small O. For 500 tasks × 20 operators = 10K comparisons — trivial. Add benchmarks in OP-05 tests. |
| **Data migration: stale operatorIds** | Low | Low | TaskAssignment.operatorId is nullable. If an operator is set to Inactive, existing assignments retain the operatorId. The validation pipeline flags OperatorAvailabilityConflict (reason: 'inactive') for manual resolution. |
| **UX confusion: two assignment concepts** | Medium | Medium | Clear separation in UI: station assignment (where) vs operator assignment (who). Tooltips explain the distinction. |
| **Scope creep: productivity in MVP** | Medium | High | Data model explicitly reserves `productivity` for V2 with a commented-out column. Refuse any duration-variability work in MVP PRs. |
| **Breaking existing tests** | Low | High | TaskAssignment changes are backward compatible (null default). Run full test suite after OP-03. |
| **Frontend performance: extra badge rendering** | Low | Low | OperatorBadge is a lightweight SVG circle. Memoize with React.memo. |
| **Operator-station FK integrity** | Low | Medium | No FK from operator_skills.station_id to stations (aggregate boundary). If station deleted, stale skills become orphaned. Mitigation: `StationDeleted` event listener removes related skills (see data model §12). |
| **Absence granularity limitations** | Medium | Medium | MVP only supports full-day absences. Half-day absences (e.g., afternoon doctor appointment) cannot be modeled. Mitigation: documented as known limitation, V2b extension path defined in data model §13. |
| **Dual availability logic (PHP + TypeScript)** | Medium | High | Availability checking (absence overlap, operating hours, assignment overlap) is implemented in both TypeScript validators (OP-04) and PHP auto-assign (OP-05). If one is updated without the other, validation and auto-assign will disagree. Mitigation: OP-05 writes `docs/architecture/operator-availability-rules.md` as shared formal specification with cross-referencing test vectors. |
| **Concurrent operator assignment (race condition)** | Medium | Medium | Two users assigning different operators to the same task simultaneously causes last-write-wins. Mitigation: rely on existing schedule `version` field for optimistic locking; document limitation. Full mutual exclusion deferred to post-MVP. |
| **Smart compaction invalidates operator assignments** | Medium | Medium | Smart compaction moves tiles in time but does not re-validate operator assignments. A previously valid assignment may become invalid (e.g., tile moved into absence). Mitigation: recommend running auto-assign after smart compaction; validation pipeline flags new conflicts. |
| **Concurrent SSE operations** | Low | High | Auto-assign running while autoplace or smart compaction is in progress may cause conflicting schedule mutations. Mitigation: auto-assign acquires `SseOperationLock` and returns 409 if held (OP-05); frontend disables button during other operations (OP-10). Existing SSE endpoints have no lock — retrofitting is optional for MVP (low risk in single-user workshop). |
| **Auto-assign conflict reports are ephemeral** | Medium | Low | Conflicts shown in SSE modal are lost after closing — no persistent record. Mitigation: conflicts are re-discoverable by running auto-assign again or via the validation pipeline. Consider adding a conflict log in post-MVP. |
| **Snapshot payload growth** | Low | Low | Adding `operators[]` to every snapshot increases payload by ~500 bytes per operator. With 20 operators, ~10 KB additional. Mitigation: monitor snapshot size; if problematic, fetch operators separately via `/api/v1/operators` and join client-side. |
| **Absence/schedule changes don't cascade to assignments** | Medium | Medium | Modifying an operator's absences or schedule after assignments exist does not trigger re-validation. Stale assignments silently become invalid. Mitigation (MVP): validation pipeline flags conflicts on next pass. **Post-MVP:** API warning header on mutations; UI toast (see data model §11.5 — explicitly deferred). |

---

## 13. Rollback Plan

### Per-release rollback

Each release is independently revertible:

- **OP-01 through OP-03 (Backend):** Revert migration (`bin/console doctrine:migrations:migrate prev`), revert code. TaskAssignment.operatorId null-safe — no data corruption.
- **OP-04 (Validator TS + Backend):** Revert TypeScript validators in `packages/validator/`, revert `SnapshotBuilder` change.
- **OP-05 (Backend):** Revert `OperatorAutoAssignService`, `SseOperationLock`, `PlacementContext` operator indexes.
- **OP-06 (Types):** Revert package version. Nullable operatorId means existing code compiles without change.
- **OP-07 through OP-11 (Frontend):** Revert component code. OperatorBadge renders nothing when operatorId is null. No visual regression.

**Rollback order (reverse dependency from §3 YAML):** OP-12, OP-10, OP-11, OP-09, OP-05, OP-08, OP-07, OP-04, OP-06, OP-03, OP-02, OP-01. Consumers are always reverted before their dependencies (e.g., OP-04/OP-07/OP-08 before OP-06 which provides their types).

### Full feature rollback

If the entire operator feature needs to be removed:

1. Drop tables: `operator_absences`, `operator_skills`, `operators`
2. Set all `TaskAssignment.operatorId` to null in Schedule JSON. **Primary method:** PHP migration script (iterates schedules, deserializes JSON, removes `operatorId` from each assignment, saves). This is reliable across all MySQL versions.
   ```php
   // bin/console app:rollback-operator-ids
   foreach ($scheduleRepository->findAll() as $schedule) {
       $assignments = array_map(fn(TaskAssignment $a) => $a->withOperator(null), $schedule->getAssignments());
       $schedule->replaceAllAssignments($assignments);
   }
   $em->flush();
   ```
   **Optional shortcut** (MySQL 8.0+ only — test on backup first):
   ```sql
   UPDATE schedules SET assignments = (
     SELECT JSON_ARRAYAGG(JSON_REMOVE(a.val, '$.operatorId'))
     FROM JSON_TABLE(assignments, '$[*]' COLUMNS(val JSON PATH '$')) AS a
   ) WHERE assignments IS NOT NULL;
   ```
3. Revert `TaskAssignment.php` (remove operatorId) — existing fromArray() ignores unknown keys
4. Remove operator-related controllers, entities, validators, services
5. Remove frontend components (badges, management page, timeline)
6. Revert @flux/types (remove operator.ts, revert assignment.ts)

No data loss to existing schedule data. All operator data is in isolated tables with no FK to core scheduling tables.
