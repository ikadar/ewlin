# Release Roadmap – Operations Research System

This document contains the development roadmap for the complete Operations Research System, broken down into small, incremental steps.

---

## System Overview

### Architecture Components

| Component | Technology | Description |
|-----------|------------|-------------|
| **Frontend** | React 19 + TypeScript | Scheduling UI with drag & drop |
| **Validation Service** | Node.js + TypeScript | Isomorphic validation (client + server) |
| **Resource Management** | PHP/Symfony | Operators, equipment, skills |
| **Job Management** | PHP/Symfony | Jobs, tasks, dependencies |
| **Assignment Service** | PHP/Symfony | Schedule orchestration |
| **Scheduling View** | PHP/Symfony | Read models, reports |
| **Execution Tracking** | PHP/Symfony | Task execution, variances |
| **Shared Package** | TypeScript | `@ewlin/schedule-validator` |

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

| Milestone | Focus | Target |
|-----------|-------|--------|
| **M0** | Infrastructure & Foundation | Sprint 1-2 |
| **M1** | Core Domain MVP (Resource + Job Management) | Sprint 3-5 |
| **M2** | Scheduling Core (Assignment + Validation) | Sprint 6-8 |
| **M3** | Frontend Integration | Sprint 9-11 |
| **M4** | Execution & Reporting | Sprint 12-13 |
| **M5** | Production Readiness | Sprint 14 |

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

### v0.0.4 - Shared Package: @ewlin/schedule-validator
- [ ] Package initialization with npm/pnpm workspace
- [ ] Core TypeScript types (Task, Assignment, Operator, Equipment)
- [ ] Basic package build configuration
- [ ] Package publishing setup (private registry or npm)

### v0.0.5 - Frontend Project Foundation ✅
- [x] Vite + React 19 + TypeScript setup
- [x] Tailwind CSS 4 integration
- [x] Redux Toolkit configuration
- [x] Basic folder structure

### v0.0.6 - CI/CD Pipeline Foundation
- [ ] GitHub Actions / GitLab CI setup
- [ ] Lint and type check jobs
- [ ] Unit test jobs
- [ ] Docker image build jobs

---

## Milestone 1: Core Domain MVP (v0.1.x)

### Phase 1A: Resource Management Service

#### v0.1.0 - Operator Entity
- [ ] Operator entity and repository
- [ ] OperatorStatus enum (Active/Inactive/Deactivated)
- [ ] Database migration
- [ ] Unit tests for Operator

#### v0.1.1 - Operator API Endpoints
- [ ] POST /api/v1/operators (create)
- [ ] GET /api/v1/operators (list)
- [ ] GET /api/v1/operators/{id} (get)
- [ ] PUT /api/v1/operators/{id} (update)
- [ ] OpenAPI documentation

#### v0.1.2 - Operator Availability
- [ ] TimeSlot value object
- [ ] Availability management on Operator
- [ ] PUT /api/v1/operators/{id}/availability endpoint
- [ ] Availability overlap validation

#### v0.1.3 - Operator Skills
- [ ] OperatorSkill value object (equipmentId, level, certificationDate)
- [ ] POST /api/v1/operators/{id}/skills endpoint
- [ ] Skill level enum (beginner/intermediate/expert)
- [ ] Skills listing on operator

#### v0.1.4 - Equipment Entity
- [ ] Equipment entity and repository
- [ ] EquipmentStatus enum (Available/InUse/Maintenance/OutOfService)
- [ ] supportedTaskTypes field
- [ ] Database migration

#### v0.1.5 - Equipment API Endpoints
- [ ] POST /api/v1/equipment (create)
- [ ] GET /api/v1/equipment (list)
- [ ] GET /api/v1/equipment/{id} (get)
- [ ] PUT /api/v1/equipment/{id} (update)
- [ ] OpenAPI documentation

