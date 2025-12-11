# User Stories – Operations Research System

This file contains user stories for the Equipment → Operator → Job → Task assignment and validation flow.

Each story follows the standard format:

> As a \<role>, I want \<capability>, so that \<outcome>.

---

## 1. Operator Management

### US-OP-001 – Register new operator
**As a** production manager  
**I want** to register a new operator in the system  
**So that** they can be assigned to tasks once properly trained and available.

**Acceptance criteria:**
- Manager can enter operator name and basic information
- Manager can define initial availability schedule
- Manager can assign equipment skills with proficiency levels
- System validates no duplicate operator names
- Operator is created in Active status by default

---

### US-OP-002 – Update operator availability
**As an** operator  
**I want** to update my availability schedule  
**So that** I'm only assigned to tasks when I'm actually available to work.

**Acceptance criteria:**
- Operator can view current availability slots
- Operator can add new availability periods
- Operator can remove future availability (with notice period)
- System prevents overlapping availability periods
- Changes trigger re-validation of affected assignments

---

### US-OP-003 – Add equipment certification
**As a** training coordinator  
**I want** to certify an operator for new equipment  
**So that** they can be assigned to more types of tasks.

**Acceptance criteria:**
- Coordinator can select operator and equipment
- Skill level can be set (beginner/intermediate/expert)
- Certification date is recorded
- Operator immediately becomes eligible for relevant tasks
- Historical skill progression is maintained

---

## 2. Equipment Management

### US-EQ-001 – Register new equipment
**As an** operations manager  
**I want** to add new equipment to the system  
**So that** it can be assigned to production tasks.

**Acceptance criteria:**
- Manager can enter equipment name and identifier
- Manager can specify supported task types
- Equipment location can be recorded
- Initial status is set to Available
- Equipment appears in assignment options immediately

---

### US-EQ-002 – Schedule equipment maintenance
**As a** maintenance planner  
**I want** to schedule preventive maintenance for equipment  
**So that** production planning knows when equipment is unavailable.

**Acceptance criteria:**
- Planner can select equipment and maintenance window
- System checks for conflicting assignments
- Affected tasks are flagged for reassignment
- Maintenance history is tracked
- Notifications sent to affected operators

---

### US-EQ-003 – Report equipment breakdown
**As an** operator  
**I want** to report equipment failure during operation  
**So that** repairs can be scheduled and tasks can be reassigned.

**Acceptance criteria:**
- Operator can quickly flag equipment as broken
- Current task is marked as interrupted
- Equipment status changes to OutOfService
- Maintenance team is notified
- System suggests alternative equipment if available

---

## 3. Job Planning

### US-JOB-001 – Create production job
**As a** production planner  
**I want** to create a new job with deadline  
**So that** work can be scheduled and tracked to completion.

**Acceptance criteria:**
- Planner can enter job name and description
- Deadline must be specified
- Job starts in Draft status
- Job ID is generated automatically
- Job appears in planning dashboard

---

### US-JOB-002 – Add tasks to job
**As a** production planner  
**I want** to add tasks to a job  
**So that** all required work steps are defined.

**Acceptance criteria:**
- Planner can add multiple tasks to a job
- Each task has type, duration, and resource requirements
- Task order/dependencies can be specified
- System validates task types are valid
- Duration must be positive

---

### US-JOB-003 – Define task dependencies
**As a** production planner  
**I want** to specify task dependencies  
**So that** work is performed in the correct sequence.

**Acceptance criteria:**
- Planner can link tasks in predecessor/successor relationships
- Multiple dependencies per task are allowed
- System prevents circular dependencies
- Dependency graph is visualized
- Critical path is calculated automatically

---

## 4. Scheduling Grid Interface

> **Note:** The Scheduling Grid is the **primary interface** for production scheduling. See [scheduling-ui-design.md](scheduling-ui-design.md) for detailed UI specifications.

### US-GRID-001 – View equipment scheduling grid
**As a** production scheduler
**I want** to see a time × equipment grid showing all scheduled tasks
**So that** I can visualize equipment utilization and plan assignments effectively.

**Acceptance criteria:**
- Grid displays equipment as rows (Y-axis) and time as columns (X-axis)
- Each scheduled task appears as a block on the appropriate equipment row
- Task blocks show: task name, job reference, assigned operator
- Equipment status is visible (Available/InUse/Maintenance/OutOfService)
- Maintenance windows are visually distinct (grayed/striped)
- Time scale is configurable (15min/30min/1hr/4hr granularity)
- Grid supports Day/Week/Month views
- Can navigate to specific dates quickly

