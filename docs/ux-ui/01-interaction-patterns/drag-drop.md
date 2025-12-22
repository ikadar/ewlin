# Drag and Drop

Core drag and drop mechanics for tile placement and repositioning.

---

## Overview

Tiles are placed and repositioned via drag and drop. The system provides real-time feedback during drag operations.

---

## Drag Sources

| Source | Action | Result |
|--------|--------|--------|
| Left panel (unscheduled tile) | Drag to grid | Create new assignment |
| Grid (scheduled tile) | Drag within same column | Reschedule (change time slot) |

**Note:** Tiles cannot be dragged between columns — each task is assigned to a specific station.

---

## Snap Grid

- **Unit:** 30 minutes
- **Behavior:** On release, tile snaps to nearest 30-minute boundary
- **Visual:** Grid lines show 30-minute intervals

---

## Drop Position Calculation

Drop position is calculated from the **tile's top edge**, not the cursor position.

### How It Works

1. On drag start, the system records the **grab offset** (where within the tile the user clicked)
2. During drag, the cursor position is tracked
3. On drop, the grab offset is subtracted to determine the tile's top position

```
Example: User grabs tile in the middle (50px from top)
- Cursor drops at Y=300
- Tile top position = 300 - 50 = 250
- Time calculated from Y=250
```

### Rationale

This prevents the tile from "jumping" on drop. If you grab a tile in the middle and drop it, the tile stays under your cursor as expected — the top edge doesn't snap to the cursor position.

### Technical Notes

```typescript
// On drag start
const grabOffsetY = e.clientY - tileRect.top;

// On drop
const tileTopY = cursorY - grabOffsetY;
const dropTime = yPositionToTime(tileTopY);
```

---

## Real-Time Validation

During drag, the system validates the proposed position in real-time.

### Performance Requirement

- **Feedback latency:** < 10ms
- **Implementation:** Client-side validation using `@flux/schedule-validator`

### Visual Feedback

| State | Visual | Border Color |
|-------|--------|--------------|
| Valid drop zone | Green highlight | `ring-green-500` |
| Warning drop zone | Orange highlight (non-blocking conflict like Plates approval) | `ring-orange-500` |
| Invalid drop zone | Red highlight (blocking conflict) | `ring-red-500` |
| Alt-key bypass | Amber highlight (precedence override) | `ring-amber-500` |
| Dragging | Tile follows cursor with slight transparency | — |

---

## Precedence Safeguard

When placing a tile, the system enforces task precedence rules.

### Default Behavior

If the drop position would violate precedence (Task N placed before Task N-1 completes):
- **Auto-snap:** Tile snaps to the nearest valid position
- **Direction:** Earliest or latest valid slot, whichever is closest to intended position

### Alt-Key Bypass

> Implemented from REQ-13

Holding **Alt** during drag bypasses the safeguard:

**During drag (Alt pressed):**
- **Amber ring** appears around the drop zone (instead of red)
- Visual indicator that bypass is active

**On drop (Alt pressed):**
- Tile is placed in the violating position
- `PrecedenceConflict` is recorded in the schedule
- Job appears in Jobs List "Problèmes" section with "Conflit" badge
- Tile shows conflict styling (amber/red halo)

**On reschedule to valid position:**
- Existing `PrecedenceConflict` is automatically cleared
- Job disappears from "Problèmes" section
- Tile returns to normal styling

### Validation Timing

| Event | Validation | Response Time |
|-------|------------|---------------|
| Drag over grid | Real-time preview | < 10ms |
| Drop on grid | Full validation | < 100ms |
| Server confirmation | Authoritative | < 500ms |

---

## Drop Handling

### Valid Drop

1. Client validates position
2. Optimistic UI update (tile appears)
3. Server validates (authoritative)
4. If server rejects, rollback and show error

### Invalid Drop

1. Show conflict resolution information
2. Tile returns to original position (or left panel if new)
3. User must resolve conflict

---

## Tile Insertion ("Push Down")

When inserting a tile between existing tiles on a station:

- New tile is placed at the drop position
- Subsequent tiles on the same station are **pushed down** (later in time)
- System recalculates all affected scheduledStart/End times
- Conflicts are detected if push causes deadline or other violations

**Note:** Tiles cannot overlap on capacity-1 stations. Insertion always pushes down.

---

## Technical Implementation

| Aspect | Decision |
|--------|----------|
| **Library** | [dnd kit](https://dndkit.com) |
| **Why** | Modern React DnD, hooks-based, accessible, performant |

---

## Related Documents

- [Precedence Safeguard Details](../domain-model/business-rules.md#ui-behavior-rules)
- [Quick Placement Mode](quick-placement-mode.md) — Keyboard-driven alternative
- [Column Focus on Drag](column-focus-on-drag.md) — Visual enhancement during drag
