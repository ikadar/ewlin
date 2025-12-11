# Release Roadmap – Flux Print Shop Scheduling System

This document contains the development roadmap for the Flux print shop scheduling system, broken down into small, incremental steps.

---

## System Overview

### Architecture Components

| Component | Technology | Description |
|-----------|------------|-------------|
| **Frontend** | React 19 + TypeScript | Scheduling UI with drag & drop |
| **Validation Service** | Node.js + TypeScript | Isomorphic validation (client + server) |
| **Station Management** | PHP/Symfony | Stations, categories, groups, providers |
| **Job Management** | PHP/Symfony | Jobs, tasks, approval gates |
| **Assignment Service** | PHP/Symfony | Schedule orchestration |
| **Scheduling View** | PHP/Symfony | Read models, snapshots |
| **Shared Package** | TypeScript | `@flux/schedule-validator` |

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

### v0.0.1 - Development Environment
- [ ] Docker Compose setup for local development
- [ ] MariaDB 10.11 container configuration
- [ ] Redis 7 container configuration
- [ ] Shared network configuration

### v0.0.2 - PHP/Symfony Project Foundation
- [ ] Symfony 7 project initialization
- [ ] Monorepo structure (services as bundles initially)
- [ ] Doctrine ORM configuration
- [ ] Environment configuration (.env structure)

### v0.0.3 - Node.js Project Foundation
- [ ] Node.js + TypeScript project setup
- [ ] ESLint + Prettier configuration
- [ ] Jest testing framework setup
- [ ] Shared types package structure

### v0.0.4 - Shared Package: @flux/schedule-validator
- [ ] Package initialization with npm/pnpm workspace
- [ ] Core TypeScript types (Station, Job, Task, Assignment)
- [ ] Basic package build configuration
- [ ] Package publishing setup (private registry or npm)

### v0.0.5 - Frontend Project Foundation
- [ ] Vite + React 19 + TypeScript setup
- [ ] Tailwind CSS 4 integration
- [ ] Redux Toolkit configuration
- [ ] Basic folder structure

### v0.0.6 - CI/CD Pipeline Foundation
- [ ] GitHub Actions / GitLab CI setup
- [ ] Lint and type check jobs
- [ ] Unit test jobs
- [ ] Docker image build jobs

---

## Milestone 1: Core Domain MVP (v0.1.x)

### Phase 1A: Station Management Service

#### v0.1.0 - Station Entity
- [ ] Station entity and repository
- [ ] StationStatus enum (Available/InUse/Maintenance/OutOfService)
- [ ] Database migration
- [ ] Unit tests for Station

#### v0.1.1 - Station API Endpoints
- [ ] POST /api/v1/stations (create)
- [ ] GET /api/v1/stations (list)
- [ ] GET /api/v1/stations/{id} (get)
- [ ] PUT /api/v1/stations/{id} (update)
- [ ] OpenAPI documentation

#### v0.1.2 - Operating Schedule
- [ ] OperatingSchedule, DaySchedule, TimeSlot value objects
- [ ] Weekly pattern management on Station
- [ ] PUT /api/v1/stations/{id}/schedule endpoint
- [ ] Time slot overlap validation

#### v0.1.3 - Schedule Exceptions
- [ ] ScheduleException value object
- [ ] POST /api/v1/stations/{id}/exceptions endpoint
- [ ] GET /api/v1/stations/{id}/exceptions endpoint
- [ ] Exception override logic

#### v0.1.4 - Station Category Entity
- [ ] StationCategory entity and repository
- [ ] SimilarityCriterion value object
- [ ] POST /api/v1/station-categories endpoint
- [ ] Category listing on stations

#### v0.1.5 - Station Group Entity
- [ ] StationGroup entity and repository
- [ ] maxConcurrent field
- [ ] POST /api/v1/station-groups endpoint
- [ ] Group capacity validation (stub)

#### v0.1.6 - Outsourced Provider Entity
- [ ] OutsourcedProvider entity and repository
- [ ] supportedActionTypes field
- [ ] Auto-create station group with unlimited capacity
- [ ] POST /api/v1/providers endpoint

#### v0.1.7 - Station Domain Events
- [ ] StationRegistered event
- [ ] OperatingScheduleUpdated event
- [ ] ScheduleExceptionAdded event
- [ ] StationStatusChanged event
- [ ] Symfony Messenger configuration

### Phase 1B: Job Management Service

#### v0.1.8 - Job Entity
- [ ] Job entity and repository
- [ ] JobStatus enum (Draft/Planned/InProgress/Completed/Cancelled)
- [ ] workshopExitDate field
- [ ] Database migration

