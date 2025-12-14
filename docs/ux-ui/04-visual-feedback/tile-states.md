# Tile States

Visual states for tiles in different contexts and conditions.

---

## Overview

Tiles have different visual appearances based on their state, location, and validity.

---

## States in Task List (Left Panel)

| State | Appearance | Interactions |
|-------|------------|--------------|
| **Unscheduled** | Full opacity | Draggable; can be placed on grid |
| **Scheduled (placed)** | Lower opacity | Single-click: jump to tile; Double-click: recall; Hover: shows buttons |

---

## States on Grid (Center Panel)

| State | Appearance |
|-------|------------|
| **Normal** | Job color, setup/run sections visible |
| **Selected** | Highlighted border or glow |
| **Dragging** | Slight transparency, follows cursor |
| **Hovered** | Swap buttons visible; slight highlight |

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
