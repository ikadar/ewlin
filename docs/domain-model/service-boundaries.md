# Service Boundaries – Flux Print Shop Scheduling System

This document defines the **service boundaries** for the Flux print shop scheduling system that handles
Station → Job → Task assignments and scheduling validations.

The goal is to translate the domain model into concrete services with clear responsibilities
and interaction patterns following the microservices architecture principles.

---

## 1. Services Overview

### 1.1 Station Management Service

**Purpose:**
Manage all stations (physical machines), station categories, station groups, and outsourced providers including their operating schedules and availability.

**Capabilities:**
- Create and manage Stations with operating schedules
- Create and manage Station Categories with similarity criteria
- Create and manage Station Groups with capacity limits
- Create and manage Outsourced Providers
- Handle schedule exceptions (holidays, maintenance)
- Provide station availability information to other services

**Inputs:**
- Commands from external callers (e.g., "createStation", "updateOperatingSchedule", "addException")
- Queries for station availability and capabilities

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
- StationId
- StationCategory
- StationCategoryId
- SimilarityCriterion
- StationGroup
- StationGroupId
- OutsourcedProvider
- ProviderId
- OperatingSchedule
- DaySchedule
- TimeSlot
- ScheduleException

**External Dependencies:**
- None (this is a foundational service)

**Reasons for Separation:**
Station management is a distinct concern from job planning and assignment validation. Stations have their
own lifecycle independent of specific jobs or tasks. This service acts as the single source of truth for
all station-related data.

---

### 1.2 Job Management Service

**Purpose:**
Handle the complete lifecycle of Jobs and their constituent Tasks, including job dependencies and approval gates.

**Capabilities:**
- Create and manage Jobs with workshop exit dates
- Parse task DSL into structured task data
- Create and manage Tasks with durations
- Manage approval gates (BAT/Proof, Plates)
- Track paper procurement status
- Manage job-level dependencies
- Manage job comments
- Validate task definitions against stations/providers

**Inputs:**
- Commands from external callers (e.g., "createJob", "updateProofStatus", "addComment")
- Task DSL text for parsing
- Optional events from Assignment Service (e.g., assignment completion)

**Outputs:**
- `JobCreated`, `JobUpdated` events
- `TaskAddedToJob` event
- `TasksReordered` event
- `JobDependencyAdded` event
- `ApprovalGateUpdated` event (for BAT and Plates)
- `PaperStatusChanged` event
- `CommentAdded` event
- `JobPlanned`, `JobStarted`, `JobCompleted`, `JobCancelled` events
- Job/Task read models or API responses

**Ownership:**
- Job
- JobId
- JobStatus
- Task (as entity within Job aggregate)
- TaskId
- TaskStatus
- Duration
- Comment
- PaperPurchaseStatus
- PlatesStatus

**External Dependencies:**
- Reads station/provider names from Station Management Service (for DSL parsing and task validation)

**Reasons for Separation:**
Job planning and task structuring is independent of station availability and assignment. Jobs define
WHAT needs to be done and in what order, while assignments determine WHERE and WHEN. This
separation allows jobs to be planned before scheduling begins.

---

### 1.3 Assignment & Validation Service

**Purpose:**
Manage task assignments, **schedule tasks with specific timings**, and validate them against all business rules and constraints.

**Capabilities:**
- Assign tasks to stations with specific time slots
- Validate assignments against multiple criteria:
  - Station availability (operating schedule, exceptions)
  - No station double-booking
  - Station group capacity limits
  - Task sequence/precedence (within job)
  - Approval gate requirements (BAT, Plates)
  - Job dependency requirements
- Calculate task end times considering operating schedules
- Calculate outsourced task duration using business calendar
- Detect and report scheduling conflicts
- Support precedence safeguards (with Alt bypass)

**Inputs:**
- Assignment commands (e.g., "assignTask", "rescheduleTask", "unassignTask")
- `StationScheduleUpdated` events from Station Management Service
- `StationExceptionAdded` events from Station Management Service
- `StationStatusChanged` events from Station Management Service
- `TaskAddedToJob` events from Job Management Service
- `TasksReordered` events from Job Management Service
- `ApprovalGateUpdated` events from Job Management Service

**Outputs:**
- `TaskAssigned` event
- `TaskUnassigned` event
- `TaskRescheduled` event
- `ConflictDetected` event with conflict details
- `ScheduleUpdated` event
- Assignment validation reports

**Ownership:**
- Schedule (aggregate root)
- ScheduleId
- TaskAssignment
- ScheduleConflict
- ValidationResult

**External Dependencies:**
- Station Management Service (for availability and operating schedules)
- Job Management Service (for task requirements and approval gates)
- Business Calendar Service (for open day calculations)

**Reasons for Separation:**
Assignment and validation is a complex orchestration concern that bridges stations and jobs. It requires
data from multiple sources and applies cross-cutting business rules. Keeping this logic separate prevents
contaminating the core station and job domains with scheduling complexity.

