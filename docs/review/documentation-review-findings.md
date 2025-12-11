# Documentation Review Findings – Flux Print Shop Scheduling System

**Review Date:** 2025-12-11
**Reviewer:** Claude
**Purpose:** Identify inconsistencies, errors, and gaps before implementation

---

## Summary

| Severity | Count | Resolved |
|----------|-------|----------|
| 🔴 **Critical** | 2 | 2 ✅ |
| 🟠 **Major** | 3 | 3 ✅ |
| 🟡 **Minor** | 5 | 5 ✅ |
| 🔵 **Suggestions** | 3 | 3 ✅ |

---

## 🔴 Critical Issues

### ~~CRIT-001: interface-contracts.md uses OLD domain model~~ ✅ RESOLVED

**Location:** `docs/architecture/interface-contracts.md`

**Problem:** This file still describes the old "Operations Research System" with Equipment → Operator → Job → Task workflow. It references:
- Resource Management Service (Operators, Equipment)
- Operators with availability and skills
- Equipment with supportedTaskTypes
- Execution Tracking Service
- Skill-based validation

**Expected:** Should describe "Flux Print Shop Scheduling System" with Station → Job → Task workflow:
- Station Management Service (Stations, Categories, Groups, Providers)
- Stations with operating schedules
- No operators concept
- No execution tracking in MVP

**Impact:** If used for implementation, would create completely wrong service contracts.

**Resolution:** File completely rewritten on 2025-12-11 with:
- Station Management Service (RegisterStation, UpdateOperatingSchedule, AddScheduleException, GetStationAvailability)
- Station Category Service (CreateCategory, UpdateSimilarityCriteria)
- Station Group Service (CreateGroup, CheckGroupCapacity)
- Outsourced Provider Service (RegisterProvider, GetProviderDetails)
- Job Management Service (CreateJob, UpdateJobDetails, ReorderTasks, SetJobDependency, UpdateProofStatus, UpdatePlatesStatus, UpdatePaperStatus, AddComment, GetJobDetails)
- Assignment & Validation Service (AssignTask, RecallTask, RescheduleTask, ValidateProposedAssignment, ValidateScheduleScope)
- Scheduling View Service (GetScheduleSnapshot)
- DSL Parsing Service (ParseDSL, GetAutocompleteSuggestions)
- Business Calendar Service (CalculateOpenDays, CountOpenDaysBetween)

---

### ~~CRIT-002: Frontend mock code uses OLD domain model~~ ✅ RESOLVED

**Location:** `apps/web/src/`

**Problem:** The frontend code still implements the old Operations Research domain:
- Uses `Operator`, `Equipment`, `OperatorSkill` types
- Mock generators create operators and equipment
- API endpoints reference the old domain

**Expected:** Should implement the print shop domain:
- Uses `Station`, `StationCategory`, `StationGroup`, `OutsourcedProvider` types
- Mock generators create stations, categories, groups, providers
- API matches `api-interface-drafts.md`

**Impact:** Frontend cannot be used as-is for the new domain.

**Resolution:** Complete rewrite performed on 2025-12-11:
- **Types (`types/index.ts`)**: Replaced Operator/Equipment/OperatorSkill with Station/StationCategory/StationGroup/OutsourcedProvider/Task with DSL fields
- **Mock generators**:
  - Created `generators/stations.ts` for stations, categories, groups, providers
  - Rewrote `generators/jobs.ts` for print shop jobs with DSL-based tasks
  - Rewrote `generators/assignments.ts` for new task/station model
  - Deleted old `generators/operators.ts` and `generators/equipment.ts`
- **Mock API (`services/mockApi.ts`)**: Complete rewrite with Station/Provider/Job CRUD operations
- **Store**:
  - `scheduleSlice.ts`: Updated thunks for Station/Provider/Job CRUD
  - `uiSlice.ts`: Changed gridView from equipment/operator to stations/providers
- **CRUD components**:
  - Created `StationList.tsx` and `ProviderList.tsx`
  - Updated `JobList.tsx` for new job structure (reference, client, tasks array)
  - Updated `CrudPanel.tsx` for stations/providers/jobs tabs
  - Deleted old `OperatorList.tsx` and `EquipmentList.tsx`
- **Panels**:
  - Updated `UnassignedTasksPanel.tsx` for tasks nested in jobs
  - Updated `TaskDetailPanel.tsx` for new task/station/provider structure
- **Scheduling components**:
  - Updated `SchedulingGrid.tsx` for stations/providers view
  - Updated `TaskBlock.tsx` for new task structure
  - Updated `Header.tsx` for Stations/Providers toggle

---

## 🟠 Major Issues

### ~~MAJ-001: Inconsistent conflict type naming~~ ✅ RESOLVED

**Locations:**
- `docs/domain-model/domain-vocabulary.md`
- `docs/domain-model/business-rules.md`
- `docs/domain-model/workflow-definitions.md`
- `docs/domain-model/domain-model.md`
- `docs/requirements/initial-data-model.md`

**Problem:** Conflict types were named inconsistently (DependencyConflict vs PrecedenceConflict).

