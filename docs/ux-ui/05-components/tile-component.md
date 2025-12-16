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
|  ○ 12345 · Client     |  ← Completion icon + Reference + Client
|                       |
|  [↑] [↓]              |  ← Swap buttons (on hover)
+-----------------------+
```

---

## Content

| Element | Description |
|---------|-------------|
| **Setup section** | Visual representation of setup time (top portion, lighter shade) |
| **Run section** | Visual representation of run time (main portion, full color) |
| **Completion icon** | Circle icon indicating task status |
| **Job reference** | Order reference number |
| **Client name** | Client name (truncated if needed) |
| **Swap buttons** | Up/down arrows for swapping with adjacent tiles |

### Simplified Display

Tiles show minimal information for clarity:
- Job reference + client name only
- No description or time display on tile
- Full details available in Job Details Panel when selected

---

## Completion Icon

Uses Lucide circle icons instead of checkbox:

| State | Icon | Color | Additional Visual |
|-------|------|-------|-------------------|
| **Not completed** | `circle` | `text-zinc-600` | — |
| **Completed** | `circle-check` | `text-emerald-500` | Green gradient from left |
| **Late/Problem** | `circle` | `text-red-500` | Red gradient from left |

### HTML Examples

```html
<!-- Not completed -->
<i data-lucide="circle" class="w-4 h-4 text-zinc-600"></i>

<!-- Completed -->
<i data-lucide="circle-check" class="w-4 h-4 text-emerald-500"></i>
```

### Completed Tile Gradient

```html
<div style="background-image: linear-gradient(to right, rgba(34,197,94,0.4) 0%, transparent 80%);">
```

---

## Dimensions

### Timeline View

- **Width:** Column width minus padding
- **Height:** Proportional to duration (setup + run)
- **Minimum height:** Enough to display completion icon + reference

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
| Left border | Full job color (border-l-4) |
| Background | Job color at low opacity (e.g., `bg-purple-950/35`) |
| Text | Lighter shade of job color (e.g., `text-purple-300`) |
| Setup section | Even lighter shade |
| Run section | Standard background |

### Dependent Jobs

Jobs with dependencies appear as **shades of one another** to show relationship.

---

## Interactive Elements

### Swap Buttons

- **Position:** Bottom of tile, visible on hover
- **Icons:** `chevron-up` and `chevron-down`
- **Actions:** Swap with tile above / below
- **Visibility:** Shown on hover

### Completion Toggle

- **Click:** Toggle between complete/incomplete
- **Does not affect:** Precedence validation (assumes tasks happen as defined)

---

## Visual States

| State | Appearance |
|-------|------------|
| Normal | Job color, full opacity |
| Selected | Highlighted border/glow |
| Dragging | Reduced opacity, follows cursor |
| Completed | Green gradient, circle-check icon |
| Late/Problem | Red gradient, red circle icon |
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
- [Similarity Indicators](../04-visual-feedback/similarity-circles.md) — Link icons between tiles
- [Tile Swap](../01-interaction-patterns/tile-swap.md) — Swap interaction
- [Tile Recall](../01-interaction-patterns/tile-recall.md) — Recall behavior
