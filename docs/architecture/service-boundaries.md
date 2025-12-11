# Service Boundaries – Operations Research System

This document defines the **service boundaries** for the Equipment → Operator → Job → Task assignment and validation domain.

The goal is to translate the **bounded contexts** from the domain model into concrete services with clear responsibilities and interaction patterns.

---

## 1. Services Overview

### 1.1 Resource Management Service

**Purpose:**  
Manage all resources (operators and equipment) including their availability, capabilities, and maintenance schedules.

**Capabilities:**  
- Create and manage operators with skills and availability
- Create and manage equipment with supported task types
- Handle equipment maintenance scheduling
- Track operator certifications and skill levels
- Manage resource availability time slots
- Report equipment breakdowns and status changes

**Inputs:**  
- Commands from external callers (e.g., "registerOperator", "scheduleMaintenace")
- Maintenance completion events from external systems
- Equipment status updates from IoT sensors (optional)

**Outputs:**  
- `OperatorAvailabilityChanged` event
- `EquipmentStatusChanged` event
- `MaintenanceScheduled` event
- Resource read models or API responses

**Ownership:**  
- Operator
- OperatorSkill
- Equipment
- MaintenanceWindow
- TimeSlot (availability slots)

**External Dependencies:**  
- None (acts as master data source for resources)

**Reasons for Separation:**  
Resource management is a foundational capability that other services depend on. It maintains the authoritative state of all resources without any knowledge of jobs, tasks, or scheduling logic. This separation allows resources to be managed independently of how they are used.

---

### 1.2 Job Management Service

**Purpose:**  
Define and manage production jobs with their constituent tasks and dependencies.

**Capabilities:**  
- Create and update job definitions with deadlines
- Add tasks to jobs with duration and resource requirements
- Define task dependencies forming a DAG
- Calculate critical paths through task networks
- Track job and task status transitions
- Validate dependency graphs for cycles

**Inputs:**  
- Commands from external callers (e.g., "createJob", "addTask", "defineDependency")
- `AssignmentCompleted` events from Assignment Service (optional)

**Outputs:**  
- `JobCreated` event
- `TaskAddedToJob` event
- `TaskDependencySet` event
- `JobStatusChanged` event
- Job/Task read models or API responses

**Ownership:**  
- Job
- Task (as entity within Job aggregate)
- TaskDependency
- Duration

**External Dependencies:**  
- Reads resource types from Resource Management Service (for task type validation)

**Reasons for Separation:**  
Job planning and task structuring is independent of resource availability and assignment. Jobs define WHAT needs to be done and in what order, while assignments determine WHO will do it and WHEN. This separation allows jobs to be planned before resources are assigned.

---

### 1.3 Assignment Service (PHP/Symfony)

**Purpose:**
Orchestrate task assignments, manage schedule state, and coordinate with Validation Service.

**Capabilities:**
- Assign operators and equipment to tasks
- Set scheduled start and end times for tasks
- Persist validated assignments
- Coordinate with Validation Service for constraint checking
- Suggest alternative assignments when conflicts detected
- Publish assignment and schedule events

**Inputs:**
- Assignment commands (e.g., "assignOperatorToTask", "scheduleTask")
- `ResourceUpdated` events from Resource Management Service
- `TaskUpdated` events from Job Management Service
- Validation results from Validation Service

**Outputs:**
- `TaskAssigned` event with timing information
- `ScheduleUpdated` event
- `ConflictDetected` event with conflict details

**Ownership:**
- Schedule (aggregate root)
- ValidatedAssignment
- TaskAssignment (as value object)

**External Dependencies:**
- **Validation Service (Node.js)** — for constraint validation
- Resource Management Service (for availability and skills data)
- Job Management Service (for task requirements and dependencies)

**Technology:** PHP/Symfony

---

### 1.4 Validation Service (Node.js) — NEW

**Purpose:**
Provide **isomorphic schedule validation** that runs identically on client (browser) and server (Node.js). This enables real-time validation feedback in the UI while maintaining server-side authority.

