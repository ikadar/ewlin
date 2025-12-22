---
tags:
  - specification
  - ux-ui
  - testing
---

# Acceptance Criteria – Flux Scheduling UI

This file contains acceptance criteria for UI user stories in Given-When-Then format.

Each criterion is traceable to its parent user story via ID.

---

## Drag-Drop Interactions

### AC-UI-DRAG-001: New Task Placement
> **User Story:** [US-UI-DRAG-001](ui-interaction-stories.md#us-ui-drag-001)

#### AC-UI-DRAG-001.1
**Given** an unscheduled task tile in the sidebar
**When** the user starts dragging it
**Then** the tile should be draggable (cursor changes to grab)

#### AC-UI-DRAG-001.2
**Given** a dragged task tile from the sidebar
**When** the user drops it onto the correct station column
**Then** a new assignment should be created with the correct scheduledStart based on Y position

#### AC-UI-DRAG-001.3
**Given** a dragged task tile from the sidebar
**When** the user hovers over a non-matching station
**Then** the drop should not be allowed (no drop zone indicator)

#### AC-UI-DRAG-001.4
**Given** a successful drop from sidebar to station
**When** the drop completes
**Then** the assignment tile should appear on the grid at the drop position

#### AC-UI-DRAG-001.5
**Given** a task that has been dropped onto the grid
**When** the assignment is created
**Then** the task tile in the sidebar should show "scheduled" state

---

### AC-UI-DRAG-002: Tile Reschedule
> **User Story:** [US-UI-DRAG-002](ui-interaction-stories.md#us-ui-drag-002)

#### AC-UI-DRAG-002.1
**Given** a scheduled tile on the grid
**When** the user starts dragging it
**Then** the tile should be draggable

#### AC-UI-DRAG-002.2
**Given** a scheduled tile being dragged
**When** the user moves it upward (earlier time)
**Then** the drop position should show the new earlier time

#### AC-UI-DRAG-002.3
**Given** a scheduled tile being dragged
**When** the user moves it downward (later time)
**Then** the drop position should show the new later time

#### AC-UI-DRAG-002.4
**Given** a scheduled tile that has been moved
**When** the user drops it at a new position
**Then** the assignment's scheduledStart should be updated to the new time

#### AC-UI-DRAG-002.5
**Given** a scheduled tile being dragged
**When** the drag starts
**Then** a ghost placeholder should appear at the original position

---

### AC-UI-DRAG-003: Grid Snapping
> **User Story:** [US-UI-DRAG-003](ui-interaction-stories.md#us-ui-drag-003)

#### AC-UI-DRAG-003.1
**Given** a tile being dropped at an arbitrary Y position
**When** the drop completes
**Then** the scheduled time should snap to the nearest :00 or :30 boundary

#### AC-UI-DRAG-003.2
**Given** any drop operation
**When** the assignment is created or updated
**Then** the minutes component should always be 0 or 30

#### AC-UI-DRAG-003.3
**Given** a drop at 7:14
**When** the snapping algorithm runs
**Then** the time should snap to 7:00 (nearest boundary, not floor/ceil)

**Given** a drop at 7:16
**When** the snapping algorithm runs
**Then** the time should snap to 7:30 (nearest boundary)

---

### AC-UI-DRAG-004: Push-Down on Collision
> **User Story:** [US-UI-DRAG-004](ui-interaction-stories.md#us-ui-drag-004)

#### AC-UI-DRAG-004.1
**Given** a tile being dropped on a time slot occupied by another tile
**When** the drop completes
**Then** the existing tile should be pushed down to make room

#### AC-UI-DRAG-004.2
**Given** multiple consecutive tiles on a station
**When** a new tile is dropped on the first one
**Then** all subsequent tiles should be pushed down in sequence

#### AC-UI-DRAG-004.3
**Given** tiles being pushed down
**When** the push-down completes
**Then** the relative order of pushed tiles should be maintained

#### AC-UI-DRAG-004.4
**Given** tiles with precedence constraints
**When** push-down would violate a constraint
**Then** the push-down should respect precedence and adjust accordingly

---

### AC-UI-DRAG-005: Station Constraint
> **User Story:** [US-UI-DRAG-005](ui-interaction-stories.md#us-ui-drag-005)

#### AC-UI-DRAG-005.1
**Given** a task assigned to station A
**When** the user tries to drop it on station B
**Then** the drop should be rejected

#### AC-UI-DRAG-005.2
**Given** a task being dragged over the wrong station
**When** hovering
**Then** no drop zone indicator should appear

#### AC-UI-DRAG-005.3
**Given** a drop attempt on the wrong station
**When** the user releases
**Then** the drop should be ignored and tile returns to origin

---

## Validation

### AC-UI-VALID-001: Precedence Validation
> **User Story:** [US-UI-VALID-001](ui-interaction-stories.md#us-ui-valid-001)

#### AC-UI-VALID-001.1
**Given** Task B depends on Task A (precedence constraint)
**And** Task A ends at 8:30
**When** the user tries to schedule Task B before 8:30
**Then** the drop should be blocked or auto-snapped

#### AC-UI-VALID-001.2
**Given** a task with unfinished predecessor
**When** dropped before predecessor ends
**Then** the scheduledStart should auto-snap to after predecessor's end time

#### AC-UI-VALID-001.3
**Given** a task being dropped before its predecessor ends
**When** hovering over the invalid position
**Then** visual feedback should indicate precedence conflict (e.g., red indicator)

#### AC-UI-VALID-001.4
**Given** a task being dropped before its predecessor ends
**When** the user holds Alt key and drops
**Then** the precedence constraint should be bypassed

#### AC-UI-VALID-001.5
**Given** a bypassed precedence placement (via Alt+drop)
**When** the assignment is created
**Then** a PrecedenceConflict record should be created in the system

---

### AC-UI-VALID-002: Approval Gate Validation
> **User Story:** [US-UI-VALID-002](ui-interaction-stories.md#us-ui-valid-002)

#### AC-UI-VALID-002.1
**Given** a task without BAT approval
**When** the user tries to schedule it
**Then** the drop should be blocked (hard constraint)

#### AC-UI-VALID-002.2
**Given** a task with BAT approved
**When** the user tries to schedule it
**Then** the drop should be allowed

#### AC-UI-VALID-002.3
**Given** a task with Plates gate pending
**When** the user tries to schedule it
**Then** the drop should be allowed but show a warning (soft constraint)

#### AC-UI-VALID-002.4
**Given** a task with pending Plates gate being dropped
**When** hovering over valid drop zone
**Then** an orange warning indicator should be shown

---

## Visual Feedback

### AC-UI-VISUAL-001: Drag Visual Feedback
> **User Story:** [US-UI-VISUAL-001](ui-interaction-stories.md#us-ui-visual-001)

#### AC-UI-VISUAL-001.1
**Given** a tile being dragged over a valid drop zone
**When** hovering
**Then** a green ring should appear around the drop zone

#### AC-UI-VISUAL-001.2
**Given** a tile being dragged over an invalid drop zone
**When** hovering
**Then** a red ring should appear around the drop zone

#### AC-UI-VISUAL-001.3
**Given** a tile being dragged over a drop zone with soft constraint violation
**When** hovering
**Then** an orange ring should appear (warning-only)

#### AC-UI-VISUAL-001.4
**Given** a tile being dragged while holding Alt key
**And** the drop would violate precedence
**When** hovering
**Then** an amber ring should appear (bypass indicator)

#### AC-UI-VISUAL-001.5
**Given** a tile from Job A being dragged
**When** dragging over the grid
**Then** tiles from other jobs should be muted (desaturated)

---

### AC-UI-VISUAL-002: Tile Ghost
> **User Story:** [US-UI-VISUAL-002](ui-interaction-stories.md#us-ui-visual-002)

#### AC-UI-VISUAL-002.1
**Given** a scheduled tile
**When** the user starts dragging it
**Then** a ghost placeholder should appear at the original position

#### AC-UI-VISUAL-002.2
**Given** a ghost placeholder
**When** visible
**Then** it should have a dashed border style

#### AC-UI-VISUAL-002.3
**Given** a ghost placeholder visible during drag
**When** the user drops the tile
**Then** the ghost should disappear

---

### AC-UI-VISUAL-003: Drag Preview
> **User Story:** [US-UI-VISUAL-003](ui-interaction-stories.md#us-ui-visual-003)

#### AC-UI-VISUAL-003.1
**Given** a tile being dragged
**When** dragging
**Then** a drag preview showing the tile content should follow the cursor

#### AC-UI-VISUAL-003.2
**Given** a drag in progress
**When** the user moves the cursor
**Then** the preview should follow the cursor position

#### AC-UI-VISUAL-003.3
**Given** a user grabbing a tile at a specific point
**When** dragging
**Then** the preview should maintain the grab offset (not center on cursor)

---

## Tile Operations

### AC-UI-TILE-001: Swap Operations
> **User Story:** [US-UI-TILE-001](ui-interaction-stories.md#us-ui-tile-001)

#### AC-UI-TILE-001.1
**Given** two adjacent tiles on the same station
**When** the user clicks the swap-up button on the lower tile
**Then** the tiles should exchange positions

#### AC-UI-TILE-001.2
**Given** two adjacent tiles on the same station
**When** the user clicks the swap-down button on the upper tile
**Then** the tiles should exchange positions

#### AC-UI-TILE-001.3
**Given** the topmost tile on a station
**When** rendered
**Then** no swap-up button should be displayed

#### AC-UI-TILE-001.4
**Given** the bottommost tile on a station
**When** rendered
**Then** no swap-down button should be displayed

#### AC-UI-TILE-001.5
**Given** two tiles being swapped
**When** the swap completes
**Then** both tiles should maintain their original durations

---

### AC-UI-TILE-002: Tile Recall
> **User Story:** [US-UI-TILE-002](ui-interaction-stories.md#us-ui-tile-002)

#### AC-UI-TILE-002.1
**Given** a scheduled tile on the grid
**When** the user double-clicks on it
**Then** the tile should be removed from the grid

#### AC-UI-TILE-002.2
**Given** a tile that has been recalled
**When** the recall completes
**Then** the task should appear back in the sidebar as unscheduled

#### AC-UI-TILE-002.3
**Given** a tile that has been recalled
**When** the recall completes
**Then** the assignment should be deleted from the system

---

## Quick Placement

### AC-UI-QUICK-001: Quick Placement Mode
> **User Story:** [US-UI-QUICK-001](ui-interaction-stories.md#us-ui-quick-001)

#### AC-UI-QUICK-001.1
**Given** normal mode
**When** the user presses Alt+Q
**Then** quick placement mode should be activated

**Given** quick placement mode active
**When** the user presses Alt+Q
**Then** quick placement mode should be deactivated

#### AC-UI-QUICK-001.2
**Given** quick placement mode active
**And** a task selected in the sidebar
**When** the user clicks on a station column
**Then** the task should be placed at the clicked position

#### AC-UI-QUICK-001.3
**Given** quick placement mode active
**And** a task that can only go to station A
**When** viewing the grid
**Then** station B and other non-matching stations should be dimmed

#### AC-UI-QUICK-001.4
**Given** quick placement mode active
**When** the user presses Escape
**Then** quick placement mode should be deactivated

#### AC-UI-QUICK-001.5
**Given** quick placement mode active
**When** the user moves the cursor over a station
**Then** a placement indicator should show at the cursor position

---

## Edge Cases

### AC-UI-EDGE-001: Past Time Validation
> **User Story:** [US-UI-EDGE-001](ui-interaction-stories.md#us-ui-edge-001)

#### AC-UI-EDGE-001.1
**Given** a task being scheduled
**When** the user tries to drop it at a time in the past
**Then** the drop should be blocked

#### AC-UI-EDGE-001.2
**Given** a past time drop attempt
**When** validation runs
**Then** the drop should be rejected with appropriate feedback

---

### AC-UI-EDGE-002: Drag Cancel
> **User Story:** [US-UI-EDGE-002](ui-interaction-stories.md#us-ui-edge-002)

#### AC-UI-EDGE-002.1
**Given** a tile being dragged
**When** the user drops it outside any station column
**Then** the drag should be cancelled

#### AC-UI-EDGE-002.2
**Given** a cancelled drag operation
**When** the tile was being rescheduled
**Then** the tile should return to its original position

---

### AC-UI-EDGE-003: Overnight Tasks
> **User Story:** [US-UI-EDGE-003](ui-interaction-stories.md#us-ui-edge-003)

#### AC-UI-EDGE-003.1
**Given** a task scheduled at 22:00 with 4-hour duration
**When** the end time is calculated
**Then** the end time should be 02:00 the next day

#### AC-UI-EDGE-003.2
**Given** an overnight task
**When** rendered on the grid
**Then** the tile height should stretch across non-operating hours correctly

---

### AC-UI-EDGE-004: Push-Down Chain
> **User Story:** [US-UI-EDGE-004](ui-interaction-stories.md#us-ui-edge-004)

#### AC-UI-EDGE-004.1
**Given** three consecutive tiles: A, B, C
**When** a new tile X is dropped on A's position
**Then** all tiles (A, B, C) should be pushed down

#### AC-UI-EDGE-004.2
**Given** a push-down chain operation
**When** completed
**Then** the order should be: X, A, B, C (original order maintained)

---

## Test Coverage Matrix

| AC ID | E2E Test | Test File |
|-------|----------|-----------|
| AC-UI-DRAG-001.1 | `AC-01.1: Task tile in sidebar is draggable` | sidebar-drag.spec.ts |
| AC-UI-DRAG-001.2 | `AC-01.2: Drop creates new assignment` | sidebar-drag.spec.ts |
| AC-UI-DRAG-001.3 | `AC-01.3: Drop only allowed on matching station` | sidebar-drag.spec.ts |
| AC-UI-DRAG-001.4 | `AC-01.4: Assignment appears on grid` | sidebar-drag.spec.ts |
| AC-UI-DRAG-002.1 | `Tile can be dragged` | drag-drop.spec.ts |
| AC-UI-DRAG-002.2 | `Tile can be dragged up` | drag-drop.spec.ts |
| AC-UI-DRAG-002.3 | `Tile can be dragged down` | drag-drop.spec.ts |
| AC-UI-DRAG-003.1-3 | `Drop snaps to 30-minute boundary` | drag-drop.spec.ts |
| AC-UI-DRAG-004.1-4 | `Push-down tests` | push-down.spec.ts |
| AC-UI-VALID-001.1-3 | `Precedence validation tests` | precedence.spec.ts |
| AC-UI-VALID-002.1-4 | `Approval gate tests` | approval-gates.spec.ts |
| AC-UI-TILE-001.1-5 | `Swap operation tests` | swap.spec.ts |
| AC-UI-EDGE-002.1-2 | `Drag cancel tests` | edge-cases.spec.ts |
| AC-UI-EDGE-004.1-2 | `Push-down chain tests` | edge-cases.spec.ts |

---

## Pending Test Coverage

The following acceptance criteria do not yet have E2E test coverage:

| AC ID | Reason |
|-------|--------|
| AC-UI-DRAG-001.5 | Sidebar state change - needs implementation |
| AC-UI-DRAG-002.5 | Ghost placeholder - visual test pending |
| AC-UI-VALID-001.4-5 | Alt+bypass - feature not yet implemented |
| AC-UI-VISUAL-001.1-5 | Visual feedback - visual tests pending |
| AC-UI-VISUAL-002.1-3 | Tile ghost - visual tests pending |
| AC-UI-VISUAL-003.1-3 | Drag preview - visual tests pending |
| AC-UI-TILE-002.1-3 | Tile recall - needs implementation |
| AC-UI-QUICK-001.1-5 | Quick placement - feature not yet implemented |
| AC-UI-EDGE-001.1-2 | Past time validation - needs implementation |
| AC-UI-EDGE-003.1-2 | Overnight tasks - edge case not yet tested |
