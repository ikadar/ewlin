# Architecture Decision Records (ADRs) – Operations Research System

This document captures **key architectural decisions** for the Equipment → Operator → Job → Task assignment and validation system.

ADRs ensure long-term traceability, clarity of intent, and accountability for design choices.

Each ADR is a **small, immutable document**. When a decision is changed, a *new* ADR is created instead of editing the old one.

---

## ADR 0001 – Use Dependency-Based Task Model (DAG)

**Status:** Accepted  
**Date:** 2025-01-15

### Context
Tasks within jobs need flexible execution ordering. Initial designs considered strict sequential task numbering, but this proved too limiting for real-world manufacturing scenarios where:
- Some tasks can run in parallel
- Dependencies may be complex (not just sequential)
- Critical path calculation is essential for deadline management

### Decision
Implement tasks as nodes in a **Directed Acyclic Graph (DAG)** where:
- Tasks have explicit dependencies on other tasks
- Multiple tasks can depend on one task
- One task can depend on multiple tasks
- The system validates against circular dependencies

### Consequences
**Positive**
- Enables parallel task execution
- Supports complex manufacturing workflows
- Allows accurate critical path calculation
- More flexible than sequential numbering

**Negative**
- More complex validation logic required
- UI must handle graph visualization
- Dependency management adds complexity

### Related Documents
- [Domain Model](../domain-model/domain-model.md)
- [Business Rules](../domain-model/business-rules.md)

---

## ADR 0002 – Event-Driven Communication Between Services

**Status:** Accepted  
**Date:** 2025-01-16

### Context
The system spans multiple bounded contexts (Resource Management, Job Management, Assignment & Validation, Execution Tracking). These services need to coordinate while maintaining independence. Tight coupling through synchronous calls would:
- Reduce system resilience
- Create deployment dependencies
- Limit independent scaling
- Make testing more complex

### Decision
Services communicate using **asynchronous integration events**:
- `ResourceManagement.OperatorAvailabilityChanged`
- `JobManagement.TaskStructureChanged`
- `Assignment.TaskScheduled`
- `Execution.TaskProgressUpdate`

Events are published via message broker (Symfony Messenger initially, can migrate to RabbitMQ/Kafka).

### Consequences
**Positive**
- Loose coupling between services
- Independent deployment and scaling
- Improved resilience through async processing
- Natural audit trail via events
- Supports event sourcing patterns

**Negative**
- Eventual consistency must be handled
- More complex debugging and tracing
- Requires dead letter queue handling
- Message ordering considerations

### Related Documents
- [Event & Message Design](event-message-design.md)
- [Service Boundaries](service-boundaries.md)

---

## ADR 0003 – Separate Scheduling Logic into Dedicated Service

**Status:** Accepted  
**Date:** 2025-01-17

### Context
Task scheduling is the core value proposition of the system. It involves:
- Complex constraint validation
- Resource availability checking
- Dependency graph analysis
- Conflict detection and resolution
- Optimization algorithms

Embedding this logic in Job or Resource services would violate single responsibility principle.

### Decision
Create a dedicated **Assignment & Validation Service** that:
- Owns the Schedule aggregate
- Performs all scheduling calculations
- Validates assignments against all constraints
- Publishes scheduling events
- Suggests conflict resolutions

### Consequences
**Positive**
- Clear separation of concerns
- Scheduling logic can evolve independently
- Easier to test complex algorithms
- Can be scaled based on computational needs
- Enables future AI/ML integration

**Negative**
- Additional service to maintain
- Requires coordination with multiple services
- Potential performance bottleneck

### Related Documents
- [Service Boundaries](service-boundaries.md)
- [Aggregate Design](aggregate-design.md)

---

## ADR 0004 – CQRS Pattern for Read Models

**Status:** Accepted  
**Date:** 2025-01-18

### Context
The system has very different read and write patterns:
- Writes: Individual task assignments, status updates
- Reads: Complex Gantt charts, resource utilization reports, schedule views

Using the same model for both would lead to:
- Poor query performance
- Complex aggregation logic in domain model
- Difficulty optimizing for specific view needs

### Decision
Implement **Command Query Responsibility Segregation (CQRS)**:
- Write models optimized for business logic and consistency
- Read models optimized for queries and reporting
- Event-driven synchronization between them
- Separate Scheduling View Service for read models

