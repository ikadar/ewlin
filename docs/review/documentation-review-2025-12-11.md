# Documentation Review – 2025-12-11

> **Scope:** Complete documentation review for Flux Print Shop Scheduling System
>
> **Goal:** Ensure documentation is accurate and consistent for feature definitions and implementation
>
> **Focus:** Milestone 0 releases (v0.0.1 - v0.0.7)

---

## Executive Summary

The documentation is **comprehensive and well-structured**, covering domain model, architecture decisions, business rules, and release plans. However, several **inconsistencies and gaps** were identified that should be addressed before starting M1 implementation.

### Critical Issues (3)
1. Missing v0.0.7 release document
2. Release roadmap not updated for v0.0.7
3. M2 Phase 2A duplicates work already completed in v0.0.4

### Moderate Issues (4)
4. Domain model vs @flux/types type mismatches
5. ScheduleException structure mismatch
6. SimilarityCriterion field naming inconsistency
7. Missing fields in implementation

---

## Issue Details

### CRITICAL-001: Missing v0.0.7 Release Document

**Status:** Missing

**Description:**
Release v0.0.7 (CI Fixes) was created on 2025-12-11 but has no corresponding release document.

**Location:** `docs/releases/` (file missing)

**Impact:** Incomplete release history, M0 milestone not fully documented.

**Resolution:** Create `docs/releases/v0.0.7-ci-fixes.md`

---

### CRITICAL-002: Release Roadmap Not Updated

**Status:** Out of date

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

**Status:** Roadmap inconsistency

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

**Status:** Inconsistent

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

**Status:** Structural difference

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

**Status:** Naming inconsistency

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

**Status:** Documentation gap

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
| v0.0.7 | ✅ Released | ❌ **Missing** | ❌ **Not listed** |

---

## Recommendations

### Immediate Actions (Before M1)

1. **Create v0.0.7 release document**
   - Document CI fixes
   - Mark M0 as fully complete

2. **Update release roadmap**
   - Add v0.0.7 to M0 section
   - Mark M2 Phase 2A (v0.2.0-v0.2.6) as completed, reference v0.0.4
   - Renumber M2 to start from Validation Service (v0.2.7)

3. **Align domain model with implementation**
   - Update ScheduleException structure
   - Update SimilarityCriterion field names
   - Add missing timestamp fields

### Future Considerations

4. **Add missing Station fields**
   - Consider adding `capacity` field (even if always 1)
   - Add `IsOutsourcedProviderGroup` to StationGroup or document alternative

5. **Add missing Provider fields**
   - Consider adding `status` field (Active/Inactive)

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
