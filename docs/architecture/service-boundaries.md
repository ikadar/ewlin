---
tags:
  - specification
  - architecture
---

# Service Boundaries – Flux Print Shop Scheduling System

This document defines the **service boundaries** for the Flux print shop scheduling system that handles
Station → Job → Element → Task assignments and scheduling validations.

The goal is to translate the **bounded contexts** from the domain model into concrete services with clear responsibilities and interaction patterns.

---

## 1. Services Overview

### 1.1 Station Management Service
#### SB-STATION-001
> **References:** [AGG-STATION-001](aggregate-design.md#agg-station-001), [AGG-CATEGORY-001](aggregate-design.md#agg-category-001), [AGG-GROUP-001](aggregate-design.md#agg-group-001), [AGG-PROVIDER-001](aggregate-design.md#agg-provider-001), [IC-STATION-001](interface-contracts.md#ic-station-001)

**Purpose:**
Manage all stations (physical machines), station categories, station groups, and outsourced providers including their operating schedules and availability.

**Capabilities:**
- Create and manage Stations with operating schedules
- Create and manage Station Categories with similarity criteria
- Create and manage Station Groups with capacity limits
- Create and manage Outsourced Providers
- Handle schedule exceptions (holidays, maintenance)
- Track station status changes

**Inputs:**
- Commands from external callers (e.g., "createStation", "updateOperatingSchedule")
- Schedule exception events from external systems

**Outputs:**
- `StationCreated`, `StationUpdated` events
- `StationCategoryCreated` event
- `StationGroupCreated` event
- `ProviderCreated` event
- `OperatingScheduleUpdated` event
- `ScheduleExceptionAdded` event
- `StationStatusChanged` event
- Station read models or API responses

**Ownership:**
- Station
- StationCategory
- SimilarityCriterion
- StationGroup
- OutsourcedProvider
- OperatingSchedule
- DaySchedule
- TimeSlot
- ScheduleException

**External Dependencies:**
- None (acts as master data source for stations)

**Reasons for Separation:**
Station management is a foundational capability that other services depend on. It maintains the authoritative state of all stations without any knowledge of jobs, tasks, or scheduling logic. This separation allows stations to be managed independently of how they are used.

---

### 1.2 Job Management Service
#### SB-JOB-001
> **References:** [AGG-JOB-001](aggregate-design.md#agg-job-001), [IC-JOB-001](interface-contracts.md#ic-job-001), [IC-JOB-003](interface-contracts.md#ic-job-003)

**Purpose:**
Define and manage print jobs with their elements, constituent tasks, element-level prerequisites, and cross-element dependencies.

**Capabilities:**
- Create and update job definitions with workshop exit dates
- Create and manage elements within jobs (single or multi-element)
- Add tasks to elements with duration and station requirements
- Define cross-element dependencies (prerequisiteElementIds, DAG with cycle detection)
- Track element-level prerequisites (paper, BAT, plates, forme) — v0.4.32
- Manage job comments
- Track job and task status transitions

**Inputs:**
- Commands from external callers (e.g., "createJob", "createElement", "addTask", "updateElementPrerequisite")
- `TaskAssigned` events from Assignment Service (optional)

**Outputs:**
- `JobCreated` event
- `ElementCreated` event
- `ElementDependencyAdded` event
- `ElementDependencyRemoved` event
- `TaskAddedToJob` event
- `TasksReordered` event
- `ElementPaperStatusUpdated` event (v0.4.32)
- `ElementBatStatusUpdated` event (v0.4.32)
- `ElementPlateStatusUpdated` event (v0.4.32)
- `ElementFormeStatusUpdated` event (v0.4.32)
- `CommentAdded` event
- `JobStatusChanged` event
- Job/Element/Task read models or API responses

**Ownership:**
- Job
- Element (as entity within Job aggregate, including prerequisite status fields)
- Task (as entity within Element)
- Duration
- Comment
- PaperStatus (element-level, v0.4.32)
- BatStatus (element-level, v0.4.32)
- PlateStatus (element-level, v0.4.32)
- FormeStatus (element-level, v0.4.32)

**External Dependencies:**
- Reads station/provider names from Station Management Service (for task validation)

**Reasons for Separation:**
Job planning and task structuring is independent of station availability and assignment. Jobs define WHAT needs to be done (organized into elements) and in what order, while assignments determine WHERE and WHEN. This separation allows jobs to be planned before stations are assigned.

---

### 1.3 Assignment Service
#### SB-ASSIGN-001
> **References:** [AGG-SCHEDULE-001](aggregate-design.md#agg-schedule-001), [IC-ASSIGN-001](interface-contracts.md#ic-assign-001), [IC-ASSIGN-002](interface-contracts.md#ic-assign-002), [IC-ASSIGN-003](interface-contracts.md#ic-assign-003)

**Purpose:**
Orchestrate task assignments, manage schedule state, and coordinate validation.

**Capabilities:**
- Assign tasks to stations or providers (`targetId` + `isOutsourced`)
- Calculate scheduled end times considering operating schedules
- Validate element-scoped precedence (intra-element sequenceOrder)
- Validate cross-element precedence (prerequisiteElementIds finish-to-start)
- Validate dry time (4h after printing tasks)
- Support precedence bypass (`bypassPrecedence` flag)
- Persist validated assignments
- Detect and report conflicts
- Support recall (unassign) and reschedule operations
- Toggle task completion status
- Publish assignment and schedule events

**Inputs:**
- Assignment commands (e.g., "assignTask", "rescheduleTask", "unassignTask")
- `StationScheduleUpdated` events from Station Management Service
- `StationStatusChanged` events from Station Management Service
- `TaskAddedToJob` events from Job Management Service
- `ElementCreated` events from Job Management Service
- `ElementDependencyAdded` events from Job Management Service
- `ElementPaperStatusUpdated` events from Job Management Service (v0.4.32)
- `ElementBatStatusUpdated` events from Job Management Service (v0.4.32)
- `ElementPlateStatusUpdated` events from Job Management Service (v0.4.32)
- `ElementFormeStatusUpdated` events from Job Management Service (v0.4.32)

**Outputs:**
- `TaskAssigned` event with timing and element information
- `TaskUnassigned` event
- `TaskRescheduled` event
- `TaskCompletionToggled` event
- `ScheduleUpdated` event
- `ConflictDetected` event with conflict details

**Ownership:**
- Schedule (aggregate root)
- TaskAssignment
- ScheduleConflict
- ValidationResult

**External Dependencies:**
- Station Management Service (for availability and operating schedules)
- Job Management Service (for task requirements and approval gates)
- Business Calendar Service (for open day calculations)

**Technology:** PHP/Symfony

---

### 1.4 Validation Service (Node.js) — Isomorphic
#### SB-VALID-001
> **References:** [IC-ASSIGN-004](interface-contracts.md#ic-assign-004), [IC-ASSIGN-005](interface-contracts.md#ic-assign-005)

**Purpose:**
Provide **isomorphic schedule validation** that runs identically on client (browser) and server (Node.js). This enables real-time validation feedback in the UI while maintaining server-side authority.

**Capabilities:**
- Validate assignments against all business constraints:
  - StationConflict — no double-booking of stations
  - GroupCapacityConflict — station group limits respected
  - PrecedenceConflict — element-scoped (intra-element sequenceOrder) and cross-element (prerequisiteElementIds finish-to-start) precedence respected
  - DryTimeConflict — 4h dry time after printing tasks respected
  - PrerequisiteConflict — element prerequisites ready (paper, BAT, plates, forme) — v0.4.32
  - AvailabilityConflict — station operating schedule respected
  - StationMismatchConflict — task assigned to correct station type
- Support `bypassPrecedence` flag for forced placements (Alt-key in UI)
- Return detailed conflict information with suggested start time
- Stateless operation (receives schedule snapshot, returns validation result)

**Shared Package:** `@flux/schedule-validator`
- Runs in browser during drag & drop (< 10ms response)
- Runs on server as authoritative validation before persist

**Inputs:**
```typescript
interface ValidationRequest {
  proposedAssignment: ProposedAssignment;
  scheduleSnapshot: ScheduleSnapshot;
}
```

**Outputs:**
```typescript
interface ValidationResult {
  valid: boolean;
  conflicts: ScheduleConflict[];
  suggestedStart?: string;  // ISO-8601 — earliest valid start time
}
```

**Ownership:**
- Validation logic (shared TypeScript code)
- ScheduleConflict types
- ValidationResult

**External Dependencies:**
- None (stateless, receives all data in request)

**Technology:** Node.js + TypeScript

**Why Separate Service:**
1. **Isomorphic code** — same validation runs on client and server
2. **Performance** — client-side validation enables < 10ms drag feedback
3. **Consistency** — single codebase eliminates rule divergence risk
4. **Testability** — one test suite covers both environments

---

### 1.5 Scheduling View Service (Read Model)
#### SB-VIEW-001
> **References:** [IC-VIEW-001](interface-contracts.md#ic-view-001)

**Purpose:**
Provide read-optimized views and queries for scheduling visualization and reporting.

**Capabilities:**
- Maintain denormalized views of the complete schedule
- Generate schedule snapshots for UI rendering
- Calculate similarity indicators between consecutive tiles
- Track late jobs
- Support complex scheduling queries

**Inputs:**
- All events from Station Management Service
- All events from Job Management Service
- All events from Assignment Service

**Outputs:**
- Schedule snapshots for UI
- Similarity indicator data
- Late job reports
- No domain events (read-only service)

**Ownership:**
- Read models and projections only
- ScheduleSnapshot
- TileView
- SimilarityIndicator
- LateJobReport

**External Dependencies:**
- Event streams from all other services (event sourcing for read models)

**Reasons for Separation:**
Read models have fundamentally different access patterns and performance requirements than write models. Separating them allows optimization for complex queries, reporting, and visualization without impacting the performance of business operations. This follows CQRS principles.

---

### 1.6 Business Calendar Service
#### SB-CAL-001
> **References:** [IC-CAL-001](interface-contracts.md#ic-cal-001), [IC-CAL-002](interface-contracts.md#ic-cal-002)

**Purpose:**
Calculate business days (open days) for outsourced task duration.

**Capabilities:**
- Calculate open days between dates
- Exclude weekends
- Exclude French holidays (future)
- Support per-provider calendars (future)

**Inputs:**
- Start date
- Number of open days to add

**Outputs:**
- Calculated end date
- Explanation of calculation

**Ownership:**
- BusinessCalendar
- OpenDay

**External Dependencies:**
- None (foundational service)

**Note:** For MVP, utility within Assignment Service.

---

## 2. Interaction Between Services

### 2.1 Events and Integration

- **Station Management → Assignment Service**
  - Events: `StationScheduleUpdated`, `ScheduleExceptionAdded`, `StationStatusChanged`
  - Meaning: Station constraints have changed, requiring revalidation

- **Job Management → Assignment Service**
  - Events: `TaskAddedToJob`, `TasksReordered`, `ElementCreated`, `ElementDependencyAdded`, `ElementPaperStatusUpdated`, `ElementBatStatusUpdated`, `ElementPlateStatusUpdated`, `ElementFormeStatusUpdated` (v0.4.32)
  - Meaning: Element/task structure or prerequisites have changed, affecting scheduling possibilities

- **Assignment Service → Validation Service** (synchronous)
  - HTTP call: `POST /validate`
  - Meaning: Validate proposed assignment before persisting

- **Frontend → Validation Service** (via shared package)
  - Direct call to `@flux/schedule-validator`
  - Meaning: Real-time validation during drag & drop (< 10ms)

- **Assignment Service → Job Management**
  - Event: `TaskAssigned`
  - Meaning: Update task status based on scheduling

- **All Services → Scheduling View Service**
  - Events: All domain events
  - Meaning: Update read models for reporting and visualization

Interaction should favor **asynchronous domain events** over direct synchronous calls wherever eventual consistency is acceptable.

**Exception:** Assignment Service → Validation Service is synchronous because validation must complete before assignment can be persisted.

---

## 3. Service Boundary Principles

1. **Each service owns its data**
   - Station Management owns stations, categories, groups, and providers
   - Job Management owns jobs, elements, and tasks
   - Assignment Service owns schedules and assignments
   - No other service writes directly to these data stores

2. **No cross-service business logic**
   - A service may react to events from other services, but must not embed foreign business rules
   - Example: Assignment service doesn't define what makes a valid operating schedule

3. **Clear, narrow interfaces**
   - Public APIs focus on business operations (e.g., `assignTask`, `scheduleTask`)
   - Not on generic CRUD access

4. **Published Language alignment**
   - Service APIs and events use the same terms as the domain vocabulary
   - Consistent use of Station, Job, Element, Task, Assignment, Schedule

5. **Loose coupling, strong cohesion**
   - Each service is internally cohesive around a specific domain capability
   - Loosely coupled to others via events or well-defined APIs

---

## 4. Service Responsibilities Matrix

| Service | Technology | Owns | Listens to | Publishes |
|---------|------------|------|------------|-----------|
| Station Management | PHP/Symfony | Station, Category, Group, Provider | External systems | StationCreated, ScheduleUpdated, StatusChanged |
| Job Management | PHP/Symfony | Job, Element, Task, Comments, ElementPrerequisites | TaskAssigned (optional) | JobCreated, ElementCreated, TaskAdded, ElementPrerequisiteUpdated |
| Assignment Service | PHP/Symfony | Schedule, Assignments | Station events, Job events, ElementPrerequisite events | TaskAssigned, ScheduleUpdated, ConflictDetected |
| **Validation Service** | **Node.js** | Validation logic (shared with frontend) | — | — |
| Scheduling View | PHP/Symfony | Read models only | All domain events | None (read-only) |
| Business Calendar | PHP/Symfony | Calendar calculations | — | — |

---

## 5. Technology Mapping

The system uses a **hybrid PHP + Node.js architecture**:

### PHP/Symfony Services
- **Station Management Service** — stations, categories, groups, providers
- **Job Management Service** — jobs, elements, tasks, approval gates
- **Assignment Service** — schedule orchestration, persistence
- **Scheduling View Service** — read models, snapshots
- **Business Calendar Service** — open day calculation (embedded in Assignment for MVP)

### Node.js Service
- **Validation Service** — isomorphic validation (shared with frontend)
  - Package: `@flux/schedule-validator`
  - Stateless, horizontally scalable

### Shared Infrastructure
- **Database:** MariaDB 10.11+ (one schema per service)
- **Event Bus:** Symfony Messenger (async domain events)
- **Cache:** Redis 7+
- **API Layer:** RESTful APIs with OpenAPI 3.0

### Frontend
- **React 19 with TypeScript**
- Bundles `@flux/schedule-validator` for client-side validation
- WebSocket for real-time schedule updates (future)

---

## 6. Deployment Considerations

### Deployment Model
```yaml
# docker-compose.yml
services:
  # PHP API (modular monolith)
  php-api:
    image: flux/php-api
    depends_on:
      - mariadb
      - redis

  # Frontend (bundles @flux/schedule-validator)
  frontend:
    image: flux/frontend
    # Static files, bundles shared validator

  # Infrastructure
  mariadb:
    image: mariadb:10.11
  redis:
    image: redis:7
```

### Deployment Strategies
- **Development:** All services in docker-compose
- **Staging:** PHP as monolith, frontend separate
- **Production:** Can extract PHP services as scaling requires

The `@flux/schedule-validator` package is **bundled into the frontend** for client-side validation and is also available for server-side use via Node.js if needed. The PHP API implements its own server-side validation in Symfony.

---

## 7. Notes

- Service boundaries are designed to be stable across releases
- Each boundary represents a cohesive business capability
- The Assignment Service is the heart of the system, implementing the core scheduling value proposition
- Read model separation (Scheduling View) enables complex UI requirements without impacting operations
- These boundaries align with team responsibilities and can scale independently
