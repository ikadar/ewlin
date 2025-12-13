---
tags:
  - specification
  - requirements
---

# Acceptance Criteria – Flux Print Shop Scheduling System

This file contains **acceptance criteria** for the print shop scheduling system.

Acceptance criteria define **exact conditions** that must be met for a user story or feature to be considered complete.

They are precise, testable, and implementation-agnostic.

---

## Station Management

### AC-STATION-001: Station Registration
> **References:** [US-STATION-001](user-stories.md#us-station-001), [BR-STATION-001](../domain-model/business-rules.md#br-station-001), [BR-STATION-002](../domain-model/business-rules.md#br-station-002), [BR-STATION-003](../domain-model/business-rules.md#br-station-003)

**Given** the user is on the station management screen
**When** they create a new station with name "Komori G37"
**Then** the station is created with a unique ID
**And** the station must have a category assigned
**And** the station must have a group assigned
**And** the station appears in the scheduling grid as a column

### AC-STATION-002: Operating Schedule Definition
> **References:** [US-STATION-002](user-stories.md#us-station-002), [BR-STATION-004](../domain-model/business-rules.md#br-station-004), [BR-STATION-005](../domain-model/business-rules.md#br-station-005)

**Given** a station exists
**When** the user defines operating hours as "Monday-Friday 06:00-00:00 and 00:00-05:00"
**Then** the station shows as available during those hours
**And** scheduling outside those hours is blocked
**And** tasks that span non-operating periods are stretched accordingly

### AC-STATION-003: Schedule Exception
> **References:** [US-STATION-003](user-stories.md#us-station-003), [BR-STATION-008](../domain-model/business-rules.md#br-station-008)

**Given** a station has a regular operating schedule
**When** the user adds an exception for "2025-12-25" as "Closed"
**Then** the station shows as unavailable for that entire day
**And** scheduled tasks on that day are flagged as conflicts

### AC-STATION-004: Station Category with Similarity Criteria
> **References:** [US-STATION-004](user-stories.md#us-station-004), [BR-CATEGORY-001](../domain-model/business-rules.md#br-category-001), [BR-CATEGORY-002](../domain-model/business-rules.md#br-category-002)

**Given** the user creates a category "Offset Printing Press"
**When** they add similarity criteria with fieldPaths:
  - {code: "paper_type", name: "Same paper type", fieldPath: "paperType"}
  - {code: "paper_size", name: "Same paper size", fieldPath: "paperFormat"}
  - {code: "inking", name: "Same inking", fieldPath: "inking"}
**Then** stations in this category show similarity indicators between consecutive tiles
**And** the number of circles matches the number of criteria (3)
**And** each criterion compares the Job's property at the specified fieldPath

### AC-STATION-006: Similarity Criterion Comparison
> **References:** [US-STATION-004](user-stories.md#us-station-004), [BR-CATEGORY-003](../domain-model/business-rules.md#br-category-003)

**Given** Job A has paperType="CB 300g" and Job B has paperType="CB 135g"
**And** a similarity criterion with fieldPath="paperType"
**When** tiles for Job A and Job B are consecutive on the same station
**Then** the circle for this criterion is hollow (○) indicating no match

### AC-STATION-005: Station Group Capacity
> **References:** [US-STATION-005](user-stories.md#us-station-005), [BR-GROUP-001](../domain-model/business-rules.md#br-group-001), [BR-GROUP-002](../domain-model/business-rules.md#br-group-002)

**Given** a station group "Offset Presses" with MaxConcurrent = 2
**When** 3 tasks are scheduled on stations in this group at the same time
**Then** the system detects a group capacity conflict
**And** the affected time slots are visually highlighted

---

## Outsourced Provider Management

### AC-PROVIDER-001: Provider Registration
> **References:** [US-PROVIDER-001](user-stories.md#us-provider-001), [BR-PROVIDER-001](../domain-model/business-rules.md#br-provider-001), [BR-PROVIDER-002](../domain-model/business-rules.md#br-provider-002)

**Given** the user registers provider "Clément" with action types ["Pelliculage", "Dorure"]
**Then** the provider is created with its own station group (unlimited capacity)
**And** the provider appears as a column in the scheduling grid

### AC-PROVIDER-002: Outsourced Task Duration
> **References:** [US-PROVIDER-002](user-stories.md#us-provider-002), [BR-TASK-009](../domain-model/business-rules.md#br-task-009), [CAL-001](../domain-model/business-rules.md#cal-001)

**Given** an outsourced task with duration "2JO" (2 open days)
**When** scheduled starting Friday before LatestDepartureTime
**Then** the scheduledEnd is Tuesday at ReceptionTime (skipping Saturday and Sunday)

### AC-PROVIDER-004: LatestDepartureTime Handling
> **References:** [US-PROVIDER-002](user-stories.md#us-provider-002), [BR-TASK-008](../domain-model/business-rules.md#br-task-008)

**Given** a provider with LatestDepartureTime = 14:00
**And** an outsourced task with duration "2JO"
**When** scheduled starting Monday at 15:00 (after LatestDepartureTime)
**Then** the effective start day is Tuesday
**And** the scheduledEnd is Thursday at ReceptionTime

### AC-PROVIDER-005: ReceptionTime Handling
> **References:** [US-PROVIDER-002](user-stories.md#us-provider-002), [BR-TASK-009](../domain-model/business-rules.md#br-task-009)

**Given** a provider with ReceptionTime = 09:00
**And** an outsourced task completing on Wednesday
**Then** the scheduledEnd time is Wednesday 09:00

### AC-PROVIDER-003: Unlimited Provider Capacity
> **References:** [US-PROVIDER-001](user-stories.md#us-provider-001), [BR-PROVIDER-003](../domain-model/business-rules.md#br-provider-003)

**Given** a provider with unlimited capacity
**When** multiple tasks are scheduled on the same time slot
**Then** no capacity conflict is detected
**And** the column splits into subcolumns to show overlapping tasks

---

## Job Management

### AC-JOB-001: Job Creation
> **References:** [US-JOB-001](user-stories.md#us-job-001), [BR-JOB-001](../domain-model/business-rules.md#br-job-001)

**Given** the user creates a job with reference "45113 A", client "Fibois Grand Est"
**And** workshop exit date "2025-12-15"
**Then** the job is created in Draft status
**And** the job appears in the left panel job list

### AC-JOB-002: Task DSL Parsing
> **References:** [US-JOB-002](user-stories.md#us-job-002), [BR-TASK-006](../domain-model/business-rules.md#br-task-006)

**Given** the user enters:
```
[Komori] 20+40 "vernis"
[Massicot] 15
ST [Clément] Pelliculage 2JO
```
**Then** 3 tasks are created:
- Task 1: Station=Komori, Setup=20, Run=40, Comment="vernis"
- Task 2: Station=Massicot, Setup=0, Run=15
- Task 3: Outsourced, Provider=Clément, ActionType=Pelliculage, Duration=2JO

### AC-JOB-003: DSL Autocomplete
> **References:** [US-JOB-002](user-stories.md#us-job-002)

**Given** the user types "[" in the task textarea
**Then** a dropdown appears with available station names
**Given** the user types "ST [" in the textarea
**Then** a dropdown appears with available provider names

### AC-JOB-004: DSL Validation Error
> **References:** [US-JOB-002](user-stories.md#us-job-002), [BR-TASK-006](../domain-model/business-rules.md#br-task-006)

**Given** the user enters "[UnknownStation] 20+40"
**Then** the line is highlighted as error
**And** error message shows "Station 'UnknownStation' not found"

### AC-JOB-004b: DSL Syntax Examples
> **References:** [US-JOB-002](user-stories.md#us-job-002), [BR-TASK-006](../domain-model/business-rules.md#br-task-006)

The following examples demonstrate valid and invalid DSL syntax:

**Internal Tasks (Station-based):**
```
[Komori] 60                    → Station=Komori, Setup=0, Run=60
[Komori] 20+40                 → Station=Komori, Setup=20, Run=40
[Komori] 20+40 "vernis"        → Station=Komori, Setup=20, Run=40, Comment="vernis"
[Heidelberg CD102] 30+90       → Station with spaces in name
[Massicot] 15                  → Simple cutting task
```

**Outsourced Tasks (Provider-based):**
```
ST [Clément] Pelliculage 2JO   → Provider=Clément, Action=Pelliculage, Duration=2 open days
ST [ArtDorure] Dorure 3JO      → Provider=ArtDorure, Action=Dorure, Duration=3 open days
ST [Reliure Express] Reliure 5JO "urgence"  → With comment
```

**Edge Cases:**
```
[Komori] 0+30                  → Zero setup time (valid)
[Komori] 30+0                  → INVALID: Run time cannot be zero
ST [Clément] Pelliculage 0JO   → INVALID: Duration cannot be zero
[Komori]60                     → INVALID: Space required before duration
ST[Clément] Pelliculage 2JO    → INVALID: Space required after ST
```

**Multi-line Examples:**
```
[Komori G37] 20+180 "tirage principal"
[Massicot] 15
ST [Clément] Pelliculage 2JO
[Plieuse] 45
[Massicot] 10 "coupe finale"
```

**Empty Lines and Comments:**
```
[Komori] 60

[Massicot] 15                  → Empty line is ignored

# This is a comment            → FUTURE: Comment lines (not yet supported)
```

**Error Recovery:**
```
[Komori] 20+40
[INVALID SYNTAX
[Massicot] 15                  → Parser continues, marks line 2 as error
```

### AC-JOB-005: Job Dependencies
> **References:** [US-JOB-004](user-stories.md#us-job-004), [BR-JOB-006](../domain-model/business-rules.md#br-job-006)

**Given** Job A exists and is completed
**When** the user sets Job B to require Job A
**Then** Job B's tasks cannot be scheduled until Job A is completed

### AC-JOB-006: Circular Dependency Prevention
> **References:** [US-JOB-004](user-stories.md#us-job-004), [BR-JOB-008](../domain-model/business-rules.md#br-job-008)

**Given** Job A requires Job B
**When** the user tries to set Job B to require Job A
**Then** the system rejects with error "Circular dependency detected"

### AC-JOB-007: Job Cancellation
> **References:** [US-JOB-006](user-stories.md#us-job-006), [BR-JOB-005](../domain-model/business-rules.md#br-job-005), [BR-JOB-010](../domain-model/business-rules.md#br-job-010)

**Given** a job with tasks scheduled in the past and future
**When** the user cancels the job
**Then** the job status changes to Cancelled
**And** all tasks status changes to Cancelled
**And** future task assignments are automatically recalled (removed from grid)
**And** past task assignments remain for historical reference

### AC-JOB-008: Job Color Assignment
> **References:** [US-JOB-001](user-stories.md#us-job-001), [BR-JOB-009](../domain-model/business-rules.md#br-job-009)

**Given** a new job is created
**Then** a random color is assigned from a predefined palette
**And** the color is stored in the job record
**And** all tiles for this job use this color

### AC-JOB-009: Dependent Job Color
> **References:** [US-JOB-004](user-stories.md#us-job-004), [BR-JOB-009](../domain-model/business-rules.md#br-job-009)

**Given** Job B is created with Job A as a dependency (requiredJobId)
**Then** Job B receives a shade of Job A's base color
**And** the color relationship is visually apparent on the grid

---

## Approval Gates

### AC-GATE-001: BAT Blocking
> **References:** [US-GATE-001](user-stories.md#us-gate-001), [BR-GATE-001](../domain-model/business-rules.md#br-gate-001)

**Given** a job with proofSentAt = null
**When** the user tries to schedule tasks
**Then** scheduling is blocked with message "Proof not sent"

### AC-GATE-002: BAT Bypass
> **References:** [US-GATE-001](user-stories.md#us-gate-001), [BR-GATE-001](../domain-model/business-rules.md#br-gate-001)

**Given** a job with proofSentAt = "NoProofRequired"
**Then** tasks can be scheduled without proof approval

### AC-GATE-003: Plates Blocking
> **References:** [US-GATE-002](user-stories.md#us-gate-002), [BR-GATE-002](../domain-model/business-rules.md#br-gate-002)

**Given** a job with platesStatus = "Todo"
**When** the user tries to schedule a printing task on an offset station
**Then** scheduling shows warning "Plates not ready"

### AC-GATE-004: Paper Status Timestamp
> **References:** [US-GATE-003](user-stories.md#us-gate-003), [BR-PAPER-002](../domain-model/business-rules.md#br-paper-002)

**Given** a job with paperPurchaseStatus = "ToOrder"
**When** the user changes status to "Ordered"
**Then** paperOrderedAt is automatically set to current timestamp

---

## Scheduling

### AC-SCHED-001: Vertical Time Axis
> **References:** [US-SCHED-001](user-stories.md#us-sched-001)

**Given** the scheduling grid is displayed
**Then** time flows vertically downward
**And** earlier times are at the top
**And** stations appear as columns

### AC-SCHED-002: Snap Grid
> **References:** [US-SCHED-001](user-stories.md#us-sched-001), [BR-ASSIGN-006](../domain-model/business-rules.md#br-assign-006)

**Given** the user drags a tile on the grid
**When** they release at any position
**Then** the tile snaps to the nearest 30-minute boundary

### AC-SCHED-003: Drag and Drop Assignment
> **References:** [US-SCHED-002](user-stories.md#us-sched-002), [BR-ASSIGN-001](../domain-model/business-rules.md#br-assign-001)

**Given** an unscheduled task in the left panel
**When** the user drags it to the grid at Komori column, 09:00
**Then** an assignment is created with scheduledStart = 09:00
**And** scheduledEnd = scheduledStart + task duration
**And** the tile appears on the grid

### AC-SCHED-004: Real-time Validation During Drag
> **References:** [US-SCHED-002](user-stories.md#us-sched-002), [VAL-001](../domain-model/business-rules.md#val-001)

**Given** the user is dragging a task over the grid
**Then** valid drop zones are highlighted
**And** invalid zones show a red indicator
**And** feedback updates in <10ms

### AC-SCHED-005: Precedence Safeguard
> **References:** [US-SCHED-002](user-stories.md#us-sched-002), [UI-001](../domain-model/business-rules.md#ui-001)

**Given** Task 2 must follow Task 1
**When** the user drags Task 2 to a time before Task 1's end
**Then** the drop snaps to the earliest valid time after Task 1

### AC-SCHED-006: Alt Key Bypass
> **References:** [US-SCHED-002](user-stories.md#us-sched-002), [UI-002](../domain-model/business-rules.md#ui-002)

**Given** the user holds Alt while dragging
**When** they drop a tile in a position that violates precedence
**Then** the drop is allowed
**And** the tile shows a red halo indicating violation

### AC-SCHED-007: Recall Tile
> **References:** [US-SCHED-004](user-stories.md#us-sched-004), [UI-004](../domain-model/business-rules.md#ui-004)

**Given** a task is scheduled (tile on grid)
**And** the same task appears faded in the left panel
**When** the user hovers over the faded tile
**Then** a "Recall" button appears
**When** the user clicks "Recall"
**Then** the assignment is removed
**And** the tile disappears from the grid
**And** the tile in the left panel becomes full opacity

### AC-SCHED-008: Selective Recall
> **References:** [US-SCHED-004](user-stories.md#us-sched-004)

**Given** tasks T1, T2, T3 are scheduled consecutively
**When** the user recalls T2
**Then** only T2 is unscheduled
**And** T1 and T3 remain scheduled in their positions

### AC-SCHED-009: Swap Tile Position
> **References:** [US-SCHED-005](user-stories.md#us-sched-005)

**Given** tiles A and B are consecutive on a station
**When** the user clicks the "swap down" button on tile A
**Then** tile A moves to B's position
**And** tile B moves to A's former position
**And** both scheduledStart/End are updated

### AC-SCHED-010: Task Completion Checkbox
> **References:** [US-SCHED-007](user-stories.md#us-sched-007), [BR-ASSIGN-007](../domain-model/business-rules.md#br-assign-007)

**Given** a task is scheduled and displayed as a tile on the grid
**Then** a completion checkbox appears on the tile
**When** the user checks the checkbox
**Then** IsCompleted is set to true
**And** CompletedAt is set to current timestamp
**And** the tile shows a completion indicator
**And** precedence validation is NOT affected by this action

### AC-SCHED-011: Completion Does Not Auto-Set
> **References:** [US-SCHED-007](user-stories.md#us-sched-007), [BR-ASSIGN-007](../domain-model/business-rules.md#br-assign-007)

**Given** a task is scheduled for a time in the past
**When** the current time passes the task's scheduledEnd
**Then** the task is NOT automatically marked as completed
**And** IsCompleted remains false until manually toggled

### AC-SCHED-012: Tile Insertion Push-Down (Capacity-1)
> **References:** [US-SCHED-002](user-stories.md#us-sched-002), [BR-ASSIGN-009](../domain-model/business-rules.md#br-assign-009)

**Given** tiles A and B are scheduled consecutively on a capacity-1 station
**When** the user drops a new tile C between A and B
**Then** tile C is inserted at the dropped position
**And** tile B (and all subsequent tiles) are pushed down (later in time)
**And** no tiles overlap on the station

### AC-SCHED-013: Tile Insertion Overlap (Capacity > 1)
> **References:** [US-SCHED-002](user-stories.md#us-sched-002), [BR-PROVIDER-003](../domain-model/business-rules.md#br-provider-003)

**Given** a provider with unlimited capacity
**When** the user schedules multiple tasks at the same time
**Then** tiles CAN overlap on the same column
**And** no push-down occurs

### AC-SCHED-014: MVP Validation Warnings Only
> **References:** [US-SCHED-002](user-stories.md#us-sched-002)

**Given** a scheduling operation would violate constraints
**Then** the system shows visual warnings (red halo, late jobs panel)
**But** the operation is NOT blocked (user can proceed)
**And** the user can create schedules with violations

---

## Conflict Detection

### AC-CONFLICT-001: Station Double-Booking
> **References:** [US-CONFLICT-001](user-stories.md#us-conflict-001), [BR-SCHED-001](../domain-model/business-rules.md#br-sched-001)

**Given** Task A is scheduled on Komori 09:00-10:00
**When** Task B is scheduled on Komori 09:30-10:30
**Then** a StationConflict is detected
**And** both tiles are highlighted
**And** conflict appears in right panel

### AC-CONFLICT-002: Group Capacity Exceeded
> **References:** [US-CONFLICT-002](user-stories.md#us-conflict-002), [BR-SCHED-002](../domain-model/business-rules.md#br-sched-002)

**Given** group "Offset Presses" has MaxConcurrent = 2
**And** Station1 and Station2 are in this group
**When** 3 tasks are scheduled simultaneously on these stations
**Then** a GroupCapacityConflict is detected
**And** the time slot is highlighted in yellow/orange

### AC-CONFLICT-003: Precedence Violation Visual
> **References:** [US-CONFLICT-003](user-stories.md#us-conflict-003), [UI-003](../domain-model/business-rules.md#ui-003)

**Given** Task 2 is scheduled before Task 1 (violating sequence)
**Then** Task 2's tile shows a red halo effect
**And** the violation appears in the right panel under "Precedence Violations"

### AC-CONFLICT-004: Late Job Detection
> **References:** [US-CONFLICT-004](user-stories.md#us-conflict-004), [BR-SCHED-005](../domain-model/business-rules.md#br-sched-005)

**Given** a job with workshopExitDate = 2025-12-15
**When** the last task is scheduled to complete on 2025-12-17
**Then** the job appears in the "Late Jobs" section of the right panel
**And** the delay amount (2 days) is displayed

---

## Station Unavailability

### AC-UNAVAIL-001: Visual Overlay
> **References:** [US-SCHED-006](user-stories.md#us-sched-006), [BR-STATION-008](../domain-model/business-rules.md#br-station-008)

**Given** a station is unavailable 12:00-13:00 (lunch break)
**Then** the time slot shows a gray hatched overlay

### AC-UNAVAIL-002: Task Stretching
> **References:** [US-SCHED-006](user-stories.md#us-sched-006), [BR-ASSIGN-003](../domain-model/business-rules.md#br-assign-003)

**Given** a 60-minute task starts at 11:30
**And** the station is unavailable 12:00-13:00
**Then** the tile stretches from 11:30 to 14:00 (30min + break + 30min)
**And** the unavailable portion has different visual appearance

---

## Similarity Indicators

### AC-SIM-001: Indicator Display
> **References:** [US-SIM-001](user-stories.md#us-sim-001), [BR-CATEGORY-001](../domain-model/business-rules.md#br-category-001)

**Given** category "Offset Printing Press" has 4 similarity criteria
**And** tiles A and B are consecutive on a station in this category
**When** Job A and Job B share 2 matching criteria
**Then** 2 filled circles and 2 hollow circles appear between the tiles

### AC-SIM-002: Indicator Position
> **References:** [US-SIM-001](user-stories.md#us-sim-001), [UI-005](../domain-model/business-rules.md#ui-005)

**Given** similarity circles between tiles A and B
**Then** the circles are positioned vertically between the tiles
**And** they overlap both tiles equally

---

## Navigation

### AC-NAV-001: Job Filter
> **References:** [US-NAV-001](user-stories.md#us-nav-001)

**Given** jobs with references "45113", "45114", "45200"
**When** the user types "451" in the filter
**Then** only "45113" and "45114" are shown
**And** "45200" is hidden

### AC-NAV-002: Jump to Date
> **References:** [US-NAV-002](user-stories.md#us-nav-002)

**Given** the current view shows December 10
**When** the user selects "December 20" from the dropdown
**Then** the grid scrolls to show December 20

### AC-NAV-003: Today Button
> **References:** [US-NAV-002](user-stories.md#us-nav-002)

**When** the user clicks the "Today" button
**Then** the grid scrolls to show the current date and time

---

## Job Creation Modal

### AC-MODAL-001: Required Fields
> **References:** [US-JOB-001](user-stories.md#us-job-001), [BR-JOB-001](../domain-model/business-rules.md#br-job-001)

**Given** the job creation modal is open
**When** the user tries to save without reference, client, description, or workshopExitDate
**Then** validation errors are shown for missing required fields

### AC-MODAL-002: DSL Textarea
> **References:** [US-JOB-002](user-stories.md#us-job-002)

**Given** the job creation modal is open
**Then** a textarea is shown for task definition
**And** it supports DSL syntax
**And** autocomplete activates on "[" and "ST ["

---

## Performance

### AC-PERF-001: Drag Feedback
> **References:** [VAL-001](../domain-model/business-rules.md#val-001)

**Given** the user is dragging a tile
**Then** validation feedback appears in <10ms

### AC-PERF-002: Grid Render
**Given** 100 tiles are scheduled
**Then** the grid renders in <100ms

### AC-PERF-003: Initial Load
**Given** a schedule with typical data
**Then** initial page load completes in <2s

---

## Reporting

### AC-REPORT-001: Job Task Status View
> **References:** [US-REPORT-001](user-stories.md#us-report-001)

**Given** a job is selected in the left panel
**When** the user views the job details
**Then** the right panel shows a list of all tasks in the job
**And** each task displays its current status (Defined, Ready, Assigned, Executing, Completed, Failed, Cancelled)
**And** each task displays its scheduled time (if assigned)
**And** unscheduled tasks are visually distinct from scheduled tasks

### AC-REPORT-002: Late Jobs Summary
> **References:** [US-REPORT-002](user-stories.md#us-report-002), [BR-SCHED-005](../domain-model/business-rules.md#br-sched-005)

**Given** there are jobs where the last task's scheduledEnd exceeds the job's workshopExitDate
**When** the user views the late jobs panel
**Then** a list of late jobs is displayed
**And** each entry shows the job reference, deadline, expected completion, and delay duration
**And** clicking a late job navigates to its details

---

## Schedule Management (Future)

### AC-BRANCH-001: Create Schedule Branch
> **References:** [US-BRANCH-001](user-stories.md#us-branch-001)

*Post-MVP Feature*

**Given** the user is viewing the current schedule
**When** they click the "Branch" button
**Then** a copy of the current schedule is created
**And** the user can provide a name and optional comments for the branch
**And** the new branch opens for editing independently

### AC-BRANCH-002: List and Open Schedule Branches
> **References:** [US-BRANCH-002](user-stories.md#us-branch-002)

*Post-MVP Feature*

**Given** multiple schedule branches exist
**When** the user opens the schedule list
**Then** all branches are displayed with their names and creation dates
**And** clicking a branch opens it for viewing/editing
**And** the user can create a new branch from any existing branch

### AC-BRANCH-003: Designate PROD Schedule
> **References:** [US-BRANCH-003](user-stories.md#us-branch-003)

*Post-MVP Feature*

**Given** multiple schedule branches exist
**When** the user designates a branch as "PROD"
**Then** that branch is marked as the official production schedule
**And** only one branch can be PROD at a time
**And** a visual indicator clearly shows which branch is PROD

---

This document defines the acceptance criteria that must be satisfied for the Flux print shop scheduling system features to be considered complete.
