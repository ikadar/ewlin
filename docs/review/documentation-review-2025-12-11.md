# Documentation Review – 2025-12-11

> **Scope:** Complete documentation review for Flux Print Shop Scheduling System
>
> **Goal:** Ensure documentation is accurate and consistent for feature definitions and implementation
>
> **Focus:** Milestone 0 releases (v0.0.1 - v0.0.7)
>
> **Status:** ✅ ALL ISSUES RESOLVED

---

## Executive Summary

The documentation is **comprehensive and well-structured**, covering domain model, architecture decisions, business rules, and release plans. All identified inconsistencies and gaps have been **resolved**.

### Critical Issues (3) - ✅ RESOLVED
1. ~~Missing v0.0.7 release document~~ → Created `docs/releases/v0.0.7-ci-fixes.md`
2. ~~Release roadmap not updated for v0.0.7~~ → Updated roadmap with v0.0.7
3. ~~M2 Phase 2A duplicates work already completed in v0.0.4~~ → Marked as completed in roadmap

### Moderate Issues (4) - ✅ RESOLVED
4. ~~Domain model vs @flux/types type mismatches~~ → Added missing fields to @flux/types
5. ~~ScheduleException structure mismatch~~ → Updated domain model (previously fixed)
6. ~~SimilarityCriterion field naming inconsistency~~ → Updated domain model (previously fixed)
7. ~~Missing fields in implementation~~ → Added: Station.capacity, StationGroup.isOutsourcedProviderGroup, OutsourcedProvider.status

---

## Issue Details

### CRITICAL-001: Missing v0.0.7 Release Document

**Status:** ✅ RESOLVED

**Description:**
Release v0.0.7 (CI Fixes) was created on 2025-12-11 but has no corresponding release document.

**Location:** `docs/releases/` (file missing)

**Impact:** Incomplete release history, M0 milestone not fully documented.

**Resolution:** Create `docs/releases/v0.0.7-ci-fixes.md`

---

### CRITICAL-002: Release Roadmap Not Updated

**Status:** ✅ RESOLVED

**Description:**
The release roadmap (`docs/roadmap/release-roadmap.md`) shows M0 as completed with v0.0.6, but v0.0.7 now exists.

**Location:** `docs/roadmap/release-roadmap.md`, line 87-92

**Current State:**
```markdown
### v0.0.6 - CI/CD Pipeline Foundation ✅
- [x] GitHub Actions workflows (ci.yml, docker.yml)
...
```

**Required Update:**
Add v0.0.7 section after v0.0.6.

---

### CRITICAL-003: M2 Phase 2A Duplicates v0.0.4 Work

**Status:** ✅ RESOLVED

**Description:**
The release roadmap (v0.2.0 - v0.2.6) plans validation work that was **already completed in v0.0.4**:

| Roadmap (v0.2.x) | Already Done (v0.0.4) |
|------------------|----------------------|
| v0.2.0 - Core Validation Types | ✅ @flux/types |
| v0.2.1 - Station Conflict Validation | ✅ validators/station.ts |
| v0.2.2 - Group Capacity Validation | ✅ validators/group.ts |
| v0.2.3 - Precedence Validation | ✅ validators/precedence.ts |
| v0.2.4 - Approval Gate Validation | ✅ validators/approval.ts |
| v0.2.5 - Availability Validation | ✅ validators/availability.ts |
| v0.2.6 - Package Build & Publish | ✅ Package built |

**Location:** `docs/roadmap/release-roadmap.md`, lines 222-262

**Impact:** Misleading roadmap; developers may re-implement existing code.

**Resolution:**
- Mark M2 Phase 2A (v0.2.0-v0.2.6) as completed
- Update descriptions to reference v0.0.4 implementation
- Start M2 from Phase 2B (Validation Service)

---

### MODERATE-001: Domain Model vs @flux/types Mismatches

**Status:** ✅ RESOLVED

**Description:**
Several fields defined in domain model (`docs/domain-model/domain-model.md`) are missing from `@flux/types` implementation:

| Entity | Domain Model Field | @flux/types Status |
|--------|-------------------|-------------------|
| Station | `Capacity` (integer, typically 1) | **Missing** |
| StationGroup | `IsOutsourcedProviderGroup` (boolean) | **Missing** |
| OutsourcedProvider | `Status` (Active/Inactive) | **Missing** |

**Location:**
- `docs/domain-model/domain-model.md` (lines 21, 45, 58)
- `services/node/packages/types/src/station.ts`

**Impact:** Implementation may not support all documented business rules.

**Resolution Options:**
1. Add missing fields to @flux/types (preferred)
2. Update domain model to match implementation
3. Document as "Future Enhancement"

---

### MODERATE-002: ScheduleException Structure Mismatch

**Status:** ✅ RESOLVED

**Description:**

**Domain Model Definition:**
```
ScheduleException:
  - Date (date)
  - Type (Closed, ModifiedHours)  ← Different
  - TimeSlots (collection)         ← Different
  - Reason (string, optional)
```

**@flux/types Implementation:**
```typescript
interface ScheduleException {
  id: string;
  date: string;
  schedule: DaySchedule;           // ← Uses DaySchedule instead
  reason?: string;
}
```

**Location:**
- `docs/domain-model/domain-model.md`, lines 164-172
- `services/node/packages/types/src/station.ts`, lines 36-45

**Impact:**
- The implementations are functionally equivalent (`DaySchedule.isOperating=false` = "Closed")
- But documentation doesn't match code

**Resolution:** Update domain model to reflect actual implementation structure.

