---
tags:
  - specification
  - domain
---

# Domain Vocabulary – Flux Print Shop Scheduling System

This document defines the core domain terms used in the **print shop scheduling** domain for the Flux system.

---

## Station

- **Definition:** A physical machine or workstation in the print shop that performs specific types of tasks.
- **Notes:** Each station has a unique identifier, belongs to a station category, and is part of a station group. Stations have operating schedules that define when they are available.
- **Typical fields:** station id, name, category, group, capacity, operating schedule.
- **Capacity:** Most stations have capacity=1 (one task at a time). Outsourced providers have unlimited capacity.
- **Related terms:** StationCategory, StationGroup, Task, Assignment, OperatingSchedule.

---

## StationCategory

- **Definition:** A classification of stations that perform similar types of work and share potential time-saving characteristics.
- **Examples:** "Offset Printing Press", "Finishing", "Cutting", "Binding"
- **Notes:** Each category defines a list of similarity criteria that can reduce setup time between consecutive jobs.
- **Similarity Criteria Examples:**
  - Same paper type (fieldPath: "paperType")
  - Same paper size (fieldPath: "paperFormat")
  - Same paper weight (fieldPath: "paperWeight")
  - Same inking (fieldPath: "inking")
- **Related terms:** Station, SimilarityCriterion, TimeSavingSimilarity.

---

## SimilarityCriterion

- **Definition:** A single criterion used to compare consecutive jobs on the same station for potential time savings.
- **Fields:**
  - `code`: Unique identifier within category (lowercase, underscores)
  - `name`: Human-readable display name (e.g., "Same paper type")
  - `fieldPath`: Path to a Job property for comparison (e.g., "paperType")
- **Notes:** The criterion's `fieldPath` references a property on the Job entity. When comparing consecutive tasks, the system checks if the jobs' values at that fieldPath match.
- **Example:** A criterion with `fieldPath="paperType"` compares `job1.paperType` vs `job2.paperType`. If Job A has `paperType="CB 300g"` and Job B has `paperType="CB 135g"`, the criterion is NOT fulfilled (hollow circle).
- **Related terms:** StationCategory, TimeSavingSimilarity, Job.

---

## StationGroup

- **Definition:** A logical grouping of stations with a maximum number that can run simultaneously.
- **Notes:** All stations must belong to exactly one group. Groups enforce capacity constraints across the shop floor.
- **Examples:**
  - "Offset Presses" group with max 2 concurrent
  - "Finishing Stations" group with max 3 concurrent
- **Outsourced Providers:** Each provider is its own group with unlimited concurrent capacity.
- **Related terms:** Station, Capacity.

---

## OperatingSchedule

- **Definition:** A recurring weekly pattern defining when a station is available for work.
- **Notes:** Can include breaks and non-operating periods. Tasks that overlap non-operating times are stretched accordingly.
- **Example:** "Monday-Friday 00:00-05:00 and 06:00-00:00" (23 hours/day with 1-hour maintenance break)
- **Exceptions:** One-off schedule exceptions can override the recurring pattern (holidays, special closures).
- **Related terms:** Station, ScheduleException.

---

## ScheduleException

- **Definition:** A one-time override to a station's regular operating schedule.
- **Examples:** Holiday closures, special maintenance windows, extended operating hours for rush jobs.
- **Related terms:** OperatingSchedule, Station.

---

## OutsourcedProvider

- **Definition:** An external company that performs specific tasks outside the workshop.
- **Notes:** Modeled as a special type of station with unlimited capacity. Each provider is its own station group.
- **Typical fields:** provider id, name, supported action types, typical lead times.
- **Duration:** Measured in open days (business days), not minutes.
- **Related terms:** Task (outsourced), StationGroup.

---

## Job

- **Definition:** A complete print order consisting of one or more sequential tasks that must be completed by a deadline.
- **Notes:** Jobs have rich metadata specific to print production including client info, paper specifications, and approval gates.
- **Typical fields:**
  - `reference` – order reference (user-manipulated for order lines/parts)
  - `client` – customer name
  - `fullyScheduled` – boolean, true if all tasks are scheduled
  - `notes` – free-form comments
  - `description` – product description (e.g., "Cartes de voeux - 9,9 x 21 cm - off 350g - 350 ex")
  - `workshopExitDate` – date job MUST leave the factory
  - `paperPurchaseStatus` – enum: InStock / ToOrder / Ordered / Received
  - `paperOrderedAt` – timestamp when paper was ordered
  - `paperType` – paper type and weight (e.g., "CB300")
  - `paperFormat` – paper dimensions (e.g., "63x88")
  - `proofSentAt` – date proof (BAT) sent to client, or special values
  - `proofApprovedAt` – date proof approval received
  - `platesStatus` – approval gate: Todo / Done
  - `requiredJobs` – list of job references that must complete first
  - `comments` – thread of dated/authored messages
