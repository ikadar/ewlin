---
tags:
  - specification
  - domain
---

# Bounded Context Map – Flux Print Shop Scheduling System

This document defines the major bounded contexts involved in the **print shop scheduling** system and the relationships between them.

---

## 1. Station Management Context

**Responsibilities:**
- Manage Stations and their operating schedules.
- Manage Station Categories with similarity criteria.
- Manage Station Groups with capacity limits.
- Manage Outsourced Providers.
- Provide station availability information.

**Owned Models:**
- `Station`
- `StationId`
- `StationCategory`
- `StationCategoryId`
- `SimilarityCriterion`
- `StationGroup`
- `StationGroupId`
- `OutsourcedProvider`
- `ProviderId`
- `OperatingSchedule`
- `ScheduleException`
- `TimeSlot` (shared kernel)

**Exposes:**
- `StationCreated` domain event
- `StationScheduleUpdated` domain event
- `StationExceptionAdded` domain event
- `StationStatusChanged` domain event
- `StationCategoryCreated` domain event
- `StationGroupCreated` domain event
- `ProviderCreated` domain event

**Consumes:**
- None (foundational context).

---

## 2. Job Management Context

**Responsibilities:**
- Create and manage Jobs with deadlines and metadata.
- Define Elements within jobs with cross-element dependencies.
- Define Tasks within elements with durations and station requirements.
- Track element-level prerequisites (paper, BAT, plates, forme) — v0.4.32.
- Manage job comments.

**Owned Models:**
- `Job`
- `JobId`
- `JobStatus`
- `Element`
- `ElementId`
- `Task`
- `TaskId`
- `TaskStatus`
- `Comment`
- `PaperStatus` (element-level, v0.4.32)
- `BatStatus` (element-level, v0.4.32)
- `PlateStatus` (element-level, v0.4.32)
- `FormeStatus` (element-level, v0.4.32)
- `Duration` (shared kernel)

**Exposes:**
- `JobCreated` domain event
- `TaskAddedToJob` domain event
- `TasksReordered` domain event
- `ElementCreated` domain event
- `ElementDependencyAdded` domain event
- `ElementPaperStatusUpdated` domain event (v0.4.32)
- `ElementBatStatusUpdated` domain event (v0.4.32)
- `ElementPlateStatusUpdated` domain event (v0.4.32)
- `ElementFormeStatusUpdated` domain event (v0.4.32)
- `CommentAdded` domain event
- `JobPlanned` domain event
- `JobStarted` domain event
- `JobCompleted` domain event
- `JobCancelled` domain event

**Consumes:**
- Station/Provider references from Station Management Context (by ID).

---

## 3. Assignment & Validation Context

**Responsibilities:**
- Assign tasks to stations with specific time slots.
- **Schedule tasks with specific start/end times (core functionality).**
- Validate assignments against all constraints.
- Validate element-scoped and cross-element precedence constraints (including dry time).
- Detect and report scheduling conflicts.
- Enforce station group capacity limits.
- Calculate task end times considering operating schedules.

**Owned Models:**
- `Schedule`
- `ScheduleId`
- `TaskAssignment`
- `ScheduleConflict`
- `ValidationResult`

**Consumes:**
- `StationScheduleUpdated` event from Station Management Context.
- `StationExceptionAdded` event from Station Management Context.
- `StationStatusChanged` event from Station Management Context.
- `TaskAddedToJob` event from Job Management Context.
- `TasksReordered` event from Job Management Context.
- `ElementCreated` event from Job Management Context.
- `ElementDependencyAdded` event from Job Management Context.
- `ElementPaperStatusUpdated` event from Job Management Context (v0.4.32).
- `ElementBatStatusUpdated` event from Job Management Context (v0.4.32).
- `ElementPlateStatusUpdated` event from Job Management Context (v0.4.32).
- `ElementFormeStatusUpdated` event from Job Management Context (v0.4.32).

**Exposes:**
- `TaskAssigned` domain event
- `TaskUnassigned` domain event
- `TaskRescheduled` domain event
- `ConflictDetected` domain event
- `ScheduleUpdated` domain event

---

## 4. Scheduling View Context

**Responsibilities:**
- Provide read-optimized views for UI consumption.
- Generate schedule snapshots.
- Calculate similarity indicators between consecutive tiles.
- Track late jobs.
- Support complex scheduling queries.

**Owned Models:**
- Read models and projections only
- `ScheduleSnapshot` (includes `elements` collection alongside jobs, tasks, assignments)
- `TileView`
- `SimilarityIndicator`
- `LateJobReport`