---

### 1.4 Scheduling View Service (Read Model)

**Purpose:**
Provide read-optimized views and queries for scheduling visualization and reporting.

**Capabilities:**
- Maintain denormalized views of the complete schedule
- Generate schedule snapshots for UI rendering
- Calculate similarity indicators between consecutive tiles
- Track late jobs
- Support complex scheduling queries
- Provide conflict summaries

**Inputs:**
- Events from all other services (event sourcing for read models)
- Direct queries for reporting

**Outputs:**
- Read models optimized for UI consumption
- Schedule snapshots with all necessary data
- Similarity indicator calculations
- Late job reports
- No domain events (read-only service)

**Ownership:**
- Read models and projections only (no source data)
- ScheduleSnapshot
- TileView
- SimilarityIndicator
- LateJobReport

**External Dependencies:**
- All other services (event consumption)

**Reasons for Separation:**
Read models often have different performance and structure requirements than command models. This service
can optimize for query performance without affecting the consistency guarantees of the write models. The
UI requires denormalized data that combines information from multiple aggregates.

---

### 1.5 DSL Parsing Service

**Purpose:**
Parse and validate task DSL syntax, providing autocomplete suggestions.

**Capabilities:**
- Parse task DSL into structured task data
- Validate DSL syntax
- Provide autocomplete suggestions for station and provider names
- Report parsing errors with line numbers

**Inputs:**
- DSL text to parse
- Partial input for autocomplete
- Context (station vs provider mode)

**Outputs:**
- Parsed task structures
- Validation errors with line numbers
- Autocomplete suggestions

**Ownership:**
- ParsedTask
- ParseError
- AutocompleteSuggestion

**External Dependencies:**
- Station Management Service (for station/provider names)

**Reasons for Separation:**
DSL parsing is a specialized capability that requires knowledge of syntax rules but not business rules.
It can be called synchronously during job creation to validate and structure input.

**Note:** For MVP, this could be embedded within Job Management Service. Extract when complexity warrants.

---

### 1.6 Business Calendar Service

**Purpose:**
Calculate business days (open days) for outsourced task duration.

**Capabilities:**
- Calculate open days between dates
- Exclude weekends
- Exclude French holidays (future enhancement)
- Support per-provider calendars (future enhancement)

**Inputs:**
- Start date
- Number of open days to add
- Optional: Provider ID for provider-specific calendar

**Outputs:**
- Calculated end date
- Explanation of calculation

**Ownership:**
- BusinessCalendar
- OpenDay

**External Dependencies:**
- None (foundational service)

**Reasons for Separation:**
Business day calculation is a utility function used by Assignment Service for outsourced tasks.
Keeping it separate allows for future enhancement with French holidays and provider-specific calendars.

**Note:** For MVP, this could be a simple utility within Assignment Service. Extract when complexity grows.

---

## 2. Interaction Between Services

### 2.1 Events and Integration

- **Station Management → Assignment & Validation**
  - Events: `StationScheduleUpdated`, `StationExceptionAdded`, `StationStatusChanged`
  - Meaning: Station constraints have changed; existing assignments may need revalidation

- **Job Management → Assignment & Validation**
  - Events: `TaskAddedToJob`, `TasksReordered`, `ApprovalGateUpdated`
  - Meaning: Task requirements or structure has changed; assignments may need adjustment

- **Assignment & Validation → Job Management**
  - Events: `TaskAssigned` (triggers job status updates)
  - Meaning: Assignment changes that affect job status

- **All Services → Scheduling View**
  - Events: All domain events
  - Meaning: Update read models for UI consumption

- **Job Management → DSL Parsing**
  - Synchronous: Parse DSL during job creation
  - Meaning: Convert text input to structured tasks

- **Assignment & Validation → Business Calendar**
  - Synchronous: Calculate end dates for outsourced tasks
  - Meaning: Determine when outsourced tasks complete

Interactions favor **asynchronous domain events** for loose coupling, with synchronous
queries only where immediate consistency is required (e.g., DSL parsing, calendar calculation).

---

## 3. Service Boundary Principles

1. **Each service owns its data**
   - Station Management owns all station, category, group, and provider data
   - Job Management owns job and task definitions
   - Assignment & Validation owns schedule and assignment data
   - No service directly modifies another's data

2. **Domain logic stays within boundaries**
   - Operating schedule logic stays in Station Management
   - Task sequence logic stays in Job Management
   - Cross-cutting validation logic is centralized in Assignment & Validation

3. **Clear command/query separation**
   - Commands modify state within one service
   - Queries may aggregate data across services through dedicated read models

4. **Event-driven coordination**
   - Services react to events from others
   - No service embeds knowledge of another's internal processes

5. **Validation at the edges**
   - Each service validates its own invariants
   - Assignment & Validation validates cross-service invariants

---

## 4. Service Responsibilities Matrix

