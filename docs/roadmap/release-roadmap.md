# Release Roadmap – Flux Print Shop Scheduling System

This document contains the development roadmap for the Flux print shop scheduling system, broken down into small, incremental steps.

---

## System Overview

### Architecture Components

| Component | Technology | Description | ADR |
|-----------|------------|-------------|-----|
| **Frontend** | React 19 + TypeScript | Scheduling UI with drag & drop | |
| **Validation Service** | Node.js + TypeScript | Isomorphic validation (client + server) | [ADR-010](../architecture/decision-records.md#adr-010--isomorphic-validation-service-nodejs) |
| **Station Management** | PHP/Symfony | Stations, categories, groups, providers | |
| **Job Management** | PHP/Symfony | Jobs, tasks, approval gates | |
| **Assignment Service** | PHP/Symfony | Schedule orchestration | |
| **Scheduling View** | PHP/Symfony | Read models, snapshots | |
| **Shared Package** | TypeScript | `@flux/schedule-validator` | [ADR-010](../architecture/decision-records.md#adr-010--isomorphic-validation-service-nodejs) |
| **DSL Parser** | TypeScript + Lezer | Task DSL parsing & highlighting | [ADR-011](../architecture/decision-records.md#adr-011--lezer-parser-system-for-task-dsl) |

### Infrastructure

- **Database:** MariaDB 10.11+
- **Cache:** Redis 7+
- **Event Bus:** Symfony Messenger
- **Container:** Docker + Kubernetes

---

## Release Strategy

- **Small releases**: Each release represents 1-3 days of work
- **Working state**: System remains functional after each release
- **Vertical slices**: Features delivered end-to-end (DB → API → UI)
- **Mock-first frontend**: UI development continues with mock data
- **Git workflow**: See [Git Release Strategy](../architecture/git-release-strategy.md) for branching, tagging, and versioning conventions

---

## Milestone Overview

| Milestone | Focus |
|-----------|-------|
| **M0** | Infrastructure & Foundation |
| **M1** | Core Domain MVP (Station + Job Management) |
| **M2** | Scheduling Core (Assignment + Validation) |
| **M3** | Frontend Integration |
| **M4** | Production Readiness |
| **Post-MVP** | Schedule Branching, Optimization |

---

## Milestone 0: Infrastructure & Foundation (v0.0.x)

### v0.0.1 - Development Environment ✅
- [x] Docker Compose setup for local development
- [x] MariaDB 10.11 container configuration
- [x] Redis 7 container configuration
- [x] Shared network configuration

### v0.0.2 - PHP/Symfony Project Foundation ✅
- [x] Symfony 7 project initialization
- [x] Monorepo structure (services as bundles initially)
- [x] Doctrine ORM configuration
- [x] Environment configuration (.env structure)

### v0.0.3 - Node.js Project Foundation ✅
- [x] Node.js + TypeScript project setup
- [x] ESLint + Prettier configuration
- [x] Vitest testing framework setup
- [x] Shared types package structure (@flux/types)

### v0.0.4 - Shared Package: @flux/schedule-validator ✅
- [x] Package initialization with pnpm workspace
- [x] Time utilities (overlap detection, duration calculation)
- [x] Six conflict validators (Station, Group, Precedence, Approval, Availability, Deadline)
- [x] Main validation function and exports
- [x] Comprehensive unit tests (29 tests)

### v0.0.5 - Frontend Project Foundation ✅
- [x] Vite 7 + React 19 + TypeScript setup
- [x] Tailwind CSS 4 integration with custom theme
- [x] Redux Toolkit with RTK Query configuration
- [x] Feature-based folder structure

### v0.0.6 - CI/CD Pipeline Foundation ✅
- [x] GitHub Actions workflows (ci.yml, docker.yml)
- [x] Lint and type check jobs (ESLint, TypeScript)
- [x] Unit test jobs (Vitest)
- [x] Docker image build jobs (ghcr.io)

### v0.0.7 - CI Fixes ✅
- [x] CI workflow fixes (build before test, PHP env setup)
- [x] ESLint error fixes in frontend and validator
- [x] ESLint config updates (ignore config files)
- [x] Branch consolidation (all releases on main)

### v0.0.8 - Repository Structure (Git Submodules) ✅
- [x] Convert monorepo to git submodule structure
- [x] Create `ewlin-php-api` repository (PHP/Symfony backend)
- [x] Create `ewlin-types` repository (@flux/types package)
- [x] Create `ewlin-validator` repository (@flux/schedule-validator package)
- [x] Restructure directories (`services/api` → `services/php-api`, `services/node/packages/*` → `packages/*`)
- [x] Update pnpm workspace configuration
- [x] Update CI/CD pipelines for new structure
- [x] Update documentation paths

---

## Milestone 1: Core Domain MVP (v0.1.x)

### Phase 1A: Station Management Service

#### v0.1.0 - Station Entity ✅
- [x] Station entity and repository
- [x] StationStatus enum (Active/Inactive/OutOfService/Maintenance)
- [x] StationCategory stub entity
- [x] StationGroup stub entity with maxConcurrent
- [x] Database migration
- [x] Unit tests for Station (50 tests, 88 assertions)

#### v0.1.1 - Station API Endpoints ✅
- [x] POST /api/v1/stations (create)
- [x] GET /api/v1/stations (list with pagination and filters)
- [x] GET /api/v1/stations/{id} (get)
- [x] PUT /api/v1/stations/{id} (update)
- [x] DELETE /api/v1/stations/{id} (delete)
- [x] OpenAPI documentation (Swagger UI at /api/doc)
- [x] Integration tests (16 test cases)

#### v0.1.2 - Operating Schedule ✅
- [x] OperatingSchedule, DaySchedule, TimeSlot value objects
- [x] Weekly pattern management on Station
- [x] PUT /api/v1/stations/{id}/schedule endpoint
- [x] Time slot overlap validation
- [x] Factory methods: defaultWeekday(), extended(), twentyFourSeven()
- [x] PHPStan level 8 configuration
- [x] Unit tests (66 tests for value objects)
- [x] Integration tests (10 tests for schedule API)

#### v0.1.3 - Schedule Exceptions ✅
- [x] ScheduleException value object
- [x] POST /api/v1/stations/{id}/exceptions endpoint
- [x] GET /api/v1/stations/{id}/exceptions endpoint
- [x] Exception override logic

#### v0.1.4 - Station Category Entity ✅
- [x] StationCategory entity and repository
- [x] SimilarityCriterion value object
- [x] POST /api/v1/station-categories endpoint
- [x] GET /api/v1/station-categories endpoint (list with search)
- [x] GET /api/v1/station-categories/{id} endpoint
- [x] PUT /api/v1/station-categories/{id} endpoint
- [x] DELETE /api/v1/station-categories/{id} endpoint
- [x] Similarity criteria JSON storage
- [x] Unit tests (53 tests for entity + value object)
- [x] Integration tests (30 tests for API)

#### v0.1.5 - Station Group Entity ✅
- [x] StationGroup entity expanded from stub (description, isOutsourcedProviderGroup, timestamps)
- [x] Full CRUD API endpoints (POST, GET, PUT, DELETE)
- [x] maxConcurrent field with validation
- [x] Provider group business rules (BR-GROUP-003)
- [x] Unit tests (24 tests)
- [x] Integration tests (31 tests)

#### v0.1.6 - Outsourced Provider Entity ✅
- [x] OutsourcedProvider entity and repository
- [x] ProviderStatus enum (Active, Inactive)
- [x] supportedActionTypes field (JSON array with deduplication)
- [x] latestDepartureTime field (HH:MM, default "14:00")
- [x] receptionTime field (HH:MM, default "09:00")
- [x] Auto-create station group with unlimited capacity (BR-PROVIDER-002, BR-PROVIDER-003)
- [x] POST /api/v1/providers endpoint
- [x] GET /api/v1/providers endpoint (list with filters)
- [x] GET /api/v1/providers/{id} endpoint
- [x] PUT /api/v1/providers/{id} endpoint
- [x] DELETE /api/v1/providers/{id} endpoint
- [x] Unit tests (31 tests)
- [x] Integration tests (34 tests)

#### v0.1.7 - Station Domain Events ✅
- [x] StationRegistered event
- [x] OperatingScheduleUpdated event
- [x] ScheduleExceptionAdded event
- [x] StationStatusChanged event
- [x] Symfony Messenger configuration

### Submodule CI/CD Setup

#### v0.1.8 - Submodule CI/CD Pipelines ✅
- [x] `ewlin-php-api`: GitHub Actions workflow (PHPStan, PHPUnit)
- [x] `ewlin-validator`: GitHub Actions workflow (TypeScript build, Vitest)
- [x] `ewlin-types`: GitHub Actions workflow (TypeScript build)
- [x] Documentation: Submodule contribution workflow
- [ ] Branch protection rules (manual configuration required)

### Phase 1B: Job Management Service

#### v0.1.9 - Job Entity ✅
- [x] Job entity and repository
- [x] JobStatus enum (Draft/Planned/InProgress/Delayed/Completed/Cancelled)
- [x] workshopExitDate field
- [x] color field (random hex from palette)
- [x] Database migration

#### v0.1.10 - Job API Endpoints ✅
- [x] POST /api/v1/jobs (create)
- [x] GET /api/v1/jobs (list with pagination and search)
- [x] GET /api/v1/jobs/{id} (get)
- [x] PUT /api/v1/jobs/{id} (update)
- [x] DELETE /api/v1/jobs/{id} (delete)
- [x] OpenAPI documentation

#### v0.1.11 - Task Entity ✅
- [x] Task entity (within Job aggregate)
- [x] TaskStatus enum (Defined/Ready/Assigned/Completed/Cancelled)
- [x] TaskType enum (Internal/Outsourced)
- [x] Duration value object (setupMinutes, runMinutes, durationOpenDays)
- [x] Job-Task bidirectional relationship with addInternalTask(), addOutsourcedTask()
- [x] Database migration for tasks table
- [x] Unit tests (94 new tests)

#### v0.1.12 - Job Creation with DSL (Server-Side) ✅
- [x] Extend POST /api/v1/jobs to accept `tasksDsl` field
- [x] Semantic validation (station/provider existence check)
- [x] Task entity creation from parsed DSL
- [x] Validation error response with line numbers
- [x] `rawDsl` field preserved on Task entities

#### v0.1.13 - Autocomplete Data Endpoints ✅
- [x] GET /api/v1/stations/names - Station name list for autocomplete
- [x] GET /api/v1/providers/names - Provider name list for autocomplete
- [x] GET /api/v1/providers/action-types - Action type list for autocomplete
- [x] Lightweight responses optimized for autocomplete UI

#### v0.1.14 - Approval Gates ✅
- [x] proofSentAt, proofApprovedAt fields on Job
- [x] platesStatus field on Job (PlatesStatus enum: Todo/Done)
- [x] PUT /api/v1/jobs/{id}/proof endpoint
- [x] PUT /api/v1/jobs/{id}/plates endpoint

#### v0.1.15 - Paper Procurement ✅
- [x] paperPurchaseStatus field on Job (PaperPurchaseStatus enum: InStock/ToOrder/Ordered/Received)
- [x] paperOrderedAt automatic timestamp (auto-set when status → Ordered)
- [x] PUT /api/v1/jobs/{id}/paper endpoint

#### v0.1.16 - Job Dependencies ✅
- [x] requiredJobIds field on Job
- [x] POST /api/v1/jobs/{id}/dependencies endpoint
- [x] Circular dependency detection
- [x] Dependency listing

#### v0.1.17 - Job Comments ✅
- [x] Comment entity (within Job aggregate)
- [x] POST /api/v1/jobs/{id}/comments endpoint
- [x] Comment listing (threaded in future)

#### v0.1.18 - Job Domain Events ✅
- [x] JobCreated event
- [x] TaskAddedToJob event
- [x] ApprovalGateUpdated event
- [x] JobCancelled event (with recalledTaskIds, preservedTaskIds)
- [x] Event publishing via Messenger

#### v0.1.19 - Job Cancellation ✅
- [x] POST /api/v1/jobs/{id}/cancel endpoint
- [x] Job.cancel() method with task cascade
- [x] JobCancelled event with cancelledTaskIds
- [x] All non-terminal task statuses → Cancelled
- [x] Unit tests for cancellation logic
- [x] Integration tests for cancel endpoint

---

## Milestone 2: Scheduling Core (v0.2.x)

### Phase 2A: Shared Validation Package ✅ (Completed in v0.0.4)

> **Note:** This phase was completed ahead of schedule in v0.0.4. The `@flux/schedule-validator` package is fully functional with all 6 validators and 29 tests.

#### v0.2.0 - Core Validation Types ✅ (Done in v0.0.4)
- [x] ScheduleSnapshot type definition → `@flux/types`
- [x] ProposedAssignment type → `@flux/types`
- [x] ValidationResult type → `@flux/types`
- [x] ScheduleConflict types (all 6 types) → `@flux/types`

#### v0.2.1 - Station Conflict Validation ✅ (Done in v0.0.4)
- [x] Station double-booking check → `validators/station.ts`
- [x] Time overlap calculation utilities → `utils/time.ts`
- [x] Unit tests with 100% coverage

#### v0.2.2 - Group Capacity Validation ✅ (Done in v0.0.4)
- [x] Concurrent task counting → `utils/time.ts`
- [x] Group capacity check → `validators/group.ts`
- [x] Unit tests

#### v0.2.3 - Precedence Validation ✅ (Done in v0.0.4)
- [x] Task sequence order check → `validators/precedence.ts`
- [x] Within-job precedence logic
- [x] Bypass flag support (Alt key)
- [x] Unit tests

#### v0.2.4 - Approval Gate Validation ✅ (Done in v0.0.4)
- [x] BAT status check → `validators/approval.ts`
- [x] Plates status check (for printing tasks)
- [x] Unit tests

#### v0.2.5 - Availability Validation ✅ (Done in v0.0.4)
- [x] Operating schedule check → `validators/availability.ts`
- [x] Schedule exception check
- [x] Duration stretching calculation (simplified for MVP)
- [x] Unit tests

#### v0.2.6 - Package Build & Publish ✅ (Done in v0.0.4)
- [x] Browser build (ES modules)
- [x] Node.js build (CommonJS + ESM)
- [x] Type declarations
- [x] Package integrated in workspace

### Phase 2B: Validation Service (Node.js) — see [ADR-010](../architecture/decision-records.md#adr-010--isomorphic-validation-service-nodejs)

#### v0.2.7 - Express/Fastify Server Setup ✅
- [x] HTTP server initialization
- [x] Health check endpoint
- [x] Request logging
- [x] Error handling middleware

#### v0.2.7.1 - Validation Service Git Submodule ✅
- [x] Create `ewlin-validation-service` repository
- [x] Convert to git submodule (consistent with php-api, types, validator)

#### v0.2.8 - Validation API Endpoint ✅
- [x] POST /validate endpoint
- [x] Request validation (Zod)
- [x] Response formatting
- [x] Performance logging (< 50ms target)

#### v0.2.9 - Validation Service Docker ✅
- [x] Dockerfile for Node.js service
- [x] Docker Compose integration
- [x] Environment configuration
- [x] Health check configuration

### Phase 2C: Assignment Service (PHP)

#### v0.2.10 - Schedule Aggregate
- [ ] Schedule entity (aggregate root)
- [ ] TaskAssignment value object (with isCompleted, completedAt fields)
- [ ] Schedule repository
- [ ] Database migration

#### v0.2.11 - Assignment API Endpoints
- [ ] POST /api/v1/tasks/{taskId}/assign (create assignment)
- [ ] Validation Service integration (HTTP client)
- [ ] Assignment persistence on validation success
- [ ] Error handling for validation failures

#### v0.2.12 - End Time Calculation
- [ ] Calculate scheduledEnd considering operating schedule
- [ ] Handle task stretching across unavailable periods
- [ ] Business calendar integration for outsourced tasks
- [ ] LatestDepartureTime handling (if drop > departure, start = next business day)
- [ ] ReceptionTime handling (scheduledEnd = receptionTime on completion day)

#### v0.2.13 - Unassign (Recall) Task
- [ ] DELETE /api/v1/tasks/{taskId}/assign endpoint
- [ ] Task status update to 'Ready'
- [ ] Event publishing

#### v0.2.14 - Reschedule Task
- [ ] PUT /api/v1/tasks/{taskId}/assign endpoint
- [ ] Revalidation on reschedule
- [ ] Event publishing

#### v0.2.15 - Schedule Snapshot Endpoint
- [ ] GET /api/v1/schedule/snapshot endpoint
- [ ] All entities aggregation (stations, jobs, tasks, assignments)
- [ ] snapshotVersion for optimistic locking
- [ ] Conflict and late job inclusion

#### v0.2.16 - Business Calendar
- [ ] Open day calculation utility
- [ ] Weekend exclusion (MVP)
- [ ] GET /api/v1/calendar/open-days endpoint

#### v0.2.17 - Assignment Domain Events
- [ ] TaskAssigned event
- [ ] TaskUnassigned event
- [ ] TaskRescheduled event
- [ ] TaskCompletionToggled event
- [ ] ConflictDetected event
- [ ] ScheduleUpdated event

#### v0.2.18 - Task Completion Toggle
- [ ] PUT /api/v1/tasks/{taskId}/completion endpoint
- [ ] Toggle isCompleted flag (manual, not time-based)
- [ ] Set/clear completedAt timestamp
- [ ] Completion does NOT affect precedence validation
- [ ] Unit tests

---

## Milestone 3: Frontend Integration (v0.3.x)

### Phase 3A: Frontend Mock Data

#### v0.3.0 - Mock Data Generators
- [ ] Station generator
- [ ] Job generator with tasks
- [ ] Assignment generator
- [ ] Snapshot cache implementation

#### v0.3.1 - Mock API
- [ ] getSnapshot endpoint
- [ ] CRUD operations (create, update, delete)
- [ ] Configurable latency
- [ ] TypeScript types

### Phase 3B: Frontend Core UI

#### v0.3.2 - Layout Components
- [ ] Header with navigation
- [ ] Main page 3-column layout
- [ ] Responsive breakpoints
- [ ] Panel collapse/expand

#### v0.3.3 - Left Panel - Jobs List
- [ ] Job list component
- [ ] Job filtering by reference/client/description
- [ ] Job selection state
- [ ] Status indicators

#### v0.3.4 - Left Panel - Tasks List
- [ ] Task list for selected job
- [ ] Task mini-tiles with duration
- [ ] Scheduled vs unscheduled appearance
- [ ] Recall button on hover

#### v0.3.5 - Center Panel - Time Axis
- [ ] Vertical time axis component
- [ ] 30-minute snap grid
- [ ] Day/hour markers
- [ ] "Today" marker line

#### v0.3.6 - Center Panel - Station Columns
- [ ] Station column headers
- [ ] Column scroll (horizontal)
- [ ] Provider columns with subcolumns
- [ ] Unavailability overlay (hatched)

#### v0.3.7 - Center Panel - Tile Component
- [ ] Task tile with job color
- [ ] Setup vs run sections
- [ ] Job reference and description
- [ ] Start/end time display
- [ ] Completion checkbox (manual toggle, not time-based)
- [ ] Completion indicator visual

#### v0.3.8 - Center Panel - Similarity Indicators
- [ ] Circles between consecutive tiles
- [ ] Filled vs hollow appearance
- [ ] Position calculation

#### v0.3.9 - Right Panel - Late Jobs
- [ ] Late jobs list component
- [ ] Delay amount display
- [ ] Link to job details

#### v0.3.10 - Right Panel - Job Details
- [ ] Task list with times
- [ ] Approval gate status
- [ ] Paper status
- [ ] Comments section

### Phase 3C: Client-Side Validation Integration

#### v0.3.11 - Validator Package Integration
- [ ] Install @flux/schedule-validator in frontend
- [ ] Validation utility wrapper
- [ ] Validation result display components
- [ ] Error message formatting

#### v0.3.12 - Drag & Drop Infrastructure
- [ ] Drag infrastructure (dnd-kit)
- [ ] Drag preview component
- [ ] Drop zone detection

#### v0.3.13 - Real-Time Validation During Drag
- [ ] Validate on drag move (< 10ms)
- [ ] Valid/invalid drop zone visualization
- [ ] Precedence safeguard (snap to valid)
- [ ] Alt-key bypass detection

#### v0.3.14 - Drop Handling
- [ ] Create assignment on valid drop
- [ ] Show conflict panel on invalid (warnings only in MVP, no hard blocks)
- [ ] Optimistic update
- [ ] Tile insertion with push-down (capacity-1 stations)
- [ ] Tile overlap allowed (capacity > 1 stations)

### Phase 3D: Backend API Integration

#### v0.3.15 - API Client Setup
- [ ] API client configuration
- [ ] Environment-based URL configuration
- [ ] Error handling utilities
- [ ] Request/response interceptors

#### v0.3.16 - Snapshot Loading
- [ ] Replace mock with real API
- [ ] Loading states
- [ ] Error states
- [ ] Retry logic

#### v0.3.17 - Assignment Operations Integration
- [ ] Create assignment via API
- [ ] Recall via API
- [ ] Reschedule via API
- [ ] Server validation response handling

### Phase 3E: DSL Editor

#### v0.3.18 - DSL Parser Package (see [ADR-011](../architecture/decision-records.md#adr-011--lezer-parser-system-for-task-dsl))
- [ ] `@flux/task-dsl-parser` package setup
- [ ] Lezer grammar definition (`task-dsl.grammar`)
- [ ] Grammar compilation and parser generation
- [ ] Internal task syntax: [Station] setup+run "comment"
- [ ] Outsourced task syntax: ST [Provider] ActionType duration "comment"
- [ ] Error recovery for partial parsing
- [ ] CodeMirror 6 language extension
- [ ] Syntax highlighting for task DSL
- [ ] Real-time parse error display

#### v0.3.19 - Job Creation Modal
- [ ] Modal component
- [ ] Required fields (reference, client, description, workshopExitDate)
- [ ] DSL textarea with syntax highlighting (uses v0.3.18)
- [ ] Autocomplete integration (uses v0.1.13 endpoints)
- [ ] Validation and submission

---

## Milestone 4: Production Readiness (v1.0.x)

### Phase 4A: Security & Auth

#### v1.0.0 - Authentication
- [ ] JWT authentication implementation
- [ ] Login/logout endpoints
- [ ] Token refresh mechanism
- [ ] Session management

#### v1.0.1 - Authorization
- [ ] RBAC implementation
- [ ] Role definitions (admin, scheduler, viewer)
- [ ] Permission checks on endpoints
- [ ] Frontend permission guards

### Phase 4B: Performance & Reliability

#### v1.0.2 - Caching Layer
- [ ] Redis cache integration
- [ ] Snapshot caching
- [ ] Cache invalidation on events
- [ ] Cache warming strategy

#### v1.0.3 - Performance Optimization
- [ ] Database query optimization
- [ ] Index optimization
- [ ] API response time < 500ms verification
- [ ] Frontend bundle size optimization

#### v1.0.4 - Frontend Virtualization
- [ ] Virtual scrolling for grid
- [ ] Lazy loading for large datasets
- [ ] Memoization optimization
- [ ] 60 FPS verification

### Phase 4C: Operations

#### v1.0.5 - Monitoring & Logging
- [ ] Prometheus metrics endpoints
- [ ] Centralized logging
- [ ] Health check endpoints
- [ ] Alerting rules

#### v1.0.6 - Deployment Configuration
- [ ] Production Docker images
- [ ] Kubernetes manifests
- [ ] Environment configurations
- [ ] Secrets management

#### v1.0.7 - Documentation
- [ ] API documentation (OpenAPI)
- [ ] Architecture documentation
- [ ] Deployment guide
- [ ] User manual

#### v1.0.8 - Final Testing
- [ ] Integration test suite
- [ ] End-to-end tests
- [ ] Performance testing
- [ ] Security review

---

## Post-MVP Features

### Schedule Branching (v1.1.x)
- [ ] Branch creation (duplicate schedule)
- [ ] Branch naming and comments
- [ ] Schedule list view
- [ ] PROD designation (single active)
- [ ] Branch comparison

### Optimization & Suggestions (v1.2.x)
- [ ] Auto-scheduling suggestions
- [ ] Conflict resolution recommendations
- [ ] Utilization optimization hints
- [ ] Similarity-based scheduling

### Reporting & Analytics (v1.3.x)
- [ ] Job completion reports
- [ ] Station utilization charts
- [ ] Late job trends
- [ ] Export functionality (PDF/CSV)

### Real-Time Updates (v1.4.x)
- [ ] WebSocket server setup
- [ ] Schedule change notifications
- [ ] Frontend WebSocket client
- [ ] Multi-user awareness

---

## Summary Table

| Milestone | Version | Focus |
|-----------|---------|-------|
| M0 | v0.0.x | Infrastructure & Foundation |
| M1 | v0.1.x | Core Domain (Station + Job) |
| M2 | v0.2.x | Scheduling Core (Assignment + Validation) |
| M3 | v0.3.x | Frontend Integration |
| M4 | v1.0.x | Production Readiness |
| Post-MVP | v1.1+ | Branching, Optimization, Reporting |

---

## Parallel Work Streams

The following can be developed in parallel:

```
Stream 1: Backend Services (PHP)
├── Station Management
├── Job Management
├── Assignment Service
└── Scheduling View

Stream 2: Validation (TypeScript)
├── @flux/schedule-validator package
└── Validation Service (Node.js)

Stream 3: Frontend (React)
├── Mock mode development
├── UI components
├── Drag & drop
└── API integration

Stream 4: Infrastructure
├── Docker setup
├── CI/CD pipeline
├── Monitoring
└── Deployment
```

---

## Dependencies

```
Frontend ──────────────► @flux/schedule-validator
                              │
Assignment Service ───────────┘
       │
       ├── Station Management (reads stations/groups)
       └── Job Management (reads tasks/approval gates)

Scheduling View ◄──────── All domain events
```

---

## Notes

- Each phase results in a deployable, working state
- Frontend continues with mock data until backend is ready (M3)
- Validation package is shared between frontend and backend
- Backend services can start as a monolith and split later
- The order can be adjusted based on business priorities
- Schedule branching and optimization are clearly post-MVP
- **MVP Validation Behavior:** All validation rules result in visual warnings only — no hard blocks prevent scheduling decisions. Hard blocking behavior may be introduced post-MVP.