---

### US-GRID-002 – View operator scheduling grid
**As a** production scheduler
**I want** to see a time × operator grid showing all operator assignments
**So that** I can balance workload and see operator utilization.

**Acceptance criteria:**
- Grid displays operators as rows (Y-axis) and time as columns (X-axis)
- Each assigned task appears as a block on the appropriate operator row
- Task blocks show: task name, assigned equipment
- Operator availability is visible (available slots vs. unavailable periods)
- Operator status and skill badges are visible
- Can switch between Equipment and Operator views easily

---

### US-GRID-003 – Drag task to schedule
**As a** production scheduler
**I want** to drag an unassigned task onto the scheduling grid
**So that** I can quickly schedule tasks to specific equipment and time slots.

**Acceptance criteria:**
- Unassigned tasks panel is visible alongside the grid
- Tasks can be dragged from the panel onto the grid
- Valid drop zones are highlighted during drag (compatible equipment)
- Invalid zones are marked red (incompatible or conflicting)
- Dropping a task creates an assignment at the target time/equipment
- If task requires operator, operator assignment dialog opens after drop
- Real-time validation occurs during drag (before drop)

---

### US-GRID-004 – Move scheduled task
**As a** production scheduler
**I want** to drag a scheduled task to a different time or equipment
**So that** I can adjust the schedule as priorities change.

**Acceptance criteria:**
- Horizontal drag changes the scheduled time
- Vertical drag changes the assigned equipment
- Dependency constraints are shown during drag (earliest possible start)
- Conflicts are highlighted in real-time during drag
- Movement can be cancelled by pressing Escape
- Undo is available after move (Ctrl+Z)
- Option to cascade-move dependent tasks

---

### US-GRID-005 – Resize task duration
**As a** production scheduler
**I want** to resize a task block by dragging its edge
**So that** I can adjust task duration directly on the grid.

**Acceptance criteria:**
- Task blocks have resize handles on left/right edges
- Dragging the edge changes the task duration
- System validates: no overlap with next task, deadline compliance
- Minimum duration is enforced (cannot resize below minimum)
- Duration change updates the task definition

---

### US-GRID-006 – View task details from grid
**As a** production scheduler
**I want** to click on a task block to see its details
**So that** I can review and modify assignment details.

**Acceptance criteria:**
- Single click selects the task (highlights it)
- Double click or Enter opens task detail panel
- Right-click opens context menu with quick actions
- Task detail panel shows: job info, schedule, resources, dependencies
- Can edit assignment from the detail panel
- Can navigate to parent job from the panel

---

### US-GRID-007 – Resolve scheduling conflicts
**As a** production scheduler
**I want** to see and resolve conflicts directly on the grid
**So that** I can fix issues without leaving the scheduling interface.

**Acceptance criteria:**
- Conflicting tasks are visually marked (red border)
- Clicking a conflict opens conflict resolution panel
- Panel shows conflict type and affected resources
- System suggests resolutions (alternative times, equipment, operators)
- One-click to apply suggested resolution
- Manual resolution option available

---

### US-GRID-008 – Multi-select and bulk operations
**As a** production scheduler
**I want** to select multiple tasks and perform bulk operations
**So that** I can make large schedule changes efficiently.

**Acceptance criteria:**
- Ctrl+Click adds/removes tasks from selection
- Drag to create selection rectangle
- Ctrl+A selects all visible tasks
- Bulk move: drag selection to shift all tasks by same offset
- Bulk unassign: remove all selected from schedule
- Bulk delete (with confirmation)

---

### US-GRID-009 – Filter and search the grid
**As a** production scheduler
**I want** to filter the grid by various criteria
**So that** I can focus on specific jobs, equipment, or time periods.

**Acceptance criteria:**
- Filter by: Job, Equipment type, Operator, Task status
- Search by: Task name, Job name, Operator name
- Filters apply instantly without page reload
- Active filters are clearly indicated
- Can save filter presets
- Clear all filters with one action

---

### US-GRID-010 – Real-time schedule updates
**As a** production scheduler
**I want** to see schedule changes from other users in real-time
**So that** I always work with the latest information.

**Acceptance criteria:**
- Changes by other users appear within 2 seconds
- Visual indicator when external change occurs
- Notification if viewing a task that was modified
- Conflict detection considers real-time state
- Version conflict handling when editing same task