| Service | Owns | Listens to | Publishes |
|---------|------|------------|-----------|
| Station Management | Station, Category, Group, Provider, Schedule, Exception | — | StationCreated, ScheduleUpdated, ExceptionAdded, StatusChanged |
| Job Management | Job, Task, Comments, Approval Gates | TaskAssigned (optional) | JobCreated, TaskAdded, GateUpdated, JobCompleted |
| Assignment & Validation | Schedule, Assignments, Conflicts | Station events, Job events, Gate events | TaskAssigned, ConflictDetected, ScheduleUpdated |
| Scheduling View | Read Models, Snapshots | All events | — |
| DSL Parsing | Parser, Validator, Autocomplete | — | — |
| Business Calendar | Calendar calculations | — | — |

---

## 5. External Clients

The services expose their functionality through APIs that are consumed by external clients:

### Primary Clients
- **Web Frontend (Vite + React + TypeScript)**
  - Uses all service APIs through REST/HTTP
  - Main consumer of Scheduling View Service for UI visualization
  - Initiates commands through API Gateway

- **Mobile Applications** (future)
  - Could consume same APIs with mobile-optimized responses

- **External Systems** (future)
  - Partner systems for data exchange
  - ERP/MES integrations

### Client Access Patterns
- All clients access services through unified API Gateway
- Authentication/Authorization handled at gateway level
- Frontend is completely decoupled from backend implementation
- No direct database access from any client

---

## 6. API Examples

### Station Management Service
```
POST   /api/v1/stations                      # Create station
GET    /api/v1/stations                      # List stations
GET    /api/v1/stations/{id}                 # Get station
PUT    /api/v1/stations/{id}                 # Update station
POST   /api/v1/stations/{id}/exceptions      # Add schedule exception

POST   /api/v1/station-categories            # Create category
POST   /api/v1/station-groups                # Create group
POST   /api/v1/providers                     # Create provider
```

### Job Management Service
```
POST   /api/v1/jobs                          # Create job (with DSL tasks)
GET    /api/v1/jobs                          # List jobs with filters
GET    /api/v1/jobs/{id}                     # Get job with tasks
PUT    /api/v1/jobs/{id}                     # Update job
PUT    /api/v1/jobs/{id}/proof               # Update BAT status
PUT    /api/v1/jobs/{id}/plates              # Update plates status
PUT    /api/v1/jobs/{id}/paper               # Update paper status
POST   /api/v1/jobs/{id}/dependencies        # Add job dependency
POST   /api/v1/jobs/{id}/comments            # Add comment
PUT    /api/v1/jobs/{id}/tasks/reorder       # Reorder tasks
```

### Assignment & Validation Service
```
POST   /api/v1/tasks/{taskId}/assign         # Assign task to station
DELETE /api/v1/tasks/{taskId}/assign         # Unassign (recall) task
POST   /api/v1/assignments/validate          # Validate proposed assignment
```

### Scheduling View Service (for Frontend)
```
GET    /api/v1/schedule/snapshot             # Full schedule for UI
```

### DSL Parsing Service
```
POST   /api/v1/dsl/parse                     # Parse DSL to tasks
GET    /api/v1/dsl/autocomplete              # Get suggestions
```

### Business Calendar Service
```
GET    /api/v1/calendar/open-days            # Calculate open days
```

---

## 7. Data Flow Example

1. **Frontend user creates a Job** → API Gateway → Job Management Service
   - DSL parsed into structured tasks
   - Job created in Draft status
2. **Frontend displays schedule** → API Gateway → Scheduling View Service → Snapshot
3. **Frontend drags task to grid** → Client-side validation (real-time)
4. **Frontend drops task** → API Gateway → Assignment Service
5. **Assignment Service validates**:
   - Queries Station Management for availability
   - Queries Business Calendar for outsourced duration
   - Checks approval gates via Job Management events
   - Returns validation result
6. **If valid, assignment is saved** → Events published to all interested services
7. **Scheduling View updates** → Frontend receives updated snapshot

---

## 8. Deployment Considerations

- Services can be deployed independently
- Each service has its own database/schema
- Event bus (e.g., RabbitMQ, Kafka, Symfony Messenger) connects services
- API Gateway provides unified external interface
- Services can be scaled independently based on load

---

## 9. Migration Path

For initial development, services could be implemented as modules within a monolithic application:

1. Start with clear module boundaries
2. Use internal events/messages between modules
3. Keep data models separate
4. Extract to microservices when scaling requires it

**MVP Simplification:**
- Station Management + Job Management + Assignment & Validation as single PHP application
- DSL Parsing embedded in Job Management
- Business Calendar as utility class
- Scheduling View as optimized query module

This approach provides the architectural benefits of service boundaries while avoiding the
operational complexity of microservices during early development.

---

## 10. Notes

- Service boundaries align with bounded contexts from the domain model
- The Assignment & Validation Service is the heart of the system
- Read model separation (Scheduling View) enables complex UI requirements
- These boundaries can scale independently as the system grows
- Technology choices (PHP/Symfony, Node.js, etc.) can be made per-service