**Consumes:**
- All events from other contexts (event sourcing for read models).

**Exposes:**
- None (read-only context).

---

## 5. Business Calendar Context

**Responsibilities:**
- Calculate open days (business days).
- Exclude weekends.
- Exclude French holidays (future).
- Support per-provider calendars (future).

**Owned Models:**
- `BusinessCalendar`
- `OpenDay`

**Consumes:**
- None (foundational context).

**Exposes:**
- Calendar calculation services (synchronous).

---

## 6. Shared Kernel

**Purpose:**
A small group of shared concepts used identically across contexts.

**Shared Models:**
- `Duration` (used in Job Management and Assignment contexts)
- `TimeSlot` (used in Station Management and Assignment contexts)
- `DateTime` (standard time representation)

This shared kernel is intentionally minimal to avoid coupling.

---

## 7. Context Relationships Overview

### Station Management → Assignment & Validation
- **Integration Pattern:** Published Language (Domain Events)
- **Events:** `StationScheduleUpdated`, `StationExceptionAdded`, `StationStatusChanged`
- **Relationship Type:** Customer/Supplier
  Station Management is the supplier; Assignment & Validation is the customer.

### Job Management → Assignment & Validation
- **Integration Pattern:** Published Language (Domain Events)
- **Events:** `TaskAddedToJob`, `TasksReordered`, `ElementCreated`, `ElementDependencyAdded`, `ElementPaperStatusUpdated`, `ElementBatStatusUpdated`, `ElementPlateStatusUpdated`, `ElementFormeStatusUpdated` (v0.4.32)
- **Relationship Type:** Customer/Supplier
  Job Management is the supplier; Assignment & Validation is the customer.

### Assignment & Validation → Job Management
- **Integration Pattern:** Published Language (Domain Events)
- **Event:** `TaskAssigned` (triggers job status updates)
- **Relationship Type:** Customer/Supplier
  Assignment & Validation is the supplier; Job Management is the customer.

### All Contexts → Scheduling View
- **Integration Pattern:** Published Language (Domain Events)
- **Relationship Type:** Customer/Supplier
  All contexts are suppliers; Scheduling View is the customer.

### Assignment & Validation → Business Calendar
- **Integration Pattern:** Synchronous Request/Response
- **Relationship Type:** Customer/Supplier
  Assignment & Validation is the customer; Business Calendar is the supplier.

---

## 8. Anti-Corruption Layers

### External System Integration
When integrating with external systems (ERP, MES, etc.), each bounded context should implement its own Anti-Corruption Layer (ACL) to:
- Translate external models to domain models
- Protect the domain from external changes
- Maintain domain purity

---

## 9. Text-Based Context Map

```
CONTEXT MAP:

StationManagement
  Owns: Station, StationCategory, StationGroup, OutsourcedProvider
  Publishes: StationCreated, ScheduleUpdated, ExceptionAdded, StatusChanged
  Consumes: —

JobManagement
  Owns: Job, Element, Task, Comments, ElementPrerequisites (v0.4.32)
  Publishes: JobCreated, ElementCreated, TaskAdded, ElementPrerequisiteUpdated, JobCompleted
  Consumes: Station/Provider references (by ID)

Assignment&Validation
  Owns: Schedule, TaskAssignment, Conflicts
  Publishes: TaskAssigned, ConflictDetected, ScheduleUpdated
  Consumes: StationEvents, TaskEvents, ElementEvents, ElementPrerequisiteEvents

SchedulingView
  Owns: Read Models, Snapshots
  Publishes: —
  Consumes: All events

BusinessCalendar
  Owns: OpenDay calculations
  Publishes: —
  Consumes: —

SharedKernel:
  Duration, TimeSlot, DateTime
```

---

## 10. Context Interaction Flow

1. **Station Setup Phase:**
   - Station Management publishes station/category/group events
   - Assignment & Validation subscribes to maintain availability state

2. **Job Planning Phase:**
   - Job Management creates jobs with elements and tasks
   - Job Management defines elements within jobs and assigns tasks to elements
   - Job Management publishes job/element/task events
   - Assignment & Validation subscribes to understand requirements (including element dependencies)

3. **Assignment Phase:**
   - Assignment & Validation validates and assigns tasks
   - Uses Business Calendar for outsourced task duration
   - Publishes assignment events

4. **View Generation Phase:**
   - Scheduling View consumes all events
   - Builds optimized read models for UI

---

This bounded context map ensures clear separation of concerns while maintaining necessary integration points through well-defined domain events.
