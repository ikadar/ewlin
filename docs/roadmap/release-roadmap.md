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

#### v0.2.10 - Schedule Aggregate ✅
- [x] Schedule entity (aggregate root)
- [x] TaskAssignment value object (with isCompleted, completedAt fields)
- [x] Schedule repository
- [x] Database migration

#### v0.2.11 - Assignment API Endpoints ✅
- [x] POST /api/v1/tasks/{taskId}/assign (create assignment)
- [x] Validation Service integration (HTTP client)
- [x] Assignment persistence on validation success
- [x] Error handling for validation failures

#### v0.2.12 - End Time Calculation ✅
- [x] Calculate scheduledEnd considering operating schedule
- [x] Handle task stretching across unavailable periods
- [x] Business calendar integration for outsourced tasks
- [x] LatestDepartureTime handling (if drop > departure, start = next business day)
- [x] ReceptionTime handling (scheduledEnd = receptionTime on completion day)

#### v0.2.13 - Unassign (Recall) Task ✅
- [x] DELETE /api/v1/tasks/{taskId}/assign endpoint
- [x] Task status update to 'Ready'
- [x] Event publishing

#### v0.2.14 - Reschedule Task ✅
- [x] PUT /api/v1/tasks/{taskId}/assign endpoint
- [x] Revalidation on reschedule
- [x] Event publishing

#### v0.2.15 - Schedule Snapshot Endpoint ✅
- [x] GET /api/v1/schedule/snapshot endpoint
- [x] All entities aggregation (stations, jobs, tasks, assignments)
- [x] snapshotVersion for optimistic locking
- [x] Conflict and late job inclusion

#### v0.2.16 - Business Calendar ✅
- [x] Open day calculation utility
- [x] Weekend exclusion (MVP)
- [x] GET /api/v1/calendar/open-days endpoint

#### v0.2.17 - Assignment Domain Events ✅
- [x] TaskAssigned event
- [x] TaskUnassigned event
- [x] TaskRescheduled event
- [x] TaskCompletionToggled event
- [x] ConflictDetected event
- [x] ScheduleUpdated event

#### v0.2.18 - Task Completion Toggle ✅
- [x] PUT /api/v1/tasks/{taskId}/completion endpoint
- [x] Toggle isCompleted flag (manual, not time-based)
- [x] Set/clear completedAt timestamp
- [x] Completion does NOT affect precedence validation
- [x] Unit tests

---

## Milestone 3: Frontend Integration (v0.3.x)

> **Reference:** [UX-UI Specification](../ux-ui/00-overview.md) | [Open Questions (Resolved)](../ux-ui/07-open-questions.md)

### Phase 3A: Frontend Mock Data

#### v0.3.0 - Mock Data Generators ✅
- [x] Station generator (with operating schedules)
- [x] Job generator with tasks (including problematic jobs: late, conflicts)
- [x] Assignment generator
- [x] Snapshot cache implementation

#### v0.3.1 - Mock API ✅
- [x] getSnapshot endpoint
- [x] CRUD operations (create, update, delete)
- [x] Configurable latency
- [x] TypeScript types matching `@flux/types`

### Phase 3B: Frontend Core Layout

> **Layout:** Sidebar | Jobs List | Job Details | Date Strip | Timeline | Station Columns
> **No Right Panel** — problems shown in Jobs List "Problèmes" section

#### v0.3.2 - Sidebar Component ✅
- [x] Fixed width (w-14 / 56px)
- [x] Navigation icons: layout-grid (active), calendar, settings
- [x] Active/inactive/hover states
- [x] Settings icon (disabled for MVP)

#### v0.3.3 - Jobs List Component ✅
- [x] Fixed width (w-72 / 288px)
- [x] Add Job button (green +, disabled for MVP)
- [x] Search field with filtering (reference, client, description)
- [x] **Problèmes section** at top with count badge
- [x] Late jobs: red background, `alert-circle` icon, "En retard" badge
- [x] Conflict jobs: amber background, `shuffle` icon, "Conflit" badge
- [x] **Travaux section** for normal jobs
- [x] Job cards with progress dots (task completion visualization)
- [x] Selected job highlight (bg-white/10, border)
- [ ] Keyboard navigation (ALT+↑/↓) - deferred

#### v0.3.4 - Job Details Panel ✅
- [x] Fixed width (w-72 / 288px)
- [x] Job info: Code, Client, Intitulé, Départ
- [x] Status section: BAT, Papier, Plaques (read-only for MVP)
- [x] **Task List** with two visual states:
  - Unscheduled: Full job color, border-l-4, draggable
  - Scheduled: Dark placeholder, station + datetime only