- **Status values:**
  - `Draft` – job is being defined
  - `Planned` – definition complete, ready for scheduling
  - `InProgress` – at least one task has started
  - `Delayed` – job at risk of missing deadline
  - `Completed` – all tasks finished
  - `Cancelled` – job was cancelled
- **Related terms:** Task, ApprovalGate, Comment.

---

## Task

- **Definition:** A specific production operation within a job, performed on a station or outsourced to a provider.
- **Notes:** Tasks are defined using a DSL syntax (see task-dsl-specification.md). Tasks follow a single straight sequence within a job.
- **Types:**
  - **Internal Task** – performed on a workshop station with setup and run times
  - **Outsourced Task** – performed by external provider with duration in open days
- **Typical fields (internal):** station, setup minutes, run minutes, comment
- **Typical fields (outsourced):** provider, action type, duration in open days, comment
- **Status values:**
  - `Defined` – task created, not yet ready
  - `Ready` – dependencies satisfied, can be scheduled
  - `Assigned` – scheduled with time slot
  - `Executing` – currently in progress
  - `Completed` – finished successfully
  - `Failed` – error during execution
  - `Cancelled` – cancelled (typically via job cancellation)
- **Related terms:** Job, Station, OutsourcedProvider, Assignment.

---

## TaskDSL

- **Definition:** A domain-specific language for quickly defining tasks within a job.
- **Syntax Examples:**
  - `[Komori] 20+40 "vernis"` – internal task with setup and run
  - `[Massicot] 15` – internal task with run only
  - `ST [Clément] Pelliculage 2JO` – outsourced task
- **Notes:** Parsed into structured data for backend storage. UI provides autocomplete and syntax highlighting.
- **Related terms:** Task, task-dsl-specification.md.

---

## Assignment

- **Definition:** The placement of a task onto a specific station at a specific time slot in the schedule.
- **Notes:** Represents when and where a task will be executed. In the UI, assignments are visualized as "tiles" on the scheduling grid.
- **Typical fields:** task reference, station, scheduled start, scheduled end.
- **Related terms:** Task, Station, Schedule, Tile.

---

## Tile

- **Definition:** The visual representation of an assignment on the scheduling grid UI.
- **Notes:** Tiles are dragged and dropped to create/modify assignments. Shows setup/run differentiation, job reference, time, and similarity indicators. In MVP, tasks spanning station downtime appear as a single continuous tile. When inserted between existing tiles on capacity-1 stations, subsequent tiles are pushed down automatically.
- **Visual elements:**
  - Setup/run duration sections
  - Job reference and description
  - Start/end time
  - Similarity circles (between consecutive tiles)
  - Job color (randomly assigned; dependent jobs use shades of same color)
  - Downtime overlay (distinct visual appearance for portions spanning station downtime)
  - Completion checkbox (manually toggled; does not affect precedence validation)
- **Related terms:** Assignment, SchedulingGrid.

---

## Schedule

- **Definition:** The time-based plan showing when each task will be executed on which station.
- **Notes:** Schedules can exist in multiple branches. Only one schedule can be designated as "PROD" at a time.
- **MVP:** Single schedule, no branching.
- **Future:** Schedule branching with create/duplicate/edit and PROD designation.
- **Related terms:** Assignment, Task, Station.

---

## ApprovalGate

- **Definition:** A checkpoint that must be cleared before production can proceed.
- **Instances:**
  - **BAT (Bon à Tirer)** – proof approval from client
    - `proofSentAt`: Date sent (or "AwaitingFile" / "NoProofRequired")
    - `proofApprovedAt`: Date approved
  - **Plates** – printing plates preparation
    - `platesStatus`: Todo / Done
- **Notes:** Tasks cannot proceed until their required approval gates are satisfied.
- **Related terms:** Job, Task.

---

## TimeSavingSimilarity

- **Definition:** A characteristic that, when shared between consecutive jobs on the same station, reduces setup time.
- **Examples for offset printing:**
  - Same paper type
  - Same paper size
  - Same paper weight
  - Same inking
- **Visual representation:** Filled or hollow circles displayed between consecutive tiles.
- **Comparison mechanism:** The system reads the `fieldPath` value from each consecutive job and compares them. If values match → filled circle; if not → hollow circle.
- **Notes:** MVP shows visual indicators only; no automatic optimization.
- **Related terms:** StationCategory, SimilarityCriterion, Tile.

