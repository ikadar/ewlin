# Quick Placement Mode

A toggle mode for fast, keyboard-driven tile placement optimized for backward scheduling.

---

## Overview

Quick Placement Mode accelerates the backward scheduling workflow by allowing rapid tile placement with minimal mouse movement.

---

## Activation

| Action | Result |
|--------|--------|
| Keyboard shortcut (TBD) | Toggle mode ON |
| Same shortcut | Toggle mode OFF |
| ESC key | Exit mode |

**Prerequisite:** A job must be selected in the left panel.

---

## Behavior When Active

### Placement Indicator

- **Mouse cursor:** Moves freely (no snapping)
- **Placement indicator:** A separate visual element that follows the cursor
- **Snapping:** Indicator magnetizes to the nearest gap between existing tiles
- Shows exactly where the tile will be placed on click

### Tooltip

A tooltip near the cursor displays:
- **Task available:** Name/info of the task that will be placed
- **No task available:** Visual indicator (e.g., "No task for this station")

### Click to Place

- Click places the indicated task at the snapped position
- Task appears on the grid immediately
- Validation runs (same as drag-drop)

---

## Task Selection Logic

The system automatically selects which task to place based on:

1. **Station context:** Which column the cursor is over
2. **Sequence order:** The last unscheduled task (highest sequence number) for that station
3. **Availability rule:** Task is only available if its immediate successor is already placed (or has no successor)

### Example

Job has: Task 1 (Komori) → Task 2 (Massicot) → Task 3 (Komori) → Task 4 (Massicot) → Task 5 (Komori)

Backward placement order:
1. Hover Komori → Task 5 available (no successor) → place it
2. Hover Massicot → Task 4 available (Task 5 placed) → place it
3. Hover Komori → Task 3 available (Task 4 placed) → place it
4. Hover Massicot → Task 2 available (Task 3 placed) → place it
5. Hover Komori → Task 1 available (Task 2 placed) → place it

### Why This Rule?

The "successor must be placed" rule enforces backward scheduling discipline:
- Prevents placing tasks out of order
- Ensures precedence validation is meaningful
- Guides users through the optimal workflow

**Note:** This rule applies **only** to Quick Placement Mode. Manual drag-drop remains flexible.

---

## Precedence Validation

- Same rules as drag-drop apply
- Placement indicator snaps to valid positions by default
- Alt+click can bypass (with red halo warning)

---

## Integration with Job Navigation

When job navigation shortcuts (prev/next) are used while in Quick Placement Mode:
- Selected job changes
- Tooltip immediately updates to show tasks from the new job
- Placement indicator behavior adjusts accordingly

---

## Visual Summary

```
+------------------+
|  Quick Placement |
|  Mode: ACTIVE    |
+------------------+

Cursor: [free movement]
        |
        v
   +---------+
   | (snap)  |  <-- Placement indicator snaps to gap
   +---------+

Tooltip: "Task 3: Komori - 20+40min"
         or
         "No task available"
```

---

## Related Documents

- [Backward Scheduling](../03-navigation/backward-scheduling.md) — The workflow this mode supports
- [Job Navigation](../03-navigation/job-navigation.md) — Prev/next job shortcuts
- [Drag and Drop](drag-drop.md) — Alternative placement method