- [x] Single-click scheduled task → scroll grid to tile (implemented in v0.3.18)
- [x] Double-click scheduled task → recall (implemented in v0.3.18)

#### v0.3.5 - Date Strip Component ✅
- [x] Fixed width (w-12 / 48px)
- [x] Day abbreviation + day number per row
- [x] Today highlight (amber background)
- [x] Click to jump to date
- [ ] Hover 2s while dragging → auto-jump to date (deferred - requires drag state)

### Phase 3C: Scheduling Grid

#### v0.3.6 - Timeline Column ✅
- [x] Fixed width (w-12 / 48px)
- [x] Hour markers with grid lines
- [x] 30-minute and 15-minute tick marks
- [x] "Now" line (red, `bg-red-500`) with time label
- [ ] **Synchronized vertical scroll** with station columns (deferred - requires station columns)

#### v0.3.7 - Station Column Headers ✅
- [x] Sticky header row (z-30)
- [x] Station names
- [x] **Off-screen indicators**: chevron + count
  - Above viewport: `↑` chevron-up + count
  - Below viewport: `↓` chevron-down + count
  - Click to scroll to tile (structure ready, calculation in v0.3.9)

#### v0.3.8 - Station Columns ✅
- [x] Dynamic width columns (w-60 / 240px each)
- [x] Horizontal scroll for many stations
- [x] Unavailability overlay (hatched pattern `bg-stripes-dark`)
- [x] Hour grid lines
- [x] **Departure date marker** (blue line, `bg-blue-500`) for selected job
- [x] **SchedulingGrid** unified component with synchronized scrolling

#### v0.3.9 - Tile Component ✅
- [x] Job color: border-l-4 + low-opacity background
- [x] **Setup/Run sections**: lighter shade (setup) + full color (run)
- [x] Content: completion icon + job reference + client
- [x] Completion icon: `circle` (incomplete) / `circle-check` (complete, emerald)
- [x] Completed tile: green gradient from left
- [x] **Swap buttons** (hover): chevron-up/down at bottom-right
- [x] Click behavior: single = select job, double = recall tile

#### v0.3.10 - Similarity Indicators ✅
- [x] **Link icons** between consecutive tiles (not circles)
- [x] `link` icon (zinc-400) = criterion matched
- [x] `unlink` icon (zinc-800) = criterion not matched
- [x] Position: horizontal row at top-right of lower tile

### Phase 3D: Interactions

#### v0.3.11 - Drag & Drop Infrastructure ✅
- [x] Drag infrastructure (@dnd-kit/core, @dnd-kit/utilities)
- [x] Drag from Job Details Panel (unscheduled tasks only)
- [x] Drag preview with slight transparency
- [x] 30-minute snap grid
- [x] Droppable station columns with highlighting

#### v0.3.12 - Column Focus on Drag ✅
- [x] Non-target columns collapse to 120px during drag
- [x] Target station stays full width (240px)
- [x] Active job tiles keep color, others desaturated
- [x] Animation: 150ms ease-out transitions

#### v0.3.13 - Real-Time Validation During Drag ✅
- [x] Validate on drag move (< 10ms)
- [x] Valid drop zone: green ring highlight
- [x] Invalid drop zone: red ring indicator
- [x] Precedence safeguard: auto-snap to valid position
- [x] ALT key bypass: allows violation with amber ring warning

#### v0.3.14 - Drop Handling ✅
- [x] Create assignment on valid drop
- [x] Show conflict in Problèmes section (warnings only, no hard blocks)
- [x] Optimistic UI update
- [x] Tile insertion with push-down (capacity-1 stations)
- [ ] Tile overlap allowed (capacity > 1 stations) - deferred

#### v0.3.15 - Tile Swap ✅
- [x] Swap buttons visible on hover
- [x] Click swap up/down → exchange positions with adjacent tile
- [ ] Validation on swap - deferred
- [ ] Smooth animation - deferred (instant swap for MVP)

#### v0.3.16 - Quick Placement Mode ✅
- [x] Toggle: ALT+Q
- [x] **Placement indicator**: white glow line at snap position
- [x] **Active tile**: white ring/halo around tile being placed
- [ ] **Tooltip**: task info near cursor - deferred
- [x] **No task available**: forbidden icon as cursor
- [x] Click to place task
- [ ] Integrates with job navigation (ALT+↑/↓) - deferred to v0.3.17