**Capabilities:**
- Validate assignments against all business constraints:
  - ResourceConflict — no double-booking of operators/equipment
  - AvailabilityConflict — operator availability respected
  - DependencyConflict — task dependencies satisfied
  - DeadlineConflict — job deadlines achievable
  - SkillConflict — operator qualified for equipment
- Return detailed conflict information with suggested resolutions
- Stateless operation (receives schedule snapshot, returns validation result)

**Shared Package:** `@ewlin/schedule-validator`
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
  suggestions: ResolutionSuggestion[];
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
2. **Performance** — client-side validation enables < 50ms drag feedback
3. **Consistency** — single codebase eliminates rule divergence risk
4. **Testability** — one test suite covers both environments

**Communication:**
```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────┐
│   Frontend  │────▶│ Validation Service  │◀────│ Assignment  │
│   (React)   │     │     (Node.js)       │     │  (PHP)      │
└─────────────┘     └─────────────────────┘     └─────────────┘
   Uses same           Authoritative            Calls before
   npm package         validation               persisting
```

---

### 1.5 Scheduling View Service (Read Model)

**Purpose:**  
Provide read-optimized views and queries for scheduling visualization and reporting.

**Capabilities:**  
- Maintain denormalized views of the complete schedule
- Provide Gantt chart data with critical paths
- Generate resource utilization reports
- Support calendar views by operator/equipment
- Calculate schedule performance metrics
- Enable complex scheduling queries without impacting write operations

**Inputs:**  
- All events from Resource Management Service
- All events from Job Management Service  
- All events from Assignment & Validation Service

**Outputs:**  
- Gantt chart projections
- Resource calendar views
- Utilization reports
- Schedule analytics
- No domain events (read-only service)

**Ownership:**  
- Read models and projections only
- GanttView
- CalendarView
- UtilizationReport
- ScheduleAnalytics

**External Dependencies:**  
- Event streams from all other services (event sourcing for read models)

**Reasons for Separation:**  
Read models have fundamentally different access patterns and performance requirements than write models. Separating them allows optimization for complex queries, reporting, and visualization without impacting the performance of business operations. This follows CQRS principles.

---

### 1.6 Execution Tracking Service

**Purpose:**  
Track actual task execution, capture variances from plan, and coordinate state transitions.

**Capabilities:**  
- Record actual task start and completion times
- Calculate schedule variances
- Manage task state transitions during execution
- Capture quality check results
- Handle early/late starts with reason tracking
- Notify dependent tasks when prerequisites complete

**Inputs:**  
- Execution commands (e.g., "startTask", "completeTask")
- `TaskAssigned` events from Assignment Service
- Time tracking data from external systems (optional)

**Outputs:**  
- `TaskStarted` event
- `TaskCompleted` event
- `ScheduleVarianceDetected` event
- Execution status updates

**Ownership:**  
- TaskExecution
- ExecutionVariance
- QualityCheckResult
- ActualTiming

**External Dependencies:**  
- Assignment & Validation Service (for planned schedule)
- Job Management Service (for task state updates)

**Reasons for Separation:**  
Execution tracking deals with the reality of operations versus the plan. It has different timing constraints (real-time updates), different data patterns (append-only event log), and different business rules (variance thresholds, quality gates). Separating it prevents planning logic from being complicated by execution concerns.

---

## 2. Interaction Between Services

### 2.1 Events and Integration

- **Resource Management → Assignment Service**
  - Events: `OperatorAvailabilityChanged`, `EquipmentStatusChanged`
  - Meaning: Resource constraints have changed, requiring revalidation

- **Job Management → Assignment Service**
  - Events: `TaskAddedToJob`, `TaskDependencySet`
  - Meaning: Task structure has changed, affecting scheduling possibilities

- **Assignment Service → Validation Service** (synchronous)
  - HTTP call: `POST /validate`
  - Meaning: Validate proposed assignment before persisting

- **Frontend → Validation Service** (via shared package)
  - Direct call to `@ewlin/schedule-validator`
  - Meaning: Real-time validation during drag & drop (< 10ms)

