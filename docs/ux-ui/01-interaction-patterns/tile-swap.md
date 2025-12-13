# Tile Swap

Swapping positions of adjacent tiles without dragging.

---

## Overview

Tile swap provides a quick way to reorder adjacent tiles on the same station without full drag-and-drop.

---

## Activation

Each tile on the grid has two visual shortcuts (visible on hover or always visible TBD):

| Shortcut | Action |
|----------|--------|
| **Swap up** | Switch position with tile above |
| **Swap down** | Switch position with tile below |

---

## Behavior

### When Clicked

1. System validates the swap against constraints
2. If valid:
   - Both tiles exchange positions
   - `scheduledStart` and `scheduledEnd` updated for both
   - Smooth animation shows the swap
3. If invalid:
   - Show warning/conflict information
   - Require confirmation or cancel

### Validation

Same rules as drag-drop:
- Precedence constraints checked
- No station conflicts created
- Deadline impacts evaluated

---

## Edge Cases

| Situation | Behavior |
|-----------|----------|
| No tile above (first tile) | "Swap up" disabled or hidden |
| No tile below (last tile) | "Swap down" disabled or hidden |
| Swap would violate precedence | Warning shown, confirmation required |
| Tiles from different jobs | Swap allowed (different jobs can be reordered) |

---

## Visual Example

```
Before swap:              After "swap down" on Tile A:

+---------+               +---------+
| Tile A  | [v]           | Tile B  |
+---------+               +---------+
+---------+               +---------+
| Tile B  | [^]           | Tile A  |
+---------+               +---------+
```

---

## Related Documents

- [Drag and Drop](drag-drop.md) — Alternative reordering method
- [Tile Component](../05-components/tile-component.md) — Swap button placement
