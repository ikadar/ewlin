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
| **M4** | Job Creation Form (Element layer + JCF UI + Templates) |
| **M5** | Backend API Integration |
| **M6** | DSL Syntax Highlighting (Post-MVP, optional) |
| **M7** | Production Readiness |
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

#### v0.3.21 - Station Compact API (Backend) ✅
- [x] `POST /api/v1/stations/{id}/compact` endpoint
- [x] CompactStationService with gap removal algorithm
- [x] Respects precedence rules (no conflicts created)
- [x] Single transaction for all assignment updates
- [x] PHPStan level 8, unit tests (7 unit + 3 integration)

#### v0.3.22 - Station Compact UI (Frontend) ✅
- [x] Compact button in station headers
- [x] API integration (call compact endpoint)
- [x] Loading state during operation
- [x] Refresh assignments after successful compact

### Phase 3H: Additional UX Features

#### v0.3.23 - Downtime-Aware Tile Height ✅
- [x] Tile height based on `scheduledEnd - scheduledStart`
- [x] Visual representation of time-stretched tasks
- [x] Setup/run sections scale proportionally

#### v0.3.24 - No Conflict for Unscheduled Predecessors (Validator) ✅
- [x] Update `@flux/schedule-validator` precedence logic
- [x] Unscheduled predecessors don't create conflicts
- [x] Enables backward scheduling workflow
- [x] Update validator tests

#### v0.3.25 - Grid Tile Repositioning ✅
- [x] Drag scheduled tiles within same station column
- [x] Reschedule to new time position on drop
- [x] Ghost placeholder at original position
- [x] Push-down behavior when dropping onto other tiles
- [x] Reuses tile-based drop position calculation

#### v0.3.26 - Manual QA Fixes ✅
- [x] Custom collision detection (`document.elementsFromPoint()`)
- [x] DragPreview pointer-events-none (prevents infinite loop)
- [x] Reschedule uses same validation as new placement (per UX spec)
- [x] Validator package rebuild (v0.3.24 changes)
- [x] Mock data fixes (group capacity, BAT approval)
- [x] Local compact implementation (mock mode)
- [x] Disable column collapse during reschedule
- [x] Operating hours validation timezone fix (UTC → local)
- [x] Precedence conflict auto-snap to valid position
- [x] Compact respects precedence (task.sequenceOrder)
- [x] Plates ApprovalGateConflict is warning only
- [x] End time stretching (BR-ASSIGN-003b)
- [x] Compact uses calculateEndTime for stretching
- [x] Initial assignments use BR-ASSIGN-003b stretching
- [x] Orange warning color for non-blocking conflicts (Plates approval)

#### v0.3.27 - Drag-Drop E2E Test Suite ✅
- [x] Deterministic test fixtures (6 fixtures: test, push-down, precedence, approval-gates, swap, sidebar-drag)
- [x] Reusable drag helpers (`playwright/helpers/drag.ts`)
- [x] UC-01: Sidebar-to-grid task placement tests (5 tests)
- [x] UC-02/UC-03: Tile reschedule + grid snapping tests (3 tests)
- [x] UC-04: Push-down collision tests (4 tests)
- [x] UC-06: Precedence validation tests (4 tests)
- [x] UC-07: Approval gate tests (4 tests)
- [x] UC-09: Swap operation tests (5 tests)
- [x] EC-02/EC-04: Edge case tests (4 tests)
- [x] 100% test reliability (5/5 runs without failure)
- [x] HTML5 DragEvent API with DataTransfer (pragmatic-drag-and-drop)
- [x] **UX-UI Specifications** - Complete documentation structure:
  - [x] `user-stories.md` - 16 UI user stories (US-UI-*)
  - [x] `acceptance-criteria.md` - Given-When-Then format (AC-UI-*)
  - [x] `non-functional-requirements.md` - Performance, accessibility, i18n
  - [x] `design-tokens.md` - Colors, spacing, typography, animations
  - [x] `state-machines.md` - Drag, tile, quick placement states
  - [x] `keyboard-shortcuts.md` - Complete shortcuts reference
  - [x] `component-api.md` - Component props and interfaces
- [x] `06-edge-cases.md` expanded with error messages and recovery

