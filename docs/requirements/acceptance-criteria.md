# Acceptance Criteria – Operations Research System

This file contains **acceptance criteria** for the Equipment → Operator → Job → Task assignment and validation flow.

Acceptance criteria define **exact conditions** that must be met for a user story or feature to be considered complete.

They are precise, testable, and implementation‑agnostic.

---

## 1. Operator Management

### AC-OP-001 – Register new operator
- Production manager can enter operator name and unique identifier.
- System validates operator name is not duplicate.
- Manager can define initial availability slots with start/end times.
- Manager can assign equipment skills with proficiency levels (beginner/intermediate/expert).
- On successful creation:
  - Operator is saved with status `Active`.
  - Unique operator ID is generated.
  - Confirmation message is shown.

### AC-OP-002 – Update operator availability
- Operator can view current availability slots in chronological order.
- Operator can add new availability periods:
  - Start time must be before end time.
  - No overlap with existing slots allowed.
- Operator can remove future availability slots.
- On successful update:
  - Changes are persisted immediately.
  - Affected task assignments are flagged for revalidation.
  - Timestamp of change is recorded.

### AC-OP-003 – Add equipment certification
- Training coordinator can select operator from active operators list.
- Coordinator can select equipment from available equipment.
- Skill level must be specified (beginner/intermediate/expert).
- On successful certification:
  - Skill is added to operator profile.
  - Certification date is recorded.
  - Operator immediately eligible for relevant task types.
  - Skill history is maintained for audit.

---

## 2. Equipment Management

### AC-EQ-001 – Register new equipment
- Operations manager can enter equipment name and identifier.
- Manager must specify at least one supported task type.
- Equipment location can be optionally recorded.
- On successful creation:
  - Equipment is saved with status `Available`.
  - Unique equipment ID is generated.
  - Equipment appears in assignment options immediately.

### AC-EQ-002 – Schedule equipment maintenance
- Maintenance planner can select equipment and maintenance window.
- System displays conflicting task assignments if any.
- Planner must confirm rescheduling of affected tasks.
- On successful scheduling:
  - Equipment status changes to `Maintenance` for the period.
  - Affected tasks are marked for reassignment.
  - Notifications sent to affected operators.
  - Maintenance record is created.

### AC-EQ-003 – Report equipment breakdown
- Operator can select currently assigned equipment.
- Breakdown reason/description is optional.
- On successful reporting:
  - Equipment status immediately changes to `OutOfService`.
  - Current task is marked as `Failed`.
  - System suggests alternative equipment if available.
  - Maintenance team is notified within 5 minutes.

---

## 3. Job Planning

### AC-JOB-001 – Create production job
- Production planner can enter job name (required).
- Planner must specify deadline date and time.
- Job description is optional.
- On successful creation:
  - Job is saved with status `Draft`.
  - Unique job ID is auto-generated.
  - Job appears in planning dashboard.
  - Creation timestamp is recorded.

### AC-JOB-002 – Add tasks to job
- Planner can add multiple tasks to a job in `Draft` status.
- Each task requires:
  - Task type (from predefined list).
  - Duration in minutes (positive integer).
  - Operator requirement (yes/no).
  - Equipment requirement (yes/no).
- On successful addition:
  - Tasks are saved with unique IDs.
  - Task count is updated on job.
  - Tasks appear in job detail view.

### AC-JOB-003 – Define task dependencies
- Planner can link tasks within same job.
- System prevents circular dependencies.
- Multiple dependencies per task allowed.
- On successful dependency creation:
  - Dependency graph is updated.
  - Critical path is recalculated.
  - DAG validation passes.
  - Visual dependency graph is available.

---

## 4. Scheduling Grid Interface

> **Reference:** See [scheduling-ui-design.md](scheduling-ui-design.md) for full UI specifications.

### AC-GRID-001 – Equipment grid view
- Grid displays with time on X-axis and equipment on Y-axis.
- All scheduled tasks appear as colored blocks on their assigned equipment row.
- Each task block displays: task name, job reference, assigned operator name.
- Equipment rows show current status (Available/InUse/Maintenance/OutOfService).
- Maintenance windows appear as distinct visual blocks (gray/striped).
- Time scale options: 15min, 30min, 1hr, 4hr granularity.
- View range options: Day, Week, Month.
- "Today" marker is clearly visible.
- Grid loads in < 500ms with up to 500 visible tasks.

