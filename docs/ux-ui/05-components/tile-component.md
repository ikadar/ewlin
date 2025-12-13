# Tile Component

The visual representation of a scheduled task assignment on the grid.

---

## Overview

Each tile represents one task assignment — a task scheduled on a station at a specific time.

---

## Anatomy

```
+-----------------------+
|  Setup Section        |  ← Lighter shade of job color
+-----------------------+
|                       |
|  Run Section          |  ← Full job color
|                       |
|  Reference: 45113 A   |
|  Description: Cartes  |
|  09:00 - 10:00        |
|                       |
|  [↑] [↓]              |  ← Swap buttons (on hover)
+-----------------------+
```

---

## Content

| Element | Description |
|---------|-------------|
| **Setup section** | Visual representation of setup time (top portion) |
| **Run section** | Visual representation of run time (main portion) |
| **Job reference** | Order reference from job |
| **Description** | Job description (truncated if needed) |
| **Time** | Start and end time |
| **Swap buttons** | Up/down arrows for swapping with adjacent tiles |

---

## Dimensions

### Timeline View

- **Width:** Column width minus padding
- **Height:** Proportional to duration (setup + run)
- **Minimum height:** Enough to display core info (reference, time)

### Sequence View

- **Width:** Same as Timeline View
- **Height:** Uniform (all tiles same height)

---

## Job Color

### Assignment

- Each job is assigned a color at creation
- Color is stored in `Job.color` as hex string (e.g., `#3B82F6`)
- Palette: 12 visually distinct, colorblind-friendly colors
- Colors cycle based on job creation order

### Usage

| Element | Color |
|---------|-------|
| Run section | Full job color |
| Setup section | Lighter shade of job color |
| Similarity circles | Job colors of both tiles |
| Off-screen indicators | Job color |
| Column collapse bands | Job color |

### Dependent Jobs

Jobs with dependencies appear as **shades of one another** to show relationship.

---

## Interactive Elements

### Swap Buttons

- **Position:** Bottom of tile, or on hover
- **Visibility:** On hover (or always visible TBD)
- **Actions:** Swap with tile above / below

### Checkbox (Task Completion)

- Each tile has a checkbox to mark the task as completed
- Visible on the tile
- Does not affect precedence validation (which assumes scheduled tasks happen as defined)

---

## Visual States

| State | Appearance |
|-------|------------|
| Normal | Job color, full opacity |
| Selected | Highlighted border/glow |
| Dragging | Reduced opacity, follows cursor |
| Precedence violation | Red halo effect |
| During unavailability | Different appearance (hatched/lighter) |

See [Tile States](../04-visual-feedback/tile-states.md) for details.

---

## Outsourced Task Tiles

Outsourced tasks appear similarly but may have subtle visual distinction:
- Different border style or icon
- Provider name instead of station
- Duration shown in days (JO) rather than minutes

---

## Related Documents

- [Tile States](../04-visual-feedback/tile-states.md) — State variations
- [Similarity Circles](../04-visual-feedback/similarity-circles.md) — Between tiles
- [Tile Swap](../01-interaction-patterns/tile-swap.md) — Swap interaction
- [Tile Recall](../01-interaction-patterns/tile-recall.md) — Recall behavior
