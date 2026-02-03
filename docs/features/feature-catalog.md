# Feature Catalog

> **Status:** In Progress
>
> **Last Updated:** 2026-02-03
>
> **Purpose:** Single Source of Truth az alkalmazás összes aktív feature-jéről.

---

## Overview

Ez a dokumentum az alkalmazás összes aktív feature-jét tartalmazza, logikai csoportokba rendezve. A Manual QA Plan ebből a katalógusból származik.

### Státuszok

| Státusz | Jelentés |
|---------|----------|
| `Active` | Működő, tesztelt feature |
| `Suspicious` | Gyanús (nincs teszt, de kód létezik) - review szükséges |
| `Deprecated` | Felülírt vagy eltávolított - nem kerül a QA Plan-be |

### ID Prefixek

| Prefix | Terület |
|--------|---------|
| `API-` | Backend API (M1, M2) |
| `SCHED-` | Scheduler UI (M3) |
| `JCF-` | Job Creation Form (M4) |

---

## Backend API Features

### B1: Station Management API (v0.1.0 - v0.1.7)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| API-001 | Station Entity | Station aggregate root with status, category, group references | Active | v0.1.0 |
| API-002 | StationStatus Enum | Station states: Active, Inactive, Maintenance, OutOfService | Active | v0.1.0 |
| API-003 | Station CRUD API | POST/GET/PUT/DELETE /api/v1/stations endpoints | Active | v0.1.1 |
| API-004 | Station List Filtering | Filter stations by status, category, group; search by name | Active | v0.1.1 |
| API-005 | OpenAPI Documentation | Swagger UI at /api/doc for all API endpoints | Active | v0.1.1 |
| API-006 | TimeSlot Value Object | Time range (HH:MM format) with overlap detection | Active | v0.1.2 |
| API-007 | OperatingSchedule Value Object | Weekly pattern (Mon-Sun) with day schedules | Active | v0.1.2 |
| API-008 | Operating Schedule API | PUT /api/v1/stations/{id}/schedule endpoint | Active | v0.1.2 |
| API-009 | Schedule Slot Validation | Overlap detection, time format validation | Active | v0.1.2 |
| API-010 | ScheduleException Value Object | Date-specific overrides (CLOSED/MODIFIED types) | Active | v0.1.3 |
| API-011 | Schedule Exception API | POST/GET/DELETE /api/v1/stations/{id}/exceptions endpoints | Active | v0.1.3 |
| API-012 | StationCategory Entity | Category with similarity criteria for visual indicators | Active | v0.1.4 |
| API-013 | SimilarityCriterion Value Object | Code, name, fieldPath for job comparison | Active | v0.1.4 |
| API-014 | Station Category CRUD API | POST/GET/PUT/DELETE /api/v1/station-categories endpoints | Active | v0.1.4 |
| API-015 | StationGroup Entity | Group with maxConcurrent limit, provider group flag | Active | v0.1.5 |
| API-016 | Station Group CRUD API | POST/GET/PUT/DELETE /api/v1/station-groups endpoints | Active | v0.1.5 |
| API-017 | OutsourcedProvider Entity | Provider with action types, departure/reception times | Active | v0.1.6 |
| API-018 | Provider CRUD API | POST/GET/PUT/DELETE /api/v1/providers endpoints | Active | v0.1.6 |
| API-019 | Auto-create Provider Group | Provider creation auto-creates unlimited capacity group | Active | v0.1.6 |
| API-020 | Domain Event Infrastructure | DomainEvent base class, RecordsDomainEvents trait | Active | v0.1.7 |
| API-021 | Station Domain Events | StationRegistered, OperatingScheduleUpdated, ScheduleExceptionAdded, StationStatusChanged | Active | v0.1.7 |