**Resolution:** All documents updated on 2025-12-11 to use consistent naming:
- `StationConflict` – station double-booked
- `GroupCapacityConflict` – station group max concurrent exceeded
- `PrecedenceConflict` – task scheduled before predecessor task completes
- `ApprovalGateConflict` – approval gate not satisfied
- `AvailabilityConflict` – task scheduled outside station operating hours
- `DeadlineConflict` – task completion exceeds job workshop exit date

---

### ~~MAJ-002: Missing AvailabilityConflict definition~~ ✅ RESOLVED

**Locations:**
- `docs/domain-model/domain-vocabulary.md`
- `docs/requirements/initial-data-model.md`

**Problem:** AvailabilityConflict was missing from core domain documents.

**Resolution:** AvailabilityConflict added to all conflict type definitions on 2025-12-11.

---

### ~~MAJ-003: ScheduleException type value inconsistency~~ ✅ RESOLVED

**Locations:**
- `docs/requirements/initial-data-model.md`: `Closed | ModifiedHours`
- `docs/architecture/event-message-design.md`: `Closed | Modified`

**Problem:** The type enum values didn't match. One said "ModifiedHours", the other said "Modified".

**Resolution:** Updated event-message-design.md to use `ModifiedHours` on 2025-12-11. All documents now use `Closed | ModifiedHours`.

---

## 🟡 Minor Issues

### ~~MIN-001: Roadmap shows frontend foundation as complete~~ ✅ NOT AN ISSUE

**Location:** `docs/roadmap/release-roadmap.md`

**Problem:** Originally reported that v0.0.5 "Frontend Project Foundation" was marked as completed with wrong domain model.

**Resolution:** Upon inspection, no completion markers (✅ or [x]) exist in the roadmap - all items show `[ ]`. The frontend foundation setup (Vite + React + TypeScript, Tailwind CSS, Redux Toolkit, folder structure) was implemented. The domain model issue was addressed separately in CRIT-002. This was a false report.

---

### ~~MIN-002: Missing "Delayed" status in event-message-design.md~~ ✅ RESOLVED

**Location:** `docs/architecture/event-message-design.md`, JobStatusChanged event

**Problem:** The JobStatusChanged event was missing `Delayed` status that exists in the domain model.

**Resolution:** Added `Delayed` to both `previousStatus` and `newStatus` enums in the JobStatusChanged event on 2025-12-11. Now reads: `Draft|Planned|InProgress|Delayed|Completed|Cancelled`.

---

### ~~MIN-003: Inconsistent proofSentAt special value notation~~ ✅ RESOLVED

**Locations:**
- `docs/domain-model/domain-model.md`
- `docs/requirements/initial-data-model.md`

**Problem:** Minor formatting inconsistency in how special values were represented (quoted vs unquoted).

**Resolution:** Standardized on 2025-12-11 to use backtick code format without quotes: `AwaitingFile` and `NoProofRequired`. Updated domain-model.md to use consistent notation.

---

### ~~MIN-004: Business calendar service not in roadmap~~ ✅ NOT AN ISSUE

**Location:** `docs/roadmap/release-roadmap.md`

**Problem:** Originally reported that Business Calendar Service was missing from roadmap.

**Resolution:** Upon inspection, v0.2.16 already contains the Business Calendar section with all required tasks. This was a false positive - the roadmap is correct.

---

### ~~MIN-005: Duplicate service-boundaries.md files with differences~~ ✅ RESOLVED

**Location:**
- `docs/architecture/service-boundaries.md` - **More complete** (kept)
- `docs/domain-model/service-boundaries.md` - Less detailed (deleted)

**Problem:** Two files with the same name existed with different levels of detail.

**Resolution:** Deleted `docs/domain-model/service-boundaries.md` on 2025-12-11. The architecture version is now the single authoritative source, which includes:
- Validation Service as separate Node.js service with `@flux/schedule-validator` package
- Hybrid PHP + Node.js architecture details
- Technology mapping section
- Docker deployment examples

---

## 🔵 Suggestions

### ~~SUG-001: Add validation rules summary table~~ ✅ IMPLEMENTED

**Location:** `docs/domain-model/business-rules.md`

**Suggestion:** Add a summary table mapping validation rules to conflict types.

**Resolution:** Added on 2025-12-11:
- "Quick Reference: Validation Rules Summary" section with complete rule-to-conflict mapping
- Conflict Type Definitions table with visual indicators
- Validation Timing table showing response time requirements

---

### ~~SUG-002: Add DSL examples to acceptance criteria~~ ✅ IMPLEMENTED

**Location:** `docs/requirements/acceptance-criteria.md`

**Suggestion:** Add DSL edge cases and examples.

**Resolution:** Added AC-JOB-004b on 2025-12-11 with comprehensive DSL syntax examples:
- Internal tasks (station-based) with setup+run, comments
- Outsourced tasks (provider-based) with action types
- Edge cases (valid/invalid syntax)
- Multi-line examples
- Empty lines and comments handling
- Error recovery behavior

---

### ~~SUG-003: Add sequence diagrams reference~~ ✅ IMPLEMENTED

**Location:** `docs/architecture/sequence-design.md`

