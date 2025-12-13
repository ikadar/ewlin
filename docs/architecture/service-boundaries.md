# Service Boundaries – Flux Print Shop Scheduling System

This document defines the **service boundaries** for the Flux print shop scheduling system that handles
Station → Job → Task assignments and scheduling validations.

The goal is to translate the **bounded contexts** from the domain model into concrete services with clear responsibilities and interaction patterns.

---

## 1. Services Overview

### 1.1 Station Management Service
#### SB-STATION-001

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

**Purpose:**
Define and manage print jobs with their constituent tasks, approval gates, and dependencies.

**Capabilities:**
- Create and update job definitions with workshop exit dates
- Parse task DSL into structured task data
- Add tasks to jobs with duration and station requirements
- Manage approval gates (BAT/Proof, Plates)
- Track paper procurement status
- Define job-level dependencies
- Manage job comments
- Track job and task status transitions

**Inputs:**
- Commands from external callers (e.g., "createJob", "addTask", "updateProofStatus")
- Task DSL text for parsing
- `TaskAssigned` events from Assignment Service (optional)

**Outputs:**
- `JobCreated` event
- `TaskAddedToJob` event
- `TasksReordered` event
- `JobDependencyAdded` event
- `ApprovalGateUpdated` event
- `PaperStatusChanged` event
- `CommentAdded` event
- `JobStatusChanged` event
- Job/Task read models or API responses

**Ownership:**
- Job
- Task (as entity within Job aggregate)
- Duration
- Comment
- PaperPurchaseStatus
- PlatesStatus

**External Dependencies:**
- Reads station/provider names from Station Management Service (for task validation)

**Reasons for Separation:**
Job planning and task structuring is independent of station availability and assignment. Jobs define WHAT needs to be done and in what order, while assignments determine WHERE and WHEN. This separation allows jobs to be planned before stations are assigned.

---

### 1.3 Assignment Service
#### SB-ASSIGN-001

**Purpose:**
Orchestrate task assignments, manage schedule state, and coordinate validation.

**Capabilities:**
- Assign tasks to stations with specific time slots
- Calculate scheduled end times considering operating schedules
- Persist validated assignments
- Detect and report conflicts
- Support recall (unassign) and reschedule operations
- Publish assignment and schedule events

**Inputs:**
- Assignment commands (e.g., "assignTask", "rescheduleTask", "unassignTask")
- `StationScheduleUpdated` events from Station Management Service
- `StationStatusChanged` events from Station Management Service
- `TaskAddedToJob` events from Job Management Service
- `ApprovalGateUpdated` events from Job Management Service

**Outputs:**
- `TaskAssigned` event with timing information
- `TaskUnassigned` event
- `TaskRescheduled` event
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

**Purpose:**
Provide **isomorphic schedule validation** that runs identically on client (browser) and server (Node.js). This enables real-time validation feedback in the UI while maintaining server-side authority.

**Capabilities:**
- Validate assignments against all business constraints:
  - StationConflict — no double-booking of stations
  - GroupCapacityConflict — station group limits respected
  - PrecedenceConflict — task sequence within job respected
  - ApprovalGateConflict — BAT/Plates requirements satisfied
  - AvailabilityConflict — station operating schedule respected
- Return detailed conflict information
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
  warnings: ValidationWarning[];
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

### 1.6 DSL Parsing Service
#### SB-DSL-001

**Purpose:**
Parse and validate task DSL syntax for job creation.

**Capabilities:**
- Parse DSL text into structured task data
- Validate syntax and station/provider references
- Provide autocomplete suggestions
- Report errors with line numbers

**Inputs:**
- DSL text to parse
- Partial input for autocomplete

**Outputs:**
- Parsed task structures
- Parse errors with positions
- Autocomplete suggestions

**Ownership:**
- ParsedTask
- ParseError
- AutocompleteSuggestion

**External Dependencies:**
- Station Management Service (for station/provider names)

**Note:** For MVP, embedded within Job Management Service.

---

### 1.7 Business Calendar Service
#### SB-CAL-001

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
  - Events: `TaskAddedToJob`, `TasksReordered`, `ApprovalGateUpdated`
  - Meaning: Task structure has changed, affecting scheduling possibilities

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
   - Job Management owns jobs and tasks
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
   - Consistent use of Station, Job, Task, Assignment, Schedule

5. **Loose coupling, strong cohesion**
   - Each service is internally cohesive around a specific domain capability
   - Loosely coupled to others via events or well-defined APIs

---

## 4. Service Responsibilities Matrix

| Service | Technology | Owns | Listens to | Publishes |
|---------|------------|------|------------|-----------|
| Station Management | PHP/Symfony | Station, Category, Group, Provider | External systems | StationCreated, ScheduleUpdated, StatusChanged |
| Job Management | PHP/Symfony | Job, Task, Comments, Gates | TaskAssigned (optional) | JobCreated, TaskAdded, GateUpdated |
| Assignment Service | PHP/Symfony | Schedule, Assignments | Station events, Job events | TaskAssigned, ScheduleUpdated, ConflictDetected |
| **Validation Service** | **Node.js** | Validation logic (shared with frontend) | — | — |
| Scheduling View | PHP/Symfony | Read models only | All domain events | None (read-only) |
| DSL Parsing | PHP/Symfony | Parser, Validator | — | — |
| Business Calendar | PHP/Symfony | Calendar calculations | — | — |

---

## 5. Technology Mapping

The system uses a **hybrid PHP + Node.js architecture**:

### PHP/Symfony Services
- **Station Management Service** — stations, categories, groups, providers
- **Job Management Service** — jobs, tasks, approval gates
- **Assignment Service** — schedule orchestration, persistence
- **Scheduling View Service** — read models, snapshots
- **DSL Parsing Service** — task DSL parsing (embedded in Job Management for MVP)
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

### Hybrid Deployment Model
```yaml
# docker-compose.yml
services:
  # PHP Services (can be monolith or separate)
  php-api:
    image: flux/php-api
    depends_on:
      - validation-service
      - mariadb
      - redis

  # Node.js Validation Service (always separate)
  validation-service:
    image: flux/validation-service
    # Stateless, can scale independently

  # Frontend
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
- **Staging:** PHP as monolith, Node.js validation separate
- **Production:** Can extract PHP services as scaling requires

The Validation Service is **always deployed separately** because:
1. Different runtime (Node.js vs PHP)
2. Shared code with frontend
3. Can scale independently based on validation load

---

## 7. Notes

- Service boundaries are designed to be stable across releases
- Each boundary represents a cohesive business capability
- The Assignment Service is the heart of the system, implementing the core scheduling value proposition
- Read model separation (Scheduling View) enables complex UI requirements without impacting operations
- These boundaries align with team responsibilities and can scale independently