#### v0.1.6 - Maintenance Windows
- [ ] MaintenanceWindow entity
- [ ] POST /api/v1/equipment/{id}/maintenance endpoint
- [ ] Maintenance status transitions
- [ ] Conflict detection with existing assignments (stub)

#### v0.1.7 - Resource Domain Events
- [ ] OperatorRegistered event
- [ ] OperatorAvailabilityChanged event
- [ ] EquipmentRegistered event
- [ ] EquipmentStatusChanged event
- [ ] Symfony Messenger configuration

### Phase 1B: Job Management Service

#### v0.1.8 - Job Entity
- [ ] Job entity and repository
- [ ] JobStatus enum (Draft/Planned/InProgress/Delayed/Completed/Cancelled)
- [ ] Deadline field with validation
- [ ] Database migration

#### v0.1.9 - Job API Endpoints
- [ ] POST /api/v1/jobs (create)
- [ ] GET /api/v1/jobs (list with pagination)
- [ ] GET /api/v1/jobs/{id} (get with tasks)
- [ ] PUT /api/v1/jobs/{id} (update)
- [ ] OpenAPI documentation

#### v0.1.10 - Task Entity
- [ ] Task entity (within Job aggregate)
- [ ] TaskStatus enum (Defined/Ready/Assigned/Executing/Completed/Failed/Cancelled)
- [ ] Duration value object
- [ ] requiresOperator, requiresEquipment flags

#### v0.1.11 - Task API Endpoints
- [ ] POST /api/v1/jobs/{jobId}/tasks (add task)
- [ ] GET /api/v1/jobs/{jobId}/tasks (list tasks)
- [ ] PUT /api/v1/tasks/{id} (update task)
- [ ] DELETE /api/v1/tasks/{id} (remove task)

#### v0.1.12 - Task Dependencies
- [ ] TaskDependency value object
- [ ] POST /api/v1/tasks/{id}/dependencies endpoint
- [ ] Circular dependency detection (DAG validation)
- [ ] Dependencies listing on task

#### v0.1.13 - Job Domain Events
- [ ] JobCreated event
- [ ] TaskAddedToJob event
- [ ] TaskDependencySet event
- [ ] Event publishing via Messenger

#### v0.1.14 - Critical Path Calculation
- [ ] Critical path algorithm implementation
- [ ] criticalPath field on job response
- [ ] Task ordering by dependencies

---

## Milestone 2: Scheduling Core (v0.2.x)

### Phase 2A: Shared Validation Package

#### v0.2.0 - Core Validation Types
- [ ] ScheduleSnapshot type definition
- [ ] ProposedAssignment type
- [ ] ValidationResult type
- [ ] ScheduleConflict types (all 5 types)

#### v0.2.1 - Resource Conflict Validation
- [ ] Operator double-booking check
- [ ] Equipment double-booking check
- [ ] Time overlap calculation utilities
- [ ] Unit tests with 100% coverage

#### v0.2.2 - Availability Conflict Validation
- [ ] Operator availability check
- [ ] Equipment maintenance window check
- [ ] TimeSlot intersection logic
- [ ] Unit tests

#### v0.2.3 - Dependency Conflict Validation
- [ ] Task dependency order check
- [ ] Earliest start time calculation
- [ ] FinishToStart dependency logic
- [ ] Unit tests

#### v0.2.4 - Deadline Conflict Validation
- [ ] Job deadline check
- [ ] Buffer time calculation
- [ ] Deadline risk assessment
- [ ] Unit tests

#### v0.2.5 - Skill Conflict Validation
- [ ] Operator skill matching
- [ ] Equipment type compatibility
- [ ] Skill level requirements (optional)
- [ ] Unit tests

#### v0.2.6 - Resolution Suggestions
- [ ] Alternative time slot suggestions
- [ ] Alternative operator suggestions
- [ ] Alternative equipment suggestions
- [ ] Suggestion ranking algorithm