### Consequences
**Positive**
- Optimal performance for both reads and writes
- Complex queries don't impact operational performance
- Can use different storage for read models
- Enables real-time dashboards and reports

**Negative**
- Eventual consistency between write and read models
- Additional infrastructure complexity
- More code to maintain
- Potential for synchronization issues

---

## ADR 0005 – Technology Stack Selection

**Status:** Accepted  
**Date:** 2025-01-19

### Context
The project requires a stable, enterprise-ready technology stack that supports:
- Complex business logic implementation
- High performance requirements
- Long-term maintainability
- Team expertise alignment
- Rich ecosystem for OR/scheduling domains

Options evaluated: Node.js, Go, Python, PHP/Symfony, Java/Spring.

### Decision
Use the following technology stack:
- **Backend:** PHP 8.3+ with Symfony 7
- **Database:** MariaDB 10.11+ 
- **Frontend:** React 18+ with TypeScript
- **Caching:** Redis 7+
- **Message Queue:** Symfony Messenger (upgradeable to RabbitMQ)
- **API:** RESTful with OpenAPI 3.0 specification
- **Container:** Docker with docker-compose

### Consequences
**Positive**
- Mature ecosystem with extensive libraries
- Strong DDD/CQRS support in Symfony
- Excellent debugging and profiling tools
- Large talent pool familiar with stack
- Good performance with proper optimization

**Negative**
- PHP perceived as less modern than Go/Node.js
- Requires careful performance tuning
- Memory usage higher than compiled languages
- Some OR libraries better in Python

---

## ADR 0006 – Aggregates Enforce All Business Invariants

**Status:** Accepted  
**Date:** 2025-01-20

### Context
Business rules must be consistently enforced:
- Operators can only be assigned to equipment they're certified for
- Tasks cannot start before dependencies complete
- Resources cannot be double-booked
- Equipment cannot be assigned while in maintenance

These rules must never be violated, regardless of how the system is accessed.

### Decision
All business invariants are enforced inside **aggregate root methods**:
- No external service can bypass aggregate rules
- All state changes go through aggregate methods
- Aggregates maintain internal consistency
- Invalid operations throw domain exceptions

### Consequences
**Positive**
- Guaranteed business rule consistency
- Single source of truth for rules
- Clear ownership of invariants
- Protection against invalid states

**Negative**
- Aggregates may become complex
- Performance impact of validation
- Requires careful aggregate boundary design
- More difficult to implement bulk operations

### Related Documents
- [Aggregate Design](aggregate-design.md)
- [Business Rules](../domain-model/business-rules.md)

---

## ADR 0007 – Repository Interfaces at Domain Layer

**Status:** Accepted  
**Date:** 2025-01-21

### Context
Infrastructure choices (SQL, NoSQL, in-memory cache) may change over the project lifecycle. Domain logic must remain stable and testable regardless of persistence mechanism. Direct coupling to Doctrine or specific database would:
- Make testing difficult
- Lock us into specific infrastructure
- Violate dependency inversion principle

### Decision
Each aggregate exposes a **repository interface** in the domain layer:
```php
interface OperatorRepository {
    public function save(Operator $operator): void;
    public function get(OperatorId $id): Operator;
    public function findAvailableBetween(DateTime $start, DateTime $end): array;
}
```

Concrete implementations reside in infrastructure layer.

### Consequences
**Positive**
- Clean separation of domain and infrastructure
- Easy to test with in-memory implementations
- Flexibility to change persistence strategy
- Follows hexagonal architecture principles

**Negative**
- Additional abstraction layer
- Boilerplate code for implementations
- Potential for leaky abstractions
- May limit use of database-specific features

---

## ADR 0008 – Optimistic Locking for Schedule Aggregate

**Status:** Accepted  
**Date:** 2025-01-22

### Context
The Schedule aggregate is a high-contention resource:
- Multiple schedulers may work simultaneously
- Automated systems may update schedules
- Real-time updates from execution tracking

Pessimistic locking would create bottlenecks and reduce system responsiveness.

### Decision
Implement **optimistic locking** for Schedule aggregate:
- Version field on aggregate
- Increment version on each modification
- Reject updates if version mismatch
- Client retry with latest version
- Maximum 3 retry attempts