### Phase 3E: Keyboard Navigation

#### v0.3.17 - Keyboard Shortcuts ✅
- [x] ALT+Q: Toggle Quick Placement Mode (implemented in v0.3.16)
- [x] ALT+D: Jump to selected job's departure date
- [x] ALT+↑: Previous job
- [x] ALT+↓: Next job
- [ ] ALT+←/→: Navigate columns left/right - deferred (no clear use case)
- [x] Home: Jump to today
- [x] Page Up/Down: Scroll by day

### Phase 3F: UX/UI Enhancements

#### v0.3.18 - Job Details Task Interactions ✅
- [x] Single-click scheduled task → scroll grid to tile position (X and Y)
- [x] Double-click scheduled task → recall (unschedule)
- [x] Visual indicator for scheduled vs unscheduled tasks (cursor-pointer, hover state)
- [x] Grid scroll integration with Job Details Panel

#### v0.3.19 - Selection Glow Effect ✅
- [x] Replace ring border with box-shadow glow for selected tiles
- [x] Glow effect: `box-shadow: 0 0 12px 4px rgba(color, 0.6)`
- [x] Works with all job colors

#### v0.3.20 - Tile-Based Drop Position ✅
- [x] Calculate drop position from tile top edge (not cursor)
- [x] Track grab offset on drag start
- [x] Prevents tile "jumping" on drop
- [x] Applies to both new placements and repositioning

### Phase 3G: Station Compact (Backend + Frontend)

#### v0.3.21 - Station Compact API (Backend)
- [ ] `POST /api/stations/{id}/compact` endpoint
- [ ] CompactStationService with gap removal algorithm
- [ ] Respects precedence rules (no conflicts created)
- [ ] Single transaction for all assignment updates
- [ ] PHPStan level 8, unit tests

#### v0.3.22 - Station Compact UI (Frontend)
- [ ] Compact button in station headers
- [ ] API integration (call compact endpoint)
- [ ] Loading state during operation
- [ ] Refresh assignments after successful compact

### Phase 3H: Additional UX Features

#### v0.3.23 - Downtime-Aware Tile Height
- [ ] Tile height based on `scheduledEnd - scheduledStart`
- [ ] Visual representation of time-stretched tasks
- [ ] Setup/run sections scale proportionally

#### v0.3.24 - No Conflict for Unscheduled Predecessors (Validator)
- [ ] Update `@flux/schedule-validator` precedence logic
- [ ] Unscheduled predecessors don't create conflicts
- [ ] Enables backward scheduling workflow
- [ ] Update validator tests

#### v0.3.25 - Grid Tile Repositioning
- [ ] Drag scheduled tiles within same station column
- [ ] Reschedule to new time position on drop
- [ ] Ghost placeholder at original position
- [ ] Push-down behavior when dropping onto other tiles
- [ ] Reuses tile-based drop position calculation

### Phase 3I: Backend API Integration

#### v0.3.26 - Validator Package Integration
- [ ] Install @flux/schedule-validator in frontend
- [ ] Validation utility wrapper
- [ ] Error message formatting (French)
- [ ] Conflict type to visual mapping

#### v0.3.27 - API Client Setup
- [ ] API client configuration (RTK Query)
- [ ] Environment-based URL configuration
- [ ] Error handling utilities
- [ ] Request/response interceptors

#### v0.3.28 - Snapshot Loading
- [ ] Replace mock with real API
- [ ] Loading states (skeleton/spinner TBD post-MVP)
- [ ] Error states
- [ ] Retry logic

#### v0.3.29 - Assignment Operations Integration
- [ ] Create assignment via API
- [ ] Recall via API
- [ ] Reschedule via API
- [ ] Toggle completion via API
- [ ] Server validation response handling

### Phase 3J: DSL Editor (Post-MVP scope)

> **Note:** Job creation modal and DSL editor moved to post-MVP. Current MVP focuses on scheduling UI with existing jobs.

#### v0.3.30 - DSL Parser Package (Post-MVP)
- [ ] `@flux/task-dsl-parser` package setup
- [ ] Lezer grammar definition
- [ ] CodeMirror 6 integration
- [ ] Syntax highlighting

#### v0.3.31 - Job Creation Modal (Post-MVP)
- [ ] Modal component
- [ ] DSL textarea with highlighting
- [ ] Autocomplete integration

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