#### v0.2.7 - Package Build & Publish
- [ ] Browser build (ES modules)
- [ ] Node.js build (CommonJS + ESM)
- [ ] Type declarations
- [ ] Package publishing

### Phase 2B: Validation Service (Node.js)

#### v0.2.8 - Express/Fastify Server Setup
- [ ] HTTP server initialization
- [ ] Health check endpoint
- [ ] Request logging
- [ ] Error handling middleware

#### v0.2.9 - Validation API Endpoint
- [ ] POST /validate endpoint
- [ ] Request validation (Zod/Joi)
- [ ] Response formatting
- [ ] Performance logging (< 50ms target)

#### v0.2.10 - Validation Service Docker
- [ ] Dockerfile for Node.js service
- [ ] Docker Compose integration
- [ ] Environment configuration
- [ ] Health check configuration

### Phase 2C: Assignment Service (PHP)

#### v0.2.11 - Schedule Aggregate
- [ ] Schedule entity (aggregate root)
- [ ] ValidatedAssignment value object
- [ ] Schedule repository
- [ ] Database migration

#### v0.2.12 - Assignment API Endpoints
- [ ] POST /api/v1/tasks/{taskId}/assignments (create assignment)
- [ ] Validation Service integration (HTTP client)
- [ ] Assignment persistence on validation success
- [ ] Error handling for validation failures

#### v0.2.13 - Schedule Task Endpoint
- [ ] POST /api/v1/tasks/{taskId}/schedule endpoint
- [ ] scheduledStart/scheduledEnd calculation
- [ ] Validation before scheduling
- [ ] Task status update to 'Assigned'

#### v0.2.14 - Reschedule Task
- [ ] PUT /api/v1/tasks/{taskId}/schedule endpoint
- [ ] Revalidation on reschedule
- [ ] Dependent task impact analysis
- [ ] Event publishing

#### v0.2.15 - Schedule Validation Endpoint
- [ ] POST /api/v1/schedules/validate endpoint
- [ ] Scope filtering (jobIds, date range)
- [ ] Batch validation
- [ ] Validation report generation

#### v0.2.16 - Schedule Snapshot Endpoint
- [ ] GET /api/v1/schedule/snapshot endpoint
- [ ] Time range filtering
- [ ] All entities aggregation (operators, equipment, jobs, tasks, assignments)
- [ ] snapshotVersion for optimistic locking

#### v0.2.17 - Assignment Domain Events
- [ ] TaskAssigned event
- [ ] ScheduleUpdated event
- [ ] ConflictDetected event
- [ ] Event publishing

---

## Milestone 3: Frontend Integration (v0.3.x)

### Phase 3A: Frontend Mock Completion ✅

#### v0.3.0 - Mock Data Generators ✅
- [x] Operator generator (20 operators)
- [x] Equipment generator (15 machines)
- [x] Job generator (12 jobs, 2-6 tasks/job)
- [x] Assignment generator
- [x] Snapshot cache implementation

#### v0.3.1 - Mock API ✅
- [x] getSnapshot endpoint
- [x] CRUD operations (create, update, delete)
- [x] Configurable latency and failure rate
- [x] TypeScript types

### Phase 3B: Frontend Core UI

#### v0.3.2 - Layout Components
- [ ] Header with view toggle
- [ ] Main page 3-column layout
- [ ] Responsive breakpoints
- [ ] Navigation structure

#### v0.3.3 - Time Axis Component
- [ ] TimeAxis component
- [ ] Time scale options (15min, 30min, 1h, 4h)
- [ ] "Today" marker
- [ ] Day/Week view toggle

#### v0.3.4 - Equipment Grid View
- [ ] Equipment rows on Y-axis
- [ ] Status display per equipment
- [ ] Task blocks rendering
- [ ] Maintenance window visualization

#### v0.3.5 - Operator Grid View
- [ ] Operator rows on Y-axis
- [ ] Availability visualization
- [ ] Skill badges
- [ ] View toggle animation

