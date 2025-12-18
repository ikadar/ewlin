---
tags:
  - specification
  - ux-ui
  - requirements
---

# User Stories – Flux Scheduling UI

This file contains user stories for the scheduling UI interactions.

Each story follows the standard format:

> As a \<role>, I want \<capability>, so that \<outcome>.

---

## Drag-Drop Interactions

### New Task Placement
#### US-UI-DRAG-001
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md), [BR-ASSIGN-001](../../domain-model/business-rules.md#br-assign-001)

> As a **scheduler**, I want to **drag an unscheduled task from the sidebar and drop it onto a station column**, so that **I can quickly schedule new work**.

**Acceptance Criteria:**
- [ ] [AC-UI-DRAG-001.1](acceptance-criteria.md#ac-ui-drag-0011): Task tile in sidebar is draggable
- [ ] [AC-UI-DRAG-001.2](acceptance-criteria.md#ac-ui-drag-0012): Drop creates assignment with correct scheduledStart
- [ ] [AC-UI-DRAG-001.3](acceptance-criteria.md#ac-ui-drag-0013): Drop only allowed on matching station
- [ ] [AC-UI-DRAG-001.4](acceptance-criteria.md#ac-ui-drag-0014): Assignment appears on grid after drop
- [ ] [AC-UI-DRAG-001.5](acceptance-criteria.md#ac-ui-drag-0015): Task tile in sidebar becomes "scheduled" state

---

### Tile Reschedule
#### US-UI-DRAG-002
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md)

> As a **scheduler**, I want to **drag an existing tile up or down within its station column**, so that **I can change when a task is scheduled**.

**Acceptance Criteria:**
- [ ] [AC-UI-DRAG-002.1](acceptance-criteria.md#ac-ui-drag-0021): Scheduled tile is draggable
- [ ] [AC-UI-DRAG-002.2](acceptance-criteria.md#ac-ui-drag-0022): Tile can be dragged up (earlier time)
- [ ] [AC-UI-DRAG-002.3](acceptance-criteria.md#ac-ui-drag-0023): Tile can be dragged down (later time)
- [ ] [AC-UI-DRAG-002.4](acceptance-criteria.md#ac-ui-drag-0024): Assignment scheduledStart updates after drop
- [ ] [AC-UI-DRAG-002.5](acceptance-criteria.md#ac-ui-drag-0025): Ghost placeholder shows at original position during drag

---

### Grid Snapping
#### US-UI-DRAG-003
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md)

> As a **scheduler**, I want **drop positions to snap to 30-minute boundaries**, so that **the schedule is clean and predictable**.

**Acceptance Criteria:**
- [ ] [AC-UI-DRAG-003.1](acceptance-criteria.md#ac-ui-drag-0031): Drop at arbitrary position snaps to :00 or :30
- [ ] [AC-UI-DRAG-003.2](acceptance-criteria.md#ac-ui-drag-0032): Minutes are always 0 or 30 after drop
- [ ] [AC-UI-DRAG-003.3](acceptance-criteria.md#ac-ui-drag-0033): Snapping rounds to nearest (not floor/ceil)

---

### Push-Down on Collision
#### US-UI-DRAG-004
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md)

> As a **scheduler**, I want **overlapped tiles to be pushed down automatically**, so that **I can insert tasks without manual rearrangement**.

**Acceptance Criteria:**
- [ ] [AC-UI-DRAG-004.1](acceptance-criteria.md#ac-ui-drag-0041): Dropping on existing tile pushes it down
- [ ] [AC-UI-DRAG-004.2](acceptance-criteria.md#ac-ui-drag-0042): Multiple tiles can be pushed in sequence
- [ ] [AC-UI-DRAG-004.3](acceptance-criteria.md#ac-ui-drag-0043): Pushed tiles maintain their relative order
- [ ] [AC-UI-DRAG-004.4](acceptance-criteria.md#ac-ui-drag-0044): Push-down respects precedence constraints

---

### Station Constraint
#### US-UI-DRAG-005
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md), [BR-TASK-001](../../domain-model/business-rules.md#br-task-001)

> As a **scheduler**, I want **tiles to only drop on their assigned station**, so that **tasks are scheduled on the correct equipment**.

**Acceptance Criteria:**
- [ ] [AC-UI-DRAG-005.1](acceptance-criteria.md#ac-ui-drag-0051): Task can only be dropped on matching stationId
- [ ] [AC-UI-DRAG-005.2](acceptance-criteria.md#ac-ui-drag-0052): Hovering over wrong station shows no drop zone
- [ ] [AC-UI-DRAG-005.3](acceptance-criteria.md#ac-ui-drag-0053): Drop on wrong station is ignored

---

## Validation

### Precedence Validation
#### US-UI-VALID-001
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md), [BR-TASK-002](../../domain-model/business-rules.md#br-task-002)

> As a **scheduler**, I want **the system to prevent scheduling a task before its predecessor finishes**, so that **the production sequence is respected**.

**Acceptance Criteria:**
- [ ] [AC-UI-VALID-001.1](acceptance-criteria.md#ac-ui-valid-0011): Cannot drop second task before first task ends
- [ ] [AC-UI-VALID-001.2](acceptance-criteria.md#ac-ui-valid-0012): Auto-snap to after predecessor end time
- [ ] [AC-UI-VALID-001.3](acceptance-criteria.md#ac-ui-valid-0013): Visual feedback shows precedence conflict
- [ ] [AC-UI-VALID-001.4](acceptance-criteria.md#ac-ui-valid-0014): Alt+drop bypasses precedence constraint
- [ ] [AC-UI-VALID-001.5](acceptance-criteria.md#ac-ui-valid-0015): Bypassed placement creates PrecedenceConflict record

---

### Approval Gate Validation
#### US-UI-VALID-002
> **References:** [BR-GATE-001](../../domain-model/business-rules.md#br-gate-001), [BR-GATE-002](../../domain-model/business-rules.md#br-gate-002)

> As a **scheduler**, I want **the system to enforce approval gates (BAT/Plates)**, so that **tasks are not scheduled prematurely**.

**Acceptance Criteria:**
- [ ] [AC-UI-VALID-002.1](acceptance-criteria.md#ac-ui-valid-0021): Cannot schedule task without BAT approval
- [ ] [AC-UI-VALID-002.2](acceptance-criteria.md#ac-ui-valid-0022): Task with BAT approved is schedulable
- [ ] [AC-UI-VALID-002.3](acceptance-criteria.md#ac-ui-valid-0023): Plates gate is warning-only (non-blocking)
- [ ] [AC-UI-VALID-002.4](acceptance-criteria.md#ac-ui-valid-0024): Warning drop shows orange indicator

---

## Visual Feedback

### Drag Visual Feedback
#### US-UI-VISUAL-001
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md), [tile-states.md](../04-visual-feedback/tile-states.md)

> As a **scheduler**, I want **clear visual feedback during drag**, so that **I know whether a drop is valid**.

**Acceptance Criteria:**
- [ ] [AC-UI-VISUAL-001.1](acceptance-criteria.md#ac-ui-visual-0011): Valid drop zone shows green ring
- [ ] [AC-UI-VISUAL-001.2](acceptance-criteria.md#ac-ui-visual-0012): Invalid drop zone shows red ring
- [ ] [AC-UI-VISUAL-001.3](acceptance-criteria.md#ac-ui-visual-0013): Warning-only shows orange ring
- [ ] [AC-UI-VISUAL-001.4](acceptance-criteria.md#ac-ui-visual-0014): Alt+precedence bypass shows amber ring
- [ ] [AC-UI-VISUAL-001.5](acceptance-criteria.md#ac-ui-visual-0015): Non-target jobs are muted (desaturated)

---

### Tile Ghost
#### US-UI-VISUAL-002
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md)

> As a **scheduler**, I want **a ghost placeholder at the original position during drag**, so that **I can see where the tile came from**.

**Acceptance Criteria:**
- [ ] [AC-UI-VISUAL-002.1](acceptance-criteria.md#ac-ui-visual-0021): Ghost appears at original position on drag start
- [ ] [AC-UI-VISUAL-002.2](acceptance-criteria.md#ac-ui-visual-0022): Ghost has dashed border style
- [ ] [AC-UI-VISUAL-002.3](acceptance-criteria.md#ac-ui-visual-0023): Ghost disappears on drop

---

### Drag Preview
#### US-UI-VISUAL-003
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md)

> As a **scheduler**, I want **a drag preview that follows my cursor**, so that **I can see what I'm dragging**.

**Acceptance Criteria:**
- [ ] [AC-UI-VISUAL-003.1](acceptance-criteria.md#ac-ui-visual-0031): Drag preview shows tile content
- [ ] [AC-UI-VISUAL-003.2](acceptance-criteria.md#ac-ui-visual-0032): Preview follows cursor position
- [ ] [AC-UI-VISUAL-003.3](acceptance-criteria.md#ac-ui-visual-0033): Preview uses grab offset (not centered)

---

## Tile Operations

### Swap Operations
#### US-UI-TILE-001
> **References:** [tile-swap.md](../01-interaction-patterns/tile-swap.md)

> As a **scheduler**, I want to **swap adjacent tiles using buttons**, so that **I can reorder tasks without dragging**.

**Acceptance Criteria:**
- [ ] [AC-UI-TILE-001.1](acceptance-criteria.md#ac-ui-tile-0011): Swap up exchanges position with tile above
- [ ] [AC-UI-TILE-001.2](acceptance-criteria.md#ac-ui-tile-0012): Swap down exchanges position with tile below
- [ ] [AC-UI-TILE-001.3](acceptance-criteria.md#ac-ui-tile-0013): Top tile has no swap-up button
- [ ] [AC-UI-TILE-001.4](acceptance-criteria.md#ac-ui-tile-0014): Bottom tile has no swap-down button
- [ ] [AC-UI-TILE-001.5](acceptance-criteria.md#ac-ui-tile-0015): Swap maintains tile durations

---

### Tile Recall
#### US-UI-TILE-002
> **References:** [tile-recall.md](../01-interaction-patterns/tile-recall.md)

> As a **scheduler**, I want to **remove a tile from the schedule**, so that **I can unschedule a task**.

**Acceptance Criteria:**
- [ ] [AC-UI-TILE-002.1](acceptance-criteria.md#ac-ui-tile-0021): Double-click on tile removes it from grid
- [ ] [AC-UI-TILE-002.2](acceptance-criteria.md#ac-ui-tile-0022): Recalled tile appears back in sidebar
- [ ] [AC-UI-TILE-002.3](acceptance-criteria.md#ac-ui-tile-0023): Assignment is deleted

---

## Quick Placement

### Quick Placement Mode
#### US-UI-QUICK-001
> **References:** [quick-placement-mode.md](../01-interaction-patterns/quick-placement-mode.md)

> As a **scheduler**, I want to **toggle quick placement mode with Alt+Q**, so that **I can place tasks by clicking instead of dragging**.

**Acceptance Criteria:**
- [ ] [AC-UI-QUICK-001.1](acceptance-criteria.md#ac-ui-quick-0011): Alt+Q toggles quick placement mode
- [ ] [AC-UI-QUICK-001.2](acceptance-criteria.md#ac-ui-quick-0012): Clicking on station places next task
- [ ] [AC-UI-QUICK-001.3](acceptance-criteria.md#ac-ui-quick-0013): Unavailable stations are dimmed
- [ ] [AC-UI-QUICK-001.4](acceptance-criteria.md#ac-ui-quick-0014): Escape exits quick placement mode
- [ ] [AC-UI-QUICK-001.5](acceptance-criteria.md#ac-ui-quick-0015): Placement indicator shows at cursor position

---

## Edge Cases

### Past Time Validation
#### US-UI-EDGE-001
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md)

> As a **scheduler**, I want **the system to prevent scheduling in the past**, so that **I don't create invalid schedules**.

**Acceptance Criteria:**
- [ ] [AC-UI-EDGE-001.1](acceptance-criteria.md#ac-ui-edge-0011): Cannot schedule task in the past
- [ ] [AC-UI-EDGE-001.2](acceptance-criteria.md#ac-ui-edge-0012): Validation blocks past time drops

---

### Drag Cancel
#### US-UI-EDGE-002
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md)

> As a **scheduler**, I want **dragging outside station columns to cancel the drag**, so that **I can abort a placement**.

**Acceptance Criteria:**
- [ ] [AC-UI-EDGE-002.1](acceptance-criteria.md#ac-ui-edge-0021): Dropping outside any column cancels drag
- [ ] [AC-UI-EDGE-002.2](acceptance-criteria.md#ac-ui-edge-0022): Tile returns to original position

---

### Overnight Tasks
#### US-UI-EDGE-003
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md), [BR-STATION-005](../../domain-model/business-rules.md#br-station-005)

> As a **scheduler**, I want **tasks spanning midnight to display correctly**, so that **I can see the full duration**.

**Acceptance Criteria:**
- [ ] [AC-UI-EDGE-003.1](acceptance-criteria.md#ac-ui-edge-0031): Task spanning midnight calculates correct end time
- [ ] [AC-UI-EDGE-003.2](acceptance-criteria.md#ac-ui-edge-0032): Tile height stretches across non-operating hours

---

### Push-Down Chain
#### US-UI-EDGE-004
> **References:** [drag-drop.md](../01-interaction-patterns/drag-drop.md)

> As a **scheduler**, I want **push-down to cascade through multiple tiles**, so that **all subsequent tiles are moved**.

**Acceptance Criteria:**
- [ ] [AC-UI-EDGE-004.1](acceptance-criteria.md#ac-ui-edge-0041): Dropping on first tile pushes entire chain
- [ ] [AC-UI-EDGE-004.2](acceptance-criteria.md#ac-ui-edge-0042): All tiles in chain maintain order