---

## 5. Assignment & Validation

### US-ASSIGN-001 – Assign operator to task
**As a** production scheduler
**I want** to assign qualified operators to tasks
**So that** work can be executed on schedule.

**Acceptance criteria:**
- Scheduler sees only qualified operators for each task
- Operator availability is clearly shown
- Conflicts are highlighted before confirmation
- Assignment can be saved as tentative or confirmed
- Operator receives notification of assignment

---

### US-ASSIGN-002 – Assign equipment to task
**As a** production scheduler
**I want** to assign compatible equipment to tasks
**So that** operators have the required tools to complete work.

**Acceptance criteria:**
- Only equipment supporting task type is shown
- Equipment availability is displayed
- Current location/status is visible
- Conflicts prevent assignment
- Equipment schedule is updated immediately

---

### US-ASSIGN-003 – Validate complete schedule
**As a** production scheduler
**I want** to validate all assignments before publishing
**So that** I can fix conflicts before they impact production.

**Acceptance criteria:**
- Single action validates entire schedule
- All constraint violations are listed
- Conflicts are categorized by type
- Suggestions provided where possible
- Validation results can be exported

---

## 6. Execution Monitoring

### US-EXEC-001 – View my task assignments
**As an** operator  
**I want** to see my assigned tasks  
**So that** I know what work to perform and when.

**Acceptance criteria:**
- Operator sees personal task calendar
- Task details include equipment and location
- Dependencies and deadlines are shown
- Mobile-friendly view available
- Can acknowledge task assignments

---

### US-EXEC-002 – Mark task as started
**As an** operator  
**I want** to mark a task as started  
**So that** actual progress is tracked against the plan.

**Acceptance criteria:**
- Operator can start task at scheduled time
- Early/late starts are allowed with reason
- System records actual start time
- Task status updates to Executing
- Dependencies are checked

---

### US-EXEC-003 – Complete task
**As an** operator  
**I want** to mark a task as completed  
**So that** dependent tasks can proceed and progress is tracked.

**Acceptance criteria:**
- Operator can mark task complete
- Actual duration is recorded
- Quality checkpoints can be confirmed
- Dependent tasks become Ready
- Job progress is updated automatically

---

## 7. Schedule Management

### US-SCHED-001 – Handle scheduling conflicts
**As a** production scheduler  
**I want** to resolve scheduling conflicts  
**So that** production continues with minimal disruption.

**Acceptance criteria:**
- Conflicts are detected automatically
- Alternative assignments are suggested
- Impact analysis shows affected tasks
- Bulk reassignment is possible
- Resolution history is tracked

---

### US-SCHED-002 – View resource utilization
**As a** production manager  
**I want** to see resource utilization reports  
**So that** I can optimize capacity and identify bottlenecks.

**Acceptance criteria:**
- Utilization shown by operator and equipment
- Time period is configurable
- Underutilized resources are highlighted
- Overtime usage is tracked
- Reports can be exported

---

### US-SCHED-003 – Reschedule delayed job
**As a** production scheduler  
**I want** to reschedule a delayed job  
**So that** we can still meet customer commitments.

**Acceptance criteria:**
- Scheduler can adjust task timings
- System recalculates dependencies
- New conflicts are identified
- Deadline impact is shown
- Affected operators are notified

---

## 8. Reporting & Analytics

### US-REPORT-001 – Generate schedule Gantt chart
**As a** production manager  
**I want** to view schedules as Gantt charts  
**So that** I can visualize workload and dependencies.

**Acceptance criteria:**
- Gantt shows all jobs and tasks
- Dependencies are visualized
- Resource assignments are color-coded
- Critical path is highlighted
- Chart can be filtered and exported

---

### US-REPORT-002 – Track job completion status
**As a** customer service representative  
**I want** to check job completion status  
**So that** I can update customers on their orders.

**Acceptance criteria:**
- Rep can search jobs by ID or customer
- Current status and progress percentage shown
- Estimated completion is calculated
- Delay reasons are visible
- History of status changes available

---

### US-REPORT-003 – Analyze schedule performance
**As an** operations director  
**I want** to analyze scheduling KPIs  
**So that** I can improve planning accuracy and efficiency.

**Acceptance criteria:**
- On-time completion rate by job type
- Average schedule vs actual variance
- Resource utilization trends
- Bottleneck identification
- Exportable dashboard data

---

These user stories cover the main user journeys in the Operations Research system and should be refined based on specific implementation requirements.