#### v0.3.6 - Task Block Component
- [ ] TaskBlock with status colors
- [ ] Task information display
- [ ] Selection state
- [ ] Hover effects

#### v0.3.7 - Side Panels
- [ ] Unassigned Tasks panel (left)
- [ ] Task Detail panel (right)
- [ ] Panel collapse/expand
- [ ] Panel resizing

### Phase 3C: Client-Side Validation Integration

#### v0.3.8 - Validator Package Integration
- [ ] Install @ewlin/schedule-validator in frontend
- [ ] Validation utility wrapper
- [ ] Validation result display components
- [ ] Error message formatting

#### v0.3.9 - Drag & Drop with Validation
- [ ] Drag infrastructure (dnd-kit)
- [ ] Real-time validation during drag (< 10ms)
- [ ] Valid/invalid drop zone visualization
- [ ] Validation feedback tooltips

#### v0.3.10 - Task Movement with Validation
- [ ] Horizontal movement validation
- [ ] Vertical movement validation
- [ ] Resize validation
- [ ] Conflict highlighting

### Phase 3D: Backend API Integration

#### v0.3.11 - API Client Setup
- [ ] API client configuration
- [ ] Environment-based URL configuration
- [ ] Error handling utilities
- [ ] Request/response interceptors

#### v0.3.12 - Snapshot Loading
- [ ] Replace mock with real API
- [ ] Loading states
- [ ] Error states
- [ ] Retry logic

#### v0.3.13 - CRUD Operations Integration
- [ ] Operator CRUD via API
- [ ] Equipment CRUD via API
- [ ] Job/Task CRUD via API
- [ ] Optimistic updates

#### v0.3.14 - Assignment Operations Integration
- [ ] Create assignment via API
- [ ] Reschedule via API
- [ ] Validate schedule via API
- [ ] Conflict resolution UI

---

## Milestone 4: Execution & Reporting (v0.4.x)

### Phase 4A: Execution Tracking Service

#### v0.4.0 - TaskExecution Entity
- [ ] TaskExecution entity
- [ ] ActualTiming value object
- [ ] ExecutionVariance calculation
- [ ] Database migration

#### v0.4.1 - Start Task Endpoint
- [ ] POST /api/v1/tasks/{taskId}/start
- [ ] Actual start time recording
- [ ] Variance calculation
- [ ] Task status update to 'Executing'

#### v0.4.2 - Complete Task Endpoint
- [ ] POST /api/v1/tasks/{taskId}/complete
- [ ] Actual end time recording
- [ ] Quality check results
- [ ] Dependent task status updates

#### v0.4.3 - Execution Events
- [ ] TaskStarted event
- [ ] TaskCompleted event
- [ ] ScheduleVarianceDetected event
- [ ] Event publishing

#### v0.4.4 - Operator Task View
- [ ] GET /api/v1/operators/{id}/tasks endpoint
- [ ] Personal task list
- [ ] Mobile-friendly response format

### Phase 4B: Scheduling View Service

#### v0.4.5 - Gantt Chart Data
- [ ] GET /api/v1/reports/gantt endpoint
- [ ] Job-based Gantt structure
- [ ] Critical path highlighting
- [ ] Dependency lines data

#### v0.4.6 - Resource Utilization Report
- [ ] GET /api/v1/reports/utilization endpoint
- [ ] Operator utilization calculation
- [ ] Equipment utilization calculation
- [ ] Date range filtering

#### v0.4.7 - Read Model Projections
- [ ] Event handlers for read model updates
- [ ] Denormalized schedule view
- [ ] Performance optimization
- [ ] Cache integration

### Phase 4C: Frontend Execution & Reports

#### v0.4.8 - Task Execution UI
- [ ] Start task button/action
- [ ] Complete task flow
- [ ] Execution status indicators
- [ ] Variance display

