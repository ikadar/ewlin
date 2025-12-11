# Service Boundaries – Operations Research System

This document defines the **service boundaries** for the Operations Research system that handles
Equipment → Operator → Job → Task assignments and validations.

The goal is to translate the domain model into concrete services with clear responsibilities 
and interaction patterns following the microservices architecture principles.

---

## 1. Services Overview

### 1.1 Resource Management Service

**Purpose:**  
Manage all resources (operators and equipment) including their properties, availability, and skills.

**Capabilities:**  
- Create and manage Operators with their availability schedules  
- Create and manage Equipment with supported task types  
- Manage operator skills and equipment competencies  
- Provide resource availability information to other services  
- Publish events when resource properties change  

**Inputs:**  
- Commands from external callers (e.g., "createOperator", "updateAvailability", "addSkill")  
- Queries for resource availability and capabilities

**Outputs:**  
- `OperatorCreated`, `OperatorUpdated` events  
- `EquipmentCreated`, `EquipmentUpdated` events  
- `AvailabilityChanged` event  
- Resource read models or API responses

**Ownership:**  
- Operator  
- Equipment  
- OperatorSkill  
- OperatorAvailability  
- EquipmentTaskType  

**External Dependencies:**  
- None (this is a foundational service)

**Reasons for Separation:**  
Resource management is a distinct concern from job planning and assignment validation. Resources have their 
own lifecycle independent of specific jobs or tasks. This service acts as the single source of truth for 
all resource-related data.

### 1.2 Job Management Service

**Purpose:**  
Handle the complete lifecycle of Jobs and their constituent Tasks, including dependencies.

**Capabilities:**  
- Create and manage Jobs with deadlines  
- Create and manage Tasks with their properties and dependencies  
- Validate task dependency graphs (DAG validation)  
- Calculate critical paths and job timelines  
- Publish events when job/task properties change  

**Inputs:**  
- Commands from external callers (e.g., "createJob", "addTask", "setTaskDependency")  
- Optional events from Assignment Service (e.g., assignment completion)

**Outputs:**  
- `JobCreated`, `JobUpdated` events  
- `TaskCreated`, `TaskUpdated` events  
- `TaskDependencyAdded` event  
- Job/Task read models or API responses

**Ownership:**  
- Job  
- Task  
- Task dependencies (required_tasks relationship)  

**External Dependencies:**  
- Reads resource types from Resource Management Service (for task type validation)  

**Reasons for Separation:**  
Job planning and task structuring is independent of resource availability and assignment. Jobs define 
WHAT needs to be done and in what order, while assignments determine WHO will do it and WHEN. This 
separation allows jobs to be planned before resources are assigned.

### 1.3 Assignment & Validation Service

**Purpose:**  
Manage task assignments, **schedule tasks with specific timings**, and validate them against all business rules and constraints.

**Capabilities:**  
- Assign operators and equipment to tasks  
- Validate assignments against multiple criteria:
  - Required resource types match task requirements
  - Operator has necessary skills for assigned equipment
  - No scheduling conflicts (operator/equipment double-booking)
  - Operator availability constraints are respected
  - Task dependencies are satisfied (prerequisite tasks completed)
  - Job deadlines can be met
- Calculate and update scheduled start/end times  
- Publish validation results and assignment events  

**Inputs:**  
- Assignment commands (e.g., "assignOperatorToTask", "scheduleTask")  
- `ResourceUpdated` events from Resource Management Service  
- `TaskUpdated` events from Job Management Service  

**Outputs:**  
- `TaskAssigned` event  
- `AssignmentValidated` event with validation results  
- `ScheduleUpdated` event  
- Assignment validation reports

**Ownership:**  
- Task assignments (assigned_operator_id, assigned_equipment_id)  
- Task scheduling (scheduled_start, scheduled_end)  
- Validation rules and logic  

**External Dependencies:**  
- Resource Management Service (for availability and skills data)  
- Job Management Service (for task requirements and dependencies)  

**Reasons for Separation:**  
Assignment and validation is a complex orchestration concern that bridges resources and jobs. It requires 
data from multiple sources and applies cross-cutting business rules. Keeping this logic separate prevents 
contaminating the core resource and job domains with scheduling complexity.

### 1.4 Scheduling View Service (Optional)

**Purpose:**  
Provide read-optimized views and queries for scheduling visualization and reporting.

**Capabilities:**  
- Maintain denormalized views of the complete schedule  
- Provide Gantt chart data  
- Calculate resource utilization metrics  
- Generate conflict reports  
- Support complex scheduling queries  

**Inputs:**  
- Events from all other services  
- Direct queries for reporting  

**Outputs:**  
- Read models optimized for UI consumption  
- Aggregated reports and metrics  

**Ownership:**  
- Read models and projections only (no source data)  

**External Dependencies:**  
- All other services (event consumption)  

**Reasons for Separation:**  
Read models often have different performance and structure requirements than command models. This service 
can optimize for query performance without affecting the consistency guarantees of the write models.

---

## 2. Interaction Between Services

### 2.1 Events and Integration