- **Assignment Service → Execution Tracking**
  - Event: `TaskAssigned`
  - Meaning: A task is ready for execution with assigned resources and timing

- **Execution Tracking → Job Management**
  - Events: `TaskCompleted`
  - Meaning: Update task status and trigger dependent task readiness

- **All Services → Scheduling View Service**
  - Events: All domain events
  - Meaning: Update read models for reporting and visualization

Interaction should favor **asynchronous domain events** over direct synchronous calls wherever eventual consistency is acceptable.

**Exception:** Assignment Service → Validation Service is synchronous because validation must complete before assignment can be persisted.

---

## 3. Service Boundary Principles

1. **Each service owns its data**
   - Resource Management owns operators and equipment
   - Job Management owns jobs and tasks
   - Assignment & Validation owns schedules and assignments
   - No other service writes directly to these data stores

2. **No cross-service business logic**
   - A service may react to events from other services, but must not embed foreign business rules
   - Example: Assignment service doesn't define what makes a valid operator skill

3. **Clear, narrow interfaces**
   - Public APIs focus on business operations (e.g., `assignOperator`, `scheduleTask`)
   - Not on generic CRUD access

4. **Published Language alignment**
   - Service APIs and events use the same terms as the domain vocabulary
   - Consistent use of Schedule, Assignment, Task, Operator, Equipment

5. **Loose coupling, strong cohesion**
   - Each service is internally cohesive around a specific domain capability
   - Loosely coupled to others via events or well-defined APIs

---

## 4. Service Responsibilities Matrix

| Service | Technology | Owns | Listens to | Publishes |
|---------|------------|------|------------|-----------|
| Resource Management | PHP/Symfony | Operator, Equipment, Skills, Maintenance | External maintenance systems | OperatorAvailabilityChanged, EquipmentStatusChanged |
| Job Management | PHP/Symfony | Job, Task, Dependencies | AssignmentCompleted (optional) | JobCreated, TaskAddedToJob, TaskDependencySet |
| Assignment Service | PHP/Symfony | Schedule, Assignments | Resource events, Job events | TaskAssigned, ScheduleUpdated, ConflictDetected |
| **Validation Service** | **Node.js** | Validation logic (shared with frontend) | — | — |
| Scheduling View | PHP/Symfony | Read models only | All domain events | None (read-only) |
| Execution Tracking | PHP/Symfony | Execution records, Variances | TaskAssigned | TaskStarted, TaskCompleted, VarianceDetected |

---

## 5. Technology Mapping

The system uses a **hybrid PHP + Node.js architecture**:

### PHP/Symfony Services
- **Resource Management Service** — operators, equipment, skills
- **Job Management Service** — jobs, tasks, dependencies
- **Assignment Service** — schedule orchestration, persistence
- **Scheduling View Service** — read models, reports
- **Execution Tracking Service** — task execution, variances

### Node.js Service
- **Validation Service** — isomorphic validation (shared with frontend)
  - Package: `@ewlin/schedule-validator`
  - Stateless, horizontally scalable

### Shared Infrastructure
- **Database:** MariaDB 10.11+ (one schema per service)
- **Event Bus:** Symfony Messenger (async domain events)
- **Cache:** Redis 7+
- **API Layer:** RESTful APIs with OpenAPI 3.0

### Frontend
- **React 18+ with TypeScript**
- Bundles `@ewlin/schedule-validator` for client-side validation
- WebSocket for real-time schedule updates

---

## 6. Deployment Considerations

### Hybrid Deployment Model
```yaml
# docker-compose.yml
services:
  # PHP Services (can be monolith or separate)
  php-api:
    image: ewlin/php-api
    depends_on:
      - validation-service
      - mariadb
      - redis

  # Node.js Validation Service (always separate)
  validation-service:
    image: ewlin/validation-service
    # Stateless, can scale independently

  # Frontend
  frontend:
    image: ewlin/frontend
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
- The Assignment & Validation Service is the heart of the system, implementing the core scheduling value proposition
- Read model separation (Scheduling View) enables complex reporting without impacting operations
- These boundaries align with team responsibilities and can scale independently
