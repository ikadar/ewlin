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
| Target station column | Remains full width (w-60 / 240px) |
| Other station columns | Collapse to **120px** width |
| Outsourced provider columns | Same behavior as stations |

**Target station detection:** Each task is assigned to a station in the backend. The station matching the dragged tile's task stays expanded.

### Animation

- **Transition:** CSS `transition: width 150ms ease-out`
- **Duration:** 150ms
- **Easing:** ease-out (fast start, smooth finish)
- **Timing:** Starts when drag begins, reverses on drop/cancel
- **Performance:** CSS transition runs independently, does not affect <10ms drag feedback

```css
.station-column {
  transition: width 150ms ease-out;
}

.station-column--collapsed {
  width: 120px;
}
```

---

## Context Preservation

Collapsed columns still show useful information:

### Active Job Tiles

- Tiles from the **active job** (the job being dragged) **keep their regular color**
- Shows where other tasks from this job are already placed

### Other Job Tiles

- Tiles from **other jobs** get **muted/desaturated colors**
- Border and background become very close to grey
- This visual distinction helps focus on the current job

```css
/* Other job tiles during drag */
.tile--muted {
  filter: saturate(0.2);
  opacity: 0.6;
}

/* Active job tiles keep their color */
.tile--active-job {
  filter: none;
  opacity: 1;
}
```

### Visual Example

```
Full width        Collapsed (120px)   Collapsed         Full width
[Komori]          |                   |                 [Massicot]
                  |                   |
+---------+       +--------+          |                 +---------+
| Tile A  |       | Job    |          |                 |         |
| (color) |       | tile   |  muted   |                 |  DROP   |
+---------+       | (color)|  tiles   |                 |  HERE   |
                  +--------+   ↓      |                 |         |
+---------+       +--------+          |                 +---------+
| Tile B  |       | Other  |          |
| (muted) |       | (grey) |          |                 +---------+
+---------+       +--------+          |                 | Tile C  |
                  |                   |                 +---------+
```

Note: Active job tiles maintain their color, other jobs appear muted.

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