- **Resource Management → Assignment Service**
  - Events: `OperatorUpdated`, `AvailabilityChanged`, `SkillAdded`
  - Meaning: Resource properties have changed; existing assignments may need revalidation

- **Job Management → Assignment Service**
  - Events: `TaskCreated`, `TaskUpdated`, `DependencyAdded`
  - Meaning: Task requirements or structure has changed; assignments may need adjustment

- **Assignment Service → Scheduling View**
  - Events: `TaskAssigned`, `ScheduleUpdated`
  - Meaning: Assignment changes that need to be reflected in read models

Interactions favor **asynchronous domain events** for loose coupling, with synchronous 
queries only where immediate consistency is required (e.g., validation checks).

---

## 3. Service Boundary Principles

1. **Each service owns its data**
   - Resource Management owns all resource master data
   - Job Management owns job and task definitions
   - Assignment Service owns assignment and schedule data
   - No service directly modifies another's data

2. **Domain logic stays within boundaries**
   - Resource availability logic stays in Resource Management
   - Task dependency logic stays in Job Management  
   - Cross-cutting validation logic is centralized in Assignment Service

3. **Clear command/query separation**
   - Commands modify state within one service
   - Queries may aggregate data across services through dedicated read models

4. **Event-driven coordination**
   - Services react to events from others
   - No service embeds knowledge of another's internal processes

5. **Validation at the edges**
   - Each service validates its own invariants
   - Assignment Service validates cross-service invariants

---

## 4. Service Responsibilities Matrix

| Service | Owns | Listens to | Publishes |
|---------|------|------------|-----------|
| Resource Management | Operator, Equipment, Skills, Availability | — | OperatorUpdated, EquipmentUpdated, AvailabilityChanged |
| Job Management | Job, Task, Dependencies | AssignmentCompleted (optional) | JobCreated, TaskCreated, DependencyAdded |
| Assignment & Validation | Assignments, Schedules, Validation Rules | ResourceUpdated, TaskUpdated | TaskAssigned, ValidationFailed, ScheduleUpdated |
| Scheduling View | Read Models, Reports | All events | — |

---

## 5. External Clients

The services expose their functionality through APIs that are consumed by external clients:

### Primary Clients
- **Web Frontend (Vite + React + TypeScript)**
  - Uses all service APIs through REST/HTTP
  - Main consumer of Scheduling View Service for UI visualization
  - Initiates commands through API Gateway
  
- **Mobile Applications** (future)
  - Could consume same APIs with mobile-optimized responses
  
- **External Systems** (future)
  - Partner systems for data exchange
  - ERP/MES integrations

### Client Access Patterns
- All clients access services through unified API Gateway
- Authentication/Authorization handled at gateway level
- Frontend is completely decoupled from backend implementation
- No direct database access from any client

---

## 6. API Examples

### Resource Management Service
```
POST   /api/v1/operators              # Create operator
GET    /api/v1/operators/{id}/availability  # Get availability slots
POST   /api/v1/operators/{id}/skills        # Add skill
GET    /api/v1/equipment/by-task-type/{type} # Find compatible equipment
```

### Job Management Service
```
POST   /api/v1/jobs                   # Create job
POST   /api/v1/jobs/{id}/tasks        # Add task to job
POST   /api/v1/tasks/{id}/dependencies # Set task dependencies
GET    /api/v1/jobs/{id}/critical-path # Calculate critical path
```

### Assignment & Validation Service
```
POST   /api/v1/assignments            # Create assignment
POST   /api/v1/assignments/validate   # Validate assignment
GET    /api/v1/assignments/conflicts  # List scheduling conflicts
GET    /api/v1/tasks/{id}/available-resources # Get assignable resources
```

### Scheduling View Service (for Frontend)
```
GET    /api/v1/schedule/gantt         # Gantt chart data
GET    /api/v1/schedule/calendar      # Calendar view data
GET    /api/v1/utilization/operators  # Operator utilization metrics
GET    /api/v1/utilization/equipment  # Equipment utilization metrics
```

---

## 7. Data Flow Example

1. **Frontend user creates a Job** → API Gateway → Job Management Service
2. **Frontend user adds Tasks to Job** → API Gateway → Job Management Service  
3. **Frontend queries available resources** → API Gateway → Assignment Service → Resource Management Service
4. **Frontend assigns operator/equipment** → API Gateway → Assignment Service
5. **Assignment Service validates**:
   - Queries Resource Management for availability/skills
   - Queries Job Management for requirements/dependencies
   - Applies validation rules
   - Returns validation result
6. **If valid, assignment is saved** → Events published to all interested services
7. **Scheduling View updates** → Frontend fetches updated view data

---

## 8. Deployment Considerations

- Services can be deployed independently
- Each service has its own database/schema
- Event bus (e.g., RabbitMQ, Kafka) connects services
- API Gateway provides unified external interface
- Services can be scaled independently based on load

---

## 9. Migration Path

For initial development, services could be implemented as modules within a monolithic application:
1. Start with clear module boundaries
2. Use internal events/messages between modules  
3. Keep data models separate
4. Extract to microservices when scaling requires it

This approach provides the architectural benefits of service boundaries while avoiding the 
operational complexity of microservices during early development.
