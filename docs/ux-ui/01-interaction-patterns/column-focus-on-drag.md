# Column Focus on Drag

When dragging a tile from the left panel, irrelevant columns collapse to focus attention on the target station.

---

## Overview

This feature reduces visual clutter during drag operations by collapsing columns that are not relevant to the tile being dragged.

---

## Trigger

- **When:** Dragging a tile from the left panel to the grid
- **Not when:** Repositioning a tile already on the grid (stays in same column anyway)

---

## Behavior

### Column Collapse

| Column Type | Behavior |
|-------------|----------|
| Target station column | Remains full width |
| Other station columns | Collapse to thin lines |
| Outsourced provider columns | Same behavior as stations |

### Animation

- **Transition:** Smooth CSS animation
- **Duration:** Quick (e.g., 150-200ms)
- **Timing:** Starts when drag begins, reverses on drop/cancel
- **Performance:** CSS transition runs independently, does not affect <10ms drag feedback

---

## Context Preservation

Collapsed columns still show useful information:

### Job-Colored Bands

- Collapsed columns display **colored bands** at vertical positions where other tiles from the **same job** are already placed
- Band color matches the job's assigned color
- Allows user to see: "This job has tasks on Massicot at ~10am and Conditionnement at ~2pm"

### Visual Example

```
Full width        Collapsed         Collapsed         Full width
[Komori]          |                 |                 [Massicot]
                  |                 |
+---------+       |                 |                 +---------+
| Tile A  |       |###|             |                 |         |
+---------+       |   |  <-- job    |                 |  DROP   |
                  |   |     color   |                 |  HERE   |
+---------+       |   |     band    |                 |         |
| Tile B  |       |###|             |                 +---------+
+---------+       |                 |
                  |                 |                 +---------+
                  |                 |                 | Tile C  |
                  |                 |                 +---------+
```

---

## On Drop / Cancel

- Columns animate back to full width
- Transition uses same duration as collapse

---

## Rationale

- **Focus:** Directs attention to the relevant drop target
- **Context:** Job-colored bands maintain awareness of other task positions
- **Performance:** Pure CSS, no impact on validation speed

---

## Related Documents

- [Drag and Drop](drag-drop.md) — Core drag mechanics
- [Tile Component](../05-components/tile-component.md) — Job color assignment