#### v0.3.28 - Alt+Drag Bypass Bug Fix ✅
> **Implements:** [REQ-13](../ux-ui/additional-requirements/refactored-new-requirements-en.md#req-13-fix-altdrag-bypass-conflict-recording-bug)
> **Released:** 2025-12-22

- [x] Fix `useDropValidation` hook: bypass-independent precedence check
- [x] Fix `bypassedPrecedence` calculation in `App.tsx`
- [x] Amber ring appears during Alt+drag over conflict position
- [x] Record `PrecedenceConflict` when Alt+drop is used
- [x] Clear conflict when task moved to valid position
- [x] E2E tests for Alt+drop scenarios

#### v0.3.29 - Job Focus & Conflict Visual Feedback ✅
> **Implements:** [REQ-01](../ux-ui/additional-requirements/refactored-new-requirements-en.md#req-01-job-focus-visual-effect), [REQ-12](../ux-ui/additional-requirements/refactored-new-requirements-en.md#req-12-persistent-visual-feedback-for-precedence-violations)
> **Released:** 2025-12-22

- [x] **REQ-01:** Mute non-selected job tiles when job is focused (not just during drag)
- [x] Extend `isMuted` logic: muted if `selectedJobId !== undefined && selectedJobId !== job.id`
- [x] **REQ-12:** Persistent amber glow on tiles with precedence conflict
- [x] New `hasConflict` prop on Tile component
- [x] Amber glow: `box-shadow: 0 0 12px 4px #F59E0B99`
- [x] Conflict glow overrides selection glow
- [x] E2E tests for visual feedback states
- [x] Bug fix: Amber ring only on compatible stations

#### v0.3.30 - Job Deselection Methods ✅
> **Implements:** [REQ-02/03](../ux-ui/additional-requirements/refactored-new-requirements-en.md#req-0203-job-deselection-methods)
> **Released:** 2025-12-22

- [x] Close button (X) in JobDetailsPanel header
- [x] `onClose` prop for JobDetailsPanel
- [x] Toggle click in JobsList: click selected job → deselect
- [x] Both methods set `selectedJobId(null)`
- [x] E2E test: close button and toggle click (6 tests)

#### v0.3.31 - Real-Time Drag Snapping ✅
> **Implements:** [REQ-08/09](../ux-ui/additional-requirements/refactored-new-requirements-en.md#req-0809-snapping-drag-preview-with-vertical-constraint)
> **Released:** 2025-12-22

- [x] **REQ-08:** Snap drag preview to 30-minute grid during drag (not just on drop)
- [x] Modify DragLayer.tsx: snap `top` position in real-time
- [x] **REQ-09:** Vertical-only drag (already implemented, verified)
- [x] Horizontal position remains fixed to column center
- [x] E2E test: drag preview snaps during drag (5 tests)

#### v0.3.32 - Enhanced Job Progression Visualization ✅
> **Implements:** [REQ-07](../ux-ui/tmp/refactored-new-requirements-en.md#req-07-enhanced-job-progression-visualization)

- [x] New `ProgressSegments` component (replaces `ProgressDots`)
- [x] Task states: unscheduled (empty), scheduled (gray), completed (green), late (red)
- [x] Segment width based on duration: `setupMinutes + runMinutes`
- [x] Standard size for ≤30min, proportional for >30min
- [x] Outsourced tasks: 5× standard width with duration label (e.g., "2JO")
- [x] Flex-wrap layout for multiple rows
- [x] Unit tests for state calculation (21 tests)
- [x] Visual test fixture

#### v0.3.33 - Task Completion Toggle ✅
> **Implements:** Task completion interaction on Tiles
> **Released:** 2025-12-22

- [x] Add `onToggleComplete` prop to `Tile` component
- [x] Make Circle/CircleCheck icon clickable with `stopPropagation`
- [x] Hover state on icon (cursor-pointer, color change)
- [x] Wire up handler in `App.tsx` to update `assignment.isCompleted`
- [x] ProgressSegments automatically reflects state change
- [x] Unit tests for toggle behavior (5 tests)
- [x] E2E test: click icon toggles completion state (4 tests)

#### v0.3.34 - Top Navigation Bar ✅
> **Implements:** [REQ-04/05/06](../ux-ui/tmp/refactored-new-requirements-en.md#req-040506-top-navigation-bar-with-controls)
> **Released:** 2025-12-22

- [x] **REQ-04:** New `TopNavBar` component (`h-12`, `bg-zinc-900`)
- [x] Logo/app name on left
- [x] **REQ-05:** Quick Placement toggle button (visual alternative to ALT+Q)
- [x] Button disabled when no job selected
- [x] **REQ-06:** Zoom control: `[-] 100% [+]` or dropdown
- [x] Zoom levels: 50%, 75%, 100%, 150%, 200%
- [x] `PIXELS_PER_HOUR` state: 40px, 60px, 80px, 120px, 160px
- [x] User/Settings section on right (placeholder)
- [x] Adjust main layout to accommodate nav bar
- [x] E2E tests for zoom and quick placement button (15 tests)

#### v0.3.35 - Global Timeline Compaction ✅
> **Implements:** [REQ-10](../ux-ui/tmp/refactored-new-requirements-en.md#req-10-global-timeline-compaction)
> **Released:** 2025-12-22

- [x] Segmented buttons in TopNavBar: `[4h] [8h] [24h]`
- [x] `compactTimeline(horizon)` function
- [x] Compaction starts from current time (`now`)
- [x] Tasks in progress are immobile
- [x] Respects precedence rules (no violations created)
- [x] Processes all stations left-to-right, top-to-bottom
- [x] Mock implementation (local state)
- [x] E2E test: compact 4h removes gaps

#### v0.3.36 - Dry Time Precedence ✅
> **Implements:** [REQ-11](../ux-ui/tmp/refactored-new-requirements-en.md#req-11-dry-time-drying-delay-after-printing)
> **Released:** 2025-12-23

- [x] `DRY_TIME_MINUTES = 240` constant (4 hours)
- [x] Update `@flux/schedule-validator` precedence logic
- [x] If predecessor is printing task: `scheduledEnd + DRY_TIME`
- [x] Identify printing tasks by station category
- [x] Label in JobDetailsPanel: `+4h drying` on precedence bar
- [x] Validator unit tests
- [x] E2E test: precedence with dry time

#### v0.3.37 - Multi-Day Grid Navigation ✅
> **Implements:** [REQ-14/15/16/17](../ux-ui/tmp/refactored-new-requirements-en.md#req-14151617-multi-day-grid-navigation--date-strip-integration)
> **Released:** 2025-12-23

- [x] **REQ-14:** Multi-day grid support (21 days / 504 hours)
- [x] DateStrip click-to-scroll: `onDateClick` connected in App.tsx
- [x] Auto-scroll to today on initial load
- [x] DateStrip scrolls with grid (synchronized Y-scroll)
- [x] **REQ-15:** Departure date highlight on DateStrip (red styling)
- [x] **REQ-16:** Scheduled days highlight (emerald indicator dots)
- [x] **REQ-17:** Extended grid background for multi-day
- [x] E2E tests for navigation and highlighting (11 tests)

#### v0.3.38 - Group Capacity Visualization ✅
> **Implements:** [REQ-18](../ux-ui/tmp/refactored-new-requirements-en.md#req-18-machine-group-capacity-limits-visualization)

- [x] Station header shows group name and capacity (e.g., "Offset Press (2/3)")
- [x] Red text and warning icon when group capacity exceeded
- [x] Red ring during drag when drop would exceed group capacity
- [x] Extended conflict detection for `GroupCapacityConflict` type
- [x] E2E tests for group capacity visualization (7 tests)

#### v0.3.39 - Outsourcing Columns ✅
> **Implements:** [REQ-19](../ux-ui/tmp/refactored-new-requirements-en.md#req-19-outsourcing-columns-provider-display)

- [x] Provider columns appear after station columns
- [x] `ProviderColumn` and `ProviderHeader` components
- [x] Provider header with Building2 icon
- [x] Dotted border on provider column
- [x] Dotted thick border on outsourced tiles
- [x] Subcolumn layout for parallel tasks (calendar-style)
- [x] Greedy subcolumn index assignment algorithm
- [x] E2E tests for provider columns (11 tests)

#### v0.3.40 - Similarities Feature Completion ✅
> **Implements:** [REQ-20](../ux-ui/tmp/refactored-new-requirements-en.md#req-20-similarities-feature-completion)

- [x] Extend `Job` type: add `paperWeight?: number`, `inking?: string`
- [x] Update `@flux/types` package
- [x] Extend mock job generator with `paperWeight` and `inking` values
- [x] `PAPER_WEIGHTS = [80, 100, 120, 150, 170, 200, 250, 300, 350]`
- [x] `INKINGS = ['CMYK', '4C+0', '4C+4C', '2C+0', 'Pantone 485+Black', '1C+0']`
- [x] Similarity indicators now show real comparisons (not always matched)
- [x] Unit tests for similarity comparison (11 new tests)

#### v0.3.41 - Drag Snapping Consistency ✅
> **Implements:** [REQ-01/02/03](../ux-ui/tmp/refactored-new-requirements-02-en.md#req-010203-drag-snapping-consistency)
> **Released:** 2026-01-06

- [x] **REQ-01:** Tile snaps to correct position during drag-over (not just on drop)
- [x] **REQ-02:** Border color (green/red/amber) based on snapped tile position, not cursor
- [x] **REQ-03:** `calculateScheduledStartFromPointer` applies `snapToGrid` before validation
- [x] Fix: `const snappedY = snapToGrid(absoluteY)` before `yPositionToTime`
- [x] Fix: DragLayer uses station column coordinates for scroll-aware snapping
- [x] E2E tests for snapping consistency

#### v0.3.42 - UI Bug Fixes ✅
> **Implements:** [REQ-04/05/06](../ux-ui/tmp/refactored-new-requirements-02-en.md#req-04)
> **Released:** 2026-01-06

- [x] **REQ-04:** `UnavailabilityOverlay` renders on all days in multi-day grid
- [x] Add `yOffset` prop to UnavailabilityOverlay, render per-day overlays
- [x] **REQ-05:** Job card overflow fix in sidebar
- [x] Add `overflow-hidden min-w-0` to header, `w-[calc(100%-1rem)]` for border clipping
- [x] **REQ-06:** Non-selected job tiles remain clickable
- [x] `pointer-events: none` only during drag, not selection mute
- [x] E2E tests for all fixes (6 tests)

#### v0.3.43 - Layout Redesign & Zoom ✅
> **Implements:** [REQ-07/08](../ux-ui/tmp/new-requirements-02.md#req-07-toolbarsidebar-layout-átszervezés)
> **Released:** 2026-01-06

- [x] **REQ-07.1:** Sidebar full height (viewport top to bottom)
- [x] **REQ-07.2:** Remove "Flux" logo from toolbar
- [x] **REQ-07.3:** Move toolbar right icons to sidebar bottom
- [x] Layout restructure: sidebar primary, toolbar secondary
- [x] **REQ-08:** Zoom levels: 25%, 50%, 75%, 100%, 150%, 200%
- [x] Update zoom dropdown/controls
- [x] E2E tests for layout and zoom (9 tests)

#### v0.3.44 - DateStrip Redesign ✅
> **Implements:** [REQ-09](../ux-ui/tmp/new-requirements-02.md#req-09-datestrip-átdolgozás)

- [x] **REQ-09.1:** Infinite scroll DateStrip (no fixed `dayCount`)
- [x] **REQ-09.2:** Focused day always centered, synced with grid scroll
- [x] **REQ-09.3:** Visual states overhaul:
  - Current day: thin line indicator (not background color)
  - Focused day: highlighted background/border
  - Departure date: red (existing)
  - Scheduled day: green dot (existing)
- [x] Update `DateCell.tsx` styling
- [x] E2E tests for DateStrip interactions (6 tests)

#### v0.3.45 - Precedence Constraint Visualization ✅
> **Implements:** [REQ-10](../ux-ui/tmp/new-requirements-02.md#req-10-precedence-constraint-vizualizáció)
> **Released:** 2026-01-07

- [x] Purple line: earliest possible start (predecessor end + dry time)
- [x] Orange line: latest possible start (successor start - task duration)
- [x] Lines visible during drag and quick placement mode
- [x] No lines if no scheduled predecessor/successor
- [x] Reuse `getEffectivePredecessorEnd` from validator
- [x] New `PrecedenceLines` component
- [x] Successor constraint validation (blocks drops below orange line)
- [x] Quick Placement Mode: lines and validation while hovering
- [x] E2E tests for precedence visualization

#### v0.3.46 - Virtual Scrolling for Multi-Day Grid ✅
> **Fixes:** Performance regression from v0.3.44 (DateStrip Redesign)
> **Completes:** REQ-09.1 (Infinite scroll) properly
> **Released:** 2026-01-07

- [x] `useVirtualScroll` hook: calculate visible day range from scroll position
- [x] Virtual scroll container: full height maintained, content rendered with transform
- [x] Grid windowing: only render ±3 days around focused day (7 days DOM vs 365)
- [x] DateStrip windowing: only render visible date cells
- [x] Station column day-slice rendering
- [x] TimelineColumn windowing (8760 → ~168 HourMarkers)
- [x] Scroll synchronization preserved between Grid and DateStrip
- [x] Performance targets: DOM <1500 elements, drag 60 FPS
- [x] React.memo optimizations (Tile, StationColumn, JobCard)
- [x] useDeferredValue for non-blocking selection
- [x] E2E tests for virtual scroll behavior

#### v0.3.47 - DateStrip Task Markers ✅
> **Implements:** DateStrip visual enhancements for task status overview

- [x] **Viewport Indicator (A):** Light gray rectangle showing visible portion of day
- [x] **"Now" Line (B):** Red line within viewport indicator at current time
- [x] **Exit Triangle (C):** White triangle at workshop exit date (departure)
- [x] **Task Timeline (D):** Dotted line from earliest task to exit date
- [x] **Task Markers (E):** Colored horizontal lines for task status:
  - Gray: scheduled (future)
  - Orange: precedence conflict
  - Red: late (past incomplete)
  - Green: completed
- [x] New components: ViewportIndicator, TaskMarkers, ExitTriangle
- [x] E2E tests for marker functionality

#### v0.3.48 - Zoom-Aware Tile Snapping (Bugfix) ✅
> **Bug:** Tile snapping works at 100% zoom but breaks at other zoom levels

**Root cause:** `snapToGrid` and `yPositionToTime` support `pixelsPerHour` parameter, but several call sites use default value instead of current zoom level.

**Affected code:**
- [x] `DragLayer.tsx:74` - `snapToGrid(contentY)` missing pixelsPerHour
- [x] `DragLayer.tsx:79` - `snapToGrid(position.y - grabOffset.y)` missing pixelsPerHour
- [x] `App.tsx` - `handleQuickPlacementMouseMove` missing pixelsPerHour
- [x] `App.tsx` - `handleQuickPlacementClick` missing pixelsPerHour for snapToGrid and yPositionToTime

**Solution:**
- [x] Add `pixelsPerHour` to DragStateContext or pass via props to DragLayer
- [x] Update Quick Placement handlers to use current pixelsPerHour state
- [x] Add E2E test for snapping at different zoom levels

### Phase 3I: UX Polish & Performance

> **Reference:** [Refactored Requirements Part 3](../ux-ui/tmp/refactored-new-requirements-03-en.md)

#### v0.3.49 - Hide DateStrip Scrollbar ✅
> **Implements:** [REQ-08](../ux-ui/tmp/refactored-new-requirements-03-en.md#req-08-hide-datestrip-scrollbar)

- [x] Hide scrollbar with CSS (webkit, Firefox, Edge)
- [x] Maintain scroll functionality (mouse wheel, touch)
- [x] Tailwind arbitrary value CSS classes

**Affected files:**
- `apps/web/src/components/DateStrip/DateStrip.tsx`

#### v0.3.50 - DateStrip & UX Improvements ✅
> **Implements:** [REQ-01](../ux-ui/tmp/refactored-new-requirements-03-en.md#req-01-month-visibility-in-datestrip) (tooltip), [REQ-02](../ux-ui/tmp/refactored-new-requirements-03-en.md#req-02-clickable-dates-in-job-details-panel)

- [x] **REQ-01:** Date tooltip on hover (custom, instant appearance, French locale)
- [x] **REQ-02:** Clickable Départ date in Job Details Panel
- [x] **REQ-02:** Clickable BAT approval date when approved
- [x] Station header cleanup (removed group capacity display)

**Affected files:**
- `apps/web/src/components/DateStrip/DateCell.tsx`
- `apps/web/src/components/JobDetailsPanel/InfoField.tsx`
- `apps/web/src/components/JobDetailsPanel/JobInfo.tsx`
- `apps/web/src/components/JobDetailsPanel/JobStatus.tsx`
- `apps/web/src/components/JobDetailsPanel/JobDetailsPanel.tsx`
- `apps/web/src/components/StationHeaders/StationHeader.tsx`
- `apps/web/src/App.tsx`

#### v0.3.51 - Drying Time Visualization ✅
> **Implements:** Visual enhancement for precedence understanding

- [x] Yellow arrow from predecessor task end to "End of drying" position
- [x] Dashed horizontal line at drying end
- [x] "End of drying" label
- [x] Only when there is drying time required
- [x] Test fixture

**Affected files:**
- `apps/web/src/components/DryingTimeIndicator/DryingTimeIndicator.tsx` (new)
- `apps/web/src/components/StationColumns/StationColumn.tsx`
- `apps/web/src/components/SchedulingGrid/SchedulingGrid.tsx`
- `apps/web/src/utils/precedenceConstraints.ts`
- `apps/web/src/App.tsx`

#### v0.3.52 - Human-Readable Validation Messages ✅
> **Implements:** [REQ-07](../ux-ui/tmp/refactored-new-requirements-03-en.md#req-07-human-readable-validation-messages)

- [x] Generate human-readable messages for each conflict type
- [x] Display validation message during drag (tooltip below preview)
- [x] Message types: station unavailable, precedence, BAT, group capacity, deadline
- [x] French localization
- [x] Test fixture

**Affected files:**
- `apps/web/src/components/DragPreview/ValidationMessage.tsx` (new)
- `apps/web/src/utils/validationMessages.ts` (new)
- `apps/web/src/dnd/DragLayer.tsx`
- `apps/web/src/hooks/useDropValidation.ts`

#### v0.3.53 - Precedence Lines + Working Hours ✅
> **Implements:** [REQ-03](../ux-ui/tmp/refactored-new-requirements-03-en.md#req-03-precedence-lines-should-respect-non-working-hours)

- [x] `snapToNextWorkingTime` utility function - snap to next working slot
- [x] `addWorkingTime` / `subtractWorkingTime` utilities
- [x] Drying time uses simple addition (physical process)
- [x] Work start snaps to working hours if drying ends outside
- [x] Update precedence line positions
- [x] Test fixture: `?fixture=precedence-working-hours`

**Key insight:** Drying is physical (continues during lunch), work requires humans (working hours only).

**Affected files:**
- `apps/web/src/utils/workingTime.ts` - new utility functions
- `apps/web/src/utils/precedenceConstraints.ts` - updated calculations

### Phase 3J: Pick & Place Interaction
> **Reference:** [Refactored Requirements Part 4](../ux-ui/tmp/refactored-new-requirements-04-en.md)

#### ✅ v0.3.54 - Pick & Place from Sidebar (REQ-01 partial)
> **Implements:** [REQ-01](../ux-ui/tmp/refactored-new-requirements-04-en.md#req-01-pick-and-place-replaces-drag-and-drop) (sidebar tasks only)
> **Replaces:** Dragover Performance Optimization (P&P solves the root cause)
> **Released:** 2026-01-22

Pick & Place is a two-click interaction replacing drag-and-drop for performance:
- Drag-and-drop: ~60 validations/second (mousemove events)
- Pick & Place: 2 validations total (pick + place)

- [x] `PickStateContext.tsx` - State management (pickedTask, pickSource, ghostPositionRef)
- [x] `PickPreview.tsx` - Ghost tile rendering (portal-based, RAF positioning)
- [x] Click handler in Job Details Panel tasks (unscheduled only)
- [x] Ghost tile follows cursor (direct DOM manipulation, no React re-renders)
- [x] ESC key cancels pick (tile returns to unpicked state)
- [x] Click on valid position places tile
- [x] Click on invalid position returns tile to origin
- [x] Ring color feedback (green/red/amber) on hover
- [x] E2E tests for sidebar pick & place

**Affected files:**
- `apps/web/src/pick/PickStateContext.tsx` (new)
- `apps/web/src/pick/PickPreview.tsx` (new)
- `apps/web/src/components/JobDetailsPanel/TaskTile.tsx`
- `apps/web/src/App.tsx`

#### ✅ v0.3.55 - Column Focus on Sidebar Pick (REQ-03)
> **Implements:** [REQ-03](../ux-ui/tmp/refactored-new-requirements-04-en.md#req-03-column-focus-during-pick-from-job-details)

- [x] Save scroll position on pick (for cancel restoration)
- [x] Scroll target station column to left edge (smooth, 300ms)
- [x] Fade non-target columns to 15% opacity
- [x] Disable pointer events on non-target columns
- [x] Restore scroll position on cancel (ESC)
- [x] Restore opacity on place/cancel
- [x] Only for sidebar picks (grid picks keep all columns visible)
- [x] Grid spacer to ensure rightmost column can scroll to left edge
- [x] E2E tests for column focus behavior

**Affected files:**
- `apps/web/src/App.tsx` - scroll/opacity logic
- `apps/web/src/components/SchedulingGrid/SchedulingGrid.tsx` - pickSource prop, spacer
- `apps/web/src/components/StationColumns/StationColumn.tsx` - opacity classes

#### ✅ v0.3.56 - Pick Visual Feedback
> **Implements:** [REQ-01](../ux-ui/tmp/refactored-new-requirements-04-en.md#req-01-pick-and-place-replaces-drag-and-drop) (visual refinements)
> **Released:** 2026-01-22

- [x] Global `cursor: grabbing` during pick mode (body.pick-mode-active)
- [x] CSS animation preparation: `@keyframes pulse-opacity` + `.animate-pulse-opacity`
- [x] Validation throttle with early-exit (same 15-min slot)
- [x] E2E tests for cursor state (4 tests)

**Affected files:**
- `apps/web/src/index.css` (CSS animation, cursor)
- `apps/web/src/App.tsx` (body class toggle, validation throttle)
- `apps/web/src/components/StationColumns/StationColumn.tsx` (simplified cursor logic)

#### v0.3.57 - Pick & Place from Grid (REQ-01 complete) ✅
> **Implements:** [REQ-01](../ux-ui/tmp/refactored-new-requirements-04-en.md#req-01-pick-and-place-replaces-drag-and-drop) (grid tiles)
> **Released:** 2026-01-22

**Pick from Grid:**
- [x] Click handler on grid tiles (non-completed, non-outsourced)
- [x] `isPicked` prop on Tile for placeholder rendering
- [x] Pulsating placeholder at original position (uses CSS from v0.3.56)
- [x] No opacity change (all columns visible for grid picks)
- [x] No scroll (user is at tile location)
- [x] Place on same or different station

**Remove Drag & Drop:**
- [x] Delete `apps/web/src/dnd/` folder entirely
  - `DragStateContext.tsx` - removed provider and hooks
  - `DragLayer.tsx` - removed drag preview overlay
  - `types.ts` - removed drag types
  - `index.ts` - removed exports
- [x] Remove `pragmatic-drag-and-drop` from `package.json`
- [x] Clean up `App.tsx`:
  - Removed `DragStateProvider` wrapper
  - Removed `useDragMonitor` hook and related handlers
  - Removed drag-related state (`dragValidation`, `grabOffset`, etc.)
  - Removed `handleDragEnd` callback
- [x] Clean up `Tile.tsx`:
  - Removed `draggable` prop and `draggableForElements` setup
  - Removed drag-related data attributes
  - Keep only click handler for pick
- [x] Clean up `StationColumn.tsx`:
  - Removed `dropTargetForElements` setup
  - Removed `useDragStateValue` hook
  - Removed `isOver`, `isValidDropTarget` state
  - Keep pick-related props only
- [x] Clean up `TaskTile.tsx` (Job Details Panel):
  - Removed `draggableForElements` setup
  - Keep only click handler for pick
- [x] Update E2E tests:
  - Created `pick-from-grid.spec.ts` with pick-based tests
  - Existing `pick-place-sidebar.spec.ts` uses pick interactions
  - Removed drag helper usage from tests

**Affected files:**
- `apps/web/src/dnd/` - DELETED entire folder
- `apps/web/src/components/Tile/Tile.tsx` (isPicked, removed draggable)
- `apps/web/src/components/StationColumns/StationColumn.tsx` (removed drop target)
- `apps/web/src/components/JobDetailsPanel/TaskTile.tsx` (removed draggable)
- `apps/web/src/App.tsx` (removed DragStateProvider, drag handlers)
- `apps/web/package.json` (removed pragmatic-drag-and-drop)
- `apps/web/playwright/pick-from-grid.spec.ts` (new E2E tests)

#### v0.3.58 - Right Click Context Menu (REQ-02) ✅
> **Implements:** [REQ-02](../ux-ui/tmp/refactored-new-requirements-04-en.md#req-02-right-click-context-menu)
> **Released:** 2026-01-22

- [x] `TileContextMenu.tsx` component (portal-based, z-9999)
- [x] Menu options: View details, Toggle completion, Move up, Move down
- [x] Position at cursor (x, y)
- [x] Auto-flip near viewport edges (right/bottom)
- [x] Close on: click outside, ESC, scroll
- [x] Only on tiles (not empty cells)
- [x] French labels (Voir détails, Marquer terminé, etc.)
- [x] E2E tests for context menu (13 tests)

**Affected files:**
- `apps/web/src/components/Tile/TileContextMenu.tsx` (new)
- `apps/web/src/components/Tile/Tile.tsx`
- `apps/web/src/components/SchedulingGrid/SchedulingGrid.tsx`
- `apps/web/src/App.tsx`
- `apps/web/playwright/context-menu.spec.ts` (new)

#### v0.3.59 - Job Details Panel Fixed Tile Height (REQ-04) ✅
> **Implements:** [REQ-04](../ux-ui/tmp/refactored-new-requirements-04-en.md#req-04-job-details-panel---fixed-tile-height)
> **Released:** 2026-01-22

- [x] Change task tile height from proportional to fixed 32px
- [x] Remove duration-based height calculation
- [x] Ensure content fits within 32px (truncation if needed)
- [x] Visual test for consistent list appearance

**Affected files:**
- `apps/web/src/components/JobDetailsPanel/TaskTile.tsx`
- `apps/web/src/components/JobDetailsPanel/TaskList.tsx`

#### v0.3.60 - Unavailability Overlay SVG (REQ-05) ✅
> **Implements:** [REQ-05](../ux-ui/tmp/refactored-new-requirements-04-en.md#req-05-unavailability-overlay---css-gradient-to-svg)
> **Released:** 2026-01-22

- [x] Create `stripes.svg` (45°, 10px stripe, rgba(255,255,255,0.03))
- [x] Update `.bg-stripes-dark` to use SVG instead of CSS gradient
- [x] Verify visual appearance matches current implementation
- [x] Test fixture: `?fixture=unavailability-overlay`

**Affected files:**
- `apps/web/public/stripes.svg` (new)
- `apps/web/src/index.css`
- `apps/web/src/mock/testFixtures.ts`

---

## Milestone 4: Job Creation Form Implementation (v0.4.x)

> **Context:** JCF (Job Creation Form) integration from `reference/jcf/`
> **Reference:** [Implicit Logic Specification](../../reference/jcf/docs/implicit-logic-specification.md)
>
> **Strategy:** Hybrid approach — spec-driven reimplementation with visual reference:
> - The `reference/jcf/` codebase is a vibe-coding prototype. It is **never merged** into the main app.
> - The [Implicit Logic Specification](../../reference/jcf/docs/implicit-logic-specification.md) (71KB) is the primary "what" source.
> - The reference app is the visual/behavioral "how it looks/works" source (run side-by-side for UX verification).
> - All code is reimplemented cleanly following main app conventions (`@flux/types`, Tailwind design tokens, `memo()`, barrel exports).
> - Granular releases (1 feature = 1 release) for maximum UX fidelity control and vibe-code firewall.
>
> **Phases:**
> 1. Element layer foundation (v0.4.0–v0.4.3)
> 2. JCF foundation: type mapping, reference data, page shell (v0.4.4–v0.4.6)
> 3. Job header form (v0.4.7–v0.4.8)
> 4. Elements table structure (v0.4.9–v0.4.10)
> 5. Base autocomplete & session learning (v0.4.11–v0.4.12)
> 6. Simple autocompletes: format, impression, surfacage, quantité/pagination (v0.4.13–v0.4.16)
> 7. DSL autocompletes: papier, imposition, precedences (v0.4.17–v0.4.19)
> 8. Sequence autocomplete: poste, ST, workflow (v0.4.20–v0.4.22)
> 9. Validation & calculated fields (v0.4.23–v0.4.25)
> 10. Job save & backend integration (v0.4.26)
> 11. Template system (v0.4.27–v0.4.28)

### Phase 4A: Element Entity Foundation

#### v0.4.0 - Element Layer: Frontend Types & Tests ✅
- [x] TypeScript types update (@flux/types)
  - [x] Element interface (id, jobId, taskIds)
  - [x] Task.elementId added (jobId kept for backward compatibility)
  - [x] ScheduleSnapshot includes elements
- [x] Frontend mock data update
  - [x] Mock generators create Elements (1:1 Job-Element for now)
  - [x] Snapshot includes elements array
- [x] Frontend unit tests update
  - [x] All 638 tests pass with Element layer
- [x] Playwright E2E tests update
  - [x] All test fixtures include Elements
  - [x] 7-day operating schedules for weekend-proof testing
  - [x] SNAP_INTERVAL_MINUTES used consistently (15 min)
- [x] Test fixtures update
  - [x] All fixtures include Element data

#### v0.4.1 - Element Layer: Task.jobId Removal ✅
- [x] Remove Task.jobId from @flux/types
  - [x] Update BaseTask interface (remove jobId)
  - [x] Rebuild types package
- [x] Update all Task usages to use elementId → element.jobId path
  - [x] App.tsx (~7 locations)
  - [x] JobsList.tsx (~4 locations)
  - [x] JobDetailsPanel.tsx (~1 location)
  - [x] SchedulingGrid.tsx (~3 locations)
  - [x] precedenceConstraints.ts
  - [x] compactTimeline.ts
  - [x] keyboardNavigation.ts
  - [x] quickPlacement.ts
- [x] Add taskHelpers.ts utility functions
  - [x] getJobIdForTask(task, elements)
  - [x] getTasksForJob(jobId, tasks, elements)
  - [x] createTaskToJobMap(tasks, elements)
  - [x] groupTasksByJob(tasks, elements)
- [x] Update test fixtures (testFixtures.ts)
  - [x] Replace jobId with elementId in all task definitions
  - [x] Add elementIds to all Job definitions (via generateElementsForJobs mutation)
- [x] Update mock generators
  - [x] jobs.ts: Add elementIds to generated jobs
  - [x] Remove jobId from generated tasks
- [x] Update unit tests
  - [x] Fix all test files with outdated mock data
- [x] All tests pass (638 unit + 199 E2E)
- [x] ESLint passes

#### v0.4.2 - Element Layer: Documentation ✅
- [x] Domain vocabulary update (domain-vocabulary.md)
  - [x] New Element term definition
  - [x] New ElementDependency term definition
  - [x] Job section update (Job → Element → Task hierarchy)
  - [x] Task section update (element-scoped sequencing, elementId)
- [x] Business rules update (business-rules.md)
  - [x] BR-ELEM-001..005 rules (element ownership, dependencies, precedence)
  - [x] BR-TASK-001/003/007 update (element-scoped sequencing)
- [x] Domain model update (domain-model.md)
  - [x] Element entity within Job aggregate
  - [x] Job aggregate updated (ElementIds, Elements collection)
  - [x] Task entity updated (ElementId replaces direct Job reference)
  - [x] ScheduleSnapshot updated (Elements collection)
  - [x] Relationships and invariants updated
- [x] Bounded context map update (bounded-context-map.md)
  - [x] Element added to Job Management Context owned models
  - [x] Element-related domain events added
  - [x] Text-based context map updated
- [x] Workflow definitions update (workflow-definitions.md)
  - [x] Task sequencing updated to element-scoped
  - [x] Cross-element precedence validation added
  - [x] Assignment validation process updated
  - [x] Element dependency events added
- [x] Architecture documentation update
  - [x] aggregate-design.md — Element within Job aggregate
  - [x] decision-records.md — ADR for Element layer introduction
  - [x] dependency-graphs.md — Element dependencies in graph
  - [x] event-message-design.md — Element-related events
  - [x] interface-contracts.md — Element in API contracts
  - [x] nonfunctional-design-notes.md — Element impact on validation performance
  - [x] project-structure.md — Element-related files
  - [x] sequence-design.md — Element-aware validation sequences
  - [x] service-boundaries.md — Element in Job Management service
  - [x] ui-backend-compatibility-report.md — Element frontend/backend alignment

#### v0.4.3 - Element Layer: Backend Implementation ✅
- [x] Element entity (PHP)
  - [x] Entity class with id, job relationship
  - [x] ElementRepository
- [x] Job-Element relationship
  - [x] Job.elements (OneToMany)
  - [x] Job.addElement() method
- [x] Element-Task relationship
  - [x] Task.element (ManyToOne)
  - [x] Task.job removed, accessible via element.job
- [x] Database migration
  - [x] Create elements table
  - [x] Migrate existing data (create Element per Job)
  - [x] Update tasks.job_id → tasks.element_id
- [x] Service updates
  - [x] JobService creates Element with Job
  - [x] ScheduleSnapshotService includes elements
- [x] Unit tests
- [x] Integration tests
- [x] PHPStan level 8

### Phase 4B: JCF Foundation

> **Note:** Phase 4B–4K can start with mock data, in parallel with v0.4.3 (backend).

#### v0.4.4 - JCF: Type Mapping & Data Model
> **Spec source:** §1 (Input Format Conventions), §9 (Reference Data), §11.6 (Domain Model Analysis)

- [ ] Map reference Element (12 string fields) → `@flux/types` model
  - [ ] Architectural decision: ElementSpec value object vs. flat fields on Element
  - [ ] Reference Element.name → Element.suffix
  - [ ] Reference Element.precedences → Element.prerequisiteElementIds
  - [ ] Reference Element.sequence → Task[] entities within Element
  - [ ] Production metadata fields (format, papier, pagination, imposition, impression, surfacage, quantite, qteFeuilles, autres, commentaires)
- [ ] Update `@flux/types` package with new types
- [ ] Type mapping documentation

#### v0.4.5 - JCF: Reference Data & Mock API
> **Spec source:** §9 (Reference Data)

- [ ] Reference data types: Paper, Format, Impression, Surfacage, Imposition
- [ ] Mock reference data (from `reference/jcf/data/*.json`)
- [ ] Mock API endpoints for reference data (GET /papers, /formats, etc.)
- [ ] Preset data: papers (5 types × 14 grammages), formats (A-series + custom), impressions (9), surfacages (10), impositions (10 × 8 poses)

#### v0.4.6 - JCF: Page Shell
- [ ] Job creation page route (or modal — architectural decision)
- [ ] Navigation integration (activate "+" button in JobsList)
- [ ] Layout skeleton: Job Header area + Elements Table area
- [ ] Empty state rendering
- [ ] Basic page structure with Tailwind design tokens

### Phase 4C: Job Header

#### v0.4.7 - JCF: Job Header Basic Fields
- [ ] Intitulé text field
- [ ] Quantity numeric input
- [ ] Deadline date picker
  - [ ] French format input (jj/mm or jj/mm/aaaa)
  - [ ] ISO 8601 storage
  - [ ] French display format
- [ ] Basic required field validation

#### v0.4.8 - JCF: Client Autocomplete
- [ ] Client field with autocomplete dropdown
- [ ] API lookup for existing clients
- [ ] Auto-create new client on save (if not exists)
- [ ] Keyboard navigation (↑↓ Enter Esc)

### Phase 4D: Elements Table Structure

#### v0.4.9 - JCF: Elements Table Grid Layout
> **Spec source:** reference `ElementsTable.tsx`

- [ ] 12-column table layout (name, precedences, quantite, format, pagination, papier, imposition, impression, surfacage, autres, qteFeuilles, commentaires)
- [ ] Sequence column (multi-line, separate treatment)
- [ ] Add/remove element rows
- [ ] Element name field (COUV, INT, FINITION, etc.)
- [ ] Plain text inputs for all fields (autocomplete added later)

#### v0.4.10 - JCF: Cell Navigation
> **Spec source:** §8 (Keyboard Navigation)

- [ ] Tab / Shift+Tab navigation between cells
- [ ] Enter to confirm and move to next cell
- [ ] Escape to cancel edit
- [ ] Focus management across rows and columns

### Phase 4E: Base Autocomplete Infrastructure

#### v0.4.11 - JCF: Base Autocomplete Component
> **Spec source:** reference `Autocomplete.tsx`

- [ ] Reusable `Autocomplete` component
- [ ] Dropdown with filtered suggestions
- [ ] Text highlight matching
- [ ] Keyboard navigation (↑↓ Enter Esc)
- [ ] Dropdown positioning & scrolling
- [ ] Click outside to close
- [ ] Lazy-load suggestions

#### v0.4.12 - JCF: Session Learning
> **Spec source:** §7 (Session Learning)

- [ ] Track user inputs per field type during session
- [ ] Session-learned values appear as top suggestions
- [ ] Priority: session values > API values
- [ ] Clear on page reload (session-scoped, not persisted)

### Phase 4F: Simple Autocompletes (1 field = 1 release)

> **Parallelizable:** v0.4.13–v0.4.16 are independent, all depend on v0.4.11–v0.4.12.

#### v0.4.13 - JCF: Format Autocomplete
> **Spec source:** §1.5 (Format DSL)

- [ ] ISO format lookup (A0–A10)
- [ ] Custom dimension input (e.g., 210x297)
- [ ] "Fermé" variants (A4f, A5fi)
- [ ] Composite formats (A3/A6)
- [ ] Pretty ↔ DSL bidirectional conversion
- [ ] Dimension lookup from API formats

#### v0.4.14 - JCF: Impression Autocomplete
> **Spec source:** §1.3 (Impression DSL)

- [ ] Preset patterns: Q/Q, Q/, Q+V/Q+V, Q+V/Q, Q+V/, N/N, N/, Q/N, N/Q
- [ ] Recto/verso validation (must contain `/`)
- [ ] Dropdown with all presets
- [ ] Free-text input with validation

#### v0.4.15 - JCF: Surfacage Autocomplete
> **Spec source:** §1.4 (Surfacage DSL)

- [ ] Preset patterns: mat/mat, satin/satin, brillant/brillant, UV/UV, dorure/dorure
- [ ] Single-side variants: mat/, satin/, brillant/, UV/, dorure/
- [ ] Recto/verso validation (must contain `/`)

#### v0.4.16 - JCF: Quantité & Pagination Inputs
> **Spec source:** §1.6 (Pagination)

- [ ] Quantité: numeric multiplier input with validation
- [ ] Pagination: validation rule — value must be 2 (feuillet) or multiple of 4 (cahier: 4, 8, 12, 16, ...)
- [ ] Visual error feedback on invalid values

### Phase 4G: DSL Autocompletes (1 field = 1 release)

> **Parallelizable:** v0.4.17–v0.4.19 are independent, all depend on v0.4.11–v0.4.12.

#### v0.4.17 - JCF: Papier Autocomplete
> **Spec source:** §1.1 (Papier DSL)

- [ ] Type:Grammage DSL format (e.g., `Couché mat:135`)
- [ ] Two-step autocomplete: type selection → grammage selection
- [ ] Pretty display conversion: `Couché mat:135` → `Couché mat 135g`
- [ ] Bidirectional DSL ↔ pretty conversion
- [ ] Auto-create new paper type on save (if not exists)

#### v0.4.18 - JCF: Imposition Autocomplete
> **Spec source:** §1.2 (Imposition DSL)

- [ ] LxH(poses) format (e.g., `50x70(8)`)
- [ ] Format-aware suggestions (based on selected format field)
- [ ] Poses extraction (supports `50x70(8)` and `50x70(8p)` variants)
- [ ] Validation regex: `/^[1-9]\d*x[1-9]\d*\([1-9]\d*\)$/i`

#### v0.4.19 - JCF: Precedences Autocomplete
- [ ] Element name reference selection (autocomplete with other element names)
- [ ] Multi-value support (element can depend on multiple predecessors)
- [ ] Visual dependency indicator
- [ ] Circular dependency prevention

### Phase 4H: Sequence Autocomplete (most complex field — 3 releases)

> **Sequential:** v0.4.20 → v0.4.21 → v0.4.22 (each builds on previous).

#### v0.4.20 - JCF: Sequence — Multi-line Editor & Poste Mode
> **Spec source:** §5.1–5.2 (Sequence State Machine — Poste mode)

- [ ] Multi-line text editor within table cell
- [ ] Poste mode: suggest poste names from presets (G37, 754, GTO, Stahl, etc.)
- [ ] Duration input: `PosteName(duration)` or `PosteName(setup+run)` format
- [ ] Poste validation regex: `/^[A-Za-z0-9_]+\(\d+(\+\d+)?\)$/`
- [ ] Per-line parsing and validation

#### v0.4.21 - JCF: Sequence — ST (Sous-Traitant) Mode
> **Spec source:** §5.3 (Sequence State Machine — ST mode)

- [ ] `ST:` prefix detection → switch to ST mode
- [ ] ST name suggestions (MCA, F37, LGI, AVN, JF)
- [ ] Duration formats: Nj (days), Nh (hours), N (plain)
- [ ] Full format: `ST:Name(duration):description`
- [ ] ST validation regex: `/^ST:[A-Za-z0-9_]+\(\d+[jh]?\):.+$/`

#### v0.4.22 - JCF: Sequence — Workflow-Guided Suggestions
> **Spec source:** §6 (Workflow-Guided Suggestions)

- [ ] `sequenceWorkflow` array: ordered list of poste categories
  - Example: `["Presse offset", "Massicot", "Conditionnement"]`
- [ ] "Next step" suggestion based on current position in workflow
- [ ] Category-based filtering of poste suggestions
- [ ] Visual indication of expected workflow progression

### Phase 4I: Validation & Calculated Fields

> **Sequential:** v0.4.23 → v0.4.24 → v0.4.25 (each validation level builds on previous).

#### v0.4.23 - JCF: Live Format Validation (Level 1)
> **Spec source:** §2.1 (Three-Level Validation — Level 1)

- [ ] Per-field regex validation during typing
- [ ] Red background + ErrorTooltip on invalid format
- [ ] Lenient for incomplete input (no error while still typing)
- [ ] Smart sequence validation: lines without closing `)` are not flagged
- [ ] Validation rules per field type (papier `:`, impression `/`, surfacage `/`, imposition regex, format regex, pagination rule)

#### v0.4.24 - JCF: Required Indicators & Calculated Fields (Level 2)
> **Spec source:** §2.2 (Required Field Logic), §3 (Calculated Fields)

- [ ] Amber dot indicator for required-but-empty fields
- [ ] BLOC SUPPORT trigger: if any of (imposition, impression, surfacage, format) → papier, pagination, format, qteFeuilles, imposition required
- [ ] BLOC IMPRESSION trigger: if any of (imposition, impression) → impression required
- [ ] **qteFeuilles auto-calculation**: `ceil((jobQuantity × elementQuantity) / poses)`
- [ ] Auto/manual toggle for qteFeuilles per element
- [ ] Recalculation triggers: jobQuantity, elementQuantity, or imposition changes

#### v0.4.25 - JCF: Submit Validation (Level 3)
> **Spec source:** §2.1 (Three-Level Validation — Level 3)

- [ ] Strict full-form validation on Save button click
- [ ] All required fields must be filled
- [ ] All format validations must pass
- [ ] Error summary display
- [ ] Form blocking until errors resolved
- [ ] Scroll to first error

### Phase 4J: Save

#### v0.4.26 - JCF: Job Save & API Integration
> **Spec source:** §10 (Backend Logic)

- [ ] Form data → API request mapping
  - [ ] Element production fields → Element/Task backend model
  - [ ] Sequence lines → Task entities
- [ ] POST /api/v1/jobs integration
- [ ] Reference data auto-creation (client, paper)
- [ ] Success feedback (Toast notification)
- [ ] Error handling and display
- [ ] Navigate back to jobs list on success

### Phase 4K: Template System

#### v0.4.27 - JCF: Template CRUD & Apply
> **Spec source:** reference `TemplateList.tsx`, `TemplateEditorModal.tsx`

- [ ] Create template from existing job
- [ ] Apply template to new job (populate elements table)
- [ ] Template list with search
- [ ] Template categories
- [ ] Category auto-creation on new category name
- [ ] Template name and description fields

#### v0.4.28 - JCF: Link Propagation & Dual-Mode Editor
> **Spec source:** §4 (Link Propagation)

- [ ] Link toggle per field: format, papier, imposition, impression, surfacage
- [ ] Value inheritance from previous element when linked
- [ ] Visual link/unlink indicator per field
- [ ] Dual-mode template editor: Form tab + JSON tab
- [ ] CodeMirror 6 integration for JSON editing
- [ ] Contextual autocomplete in JSON editor
- [ ] Bidirectional sync between form and JSON

---

## Milestone 5: Backend API Integration (v0.5.x)

### Phase 5A: Validator & API Setup

#### v0.5.0 - Validator Package Integration
- [ ] Install @flux/schedule-validator in frontend
- [ ] Validation utility wrapper
- [ ] Error message formatting (French)
- [ ] Conflict type to visual mapping

#### v0.5.1 - API Client Setup
- [ ] API client configuration (RTK Query)
- [ ] Environment-based URL configuration
- [ ] Error handling utilities
- [ ] Request/response interceptors

#### v0.5.2 - Snapshot Loading
- [ ] Replace mock with real API
- [ ] Loading states (skeleton/spinner TBD post-MVP)
- [ ] Error states
- [ ] Retry logic

#### v0.5.3 - Assignment Operations Integration
- [ ] Create assignment via API
- [ ] Recall via API
- [ ] Reschedule via API
- [ ] Toggle completion via API
- [ ] Server validation response handling

---

## Milestone 6: DSL Editor (v0.6.x, Post-MVP)

> **Note:** The original Job Creation Modal (v0.6.1) and DSL textarea approach have been **superseded by the JCF implementation in M4** (v0.4.4–v0.4.28), which provides a full-featured form-based job creation UI with specialized autocompletes. The Lezer-based DSL parser remains as an optional post-MVP enhancement for syntax highlighting in the sequence field.

### Phase 6A: DSL Parser (Optional Enhancement)

#### v0.6.0 - DSL Parser Package
- [ ] `@flux/task-dsl-parser` package setup
- [ ] Lezer grammar definition for sequence field syntax
- [ ] CodeMirror 6 integration (extends v0.4.28 JSON editor)
- [ ] Syntax highlighting for sequence field

---

## Milestone 7: Production Readiness (v1.0.x)

### Phase 7A: Security & Auth

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

### Phase 7B: Performance & Reliability

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

### Phase 7C: Operations

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

| Milestone | Version | Releases | Focus                                     |
|-----------|---------|----------|-------------------------------------------|
| M0        | v0.0.x  | 9        | Infrastructure & Foundation               |
| M1        | v0.1.x  | 20       | Core Domain (Station + Job)               |
| M2        | v0.2.x  | 19       | Scheduling Core (Assignment + Validation) |
| M3        | v0.3.x  | 61       | Frontend Integration                      |
| M4        | v0.4.x  | 29       | Job Creation Form (Element layer + JCF UI + Templates) |
| M5        | v0.5.x  | 4        | Backend API Integration                   |
| M6        | v0.6.x  | 1        | DSL Syntax Highlighting (Post-MVP, optional) |
| M7        | v1.0.x  | 9        | Production Readiness                      |
| Post-MVP  | v1.1+   | —        | Branching, Optimization, Reporting        |

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
├── Scheduling UI components
├── Pick & Place interactions
├── Job Creation Form (v0.4.4–v0.4.28)
│   ├── Autocompletes (parallelizable: v0.4.13–v0.4.22)
│   └── Template system (v0.4.27–v0.4.28)
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
- **JCF Strategy:** The `reference/jcf/` codebase is a vibe-coding prototype used only as visual/behavioral reference. It is never merged. All JCF code is reimplemented cleanly using the [Implicit Logic Specification](../../reference/jcf/docs/implicit-logic-specification.md) as the primary source. Granular releases (1 feature = 1 release) ensure UX fidelity and prevent vibe-code leakage.
