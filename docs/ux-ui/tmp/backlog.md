# Requirements Backlog

This document contains requirements that are deferred for future implementation.

---

## REQ-02: Auto-Scroll on Drag Near Grid Edge

**Description:**
When dragging a tile near the edge of the grid viewport, the grid should automatically scroll in that direction. This eliminates the need for the current column shrinking behavior during drag operations.

**Current behavior:**
```
User drags tile to grid edge:
┌───────────────────────────────┐
│                               │
│      ┌─────────┐              │
│      │ Tile    │──────→ ❌     │  ← Grid does NOT scroll
│      └─────────┘   (edge)     │
│                               │
└───────────────────────────────┘
```

**Expected behavior:**
```
User drags tile to grid edge:
┌───────────────────────────────┐
│             ▲                 │  ← Scroll indicator appears
├───────────────────────────────┤
│                               │
│      ┌─────────┐              │
│      │ Tile    │              │  ← Grid auto-scrolls
│      └─────────┘              │
│                               │
├───────────────────────────────┤
│             ▼                 │  ← Scroll indicator appears
└───────────────────────────────┘
```

**Visual indicators:**
- Arrow/triangle indicator appears at grid edge when auto-scroll is active
- Indicator positioned at center of edge
- Animated/pulsing effect during active scrolling
- Horizontal scrolling: ◀ and ▶ arrows

```
Vertical scroll:                Horizontal scroll:
┌─────────────────────┐        ┌─────────────────────┐
│         ▲           │        │                     │
│                     │        │ ◀               ▶   │
│       Grid          │        │       Grid          │
│                     │        │                     │
│         ▼           │        │                     │
└─────────────────────┘        └─────────────────────┘
```

**Important:** This feature could completely replace the current column shrinking behavior (where non-target columns shrink during drag). Auto-scroll is a more intuitive solution for both vertical and horizontal navigation.

**Implementation details:**

| Parameter | Value |
|-----------|-------|
| Edge detection zone | ~80px from grid edge |
| Scroll speed | Progressive (closer = faster) |
| Directions | Vertical (up/down) + Horizontal (left/right) |
| Column shrinking | Remove once auto-scroll is implemented |

**Affected files:**
- `apps/web/src/components/SchedulingGrid/SchedulingGrid.tsx`
- `apps/web/src/components/StationColumns/StationColumn.tsx` - remove shrinking
- `apps/web/src/components/StationHeaders/StationHeader.tsx` - remove shrinking
- New hook: `useAutoScrollOnDrag.ts`
- New component: `ScrollIndicator.tsx`

**Current state:**
- Column shrinking on drag: ✅ Implemented (to be removed)
- Auto-scroll on drag: ❌ **Missing**
- Scroll direction indicators: ❌ **Missing**

**Source:** [REQ-02](new-requirements-03.md#req-02-auto-scroll-on-drag-near-grid-edge)

---

## REQ-07: Undo/Redo Functionality

**Description:**
Implement undo and redo functionality for scheduling operations, allowing users to reverse mistakes easily.

**Keyboard shortcuts:**
| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z | Cmd+Shift+Z |

**Undoable operations:**

| Operation | Description |
|-----------|-------------|
| Task placement | Drag from sidebar to grid |
| Task reschedule | Move tile within grid |
| Task recall | Double-click to return to sidebar |
| Swap up/down | Reorder tiles on station |
| Completion toggle | Mark task complete/incomplete |

**Implementation approach:**
```typescript
interface HistoryEntry {
  timestamp: number;
  snapshot: ScheduleSnapshot;
  operation: string; // Description for potential display
}

interface HistoryState {
  past: HistoryEntry[];      // Stack of previous states
  present: ScheduleSnapshot; // Current state
  future: HistoryEntry[];    // Stack of undone states (for redo)
}

// Max history size to prevent memory issues
const MAX_HISTORY_SIZE = 50;
```

**UI elements:**
```
┌─ Toolbar ──────────────────────────────────┐
│  ↶ Undo  ↷ Redo  │  ... other controls ... │
└────────────────────────────────────────────┘
     │       │
     │       └─ Disabled when future is empty
     └─ Disabled when past is empty
```

**Affected files:**
- New hook: `useScheduleHistory.ts` or `useUndoRedo.ts`
- `apps/web/src/App.tsx` - keyboard shortcuts, history integration
- `apps/web/src/components/TopNavBar/TopNavBar.tsx` - undo/redo buttons

**Current state:**
- Keyboard shortcut system: ✅ Exists
- History tracking: ❌ **Missing**
- Undo/Redo buttons: ❌ **Missing**

**Source:** [REQ-07](new-requirements-03.md#req-07-undoredo-functionality)

---

## REQ-10: Auto-Scroll to First Valid Position on Task Click

**Description:**
When clicking on an unscheduled task tile in the sidebar, the grid should automatically scroll to show the first valid placement position for that task.

**Current behavior:**
```
User clicks unscheduled task:
┌─ Sidebar ─┐    ┌─ Grid ──────────────────┐
│           │    │                          │
│ [Task A]◀─┼────│  (no change)             │
│           │    │                          │
└───────────┘    └──────────────────────────┘
```

**Expected behavior:**
```
User clicks unscheduled task:
┌─ Sidebar ─┐    ┌─ Grid ──────────────────┐
│           │    │      Target Station      │
│ [Task A]◀─┼────│  ═══════════════════     │ ← Scrolls to first valid slot
│           │    │  [First valid position]  │
│           │    │                          │
└───────────┘    └──────────────────────────┘
```

**Scroll behavior:**
1. **Vertical:** Scroll to the first possible valid start time
2. **Horizontal:** Center the target station column in viewport

**First valid position calculation:**
- Consider precedence constraints (predecessor end + dry time)
- Consider station operating schedule (skip non-working hours)
- Consider existing assignments (avoid conflicts)
- Consider BAT approval status

**Edge cases:**

| Scenario | Behavior |
|----------|----------|
| No valid position (BAT not approved) | Show warning message, don't scroll |
| Valid position already visible | Don't scroll unnecessarily |
| Multiple valid slots | Scroll to the earliest one |

**Visual feedback:**
- Smooth scroll animation
- Optional: highlight/pulse effect at first valid position

**Affected files:**
- `apps/web/src/App.tsx` - task click handler
- `apps/web/src/components/SchedulingGrid/SchedulingGrid.tsx` - scroll API
- `apps/web/src/components/JobDetailsPanel/TaskTile.tsx` - click handler
- New utility: `findFirstValidPosition.ts`

**Current state:**
- Task tile click: ✅ Selects job
- Auto-scroll to valid position: ❌ **Missing**

**Source:** [REQ-10](new-requirements-03.md#req-10-auto-scroll-to-first-valid-position-on-task-click)

---

## Summary Table

| REQ | Title | Priority | Complexity | Category |
|-----|-------|----------|------------|----------|
| REQ-02 | Auto-Scroll on Drag | High | Medium | UX/Performance |
| REQ-07 | Undo/Redo | High | High | Feature |
| REQ-10 | Auto-Scroll to Valid Position | Medium | Medium | UX |