### AC-GRID-002 – Operator grid view
- Grid displays with time on X-axis and operators on Y-axis.
- All scheduled tasks appear as colored blocks on their assigned operator row.
- Each task block displays: task name, assigned equipment.
- Operator availability is visible (open slots vs. unavailable periods).
- Operator status and skill badges are shown in row header.
- Toggle between Equipment and Operator views in < 300ms.

### AC-GRID-003 – Drag task from unassigned list
- Unassigned tasks panel is visible alongside the grid.
- Panel shows: task name, job, duration, resource requirements, deadline.
- Dragging a task from panel shows ghost element following cursor.
- Valid drop zones (compatible equipment rows) are highlighted green.
- Invalid drop zones (incompatible or conflicting) are highlighted red.
- Dropping on valid zone creates assignment immediately.
- System validates: equipment compatibility, availability, dependencies.
- If task requires operator: assignment dialog opens after drop.
- Validation feedback appears within 200ms of drop.

### AC-GRID-004 – Move task on grid
- Clicking and dragging a task block initiates move.
- Horizontal drag preview shows new start/end time.
- Vertical drag preview shows new equipment assignment.
- Dependency constraints shown (earliest start time indicator).
- Conflicts highlighted in real-time during drag.
- Releasing completes the move if valid.
- Pressing Escape cancels the move.
- Ctrl+Z undoes the last move.
- Option to cascade-move dependent tasks is available.

### AC-GRID-005 – Resize task
- Resize handles appear on task block edges on hover.
- Dragging left edge changes start time.
- Dragging right edge changes end time/duration.
- Minimum duration enforced (visual feedback if too small).
- Validation during resize: no overlap, deadline compliance.
- Duration change updates task definition.

### AC-GRID-006 – Task interaction
- Single click selects task (visual highlight).
- Double click opens task detail panel.
- Right-click opens context menu with:
  - Edit Details
  - Change Operator
  - Change Equipment
  - Unassign
  - View Job
  - View Dependencies
- Detail panel shows: job info, schedule, resources, dependencies.
- Can edit assignment from detail panel.

### AC-GRID-007 – Conflict visualization and resolution
- Tasks with conflicts have red border.
- Conflict icon appears on task block.
- Clicking conflict opens resolution panel.
- Panel shows:
  - Conflict type (ResourceConflict, AvailabilityConflict, etc.)
  - Affected resources and time period.
  - Up to 3 suggested resolutions.
- Each suggestion can be applied with one click.
- Manual resolution option available.

### AC-GRID-008 – Multi-select operations
- Ctrl+Click adds/removes task from selection.
- Drag creates selection rectangle on empty area.
- Ctrl+A selects all visible tasks.
- Selected tasks have distinct visual state.
- Bulk move: dragging selection moves all by same offset.
- Bulk unassign: menu option removes all from schedule.
- Bulk actions require confirmation for > 5 tasks.

### AC-GRID-009 – Filtering and search
- Filter dropdown for: Job, Equipment type, Operator, Task status.
- Search box for: task name, job name, operator name.
- Filters apply instantly (< 100ms).
- Active filters shown as chips/badges.
- Filter preset can be saved and named.
- "Clear all" button resets all filters.

### AC-GRID-010 – Real-time updates
- Schedule changes from other users appear within 2 seconds.
- Changed tasks flash briefly to indicate update.
- Notification appears if currently selected task was modified.
- Concurrent edit conflict shows warning dialog.
- "Refresh" option available to force sync.

### AC-GRID-011 – Keyboard navigation
- Arrow keys navigate between tasks.
- Enter opens task details.
- Delete unassigns selected task.
- Ctrl+Z / Ctrl+Y for undo/redo.
- ? shows keyboard shortcuts help.
- Tab moves focus through interactive elements.

### AC-GRID-012 – Performance requirements
- Initial load: < 500ms
- Drag start response: < 50ms
- Validation feedback: < 200ms
- View toggle: < 300ms
- Scroll/pan: 60 FPS
- Supports 500+ visible tasks without degradation.