### B2: Job Management API (v0.1.9 - v0.1.19)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| API-022 | Job Entity | Job aggregate root with reference, client, description, workshopExitDate, color | Active | v0.1.9 |
| API-023 | JobStatus Enum | Job states: Draft, Planned, InProgress, Delayed, Completed, Cancelled | Active | v0.1.9 |
| API-024 | Job Color Assignment | Random hex color from curated 10-color palette for visual identification | Active | v0.1.9 |
| API-025 | Job CRUD API | POST/GET/PUT/DELETE /api/v1/jobs endpoints with pagination and filtering | Active | v0.1.10 |
| API-026 | Job List Filtering | Filter by status; search across reference, client, description fields | Active | v0.1.10 |
| API-027 | Task Entity | Task entity within Job aggregate with sequenceOrder, taskType, status | Active | v0.1.11 |
| API-028 | TaskStatus Enum | Task states: Defined, Ready, Assigned, Completed, Cancelled | Active | v0.1.11 |
| API-029 | TaskType Enum | Task types: Internal (workshop) / Outsourced (external provider) | Active | v0.1.11 |
| API-030 | Duration Value Object | Setup+run minutes (internal) or open days (outsourced) | Active | v0.1.11 |
| API-031 | Job-Task Relationship | addInternalTask(), addOutsourcedTask() with auto-incrementing sequence | Active | v0.1.11 |
| API-032 | DSL Parser Service | Server-side semantic validation of Task DSL (station/provider existence) | Active | v0.1.12 |
| API-033 | Job Creation with DSL | POST /api/v1/jobs accepts tasksDsl field, creates Task entities | Active | v0.1.12 |
| API-034 | DSL Validation Errors | Line-numbered validation errors for DSL parsing failures | Active | v0.1.12 |
| API-035 | Station Names Autocomplete | GET /api/v1/stations/names for DSL editor autocomplete | Active | v0.1.13 |
| API-036 | Provider Names Autocomplete | GET /api/v1/providers/names for DSL editor autocomplete | Active | v0.1.13 |
| API-037 | Action Types Autocomplete | GET /api/v1/providers/action-types for DSL editor autocomplete | Active | v0.1.13 |
| API-038 | Proof Approval Gates | proofSentAt, proofApprovedAt fields with special values (AwaitingFile, NoProofRequired) | Active | v0.1.14 |
| API-039 | Plates Status Gate | platesStatus field (Todo/Done) for plates preparation tracking | Active | v0.1.14 |
| API-040 | Approval Gates API | PUT /api/v1/jobs/{id}/proof and /plates endpoints | Active | v0.1.14 |
| API-041 | Paper Procurement Tracking | paperPurchaseStatus (InStock/ToOrder/Ordered/Received), paperOrderedAt auto-timestamp | Active | v0.1.15 |
| API-042 | Paper Status API | PUT /api/v1/jobs/{id}/paper with transition validation | Active | v0.1.15 |
| API-043 | Job Dependencies | requiredJobIds field for finish-to-start job relationships | Active | v0.1.16 |
| API-044 | Circular Dependency Detection | DFS traversal prevents circular job dependency graphs | Active | v0.1.16 |
| API-045 | Dependencies API | POST/GET/DELETE /api/v1/jobs/{id}/dependencies endpoints | Active | v0.1.16 |
| API-046 | Job Comments | JobComment entity with author, content, createdAt (immutable audit trail) | Active | v0.1.17 |
| API-047 | Comments API | POST/GET /api/v1/jobs/{id}/comments endpoints | Active | v0.1.17 |
| API-048 | Job Domain Events | JobCreated, TaskAddedToJob, ApprovalGateUpdated, JobCancelled events | Active | v0.1.18 |
| API-049 | Job Cancellation | POST /api/v1/jobs/{id}/cancel with task cascade cancellation | Active | v0.1.19 |

### B3: Validation & Assignment API (v0.2.7 - v0.2.18)

| ID | Feature | Leírás | Státusz | Release |
|----|---------|--------|---------|---------|
| API-050 | Validation Service Setup | Node.js/Express HTTP server with health check, logging, error handling | Active | v0.2.7 |
| API-051 | Validation API Endpoint | POST /validate endpoint exposing @flux/schedule-validator via REST | Active | v0.2.8 |
| API-052 | Zod Request Validation | Request schema validation with detailed error messages | Active | v0.2.8 |
| API-053 | Validation Service Docker | Multi-stage Dockerfile with Docker Compose integration | Active | v0.2.9 |
| API-054 | Schedule Entity | Aggregate root managing task assignments with version tracking | Active | v0.2.10 |
| API-055 | TaskAssignment Value Object | Immutable assignment data with taskId, targetId, scheduledStart/End, completion | Active | v0.2.10 |
| API-056 | Schedule Domain Events | ScheduleCreated, TaskAssigned, TaskUnassigned, TaskCompletionToggled events | Active | v0.2.10 |
| API-057 | Assignment API | POST /api/v1/tasks/{taskId}/assign with Validation Service integration | Active | v0.2.11 |
| API-058 | ValidationServiceClient | HTTP client for PHP-to-Node.js Validation Service communication | Active | v0.2.11 |
| API-059 | SnapshotBuilder | Builds schedule snapshot for validation requests | Active | v0.2.11 |
| API-060 | EndTimeCalculator | Calculates scheduledEnd for internal tasks (stretching) and outsourced tasks | Active | v0.2.12 |
| API-061 | Internal Task Stretching | End time spans operating schedule gaps (nights, weekends, breaks) | Active | v0.2.12 |
| API-062 | Outsourced Task Calculation | Business day counting with departure/reception time handling | Active | v0.2.12 |
| API-063 | BusinessCalendar Service | Weekday-based business day calculations (isBusinessDay, addBusinessDays) | Active | v0.2.12 |
| API-064 | Unassign Task API | DELETE /api/v1/tasks/{taskId}/assign - recalls task to Ready status | Active | v0.2.13 |
| API-065 | Reschedule Task API | PUT /api/v1/tasks/{taskId}/assign - updates time/target with revalidation | Active | v0.2.14 |
| API-066 | TaskRescheduled Event | Domain event capturing reschedule details (old/new target, times) | Active | v0.2.14 |
| API-067 | Schedule Snapshot API | GET /api/v1/schedule/snapshot - full schedule state for frontend | Active | v0.2.15 |
| API-068 | Business Calendar API | GET /api/v1/calendar/open-days - query business days in date range | Active | v0.2.16 |
| API-069 | ConflictDetected Event | Domain event for validation conflicts (logging/monitoring) | Active | v0.2.17 |
| API-070 | ScheduleUpdated Event | Generic event for any schedule change (cache invalidation) | Active | v0.2.17 |
| API-071 | Task Completion Toggle | PUT /api/v1/tasks/{taskId}/completion - manual checkbox toggle | Active | v0.2.18 |