**Suggestion:** Update sequence diagrams for new domain.

**Resolution:** Complete rewrite on 2025-12-11 with 8 key flows for Flux Print Shop domain:
1. Task Assignment (Drag & Drop) with isomorphic validation
2. Job Creation with DSL Tasks
3. Approval Gate Update (BAT Approval)
4. Station Schedule Exception
5. Task Recall (Unassign)
6. Late Job Detection
7. Outsourced Task Scheduling with business calendar
8. Real-time Conflict Resolution

Each flow includes textual description and Mermaid sequence diagram.

---

## Consistency Matrix

### Verified Consistent ✅

| Item | Documents Checked |
|------|-------------------|
| JobStatus enum values | domain-vocabulary, domain-model, initial-data-model, api-interface-drafts |
| TaskStatus enum values | domain-vocabulary, domain-model, initial-data-model, api-interface-drafts |
| StationStatus enum values | domain-vocabulary, domain-model, initial-data-model |
| PaperPurchaseStatus enum | domain-vocabulary, domain-model, initial-data-model |
| PlatesStatus enum | domain-vocabulary, domain-model, initial-data-model |
| TimeSlot field names (start/end) | All documents |
| DSL syntax | task-dsl-specification, user-stories, acceptance-criteria |
| Approval gates (BAT, Plates) | domain-vocabulary, business-rules, acceptance-criteria |

### ~~Needs Update~~ ✅ All Fixed

| Item | Issue | Status |
|------|-------|--------|
| ~~ScheduleConflict types~~ | ~~Naming inconsistency~~ | ✅ Fixed |
| ~~ScheduleException.type values~~ | ~~ModifiedHours vs Modified~~ | ✅ Fixed |
| ~~interface-contracts.md~~ | ~~Wrong domain~~ | ✅ Fixed |
| ~~Frontend code~~ | ~~Wrong domain~~ | ✅ Fixed |
| ~~JobStatusChanged event~~ | ~~Missing Delayed status~~ | ✅ Fixed |
| ~~proofSentAt notation~~ | ~~Inconsistent quotes~~ | ✅ Fixed |
| ~~Duplicate service-boundaries.md~~ | ~~Two versions~~ | ✅ Fixed |

---

## Recommended Action Priority

### ~~Immediate (Before Implementation)~~ ✅ ALL COMPLETE

1. ~~**CRIT-001**: Rewrite interface-contracts.md for print shop domain~~ ✅
2. ~~**MAJ-001**: Standardize conflict type naming across all documents~~ ✅
3. ~~**MAJ-002**: Add AvailabilityConflict to domain documents~~ ✅
4. ~~**MAJ-003**: Fix ScheduleException type enum~~ ✅

### ~~Before Frontend Development~~ ✅ ALL COMPLETE

5. ~~**CRIT-002**: Rewrite frontend mock code for print shop domain~~ ✅
6. ~~**MIN-001**: Roadmap completion markers~~ ✅ (was not an issue)
7. ~~**MIN-002**: Add Delayed to event status~~ ✅
8. ~~**MIN-003**: Standardize proofSentAt notation~~ ✅
9. ~~**MIN-004**: Business calendar in roadmap~~ ✅ (was not an issue)
10. ~~**MIN-005**: Resolve duplicate service-boundaries files~~ ✅

### ~~Nice to Have (Suggestions)~~ ✅ ALL COMPLETE

11. ~~**SUG-001**: Add validation rules summary table~~ ✅
12. ~~**SUG-002**: Add DSL examples to acceptance criteria~~ ✅
13. ~~**SUG-003**: Add sequence diagrams reference~~ ✅

---

## Conclusion

The core domain documentation (domain-vocabulary, domain-model, initial-data-model, business-rules, user-stories, acceptance-criteria, api-interface-drafts) is **consistent and well-structured** for the print shop scheduling domain.

**All issues have been resolved (13/13):**

*Critical (2/2):*
- ~~CRIT-001: `interface-contracts.md` rewritten for print shop domain~~ ✅
- ~~CRIT-002: Frontend code refactored for print shop domain~~ ✅

*Major (3/3):*
- ~~MAJ-001: Conflict type naming standardized~~ ✅
- ~~MAJ-002: AvailabilityConflict added to domain documents~~ ✅
- ~~MAJ-003: ScheduleException type enum fixed~~ ✅

*Minor (5/5):*
- ~~MIN-001: Roadmap frontend markers~~ ✅ (was not an issue)
- ~~MIN-002: Added Delayed status to JobStatusChanged event~~ ✅
- ~~MIN-003: Standardized proofSentAt notation~~ ✅
- ~~MIN-004: Business calendar in roadmap~~ ✅ (was not an issue)
- ~~MIN-005: Deleted duplicate service-boundaries.md~~ ✅

*Suggestions (3/3):*
- ~~SUG-001: Added validation rules summary table to business-rules.md~~ ✅
- ~~SUG-002: Added DSL syntax examples to acceptance criteria~~ ✅
- ~~SUG-003: Rewrote sequence-design.md with 8 key flows~~ ✅

**The documentation is now 100% consistent and complete.** Ready for feature definitions and implementation.