---

## 5. Assignment & Validation

### AC-ASSIGN-001 – Assign operator to task
- Scheduler sees only operators with required skills.
- Operator availability for task duration is displayed.
- Conflicts are highlighted in red before confirmation.
- On successful assignment:
  - Operator is linked to task.
  - Operator's schedule is updated.
  - Task state changes to `Assigned`.
  - Operator receives notification.

### AC-ASSIGN-002 – Assign equipment to task
- Only equipment supporting task type is shown.
- Equipment availability status is clearly visible.
- Current equipment location is displayed.
- On successful assignment:
  - Equipment is linked to task.
  - Equipment schedule is blocked for task duration.
  - Conflicts are prevented by validation.

### AC-ASSIGN-003 – Validate complete schedule
- Scheduler can trigger validation with single action.
- System checks all assignments in < 5 seconds.
- Validation report includes:
  - Resource conflicts count and details.
  - Availability violations.
  - Dependency violations.
  - Deadline risks.
- Report can be exported as PDF or CSV.

---

## 6. Execution Monitoring

### AC-EXEC-001 – View my task assignments
- Operator sees personal task list for next 7 days by default.
- Each task shows:
  - Task name and job reference.
  - Scheduled start/end time.
  - Required equipment and location.
  - Dependencies status.
- View is mobile-responsive.
- Operator can acknowledge assignments.

### AC-EXEC-002 – Mark task as started
- Operator can start task within ±15 minutes of scheduled time.
- Early/late start requires reason selection.
- On successful start:
  - Task status changes to `Executing`.
  - Actual start time is recorded.
  - Job progress percentage updates.
  - Dependent tasks are notified.

### AC-EXEC-003 – Complete task
- Operator can mark executing task as complete.
- Completion requires confirmation.
- Optional quality checkpoints can be recorded.
- On successful completion:
  - Task status changes to `Completed`.
  - Actual end time is recorded.
  - Duration variance is calculated.
  - Dependent tasks become `Ready`.

---

## 7. Schedule Management

### AC-SCHED-001 – Handle scheduling conflicts
- Conflicts are detected within 2 seconds of change.
- System suggests up to 3 alternative assignments.
- Impact analysis shows:
  - Number of affected tasks.
  - Deadline impact assessment.
  - Resource utilization changes.
- Bulk reassignment supports up to 20 tasks at once.

### AC-SCHED-002 – View resource utilization
- Manager can view utilization for any date range.
- Report shows:
  - Operator utilization percentage.
  - Equipment utilization percentage.
  - Overtime hours highlighted.
  - Idle time identification.
- Data refreshes every 5 minutes.
- Export supports Excel and PDF formats.

### AC-SCHED-003 – Reschedule delayed job
- Scheduler can adjust task timings by drag-drop.
- System recalculates all dependencies in real-time.
- New conflicts are highlighted immediately.
- On successful rescheduling:
  - All affected tasks are updated.
  - Notifications sent to affected operators.
  - Audit trail records changes.
  - New timeline is locked.

---

## 8. Reporting & Analytics

### AC-REPORT-001 – Generate schedule Gantt chart
- Manager can generate Gantt for any date range.
- Chart displays:
  - All jobs and tasks in timeline.
  - Dependencies as connecting lines.
  - Resource assignments by color.
  - Critical path in red highlight.
- Chart supports zoom and pan.
- Export formats include PNG, PDF, SVG.

### AC-REPORT-002 – Track job completion status
- CSR can search jobs by ID or customer reference.
- Status display includes:
  - Current completion percentage.
  - Estimated completion time.
  - Delay reasons if any.
  - Last update timestamp.
- Status refreshes every 30 seconds.
- History shows last 10 status changes.

### AC-REPORT-003 – Analyze schedule performance
- Director can view KPIs for any period.
- Metrics include:
  - On-time completion rate by job type.
  - Schedule vs actual variance (mean/median).
  - Resource utilization trends.
  - Top 5 bottleneck resources.
- Data can be filtered by multiple criteria.
- Dashboard refreshes daily at midnight.

---

This document should be refined based on specific implementation requirements and technical constraints.
