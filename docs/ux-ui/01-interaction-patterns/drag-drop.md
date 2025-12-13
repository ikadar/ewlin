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

## Real-Time Validation

During drag, the system validates the proposed position in real-time.

### Performance Requirement

- **Feedback latency:** < 10ms
- **Implementation:** Client-side validation using `@flux/schedule-validator`

### Visual Feedback

| State | Visual |
|-------|--------|
| Valid drop zone | Highlighted area |
| Invalid drop zone | Red indicator |
| Dragging | Tile follows cursor with slight transparency |

---

## Precedence Safeguard

When placing a tile, the system enforces task precedence rules.

### Default Behavior

If the drop position would violate precedence (Task N placed before Task N-1 completes):
- **Auto-snap:** Tile snaps to the nearest valid position
- **Direction:** Earliest or latest valid slot, whichever is closest to intended position

### Alt-Key Bypass

Holding **Alt** during drag bypasses the safeguard:
- Tile can be placed in a violating position
- **Red halo** appears on the tile after placement
- Violation listed in right panel

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

## Related Documents

- [Precedence Safeguard Details](../domain-model/business-rules.md#ui-behavior-rules)
- [Quick Placement Mode](quick-placement-mode.md) — Keyboard-driven alternative
- [Column Focus on Drag](column-focus-on-drag.md) — Visual enhancement during drag
