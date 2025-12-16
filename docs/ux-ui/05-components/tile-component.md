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
|  ○ 12345 · Client     |  ← Checkbox + Reference + Client (header row)
|                       |
|  [↑] [↓]              |  ← Swap buttons (on hover, bottom-right)
+-----------------------+
```

**Checkbox position:** Left of job reference number in the header row.

---

## Content

| Element | Description |
|---------|-------------|
| **Setup section** | Visual representation of setup time (top portion, lighter shade) |
| **Run section** | Visual representation of run time (main portion, full color) |
| **Completion checkbox** | Circle icon left of job reference (see below) |
| **Job reference** | Order reference number |
| **Client name** | Client name (truncated if needed) |
| **Swap buttons** | Chevron up/down at bottom-right (visible on hover) |

### Header Row Layout

```
○ 12345 · Client
^   ^       ^
|   |       |
|   |       └── Client name (truncated)
|   └── Job reference number (monospace)
└── Completion checkbox (circle icon)
```

### Simplified Display

Tiles show minimal information for clarity:
- Checkbox + job reference + client name only
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

### Tile Click Behavior (on Grid)

| Action | Result |
|--------|--------|
| **Single click** | Selects the job (same as clicking in Jobs List) |
| **Single click again** | Deselects the job |
| **Double click** | Recalls tile (removes from schedule) |

Note: Single and double click are compatible — single click triggers immediately, double click triggers after the second click.

### Swap Buttons

- **Position:** Bottom-right of tile
- **Icons:** `chevron-up` and `chevron-down`
- **Actions:** Swap with tile above / below
- **Visibility:** Shown on hover only

### Completion Toggle

- **Click on checkbox:** Toggle between complete/incomplete
- **Does not affect:** Precedence validation (assumes tasks happen as defined)

---

## Visual States

| State | Appearance |
|-------|------------|
| Normal | Job color, full opacity |
| Selected (job active) | Highlighted border/glow (job is selected in Jobs List) |
| Dragging | Reduced opacity, follows cursor |
| Completed | Green gradient from left, `circle-check` icon |
| Late/Problem | Red gradient from left, red `circle` icon |
| Precedence violation | Red halo effect |
| During unavailability | Different appearance (hatched/lighter) |

### Selected State

When a job is selected (via Jobs List or by clicking a tile on the grid):
- All tiles belonging to that job get a subtle highlight/glow
- Off-screen indicators appear for tiles outside viewport

See [Tile States](../04-visual-feedback/tile-states.md) for details.

---

## Outsourced Task Tiles

Outsourced tasks appear in dedicated provider columns with visual distinction:

| Element | Outsourced Tile |
|---------|-----------------|
| **Border style** | Dotted (instead of solid) |
| **Column** | Provider column (not station) |
| **Duration format** | "2 JO" (days, not hours/minutes) |

---

## Related Documents

- [Tile States](../04-visual-feedback/tile-states.md) — State variations
- [Similarity Indicators](../04-visual-feedback/similarity-circles.md) — Link icons between tiles
- [Tile Swap](../01-interaction-patterns/tile-swap.md) — Swap interaction
- [Tile Recall](../01-interaction-patterns/tile-recall.md) — Recall behavior
