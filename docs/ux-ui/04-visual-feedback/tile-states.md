# Tile States

Visual states for tiles in different contexts and conditions.

---

## Overview

Tiles have different visual appearances based on their state, location, and validity.

---

## States in Task List (Job Details Panel)

| State | Appearance | Interactions |
|-------|------------|--------------|
| **Unscheduled** | Full job color, border-l-4, job-colored background | Draggable to grid |
| **Scheduled (placed)** | Dark placeholder, no color, shows station + datetime | Single-click: jump to tile; Double-click: recall |

### Visual Distinction

- **Unscheduled:** Colorful tile with job border and background
- **Scheduled:** Simple dark placeholder with minimal text (station name, scheduled time)

---

## States on Grid (Center Panel)

| State | Appearance |
|-------|------------|
| **Normal** | Job color, setup/run sections visible |
| **Selected (job active)** | Highlighted border/glow (when job is selected) |
| **Dragging** | Slight transparency, follows cursor |
| **Hovered** | Swap buttons visible at bottom-right; slight highlight |

### Click Behavior on Grid

| Action | Result |
|--------|--------|
| Single click | Selects the job (same as clicking in Jobs List) |
| Single click again | Deselects the job |
| Double click | Recalls tile (removes from schedule) |

---

## Validity States

| State | Visual | Cause |
|-------|--------|-------|
| **Valid** | Normal appearance | No constraint violations |
| **Precedence violation** | Red halo effect | Task placed before predecessor completes (after Alt bypass) |
| **Part of conflict** | Highlighted | Station double-booking or group capacity exceeded |

---

## Drag Preview States

During drag operations:

| State | Visual |
|-------|--------|
| **Over valid drop zone** | Drop zone highlighted; preview shows final position |
| **Over invalid drop zone** | Red indicator; no preview |
| **Snapping (precedence safeguard)** | Preview shows snapped position |

---

## Opacity Reference

| Context | Opacity |
|---------|---------|
| Normal tile (grid) | 100% |
| Dragging tile | ~70-80% |
| Scheduled tile in task list | ~50-60% |
| Unscheduled tile in task list | 100% |

---

## State Transitions

```
Unscheduled (task list)
    │
    │ [drag to grid]
    ▼
Dragging
    │
    │ [drop on valid zone]
    ▼
Normal (grid) + Scheduled (task list, lower opacity)
    │
    │ [recall]
    ▼
Unscheduled (task list)
```

---

## Related Documents

- [Tile Recall](../01-interaction-patterns/tile-recall.md) — State change on recall
- [Tile Component](../05-components/tile-component.md) — Tile structure
- [Conflict Indicators](conflict-indicators.md) — Invalid state visuals
