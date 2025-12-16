# Quick Placement Mode

A toggle mode for fast, keyboard-driven tile placement optimized for backward scheduling.

---

## Overview

Quick Placement Mode accelerates the backward scheduling workflow by allowing rapid tile placement with minimal mouse movement.

---

## Activation

| Action | Result |
|--------|--------|
| **ALT+Q** | Toggle mode ON |
| **ALT+Q** (again) | Toggle mode OFF |
| **ESC** | Exit mode |

**Prerequisite:** A job must be selected in the Jobs List.

---

## Behavior When Active

### Placement Indicator

- **Mouse cursor:** Moves freely (no snapping)
- **Placement line:** Glowing thick line in **pure white** that follows the cursor
- **Snapping:** Line magnetizes to the nearest gap between existing tiles
- Shows exactly where the tile will be placed on click

### Visual Appearance

```css
/* Placement indicator line */
.placement-indicator {
  height: 4px;
  background: white;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.8);
}
```

### Active Tile Highlight

The tile being placed gets a **white ring/halo** to indicate it's the active placement target:

```css
/* Active tile during Quick Placement */
.tile-active-placement {
  box-shadow: 0 0 0 2px white, 0 0 16px rgba(255, 255, 255, 0.5);
}
```

### Tooltip

Simple text near the cursor showing task information:
- **Task available:** Task name/station displayed
- **No task available:** "Forbidden" cursor icon (crossed-out circle)

### No Task Available State

When hovering a station with no available task:
- **Cursor:** Changes to "forbidden" icon (`cursor: not-allowed`)
- **No placement line:** Indicator hidden
- **Visual feedback:** Clear indication that clicking won't work

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
Quick Placement Mode: ACTIVE (ALT+Q to toggle)

┌─────────────────────────────────────┐
│  Station Column                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Existing Tile               │    │
│  └─────────────────────────────┘    │
│                                     │
│  ════════════════════════════════   │  ← White glowing line (placement indicator)
│        ↑ cursor position            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Another Tile                │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘

Task available: Simple tooltip text near cursor
No task available: 🚫 cursor (not-allowed)
```

### Active Tile (in Job Details)

```
┌────────────────────────────┐
│ ○○○○○○○○○○○○○○○○○○○○○○○○○  │  ← White ring/halo around tile
│ ○ Task being placed     ○  │
│ ○○○○○○○○○○○○○○○○○○○○○○○○○  │
└────────────────────────────┘
```

---

## Related Documents

- [Backward Scheduling](../03-navigation/backward-scheduling.md) — The workflow this mode supports
- [Job Navigation](../03-navigation/job-navigation.md) — Prev/next job shortcuts
- [Drag and Drop](drag-drop.md) — Alternative placement method