---

### MODERATE-003: SimilarityCriterion Field Naming

**Status:** ✅ RESOLVED

**Description:**

**Domain Model:**
```
SimilarityCriterion:
  - Name (string)
  - Code (string, for matching logic)
```

**@flux/types:**
```typescript
interface SimilarityCriterion {
  id: string;
  name: string;
  fieldPath: string;  // ← Called "fieldPath", not "Code"
}
```

**Location:**
- `docs/domain-model/domain-model.md`, lines 173-179
- `services/node/packages/types/src/station.ts`, lines 47-53

**Resolution:** Align naming - recommend keeping `fieldPath` as it's more descriptive.

---

### MODERATE-004: Missing Domain Model Updates

**Status:** ✅ RESOLVED

**Description:**
Several @flux/types definitions have fields not documented in domain model:

| Type | Field | Description |
|------|-------|-------------|
| Job | `fullyScheduled` | Whether all tasks are scheduled |
| Job | `color` | UI color (hex string) |
| Task | `createdAt`, `updatedAt` | Timestamps |
| TaskAssignment | `id`, `createdAt`, `updatedAt` | Timestamps and ID |
| ScheduleSnapshot | Full structure | Not fully documented |

**Location:** `docs/domain-model/domain-model.md`

**Resolution:** Add these fields to domain model documentation.

---

## Validation: Business Rules vs Implementation

### Rules Correctly Implemented in @flux/schedule-validator

| Rule ID | Description | Validator |
|---------|-------------|-----------|
| BR-SCHED-001 | No station double-booking | `validateStationConflict` |
| BR-SCHED-002 | Group capacity enforcement | `validateGroupCapacity` |
| BR-SCHED-003 | Task sequence enforcement | `validatePrecedence` |
| BR-SCHED-005 | Deadline enforcement | `validateDeadline` |
| BR-SCHED-006 | Approval gate enforcement | `validateApprovalGates` |
| BR-ASSIGN-002 | Operating hours compliance | `validateAvailability` |

### Rules Not Yet Implemented (Correct per Roadmap)

| Rule ID | Description | Planned |
|---------|-------------|---------|
| BR-SCHED-004 | Job dependency enforcement | M2 |
| BR-ASSIGN-004 | No retrospective scheduling | M2 |
| BR-ASSIGN-005 | Assignment immutability after start | M2 |

---

## Milestone 0 Release Summary

| Version | Status | Document | Roadmap |
|---------|--------|----------|---------|
| v0.0.1 | ✅ Released | ✅ Exists | ✅ Listed |
| v0.0.2 | ✅ Released | ✅ Exists | ✅ Listed |
| v0.0.3 | ✅ Released | ✅ Exists | ✅ Listed |
| v0.0.4 | ✅ Released | ✅ Exists | ✅ Listed |
| v0.0.5 | ✅ Released | ✅ Exists | ✅ Listed |
| v0.0.6 | ✅ Released | ✅ Exists | ✅ Listed |
| v0.0.7 | ✅ Released | ✅ Exists | ✅ Listed |

---

## Recommendations

### Immediate Actions (Before M1) - ✅ ALL COMPLETED

1. ✅ **Create v0.0.7 release document**
   - Created `docs/releases/v0.0.7-ci-fixes.md`
   - M0 milestone fully documented

2. ✅ **Update release roadmap**
   - Added v0.0.7 to M0 section
   - Marked M2 Phase 2A (v0.2.0-v0.2.6) as completed with v0.0.4 reference
   - M2 now starts from Phase 2B (Validation Service)

3. ✅ **Align domain model with implementation**
   - Updated ScheduleException structure
   - Updated SimilarityCriterion field names (Code → FieldPath)
   - Added ScheduleSnapshot, LateJob, ProposedAssignment, ValidationResult docs

### Future Considerations - ✅ ALL COMPLETED

4. ✅ **Add missing Station fields**
   - Added `capacity` field to Station type
   - Added `isOutsourcedProviderGroup` to StationGroup

5. ✅ **Add missing Provider fields**
   - Added `status` field (ProviderStatus: Active/Inactive) to OutsourcedProvider

---

## Appendix: Files Reviewed

### Release Documents
- `docs/releases/v0.0.1-development-environment.md`
- `docs/releases/v0.0.2-php-symfony-foundation.md`
- `docs/releases/v0.0.3-nodejs-project-foundation.md`
- `docs/releases/v0.0.4-schedule-validator-package.md`
- `docs/releases/v0.0.5-frontend-project-foundation.md`
- `docs/releases/v0.0.6-cicd-pipeline-foundation.md`
- `docs/releases/_TEMPLATE.md`

### Domain Model
- `docs/domain-model/domain-model.md`
- `docs/domain-model/business-rules.md`
- `docs/domain-model/workflow-definitions.md`
- `docs/domain-model/bounded-context-map.md`
- `docs/domain-model/domain-vocabulary.md`
- `docs/domain-model/domain-open-questions.md`

### Architecture
- `docs/architecture/decision-records.md`
- `docs/architecture/service-boundaries.md`
- `docs/architecture/interface-contracts.md`

### Implementation
- `services/node/packages/types/src/station.ts`
- `services/node/packages/types/src/job.ts`
- `services/node/packages/types/src/task.ts`
- `services/node/packages/types/src/assignment.ts`
- `services/node/packages/validator/src/validate.ts`

### Other
- `docs/roadmap/release-roadmap.md`
- `docs/requirements/task-dsl-specification.md`
- `CHANGELOG.md`
