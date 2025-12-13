---
tags:
  - specification
  - requirements
---

# User Stories – Flux Print Shop Scheduling System

This file contains user stories for the print shop scheduling system.

Each story follows the standard format:

> As a \<role>, I want \<capability>, so that \<outcome>.

---

## Station Management

### Register a Station
#### US-STATION-001
> **References:** [BR-STATION-001](../domain-model/business-rules.md#br-station-001), [BR-STATION-002](../domain-model/business-rules.md#br-station-002), [BR-STATION-003](../domain-model/business-rules.md#br-station-003)

> As a **production manager**, I want to **register a new station** (e.g., Komori press, Massicot), so that **I can assign tasks to it**.

**Acceptance Criteria:**
- Station has a unique name
- Station belongs to a category
- Station belongs to a group
- Operating schedule can be defined

### Configure Station Operating Schedule
#### US-STATION-002
> **References:** [BR-STATION-004](../domain-model/business-rules.md#br-station-004), [BR-STATION-005](../domain-model/business-rules.md#br-station-005)

> As a **production manager**, I want to **define a station's weekly operating schedule**, so that **tasks are only scheduled during available hours**.

**Acceptance Criteria:**
- Can define time slots for each day of week
- System prevents scheduling outside operating hours
- Tasks overlapping non-operating periods are stretched appropriately

### Add Schedule Exception
#### US-STATION-003
> **References:** [BR-STATION-008](../domain-model/business-rules.md#br-station-008)

> As a **production manager**, I want to **add a one-off schedule exception** (holiday, special maintenance), so that **the schedule reflects reality**.

**Acceptance Criteria:**
- Can mark a date as closed
- Can define modified hours for a date
- Exception overrides regular schedule

### Configure Station Category
#### US-STATION-004
> **References:** [BR-CATEGORY-001](../domain-model/business-rules.md#br-category-001), [BR-CATEGORY-002](../domain-model/business-rules.md#br-category-002)

> As a **production manager**, I want to **create station categories with similarity criteria**, so that **I can see time-saving indicators between consecutive jobs**.

**Acceptance Criteria:**
- Category has a name
- Category has similarity criteria (e.g., same paper type, same paper size)
- Indicators appear between tiles on the scheduling grid

### Configure Station Group
#### US-STATION-005
> **References:** [BR-GROUP-001](../domain-model/business-rules.md#br-group-001), [BR-GROUP-002](../domain-model/business-rules.md#br-group-002)

> As a **production manager**, I want to **create station groups with concurrency limits**, so that **the system enforces capacity constraints**.

**Acceptance Criteria:**
- Group has a name
- Group has max concurrent value (or unlimited)
- System prevents exceeding group capacity

---

## Outsourced Provider Management

### Register an Outsourced Provider
#### US-PROVIDER-001
> **References:** [BR-PROVIDER-001](../domain-model/business-rules.md#br-provider-001), [BR-PROVIDER-002](../domain-model/business-rules.md#br-provider-002), [BR-PROVIDER-003](../domain-model/business-rules.md#br-provider-003)

> As a **production manager**, I want to **register an external provider** (e.g., Clément for pelliculage), so that **I can schedule outsourced tasks**.

**Acceptance Criteria:**
- Provider has a unique name
- Provider has supported action types
- Provider has unlimited capacity
- Provider appears as a column in the scheduling grid

### Schedule Outsourced Task
#### US-PROVIDER-002
> **References:** [BR-PROVIDER-004](../domain-model/business-rules.md#br-provider-004), [BR-TASK-008](../domain-model/business-rules.md#br-task-008), [BR-TASK-009](../domain-model/business-rules.md#br-task-009), [CAL-001](../domain-model/business-rules.md#cal-001)

> As a **scheduler**, I want to **assign a task to an outsourced provider**, so that **external work is tracked in my schedule**.

**Acceptance Criteria:**
- Task duration is specified in open days (JO)
- Multiple tasks can overlap on the same provider
- Calendar calculates end date using business days
- Latest departure time determines if current day counts as first business day
- Reception time determines when completed work returns from provider
- Outsourced tasks can only start on business days

---

## Job Management

### Create a New Job
#### US-JOB-001
> **References:** [BR-JOB-001](../domain-model/business-rules.md#br-job-001), [BR-JOB-002](../domain-model/business-rules.md#br-job-002), [BR-JOB-003](../domain-model/business-rules.md#br-job-003)

> As a **scheduler**, I want to **create a new print job**, so that **I can track an order through production**.

**Acceptance Criteria:**
- Job has reference, client, description
- Job has workshop exit date (deadline)
- Job can have paper specifications (type, format)
- Job starts in Draft status

### Define Tasks Using DSL
#### US-JOB-002
> **References:** [BR-TASK-006](../domain-model/business-rules.md#br-task-006)

> As a **scheduler**, I want to **define tasks using a simple text syntax**, so that **I can quickly enter action sequences**.

**Acceptance Criteria:**
- Textarea accepts DSL syntax
- Autocomplete suggests station names
- Syntax errors are highlighted
- Tasks are parsed into structured data

### Reorder Tasks
#### US-JOB-003
> **References:** [BR-TASK-003](../domain-model/business-rules.md#br-task-003)

> As a **scheduler**, I want to **reorder tasks within a job**, so that **the production sequence is correct**.

**Acceptance Criteria:**
- Tasks can be dragged to reorder
- Sequence order is saved
- Existing assignments are revalidated

### Set Job Dependencies
#### US-JOB-004
> **References:** [BR-JOB-006](../domain-model/business-rules.md#br-job-006), [BR-JOB-007](../domain-model/business-rules.md#br-job-007), [BR-JOB-008](../domain-model/business-rules.md#br-job-008)

> As a **scheduler**, I want to **specify that a job depends on another job**, so that **linked orders are processed in the right sequence**.

**Acceptance Criteria:**
- Can select required jobs from a list
- Circular dependencies are prevented
- Dependent job cannot start until prerequisites complete

### Add Comment to Job
#### US-JOB-005
> **References:** [COM-001](../domain-model/business-rules.md#com-001), [COM-002](../domain-model/business-rules.md#com-002)

> As a **production manager**, I want to **add timestamped comments to a job**, so that **communication is logged**.

**Acceptance Criteria:**
- Comment includes timestamp (MVP: author is anonymous; post-MVP: logged-in user)
- Comments are immutable
- Comments are displayed as a thread

### Cancel a Job
#### US-JOB-006
> **References:** [BR-JOB-005](../domain-model/business-rules.md#br-job-005), [BR-JOB-010](../domain-model/business-rules.md#br-job-010), [BR-JOB-010b](../domain-model/business-rules.md#br-job-010b)

> As a **scheduler**, I want to **cancel a job**, so that **it is removed from active scheduling**.

**Acceptance Criteria:**
- Job status changes to Cancelled
- Future task assignments are automatically recalled (removed)
- Past task assignments remain for historical reference
- All incomplete tasks are marked as Cancelled

---

## Approval Gates

### Track BAT (Proof) Approval
#### US-GATE-001
> **References:** [BR-GATE-001](../domain-model/business-rules.md#br-gate-001), [BR-GATE-003](../domain-model/business-rules.md#br-gate-003)

> As a **scheduler**, I want to **track proof approval status**, so that **I know when a job is ready for production**.

**Acceptance Criteria:**
- Can mark proof as "Awaiting File", "Sent", or "No Proof Required"
- Can record proof approval date
- Tasks are blocked until proof approved (or not required)

### Track Plates Approval
#### US-GATE-002
> **References:** [BR-GATE-002](../domain-model/business-rules.md#br-gate-002)

> As a **scheduler**, I want to **track plates preparation status**, so that **printing tasks wait for plates to be ready**.

**Acceptance Criteria:**
- Can mark plates as Todo or Done
- Printing tasks are blocked until plates Done

### Track Paper Procurement
#### US-GATE-003
> **References:** [BR-PAPER-001](../domain-model/business-rules.md#br-paper-001), [BR-PAPER-002](../domain-model/business-rules.md#br-paper-002), [BR-PAPER-003](../domain-model/business-rules.md#br-paper-003)

> As a **scheduler**, I want to **track paper purchase status**, so that **I know if material is available**.

**Acceptance Criteria:**
- Can set status: InStock, ToOrder, Ordered, Received
- System records timestamp when paper ordered
- Production tasks should wait for paper

---

## Scheduling

### View Scheduling Grid
#### US-SCHED-001
> **References:** [BR-ASSIGN-006](../domain-model/business-rules.md#br-assign-006)

> As a **scheduler**, I want to **see a grid with stations as columns and time as vertical axis**, so that **I have an overview of the schedule**.

**Acceptance Criteria:**
- Stations appear as columns
- Time flows downward
- Tiles represent scheduled tasks
- Grid snaps to 30-minute intervals

### Drag and Drop Assignment
#### US-SCHED-002
> **References:** [BR-ASSIGN-009](../domain-model/business-rules.md#br-assign-009), [UI-001](../domain-model/business-rules.md#ui-001), [UI-002](../domain-model/business-rules.md#ui-002), [VAL-001](../domain-model/business-rules.md#val-001)

> As a **scheduler**, I want to **drag a task from the job panel to the scheduling grid**, so that **I can assign it to a station and time slot**.

**Acceptance Criteria:**
- Dragging shows real-time validation feedback
- Drop creates assignment if valid
- Invalid drops show conflict information
- Tile appears on grid after successful drop
- On capacity-1 stations: inserting between tiles pushes subsequent tiles down
- On capacity > 1 stations: tiles can overlap up to capacity limit
- Precedence violations are allowed with visual warning (not blocked)

### Reschedule Task
#### US-SCHED-003
> **References:** [BR-ASSIGN-005](../domain-model/business-rules.md#br-assign-005)

> As a **scheduler**, I want to **drag a tile to a different position on the grid**, so that **I can adjust the schedule**.

**Acceptance Criteria:**
- Tile can be moved within same station (time change)
- Tile can be moved to different station
- Validation runs on new position

### Recall Tile
#### US-SCHED-004
> **References:** [UI-004](../domain-model/business-rules.md#ui-004)

> As a **scheduler**, I want to **recall a scheduled task back to unscheduled state**, so that **I can free up the time slot**.

**Acceptance Criteria:**
- Scheduled tasks appear faded in left panel
- "Recall" button appears on hover
- Recall removes assignment only for that task
- Sibling tasks remain scheduled

### Swap Tile Positions
#### US-SCHED-005
> **References:** [BR-SCHED-003](../domain-model/business-rules.md#br-sched-003)

> As a **scheduler**, I want to **swap a tile with an adjacent tile**, so that **I can quickly reorder without redragging**.

**Acceptance Criteria:**
- Tile has swap up/down shortcuts
- Swap validates constraints
- Both tiles update positions

### View Station Unavailability
#### US-SCHED-006
> **References:** [BR-ASSIGN-002](../domain-model/business-rules.md#br-assign-002), [BR-STATION-008](../domain-model/business-rules.md#br-station-008)

> As a **scheduler**, I want to **see when stations are unavailable**, so that **I avoid scheduling during those times**.

**Acceptance Criteria:**
- Unavailable periods shown as overlay
- Tiles stretch across unavailability
- Different visual appearance for unavailable portion

### Mark Task as Completed
#### US-SCHED-007
> **References:** [BR-ASSIGN-007](../domain-model/business-rules.md#br-assign-007), [BR-ASSIGN-008](../domain-model/business-rules.md#br-assign-008)

> As a **scheduler**, I want to **mark a scheduled task as completed via checkbox**, so that **I can track actual progress**.

**Acceptance Criteria:**
- Checkbox appears on each tile
- Completion is manually toggled (not automatic based on time)
- Completed tasks remain on grid for reference
- Completion status does NOT affect precedence validation
- Tasks in the past are NOT automatically marked as completed

---

## Conflict Detection

### Detect Station Conflicts
#### US-CONFLICT-001
> **References:** [BR-SCHED-001](../domain-model/business-rules.md#br-sched-001), [VAL-002](../domain-model/business-rules.md#val-002)

> As a **scheduler**, I want to **see when a station is double-booked**, so that **I can resolve the conflict**.

**Acceptance Criteria:**
- System detects overlapping assignments
- Conflict appears in conflicts list
- Affected tiles are highlighted

### Detect Group Capacity Conflicts
#### US-CONFLICT-002
> **References:** [BR-SCHED-002](../domain-model/business-rules.md#br-sched-002), [BR-GROUP-002](../domain-model/business-rules.md#br-group-002)

> As a **scheduler**, I want to **see when station group capacity is exceeded**, so that **I can reduce concurrent tasks**.

**Acceptance Criteria:**
- System tracks concurrent tasks per group
- Warning when max concurrent exceeded
- Affected time slots are highlighted

### Detect Precedence Violations
#### US-CONFLICT-003
> **References:** [BR-SCHED-003](../domain-model/business-rules.md#br-sched-003), [UI-001](../domain-model/business-rules.md#ui-001), [UI-003](../domain-model/business-rules.md#ui-003)

> As a **scheduler**, I want to **see when task sequence is violated**, so that **I can fix the order**.

**Acceptance Criteria:**
- Tiles violating precedence have red halo
- Precedence violations listed in right panel
- Drag-and-drop snaps to valid position (unless Alt held)

### View Late Jobs
#### US-CONFLICT-004
> **References:** [BR-SCHED-005](../domain-model/business-rules.md#br-sched-005), [BR-JOB-005b](../domain-model/business-rules.md#br-job-005b)

> As a **scheduler**, I want to **see jobs that will miss their deadline**, so that **I can prioritize them**.

**Acceptance Criteria:**
- Late jobs listed in right panel
- Shows job reference and delay amount
- Links to job details

---

## Navigation and Filtering

### Filter Jobs
#### US-NAV-001
> As a **scheduler**, I want to **filter jobs by reference, client, or description**, so that **I can find specific jobs quickly**.

**Acceptance Criteria:**
- Text input filters jobs list
- Filter updates in real-time
- Clear button resets filter

### Jump to Date
#### US-NAV-002
> As a **scheduler**, I want to **jump to a specific date/time on the grid**, so that **I can navigate to future or past schedules**.

**Acceptance Criteria:**
- Dropdown allows date/time selection
- Grid scrolls to selected time
- "Today" button jumps to current time

### Navigate Station Columns
#### US-NAV-003
> As a **scheduler**, I want to **navigate horizontally across station columns**, so that **I can see all stations**.

**Acceptance Criteria:**
- Horizontal scroll reveals more columns
- Keyboard shortcut for column navigation
- Column headers remain visible

---

## Similarity Indicators

### View Similarity Indicators
#### US-SIM-001
> **References:** [BR-CATEGORY-001](../domain-model/business-rules.md#br-category-001), [BR-CATEGORY-003](../domain-model/business-rules.md#br-category-003), [UI-005](../domain-model/business-rules.md#ui-005)

> As a **scheduler**, I want to **see which criteria match between consecutive jobs**, so that **I can optimize setup time**.

**Acceptance Criteria:**
- Circles appear between consecutive tiles
- Filled circle = matching criterion
- Hollow circle = non-matching criterion
- Number of circles = criteria in station category

---

## Schedule Management (Future)

### Create Schedule Branch
#### US-BRANCH-001
> As a **scheduler**, I want to **create a branch of the current schedule**, so that **I can experiment with changes**.

*Post-MVP Feature*

**Acceptance Criteria:**
- "Branch" button creates duplicate schedule
- New schedule has name and optional comments
- Can edit branch independently

### List and Open Schedules
#### US-BRANCH-002
> As a **scheduler**, I want to **see all schedule branches and open any of them**, so that **I can compare alternatives**.

*Post-MVP Feature*

**Acceptance Criteria:**
- Schedule list shows all branches
- Click opens schedule
- Can create branch from any schedule

### Designate PROD Schedule
#### US-BRANCH-003
> As a **production manager**, I want to **designate one schedule as PROD**, so that **everyone knows which is the official plan**.

*Post-MVP Feature*

**Acceptance Criteria:**
- Only one schedule can be PROD
- Dropdown to set PROD status
- Visual indicator for PROD schedule

---

## Reporting

### View Job Status
#### US-REPORT-001
> As a **production manager**, I want to **see the status of all tasks in a job**, so that **I can track progress**.

**Acceptance Criteria:**
- Right panel shows task list for selected job
- Each task shows status and scheduled time
- Unscheduled tasks are clearly marked

### View Late Jobs Summary
#### US-REPORT-002
> **References:** [BR-SCHED-005](../domain-model/business-rules.md#br-sched-005)

> As a **production manager**, I want to **see a summary of all late jobs**, so that **I can take action**.

**Acceptance Criteria:**
- Late jobs listed in right panel
- Shows deadline and expected completion
- Shows delay duration

---

## Performance

### Responsive Scheduling Interface
#### US-PERF-001
> **References:** [VAL-001](../domain-model/business-rules.md#val-001)

> As a **scheduler**, I want **the scheduling interface to respond quickly**, so that **I can work efficiently without waiting**.

**Acceptance Criteria:**
- Drag feedback appears in <10ms
- Grid renders in <100ms with 100 tiles
- Initial page load completes in <2s

---

This document contains the user stories for the Flux print shop scheduling system. Stories are prioritized with core scheduling functionality first, followed by supporting features.