### Consequences
**Positive**
- Better performance under normal conditions
- No blocking of concurrent users
- Scales well with multiple schedulers
- Natural conflict detection

**Negative**
- Requires retry logic in clients
- Potential for lost updates under high contention
- More complex error handling
- Users may need to re-apply changes

---

## ADR 0009 – Monolith-First Architecture

**Status:** Superseded by ADR 0012
**Date:** 2025-01-23
**Superseded:** 2025-01-25

### Context
While the system is designed with clear service boundaries, premature distribution would add unnecessary complexity:
- Small initial team
- Unclear scaling requirements
- Need for rapid iteration
- Simplified deployment and debugging

### Original Decision
Start with a **modular monolith**:
- All services in single Symfony application
- Clear module boundaries matching service boundaries
- Separate database schemas per service
- Event bus abstraction for future extraction
- No shared domain objects between modules

### Superseded By
This ADR has been **superseded by ADR 0011 and ADR 0012** which introduce a hybrid architecture:
- PHP services remain as modular monolith
- **Validation Service is separate (Node.js)** due to isomorphic code requirement
- See [ADR 0011](#adr-0011--shared-validation-service-isomorphic-typescript) and [ADR 0012](#adr-0012--hybrid-backend-architecture-php--nodejs)

### Current Architecture
```
┌─────────────────────────────────────────┐
│      PHP Modular Monolith (Symfony)     │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
│  │Resource │ │  Job    │ │Assignment │  │
│  │ Mgmt    │ │  Mgmt   │ │ Service   │  │
│  └─────────┘ └─────────┘ └───────────┘  │
│  ┌─────────┐ ┌───────────────────────┐  │
│  │  View   │ │ Execution Tracking    │  │
│  │ Service │ │                       │  │
│  └─────────┘ └───────────────────────┘  │
└─────────────────────────────────────────┘
              │
              │ HTTP (internal)
              ▼
┌─────────────────────────────────────────┐
│   Node.js Validation Service            │
│   (separate due to isomorphic code)     │
└─────────────────────────────────────────┘
```

### Related Documents
- [ADR 0011 – Shared Validation Service](decision-records.md#adr-0011)
- [ADR 0012 – Hybrid Backend Architecture](decision-records.md#adr-0012)
- [Service Boundaries](service-boundaries.md)

---

## ADR 0010 – Event Sourcing for Schedule Aggregate (Future)

**Status:** Proposed  
**Date:** 2025-01-24

### Context
Schedule changes need detailed audit trails for:
- Compliance requirements
- Debugging complex scenarios
- Understanding decision history
- Potential "time travel" queries

Traditional state-based persistence loses this history.

### Decision
Implement **event sourcing** for Schedule aggregate:
- Store all state changes as events
- Rebuild current state from event stream
- Snapshot periodically for performance
- Keep full history of all changes

### Consequences
**Positive**
- Complete audit trail built-in
- Can replay events for debugging
- Natural integration with event-driven architecture
- Enables temporal queries

**Negative**
- Increased complexity
- Storage requirements grow over time
- Event schema versioning challenges
- Performance considerations for replay

**Note:** This ADR is marked as "Proposed" for future implementation after initial system stabilization.

---

## ADR 0011 – Shared Validation Service (Isomorphic TypeScript)

**Status:** Accepted
**Date:** 2025-01-25

### Context
The scheduling grid UI requires **real-time validation feedback** during drag & drop operations:
- Drag response must be < 50ms for smooth UX
- Server round-trip is typically 50-200ms (too slow)
- Validation must happen on both client and server
- Maintaining two separate validation implementations (PHP + TypeScript) creates:
  - Synchronization risk (rules diverge over time)
  - Double maintenance burden
  - Potential for subtle behavioral differences

### Decision
Implement schedule validation as a **shared TypeScript package** that runs in both environments:

```
@ewlin/schedule-validator (npm package)
├── src/
│   ├── validators/
│   │   ├── resource-conflict.ts
│   │   ├── availability-conflict.ts
│   │   ├── dependency-conflict.ts
│   │   ├── deadline-conflict.ts
│   │   └── skill-conflict.ts
│   ├── types/
│   │   └── schedule-types.ts
│   └── index.ts
```

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  @ewlin/schedule-validator (runs in browser)        │   │
│  │  - Instant validation during drag (< 10ms)          │   │
│  │  - Uses local schedule state snapshot               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js Validation Service                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  @ewlin/schedule-validator (runs on server)         │   │
│  │  - Authoritative validation before persist          │   │
│  │  - Same code, guaranteed consistency                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Internal API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    PHP Backend Services                     │
│  - Resource Management Service                              │
│  - Job Management Service                                   │
│  - Assignment Service (calls Validation Service)            │
│  - Execution Tracking Service                               │
└─────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. Client receives schedule snapshot via WebSocket
2. During drag, client runs local validation (instant)
3. On drop, client sends assignment request to server
4. Node.js Validation Service validates (authoritative)
5. PHP Assignment Service persists if valid
6. Updated schedule pushed to all clients via WebSocket

**Validation Service API:**
```typescript
// Shared types
interface ScheduleSnapshot {
  tasks: TaskAssignment[];
  operators: OperatorAvailability[];
  equipment: EquipmentStatus[];
  dependencies: TaskDependency[];
}

interface ValidationResult {
  valid: boolean;
  conflicts: ScheduleConflict[];
}

// Shared validator
function validateAssignment(
  assignment: ProposedAssignment,
  schedule: ScheduleSnapshot
): ValidationResult;
```

### Consequences
**Positive**
- Single source of truth for validation logic
- Zero risk of client/server rule divergence
- Instant UI feedback (< 10ms on client)
- Authoritative server validation
- Testable: one test suite covers both environments
- TypeScript provides type safety across stack

**Negative**
- Adds Node.js to infrastructure (alongside PHP)
- Two runtimes to maintain and deploy
- Network call from PHP to Node.js Validation Service
- Team needs JavaScript/TypeScript expertise
- Slightly more complex deployment

**Mitigations:**
- Validation Service is stateless, easy to scale
- Clear API boundary between PHP and Node.js
- Can be containerized alongside PHP services
- Internal network latency is minimal (< 5ms)

### Related Documents
- [ADR 0005 – Technology Stack Selection](decision-records.md#adr-0005)
- [Scheduling UI Design](../requirements/scheduling-ui-design.md)
- [Service Boundaries](service-boundaries.md)

---

## ADR 0012 – Hybrid Backend Architecture (PHP + Node.js)

**Status:** Accepted
**Date:** 2025-01-25

### Context
Following ADR 0011, the system now includes a Node.js Validation Service alongside the PHP backend. This creates a hybrid architecture that needs clear boundaries and communication patterns.

### Decision
Adopt a **hybrid backend architecture**:

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Resource Management | PHP/Symfony | Operators, Equipment, Skills, Availability |
| Job Management | PHP/Symfony | Jobs, Tasks, Dependencies |
| Assignment Service | PHP/Symfony | Orchestrates assignments, calls Validation Service |
| Execution Tracking | PHP/Symfony | Task execution, variances |
| **Validation Service** | **Node.js** | Schedule validation (shared with frontend) |
| Scheduling View | PHP/Symfony | Read models, reports |

**Communication:**
- PHP → Node.js: HTTP REST (internal network)
- Node.js → PHP: Not allowed (one-way dependency)
- Frontend → Both: Via API Gateway

**Deployment:**
```yaml
# docker-compose.yml
services:
  php-api:
    image: ewlin/php-api
    depends_on:
      - validation-service

  validation-service:
    image: ewlin/validation-service
    # Stateless, horizontally scalable

  frontend:
    image: ewlin/frontend
    # Bundles @ewlin/schedule-validator
```

### Consequences
**Positive**
- Clear separation: PHP for business logic, Node.js for shared validation
- Each technology used for its strengths
- Validation Service is independently scalable
- Frontend and server guaranteed to use same validation

**Negative**
- Operational complexity (two runtimes)
- Need expertise in both ecosystems
- Additional network hop for validation

### Related Documents
- [ADR 0011 – Shared Validation Service](decision-records.md#adr-0011)

---

## Notes

- These ADRs reflect key decisions made during initial system design
- Each ADR should be reviewed quarterly and updated if needed
- New ADRs should be created rather than modifying existing ones
- All team members should be familiar with accepted ADRs
- Future ADRs should be added as new architectural decisions are made