#### v0.1.9 - Job API Endpoints
- [ ] POST /api/v1/jobs (create with DSL)
- [ ] GET /api/v1/jobs (list with pagination and search)
- [ ] GET /api/v1/jobs/{id} (get with tasks)
- [ ] PUT /api/v1/jobs/{id} (update)
- [ ] OpenAPI documentation

#### v0.1.10 - Task Entity
- [ ] Task entity (within Job aggregate)
- [ ] TaskStatus enum (Defined/Ready/Assigned/Completed/Cancelled)
- [ ] Duration value object (setupMinutes, runMinutes, durationOpenDays)
- [ ] Internal vs Outsourced task types

#### v0.1.11 - DSL Parsing
- [ ] DSL parser implementation
- [ ] Internal task syntax: [Station] setup+run "comment"
- [ ] Outsourced task syntax: ST [Provider] ActionType duration "comment"
- [ ] POST /api/v1/dsl/parse endpoint
- [ ] Parse error reporting with line numbers

#### v0.1.12 - DSL Autocomplete
- [ ] GET /api/v1/dsl/autocomplete endpoint
- [ ] Station name suggestions
- [ ] Provider name suggestions
- [ ] Action type suggestions

#### v0.1.13 - Approval Gates
- [ ] proofSentAt, proofApprovedAt fields on Job
- [ ] platesStatus field on Job
- [ ] PUT /api/v1/jobs/{id}/proof endpoint
- [ ] PUT /api/v1/jobs/{id}/plates endpoint

#### v0.1.14 - Paper Procurement
- [ ] paperPurchaseStatus field on Job
- [ ] paperOrderedAt automatic timestamp
- [ ] PUT /api/v1/jobs/{id}/paper endpoint

#### v0.1.15 - Job Dependencies
- [ ] requiredJobIds field on Job
- [ ] POST /api/v1/jobs/{id}/dependencies endpoint
- [ ] Circular dependency detection
- [ ] Dependency listing

#### v0.1.16 - Job Comments
- [ ] Comment entity (within Job aggregate)
- [ ] POST /api/v1/jobs/{id}/comments endpoint
- [ ] Comment listing (threaded in future)

#### v0.1.17 - Job Domain Events
- [ ] JobCreated event
- [ ] TaskAddedToJob event
- [ ] ApprovalGateUpdated event
- [ ] Event publishing via Messenger

---

## Milestone 2: Scheduling Core (v0.2.x)

### Phase 2A: Shared Validation Package

#### v0.2.0 - Core Validation Types
- [ ] ScheduleSnapshot type definition
- [ ] ProposedAssignment type
- [ ] ValidationResult type
- [ ] ScheduleConflict types (all 5 types)

#### v0.2.1 - Station Conflict Validation
- [ ] Station double-booking check
- [ ] Time overlap calculation utilities
- [ ] Unit tests with 100% coverage

#### v0.2.2 - Group Capacity Validation
- [ ] Concurrent task counting
- [ ] Group capacity check
- [ ] Unit tests

#### v0.2.3 - Precedence Validation
- [ ] Task sequence order check
- [ ] Within-job precedence logic
- [ ] Bypass flag support (Alt key)
- [ ] Unit tests

#### v0.2.4 - Approval Gate Validation
- [ ] BAT status check
- [ ] Plates status check (for printing tasks)
- [ ] Unit tests

#### v0.2.5 - Availability Validation
- [ ] Operating schedule check
- [ ] Schedule exception check
- [ ] Duration stretching calculation
- [ ] Unit tests

#### v0.2.6 - Package Build & Publish
- [ ] Browser build (ES modules)
- [ ] Node.js build (CommonJS + ESM)
- [ ] Type declarations
- [ ] Package publishing

### Phase 2B: Validation Service (Node.js)

#### v0.2.7 - Express/Fastify Server Setup
- [ ] HTTP server initialization
- [ ] Health check endpoint
- [ ] Request logging
- [ ] Error handling middleware

#### v0.2.8 - Validation API Endpoint
- [ ] POST /validate endpoint
- [ ] Request validation (Zod/Joi)
- [ ] Response formatting
- [ ] Performance logging (< 50ms target)

#### v0.2.9 - Validation Service Docker
- [ ] Dockerfile for Node.js service
- [ ] Docker Compose integration
- [ ] Environment configuration
- [ ] Health check configuration

### Phase 2C: Assignment Service (PHP)

#### v0.2.10 - Schedule Aggregate
- [ ] Schedule entity (aggregate root)
- [ ] TaskAssignment value object
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
- [ ] ConflictDetected event
- [ ] ScheduleUpdated event

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
- [ ] Show conflict panel on invalid
- [ ] Optimistic update

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

#### v0.3.18 - Job Creation Modal
- [ ] Modal component
- [ ] Required fields (reference, client, description, workshopExitDate)
- [ ] DSL textarea with syntax highlighting
- [ ] Autocomplete integration
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
