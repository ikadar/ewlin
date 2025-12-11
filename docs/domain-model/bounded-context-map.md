# Bounded Context Map – Operations Research System

This document defines the major bounded contexts involved in the **Equipment → Operator → Job → Task** assignment and validation flow, and the relationships between them.

---

## 1. Resource Management Context

**Responsibilities:**
- Manage Operators and their availability schedules.
- Manage Equipment and supported task types.
- Track operator skills and competencies.
- Provide resource availability information.

**Owned Models:**
- `Operator`
- `OperatorId`
- `OperatorAvailability`
- `OperatorSkill`
- `Equipment`
- `EquipmentId`
- `EquipmentStatus`
- `TimeSlot` (shared kernel)

**Exposes:**
- `OperatorCreated` domain event
- `OperatorAvailabilityChanged` domain event
- `OperatorSkillAdded` domain event
- `EquipmentCreated` domain event
- `EquipmentStatusChanged` domain event

**Consumes:**
- None (foundational context).

---

## 2. Job Management Context

**Responsibilities:**
- Create and manage Jobs with deadlines.
- Define Tasks and their dependencies.
- Validate task dependency graphs (DAG).
- Calculate critical paths and timelines.

**Owned Models:**
- `Job`
- `JobId`
- `JobStatus`
- `Task`
- `TaskId`
- `TaskType`
- `TaskDependency`
- `Duration` (shared kernel)

**Exposes:**
- `JobCreated` domain event
- `TaskAddedToJob` domain event
- `TaskDependencySet` domain event
- `JobScheduled` domain event
- `JobCompleted` domain event

**Consumes:**
- `AssignmentCompleted` event from Assignment Context (optional).

---

## 3. Assignment & Validation Context

**Responsibilities:**
- Assign operators and equipment to tasks.
- **Schedule tasks with specific start/end times (core functionality).**
- Validate assignments against all constraints.
- Detect and report scheduling conflicts.
- Calculate and optimize task timings.

**Owned Models:**
- `Schedule`
- `ScheduleId`
- `TaskAssignment`
- `ScheduleConflict`
- `ValidationResult`

**Consumes:**
- `OperatorAvailabilityChanged` event from Resource Management Context.
- `OperatorSkillAdded` event from Resource Management Context.
- `EquipmentStatusChanged` event from Resource Management Context.
- `TaskAddedToJob` event from Job Management Context.
- `TaskDependencySet` event from Job Management Context.

**Exposes:**
- `TaskAssigned` domain event
- `AssignmentValidated` domain event
- `ConflictDetected` domain event
- `ScheduleUpdated` domain event
- `AssignmentCompleted` domain event

---

## 4. Scheduling View Context

**Responsibilities:**
- Provide read-optimized views for UI consumption.
- Generate Gantt charts and calendar views.
- Calculate utilization metrics.
- Support complex scheduling queries.

**Owned Models:**
- Read models and projections only
- `GanttView`
- `CalendarView`
- `UtilizationReport`

**Consumes:**
- All events from other contexts (event sourcing for read models).

**Exposes:**
- None (read-only context).

---

## 5. Shared Kernel

**Purpose:**
A small group of shared concepts used identically across contexts.

**Shared Models:**
- `Duration` (used in Job Management and Assignment contexts)
- `TimeSlot` (used in Resource Management and Assignment contexts)
- `DateTime` (standard time representation)

This shared kernel is intentionally minimal to avoid coupling.

---

## 6. Context Relationships Overview

### Resource Management → Assignment & Validation
- **Integration Pattern:** Published Language (Domain Events)
- **Events:** `OperatorAvailabilityChanged`, `OperatorSkillAdded`, `EquipmentStatusChanged`
- **Relationship Type:** Customer/Supplier  
  Resource Management is the supplier; Assignment & Validation is the customer.

### Job Management → Assignment & Validation
- **Integration Pattern:** Published Language (Domain Events)
- **Events:** `TaskAddedToJob`, `TaskDependencySet`
- **Relationship Type:** Customer/Supplier  
  Job Management is the supplier; Assignment & Validation is the customer.

### Assignment & Validation → Job Management
- **Integration Pattern:** Published Language (Domain Events)
- **Event:** `AssignmentCompleted` (optional feedback)
- **Relationship Type:** Customer/Supplier  
  Assignment & Validation is the supplier; Job Management is the customer.

### All Contexts → Scheduling View
- **Integration Pattern:** Published Language (Domain Events)
- **Relationship Type:** Customer/Supplier  
  All contexts are suppliers; Scheduling View is the customer.

---

## 7. Anti-Corruption Layers

### External System Integration
When integrating with external systems (ERP, MES, etc.), each bounded context should implement its own Anti-Corruption Layer (ACL) to:
- Translate external models to domain models
- Protect the domain from external changes
- Maintain domain purity

---

## 8. Text-Based Context Map

```
CONTEXT MAP:

ResourceManagement
  Owns: Operator, Equipment, Skills, Availability
  Publishes: OperatorCreated, AvailabilityChanged, SkillAdded, EquipmentStatusChanged
  Consumes: —

JobManagement
  Owns: Job, Task, Dependencies
  Publishes: JobCreated, TaskAdded, DependencySet, JobScheduled
  Consumes: AssignmentCompleted (optional)

Assignment&Validation
  Owns: Schedule, TaskAssignment, Conflicts
  Publishes: TaskAssigned, AssignmentValidated, ConflictDetected
  Consumes: OperatorAvailabilityChanged, TaskAdded, DependencySet

SchedulingView
  Owns: Read Models, Reports
  Publishes: —
  Consumes: All events

SharedKernel:
  Duration, TimeSlot, DateTime
```

---

## 9. Context Interaction Flow

1. **Resource Definition Phase:**
   - Resource Management publishes operator/equipment events
   - Assignment & Validation subscribes to maintain resource state

2. **Job Planning Phase:**
   - Job Management publishes job/task events
   - Assignment & Validation subscribes to understand requirements

3. **Assignment Phase:**
   - Assignment & Validation validates and assigns resources
   - Publishes assignment events

4. **View Generation Phase:**
   - Scheduling View consumes all events
   - Builds optimized read models for UI

---

This bounded context map ensures clear separation of concerns while maintaining necessary integration points through well-defined domain events.
