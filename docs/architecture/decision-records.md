# Architecture Decision Records (ADRs) – Flux Print Shop Scheduling System

This document captures **key architectural decisions** for the Flux Print Shop Scheduling System.

ADRs ensure long-term traceability, clarity of intent, and accountability for design choices.

Each ADR is a **small, immutable document**. When a decision is changed, a *new* ADR is created instead of editing the old one.

---

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](#adr-001--linear-task-sequence-model) | Linear Task Sequence Model | Accepted | 2025-01-15 |
| [ADR-002](#adr-002--event-driven-communication-between-services) | Event-Driven Communication | Accepted | 2025-01-16 |
| [ADR-003](#adr-003--dedicated-assignment--validation-service) | Dedicated Assignment & Validation Service | Accepted | 2025-01-17 |
| [ADR-004](#adr-004--cqrs-pattern-for-read-models) | CQRS Pattern for Read Models | Accepted | 2025-01-18 |
| [ADR-005](#adr-005--technology-stack-selection) | Technology Stack Selection | Accepted | 2025-01-19 |
| [ADR-006](#adr-006--aggregates-enforce-all-business-invariants) | Aggregates Enforce Invariants | Accepted | 2025-01-20 |
| [ADR-007](#adr-007--repository-interfaces-at-domain-layer) | Repository Interfaces at Domain Layer | Accepted | 2025-01-21 |
| [ADR-008](#adr-008--optimistic-locking-for-schedule-aggregate) | Optimistic Locking | Accepted | 2025-01-22 |
| [ADR-009](#adr-009--hybrid-backend-architecture-php--nodejs) | Hybrid Backend Architecture (PHP + Node.js) | Accepted | 2025-01-23 |
| [ADR-010](#adr-010--isomorphic-validation-service-nodejs) | Isomorphic Validation Service (Node.js) | Accepted | 2025-01-24 |
| [ADR-011](#adr-011--lezer-parser-system-for-task-dsl) | Lezer Parser System for Task DSL | Accepted | 2025-12-11 |
| [ADR-012](#adr-012--event-sourcing-for-schedule-aggregate-future) | Event Sourcing (Future) | Proposed | 2025-01-25 |

---

## ADR-001 – Linear Task Sequence Model

**Status:** Accepted
**Date:** 2025-01-15

### Context

Tasks within jobs need execution ordering. The print shop workflow follows a linear production sequence:
- Printing → Cutting → Lamination → Folding → Final Cut
- Each step depends on the previous one completing
- No parallel execution within a single job

Unlike manufacturing systems with complex DAG dependencies, print shop jobs follow a predictable linear flow.

### Decision

Implement tasks as a **linear sequence** where:
- Tasks have a `sequenceOrder` field (1, 2, 3, ...)
- Task N depends implicitly on Task N-1
- Jobs have dependencies at job level (cross-job precedence)

### Consequences

**Positive:**
- Simple, intuitive model matching real workflow
- Easy to visualize and manage in UI
- Straightforward validation logic
- DSL can express tasks in natural order

**Negative:**
- Cannot model parallel tasks within a job (not needed for print shop)
- Less flexible than DAG model

### Related Documents

- [Domain Model](../domain-model/domain-model.md)
- [Business Rules](../domain-model/business-rules.md)

---

## ADR-002 – Event-Driven Communication Between Services

**Status:** Accepted
**Date:** 2025-01-16

### Context

The system spans multiple bounded contexts (Station Management, Job Management, Assignment & Validation, Scheduling View). These services need to coordinate while maintaining independence.

### Decision

Services communicate using **asynchronous integration events**:
- `StationManagement.StationScheduleUpdated`
- `JobManagement.TaskStructureChanged`
- `JobManagement.ApprovalGateChanged`
- `Assignment.TaskScheduled`
- `Assignment.ConflictDetected`

Events are published via message broker (Symfony Messenger initially, can migrate to RabbitMQ).

### Consequences

**Positive:**
- Loose coupling between services
- Independent deployment and scaling
- Natural audit trail via events
- Supports event sourcing patterns

**Negative:**
- Eventual consistency must be handled
- More complex debugging and tracing
- Message ordering considerations

### Related Documents

- [Event & Message Design](event-message-design.md)
- [Service Boundaries](service-boundaries.md)

---

## ADR-003 – Dedicated Assignment & Validation Service

**Status:** Accepted
**Date:** 2025-01-17

### Context

Task scheduling is the core value proposition. It involves:
- Complex constraint validation
- Station availability checking
- Group capacity checking
- Conflict detection and resolution
- Precedence validation

### Decision

Create a dedicated **Assignment & Validation Service** that:
- Owns the Schedule aggregate
- Performs all scheduling calculations
- Validates assignments against all constraints
- Publishes scheduling events
- Coordinates with Validation Service (Node.js)

### Consequences

**Positive:**
- Clear separation of concerns
- Scheduling logic can evolve independently
- Easier to test complex algorithms
- Can be scaled based on computational needs

**Negative:**
- Additional service to maintain
- Requires coordination with multiple services

### Related Documents

- [Service Boundaries](service-boundaries.md)

---

## ADR-004 – CQRS Pattern for Read Models

**Status:** Accepted
**Date:** 2025-01-18

### Context

The system has very different read and write patterns:
- Writes: Individual task assignments, status updates
- Reads: Complex scheduling grids, late job reports, station utilization

### Decision

Implement **Command Query Responsibility Segregation (CQRS)**:
- Write models optimized for business logic and consistency
- Read models optimized for queries (ScheduleSnapshot)
- Event-driven synchronization between them
- Separate Scheduling View Service for read models

### Consequences

**Positive:**
- Optimal performance for both reads and writes
- Complex queries don't impact operational performance
- Enables real-time dashboards

**Negative:**
- Eventual consistency between write and read models
- More code to maintain

---

## ADR-005 – Technology Stack Selection

**Status:** Accepted
**Date:** 2025-01-19

### Context

The project requires a stable, enterprise-ready technology stack supporting:
- Complex business logic implementation
- High performance drag & drop validation
- Long-term maintainability
- Team expertise alignment

### Decision

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Backend Services | PHP 8.3+ / Symfony 7 | Strong DDD support, mature ecosystem |
| Database | MariaDB 10.11+ | Reliable, performant, familiar |
| Frontend | React 19 + TypeScript | Modern UI, strong typing |
| Validation Service | Node.js + TypeScript | Isomorphic code (see ADR-010) |
| DSL Parser | Lezer + TypeScript | Editor integration (see ADR-011) |
| Caching | Redis 7+ | Fast, reliable |
| Message Queue | Symfony Messenger | Simple start, upgradeable |
| Container | Docker | Consistent environments |

### Consequences

**Positive:**
- Mature ecosystems with extensive libraries
- Strong DDD/CQRS support in Symfony
- Isomorphic validation with TypeScript
- Large talent pool

**Negative:**
- Polyglot architecture (PHP + Node.js)
- Two runtimes to maintain

---

## ADR-006 – Aggregates Enforce All Business Invariants

**Status:** Accepted
**Date:** 2025-01-20

### Context

Business rules must be consistently enforced:
- Stations cannot be double-booked
- Tasks cannot start before predecessors complete
- Approval gates must be satisfied before scheduling
- Group capacity limits must be respected

### Decision

All business invariants are enforced inside **aggregate root methods**:
- No external service can bypass aggregate rules
- All state changes go through aggregate methods
- Invalid operations throw domain exceptions

### Consequences

**Positive:**
- Guaranteed business rule consistency
- Single source of truth for rules
- Protection against invalid states

**Negative:**
- Aggregates may become complex
- Performance impact of validation

### Related Documents

- [Business Rules](../domain-model/business-rules.md)

---

## ADR-007 – Repository Interfaces at Domain Layer

**Status:** Accepted
**Date:** 2025-01-21

### Context

Infrastructure choices may change over time. Domain logic must remain stable and testable regardless of persistence mechanism.

### Decision

Each aggregate exposes a **repository interface** in the domain layer:
```php
interface StationRepository {
    public function save(Station $station): void;
    public function get(StationId $id): Station;
    public function findAvailableBetween(DateTime $start, DateTime $end): array;
}
```

Concrete implementations reside in infrastructure layer.

### Consequences

**Positive:**
- Clean separation of domain and infrastructure
- Easy to test with in-memory implementations
- Follows hexagonal architecture principles

**Negative:**
- Additional abstraction layer
- Boilerplate code for implementations

---

## ADR-008 – Optimistic Locking for Schedule Aggregate

**Status:** Accepted
**Date:** 2025-01-22

### Context

The Schedule aggregate is a high-contention resource:
- Multiple schedulers may work simultaneously
- Real-time updates from various sources

### Decision

Implement **optimistic locking** for Schedule aggregate:
- `snapshotVersion` field on aggregate
- Increment version on each modification
- Reject updates if version mismatch
- Client retry with latest version

### Consequences

**Positive:**
- Better performance under normal conditions
- No blocking of concurrent users
- Natural conflict detection

**Negative:**
- Requires retry logic in clients
- Users may need to re-apply changes

---

## ADR-009 – Hybrid Backend Architecture (PHP + Node.js)

**Status:** Accepted
**Date:** 2025-01-23

### Context

Following ADR-010, the system includes a Node.js Validation Service alongside the PHP backend to enable isomorphic validation code. This creates a hybrid architecture.

### Decision

Adopt a **hybrid backend architecture**:

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Station Management | PHP/Symfony | Stations, Categories, Groups, Providers |
| Job Management | PHP/Symfony | Jobs, Tasks, Approval Gates |
| Assignment Service | PHP/Symfony | Orchestrates assignments, calls Validation Service |
| **Validation Service** | **Node.js** | Schedule validation (shared with frontend) |
| Scheduling View | PHP/Symfony | Read models, snapshots |

**Architecture:**
```
┌─────────────────────────────────────────┐
│      PHP Modular Monolith (Symfony)     │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
│  │Station  │ │  Job    │ │Assignment │  │
│  │ Mgmt    │ │  Mgmt   │ │ Service   │──┼──► calls
│  └─────────┘ └─────────┘ └───────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Scheduling View Service          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    │ HTTP (internal)
                    ▼
┌─────────────────────────────────────────┐
│   Node.js Validation Service            │
│   @flux/schedule-validator              │
│   (isomorphic - same code as frontend)  │
└─────────────────────────────────────────┘
```

**Communication:**
- PHP → Node.js: HTTP REST (internal network)
- Node.js → PHP: Not allowed (one-way dependency)
- Frontend → Both: Via API Gateway

### Consequences

**Positive:**
- Clear separation: PHP for business logic, Node.js for shared validation
- Each technology used for its strengths
- Validation Service is independently scalable

**Negative:**
- Operational complexity (two runtimes)
- Need expertise in both ecosystems
- Additional network hop for validation (~5ms)

### Related Documents

- [ADR-010 – Isomorphic Validation Service](#adr-010--isomorphic-validation-service-nodejs)
- [Service Boundaries](service-boundaries.md)

---

## ADR-010 – Isomorphic Validation Service (Node.js)

**Status:** Accepted
**Date:** 2025-01-24

### Context

The scheduling grid UI requires **real-time validation feedback** during drag & drop:
- Drag response must be < 10ms for smooth UX
- Server round-trip is typically 50-200ms (too slow)
- Validation must happen on both client and server
- Maintaining two separate implementations (PHP + TypeScript) creates sync risk

Validation rules include:
- Station conflict detection (no double-booking)
- Station group capacity limits (MaxConcurrent)
- Task precedence within jobs
- Approval gate requirements (BAT, Plates)
- Operating schedule compliance
- Deadline feasibility

### Decision

Implement schedule validation as a **shared TypeScript package** (`@flux/schedule-validator`) that runs identically on:

1. **Browser**: Bundled into React frontend (<10ms validation)
2. **Server**: Running as dedicated Node.js microservice (authoritative)

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           @flux/schedule-validator                   │    │
│  │  (bundled, runs in browser, <10ms validation)        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (assign/reschedule)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              PHP/Symfony Assignment Service                  │
│                              │                               │
│                              │ HTTP (validate)               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         Node.js Validation Service                   │    │
│  │         @flux/schedule-validator                     │    │
│  │  (authoritative validation before persist)           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Shared Package API:**
```typescript
// @flux/schedule-validator

export interface ProposedAssignment {
  taskId: string;
  stationId: string;
  scheduledStart: string; // ISO-8601
}

export interface ValidationResult {
  valid: boolean;
  conflicts: ScheduleConflict[];
  warnings: ValidationWarning[];
}

export function validateAssignment(
  proposed: ProposedAssignment,
  snapshot: ScheduleSnapshot
): ValidationResult;
```

**Why Not PHP in Browser?**

PHP cannot run in the browser. Transpilation approaches are impractical for real-time validation.

**Alternatives Considered:**

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| PHP-only validation | Single language | Can't run in browser | Rejected |
| Duplicate implementations | Technology flexibility | Sync nightmare | Rejected |
| WebAssembly (Rust/Go) | High performance | Complex toolchain | Rejected |
| Server-only validation | Simpler architecture | Poor UX (lag) | Rejected |

### Consequences

**Positive:**
- Single source of truth for validation logic
- Zero risk of client/server rule divergence
- Instant UI feedback (< 10ms on client)
- One test suite covers both environments
- TypeScript provides type safety

**Negative:**
- Adds Node.js to infrastructure
- Network call from PHP to Node.js (~5ms)
- Team needs TypeScript expertise

### Related Documents

- [ADR-009 – Hybrid Backend Architecture](#adr-009--hybrid-backend-architecture-php--nodejs)
- [Business Rules](../domain-model/business-rules.md) - Validation Rules section
- [Interface Contracts](interface-contracts.md) - ValidateProposedAssignment

---

## ADR-011 – Lezer Parser System for Task DSL

**Status:** Accepted
**Date:** 2025-12-11

### Context

The Flux Print Shop Scheduling System requires a Domain-Specific Language (DSL) for defining tasks within jobs. Users enter task definitions in a textarea, and the system must:

1. Parse the DSL into structured task data
2. Provide real-time syntax highlighting in the editor
3. Offer autocomplete suggestions for station/provider names
4. Display inline error messages with line numbers
5. Recover gracefully from syntax errors (partial parsing)

The DSL syntax is:
```
[StationName] setupMinutes+runMinutes "optional comment"
ST [ProviderName] ActionType durationJO "optional comment"
```

### Decision

**Use the Lezer Parser System** (https://lezer.codemirror.net/) for implementing the Task DSL parser.

Lezer is a parser generator that produces JavaScript modules from declarative grammars, designed specifically for code editor use cases.

### Rationale

| Requirement | Lezer Capability |
|-------------|------------------|
| Browser-compatible | Pure JavaScript output, small footprint (~15KB) |
| Error recovery | Built-in error recovery strategies for partial parsing |
| Syntax highlighting | Direct integration with CodeMirror 6 |
| Incremental parsing | Reuses nodes from previous parse (<1ms re-parse) |
| Memory efficient | 64 bits per node, compact tree representation |
| TypeScript support | First-class TypeScript definitions |

**Alternatives Considered:**

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| PEG.js/Peggy | Simple grammar syntax | No error recovery, abandoned | Rejected |
| ANTLR4 | Powerful, well-documented | Heavy runtime (~200KB) | Rejected |
| Nearley.js | Handles ambiguity | No error recovery | Rejected |
| Hand-written | Full control | Maintenance burden | Rejected |
| Chevrotain | Fast, TypeScript-native | No editor integration | Rejected |
| Tree-sitter | Excellent error recovery | WASM dependency | Rejected |

### Implementation

**Grammar Definition (`task-dsl.grammar`):**
```lezer
@top TaskList { Task* }

Task {
  InternalTask |
  OutsourcedTask
}

InternalTask {
  "[" StationName "]" Duration Comment?
}

OutsourcedTask {
  "ST" "[" ProviderName "]" ActionType OpenDays Comment?
}

Duration {
  Number ("+" Number)?
}

OpenDays {
  Number "JO"
}

@tokens {
  StationName { ![\\]]+ }
  ProviderName { ![\\]]+ }
  ActionType { $[A-Za-zÀ-ÿ]+ }
  Number { $[0-9]+ }
  String { '"' !["]* '"' }
}
```

**Package Structure:**
```
packages/
  task-dsl-parser/
    src/
      task-dsl.grammar     # Lezer grammar definition
      parser.ts            # Generated parser + wrapper
      highlighter.ts       # CodeMirror highlighting extension
      autocomplete.ts      # Autocomplete provider
      types.ts             # ParsedTask, ParseError types
```

**Integration Points:**
- **Job Creation Modal**: CodeMirror 6 editor with DSL highlighting
- **Job Management Service**: Server-side validation using same parser
- **Autocomplete**: Station/provider names from Station Management Service

### Consequences

**Positive:**
- Real-time syntax highlighting and error feedback
- Consistent parsing on client and server (isomorphic)
- Excellent user experience with autocomplete
- Easy to extend grammar as DSL evolves
- Small bundle size (~15KB)

**Negative:**
- Learning curve for Lezer grammar syntax
- Build step required for grammar compilation
- CodeMirror 6 dependency

### References

- [Lezer Documentation](https://lezer.codemirror.net/)
- [Lezer Grammar Guide](https://lezer.codemirror.net/docs/guide/)
- [CodeMirror 6 Language Support](https://codemirror.net/docs/ref/#language)
- [Task DSL Specification](../requirements/task-dsl-specification.md)

---

## ADR-012 – Event Sourcing for Schedule Aggregate (Future)

**Status:** Proposed
**Date:** 2025-01-25

### Context

Schedule changes need detailed audit trails for:
- Compliance requirements
- Debugging complex scenarios
- Understanding decision history

### Decision

Implement **event sourcing** for Schedule aggregate (future):
- Store all state changes as events
- Rebuild current state from event stream
- Snapshot periodically for performance

### Consequences

**Positive:**
- Complete audit trail built-in
- Can replay events for debugging
- Enables temporal queries

**Negative:**
- Increased complexity
- Event schema versioning challenges

**Note:** This ADR is marked as "Proposed" for future implementation after initial system stabilization.

---

## Notes

- These ADRs reflect key decisions made during system design
- Each ADR should be reviewed quarterly and updated if needed
- New ADRs should be created rather than modifying existing ones
- All team members should be familiar with accepted ADRs
