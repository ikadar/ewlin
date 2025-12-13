# Scheduling Grid

The central component displaying stations as columns and time as the vertical axis.

---

## Overview

The scheduling grid is the core visualization of the schedule. It shows all stations, their tiles, and time-based information.

---

## Axes

| Axis | Content | Direction |
|------|---------|-----------|
| **Horizontal (X)** | Station columns | Left to right |
| **Vertical (Y)** | Time | Top to bottom (earlier → later) |

**Important:** Time flows **downward** (like a calendar, not a Gantt chart).

---

## Time Axis

### Scale

- **Snap unit:** 30 minutes
- **Markers:** Hour lines (light), day lines (bold with date label)
- **Today marker:** Colored horizontal line at current time

### Time Range

- Dynamic based on scheduled content
- Default: Shows range with active (incomplete) jobs
- Scrollable to past and future

---

## Station Columns

### Structure

- One column per station
- Column header: Station name (sticky during vertical scroll)
- Column width: Configurable (future), fixed for MVP

### Ordering

- Station order is configurable (stored setting)
- Keyboard shortcut to navigate columns left/right

### Outsourced Providers

- Providers appear as columns (like stations)
- Unlimited capacity: Column splits into subcolumns when tiles overlap (like calendar apps)

---

## Column States

### Normal

- Full width
- Shows all tiles and unavailability overlays

### Collapsed (during drag)

- Thin line
- Shows job-colored bands indicating tile positions
- See [Column Focus on Drag](../01-interaction-patterns/column-focus-on-drag.md)

---

## Grid Elements

| Element | Description |
|---------|-------------|
| **Tiles** | Scheduled task assignments |
| **Unavailability overlay** | Gray hatched pattern for non-operating periods |
| **Similarity circles** | Between consecutive tiles |
| **Today marker** | Horizontal line at current time |
| **Departure date marker** | Horizontal line for selected job's deadline |
| **Off-screen indicators** | Top/bottom of columns for out-of-view tiles |

---

## Scroll Behavior

| Direction | Method |
|-----------|--------|
| Vertical (time) | Mouse wheel, trackpad, Page Up/Down |
| Horizontal (stations) | Shift + wheel, trackpad, keyboard shortcut |

### Sticky Elements

- Column headers remain visible during vertical scroll
- Time labels remain visible during horizontal scroll (TBD)

---

## View Modes

The grid supports two display modes:

| Mode | Tile Height | Tile Position |
|------|-------------|---------------|
| **Timeline View** | Proportional to duration | Aligned to time |
| **Sequence View** | Uniform | Stacked as list |

See [Timeline vs Sequence](../02-view-modes/timeline-vs-sequence.md)

---

## Performance

| Metric | Target |
|--------|--------|
| Render (100 tiles) | < 100ms |
| Scroll | 60 FPS |
| Drag feedback | < 10ms |

---

## Related Documents

- [Tile Component](tile-component.md) — Individual tile structure
- [Grid Navigation](../03-navigation/grid-navigation.md) — Scroll and jump
- [Column Focus on Drag](../01-interaction-patterns/column-focus-on-drag.md) — Collapse behavior
