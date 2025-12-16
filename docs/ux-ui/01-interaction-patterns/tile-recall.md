# Tile Recall

Removing a scheduled tile from the grid (unassigning a task).

---

## Overview

"Recall" removes a task assignment, returning the task to unscheduled state. The tile disappears from the grid and becomes available for re-placement.

---

## Methods

### From Task List (Job Details Panel)

Placed tiles appear with **lower opacity** in the task list.

| Action | Result |
|--------|--------|
| **Single-click** | Scrolls grid to tile's position (tile appears ~20vh from top) |
| **Double-click** | Recalls the tile (removes from schedule) |
| **Hover** | Shows two buttons: "Jump to" and "Recall" |

### Button Actions (on hover)

| Button | Action | Equivalent |
|--------|--------|------------|
| "Jump to" | Scroll to tile | Single-click |
| "Recall" | Remove from schedule | Double-click |

**Rationale:** Buttons provide discoverability for new users; click shortcuts provide speed for power users.

---

## Visual States in Task List

| State | Appearance |
|-------|------------|
| Unscheduled | Full opacity, draggable |
| Scheduled (placed) | Lower opacity, hover shows buttons |

---

## Selective Recall

Recalling a tile affects **only that specific task**:

- Sibling tasks remain scheduled
- Surrounding tiles on the station do not move (gaps may appear)

### Example

Tasks T1, T2, T3 scheduled consecutively:

```
Before recall:          After recalling T2:

+---------+             +---------+
|   T1    |             |   T1    |
+---------+             +---------+
+---------+
|   T2    |  <-- recall       (gap)
+---------+
+---------+             +---------+
|   T3    |             |   T3    |
+---------+             +---------+
```

T1 and T3 remain in their positions. T2 returns to unscheduled state in the task list.

---

## After Recall

- Task status changes from `Assigned` to `Ready`
- Tile disappears from grid
- Tile in task list returns to full opacity
- Station time slot is freed

---

## Related Documents

- [Job Details Panel](../05-components/job-details-panel.md) — Task list component
- [Tile States](../04-visual-feedback/tile-states.md) — Visual state definitions