---

## OpenDay (JO)

- **Definition:** A business day used for measuring outsourced task durations.
- **Calculation:**
  - Monday through Friday (MVP)
  - Excludes French public holidays (future)
- **Notation:** `2JO` means 2 open days.
- **Related terms:** OutsourcedProvider, Task (outsourced), LatestDepartureTime.

---

## LatestDepartureTime

- **Definition:** The latest time of day by which work must be sent to an outsourced provider for that day to count as the first business day of the lead time.
- **Example:** If LatestDepartureTime is 14:00 and an outsourced task is scheduled to start at 15:00 on Monday, the lead time (DurationOpenDays) starts counting from Tuesday, not Monday.
- **Notes:** This is about when the outsourced task starts, not about when the previous task completes.
- **Related terms:** OutsourcedProvider, Task (outsourced), OpenDay, ReceptionTime.

---

## ReceptionTime

- **Definition:** The time of day when completed work is received back from the outsourced provider after the lead time has elapsed.
- **Example:** If lead time is 2JO, work sent Monday before LatestDepartureTime will be received back on Wednesday at ReceptionTime.
- **Notes:** Used to calculate the actual end time of an outsourced task.
- **Related terms:** OutsourcedProvider, Task (outsourced), OpenDay, LatestDepartureTime.

---

## BusinessCalendar

- **Definition:** The calendar defining which days are open days (business days).
- **MVP:** Simple Monday-Friday calculation.
- **Future:** French public holidays, per-provider calendars.
- **Related terms:** OpenDay, OutsourcedProvider.

---

## Comment

- **Definition:** A dated, authored message attached to a job.
- **Notes:** Comments form a simple thread (MVP). Future may add reply/threading structure.
- **Typical fields:** author, timestamp, content.
- **Related terms:** Job.

---

## JobDependency

- **Definition:** A finish-to-start relationship indicating that one job must complete before another job can begin.
- **Notes:**
  - Job-level only (not task-level cross-job dependencies).
  - Strictly finish-to-start: the first task of the dependent job cannot start until the last task of all required jobs are completed.
  - No other dependency types (start-to-start, finish-to-finish) are supported.
- **Related terms:** Job, requiredJobs field.

---

## ScheduleConflict

- **Definition:** A situation where scheduling constraints are violated.
- **Types:**
  - `StationConflict` – station double-booked
  - `GroupCapacityConflict` – station group max concurrent exceeded
  - `PrecedenceConflict` – task scheduled before predecessor task completes
  - `ApprovalGateConflict` – approval gate not satisfied
  - `AvailabilityConflict` – task scheduled outside station operating hours
  - `DeadlineConflict` – task completion exceeds job workshop exit date
- **Related terms:** Schedule, Assignment, Validation.

---

## LateJob

- **Definition:** A job whose planned completion date exceeds its configured workshop exit date.
- **Notes:** Displayed prominently in the UI's right panel.
- **Related terms:** Job, workshopExitDate.

---

## SchedulingGrid

- **Definition:** The central UI component showing stations as columns and time as the vertical axis.
- **Notes:** Time flows downward. Station columns are ordered by configuration.
- **Key features:**
  - Drag-and-drop tile placement
  - Tile insertion pushes subsequent tiles down (no overlap on capacity-1 stations)
  - Visual unavailability overlay
  - Similarity indicators between tiles
  - 30-minute snap grid
  - Precedence violations allowed with visual warning (red halo)
- **Related terms:** Tile, Station, Assignment.

---

## StationTimeBlock

- **Definition:** An abstract concept representing any time period during which a station is occupied or unavailable.
- **Notes:** Both production work (TaskAssignment) and maintenance periods (MaintenanceBlock) are types of StationTimeBlock. This abstraction allows unified handling of station availability.
- **Subtypes:**
  - **TaskAssignment** – station occupied by production work
  - **MaintenanceBlock** – station occupied by scheduled maintenance
- **Related terms:** TaskAssignment, MaintenanceBlock, Station.

---

## MaintenanceBlock

- **Definition:** A scheduled maintenance period that blocks a station's availability.
- **Notes:** Conceptually similar to TaskAssignment (both represent "station occupied during time period"), but MaintenanceBlock is not associated with a Job or Task. Has station, duration, and optional reason, but no client, approval gates, or paper status.
- **Typical fields:** station, scheduled start, scheduled end, reason (optional), status.
- **MVP Status:** Post-MVP feature.
- **Related terms:** StationTimeBlock, TaskAssignment, Station, OperatingSchedule.