#### v0.4.9 - Reporting Dashboard
- [ ] Gantt chart component
- [ ] Utilization charts
- [ ] Date range selector
- [ ] Export functionality (PDF/CSV)

---

## Milestone 5: Production Readiness (v1.0.x)

### Phase 5A: Security & Auth

#### v1.0.0 - Authentication
- [ ] JWT authentication implementation
- [ ] Login/logout endpoints
- [ ] Token refresh mechanism
- [ ] Session management

#### v1.0.1 - Authorization
- [ ] RBAC implementation
- [ ] Role definitions (admin, scheduler, manager, operator)
- [ ] Permission checks on endpoints
- [ ] Frontend permission guards

#### v1.0.2 - Audit Trail
- [ ] Audit log entity
- [ ] Change tracking middleware
- [ ] Login attempt logging
- [ ] Audit log API

### Phase 5B: Performance & Reliability

#### v1.0.3 - Caching Layer
- [ ] Redis cache integration
- [ ] Snapshot caching
- [ ] Cache invalidation on events
- [ ] Cache warming strategy

#### v1.0.4 - Real-time Updates
- [ ] WebSocket server setup
- [ ] Schedule change notifications
- [ ] Frontend WebSocket client
- [ ] Reconnection handling

#### v1.0.5 - Performance Optimization
- [ ] Database query optimization
- [ ] Index optimization
- [ ] API response time < 500ms verification
- [ ] Frontend bundle size < 2MB

#### v1.0.6 - Frontend Virtualization
- [ ] Virtual scrolling for grid
- [ ] Lazy loading
- [ ] Memoization optimization
- [ ] 60 FPS verification

### Phase 5C: Operations

#### v1.0.7 - Monitoring & Logging
- [ ] Prometheus metrics endpoints
- [ ] Centralized logging (ELK/Loki)
- [ ] Health check endpoints
- [ ] Alerting rules

#### v1.0.8 - Deployment Configuration
- [ ] Production Docker images
- [ ] Kubernetes manifests
- [ ] Environment configurations
- [ ] Secrets management

#### v1.0.9 - Documentation
- [ ] API documentation (OpenAPI)
- [ ] Architecture documentation
- [ ] Deployment guide
- [ ] User manual

#### v1.0.10 - Final Testing
- [ ] Integration test suite
- [ ] End-to-end tests
- [ ] Performance testing
- [ ] Security audit

---

## Summary Table

| Milestone | Version | Focus | Sprints |
|-----------|---------|-------|---------|
| M0 | v0.0.x | Infrastructure & Foundation | 1-2 |
| M1 | v0.1.x | Core Domain (Resource + Job) | 3-5 |
| M2 | v0.2.x | Scheduling Core (Assignment + Validation) | 6-8 |
| M3 | v0.3.x | Frontend Integration | 9-11 |
| M4 | v0.4.x | Execution & Reporting | 12-13 |
| M5 | v1.0.x | Production Readiness | 14 |

---

## Parallel Work Streams

The following can be developed in parallel:

```
Stream 1: Backend Services (PHP)
├── Resource Management
├── Job Management
├── Assignment Service
├── Execution Tracking
└── Scheduling View

Stream 2: Validation (TypeScript)
├── @ewlin/schedule-validator package
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
Frontend ──────────────► @ewlin/schedule-validator
                              │
Assignment Service ───────────┘
       │
       ├── Resource Management (reads operator/equipment)
       └── Job Management (reads tasks/dependencies)

Scheduling View ◄──────── All domain events

Execution Tracking ◄───── Assignment Service (TaskAssigned)
       │
       └────────────────► Job Management (status updates)
```

---

## Notes

- ✅ marks completed items
- Each phase results in a deployable, working state
- Frontend continues with mock data until backend is ready (M3)
- Validation package is shared between frontend and backend
- Backend services can start as a monolith and split later
- The order can be adjusted based on business priorities