---

## Scheduler UI Features

### B4: Mock Data, Layout, Grid (v0.3.0 - v0.3.10)

*Pending - B4 batch feldolgozás után*

### B5: Drag & Drop Basics (v0.3.11 - v0.3.20)

*Pending - B5 batch feldolgozás után*

### B6: Station Compact, Fixes (v0.3.21 - v0.3.33)

*Pending - B6 batch feldolgozás után*

### B7: Navigation, Layout, UX (v0.3.34 - v0.3.46)

*Pending - B7 batch feldolgozás után*

### B8: DateStrip, Validation, Pick&Place (v0.3.47 - v0.3.60)

*Pending - B8 batch feldolgozás után*

---

## Job Creation Form Features

### B9: Element Layer, JCF Basics (v0.4.0 - v0.4.12)

*Pending - B9 batch feldolgozás után*

### B10: JCF Autocomplete Fields (v0.4.13 - v0.4.24)

*Pending - B10 batch feldolgozás után*

### B11: JCF Validation, Templates, API (v0.4.25 - v0.4.40)

*Pending - B11 batch feldolgozás után*

---

## QA Document Mapping

Ez a szekció definiálja, hogy a Feature Katalógus batch-ei hogyan képződnek le a Manual QA dokumentumokra. A `/manual-qa-plan` parancs ezt a mappinget használja.

| QA Csoport | Batch-ek | Output fájl | Leírás |
|------------|----------|-------------|--------|
| station-management | B1 | `api/station-management.md` | Station, Category, Group, Provider CRUD + Schedule API |
| job-management | B2 | `api/job-management.md` | Job, Task, Element, Comments API |
| scheduling | B3 | `api/scheduling.md` | Assignment, Validation, Conflict detection API |
| layout-grid | B4 | `scheduler/layout-grid.md` | Sidebar, Jobs List, Grid layout, Station columns |
| drag-drop | B5, B6 | `scheduler/drag-drop.md` | Drag & Drop, Validation feedback, Station compact view |
| navigation-ux | B7 | `scheduler/navigation-ux.md` | Keyboard navigation, Layout modes, UX improvements |
| datestrip-pickplace | B8 | `scheduler/datestrip-pickplace.md` | DateStrip, Pick & Place, Context menu |
| elements-table | B9 | `jcf/elements-table.md` | Element layer, JcfElementsTable, Row operations |
| autocomplete | B10 | `jcf/autocomplete.md` | JCF Autocomplete mezők (Papier, Imposition, etc.) |
| validation-templates | B11 | `jcf/validation-templates.md` | JCF Validation, Templates, JSON Editor |

**Megjegyzés:** A mapping finomítható a batch-ek feldolgozása során, ha az összevonás vagy szétbontás logikusabb struktúrát eredményez.

---

## Statistics

| Batch | Status | Features | Active | Suspicious | Deprecated |
|-------|--------|----------|--------|------------|------------|
| B1 | ✅ Complete | 21 | 21 | 0 | 0 |
| B2 | ✅ Complete | 28 | 28 | 0 | 0 |
| B3 | ✅ Complete | 22 | 22 | 0 | 0 |
| B4 | ⏳ Pending | - | - | - | - |
| B5 | ⏳ Pending | - | - | - | - |
| B6 | ⏳ Pending | - | - | - | - |
| B7 | ⏳ Pending | - | - | - | - |
| B8 | ⏳ Pending | - | - | - | - |
| B9 | ⏳ Pending | - | - | - | - |
| B10 | ⏳ Pending | - | - | - | - |
| B11 | ⏳ Pending | - | - | - | - |
| **Total** | | **71** | **71** | **0** | **0** |
