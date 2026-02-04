# Refactored Requirements (Part 4)

This document contains the reformulated, precise requirements from the fourth batch.

---

## REQ-01: Pick and Place (Replaces Drag and Drop)

**Description:**
Replace the traditional drag-and-drop interaction with a two-click "Pick and Place" pattern. This change addresses performance issues caused by continuous validation during `mousemove` events (~60 validations/second).

**Current behavior (Drag and Drop):**
```
Event flow:
mousedown → mousemove (60x/sec) → mouseup
            ↓
     Validation runs on EVERY move
            ↓
     ~60 validations per second
            ↓
     Performance degradation with many tiles
```

**Expected behavior (Pick and Place):**
```
Event flow:
click (pick) → hover detection only → click (place)
     ↓                                    ↓
  1 validation                      1 validation
     ↓
  Only 2 validations total!
```

**Interaction flow:**

| Phase | Trigger | Behavior |
|-------|---------|----------|
| **Pick** | Single click on tile | Tile enters "picked" state, ghost follows cursor |
| **Hover** | Mouse move over grid | Visual feedback only (ring color), no heavy validation |
| **Place** | Single click on target | Tile placed if valid, returns to origin if invalid |
| **Cancel** | ESC key | Tile returns to original position |

**Visual feedback (same as drag-and-drop):**

```
┌─ Station Column ─────────────────────┐
│                                      │
│  ═══════════════════════════════════ │ ← Purple line (earliest start)
│                                      │
│  ┌──────────────────────────────┐    │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │ ← Ghost tile (follows cursor)
│  │  ░░░░  PREVIEW TILE  ░░░░░░  │    │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │
│  └──────────────────────────────┘    │
│           ┌─────────┐                │
│           │ ● Valid │ ← Green ring   │
│           └─────────┘                │
│                                      │
│  ═══════════════════════════════════ │ ← Orange line (latest start)
└──────────────────────────────────────┘

Original position (when picking from grid):
┌──────────────────────────────┐
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │      PULSATING         │  │ ← Dashed border, pulsating animation
│  │     PLACEHOLDER        │  │    Shows where tile was picked from
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
└──────────────────────────────┘
```

**Ring color states:**

| State | Ring Color | Meaning |
|-------|------------|---------|
| Valid position | Green | Drop allowed |
| Invalid position | Red | Drop blocked |
| Warning (Alt bypass) | Amber | Drop allowed with conflict |

**Cursor states:**

| State | Cursor |
|-------|--------|
| No tile picked | default (pointer on hoverable tiles) |
| Tile picked, over valid target | grab |
| Tile picked, over invalid target | grab (ring color indicates validity) |

**Constraints:**
- Only ONE tile can be picked at a time
- Picking a new tile automatically cancels the previous pick
- Completed tiles cannot be picked (only selected)
- Outsourced tiles cannot be picked

**Architecture (from experimental branch):**

```
┌─────────────────────────────────────────────────────────────┐
│                     Dual Rendering Streams                   │
├─────────────────────────────────────────────────────────────┤
│ Stream 1: Position (60fps)                                   │
│   └─ RAF loop → direct DOM manipulation (no React re-render) │
│                                                              │
│ Stream 2: Validation (100ms throttled)                       │
│   └─ CSS transition masks latency                            │
│                                                              │
│ Stream 3: Messages (60fps)                                   │
│   └─ Real-time time string generation                        │
└─────────────────────────────────────────────────────────────┘
```

**Key components:**

| Component | File | Purpose |
|-----------|------|---------|
| PickStateContext | `apps/web/src/pick/PickStateContext.tsx` | State management + GhostPositionRef |
| PickPreview | `apps/web/src/pick/PickPreview.tsx` | Ghost tile rendering (portal-based) |
| StationColumn | `StationColumn.tsx` | Ring color feedback, mouse move handling |
| Tile | `Tile.tsx` | Click handler, pulsating animation |

**Performance optimizations:**
1. Ghost position via `useRef` + RAF (no React re-renders)
2. Validation throttled to 100ms with early-exit (same 15-min slot check)
3. CSS transition masking for smooth ring color changes
4. Direct DOM manipulation for ghost positioning

**Affected files:**
- `apps/web/src/pick/PickStateContext.tsx` (new)
- `apps/web/src/pick/PickPreview.tsx` (new)
- `apps/web/src/components/Tile/Tile.tsx`
- `apps/web/src/components/StationColumns/StationColumn.tsx`
- `apps/web/src/App.tsx`

**Experimental implementation reference:**
> **Branch:** `feature/v0.3.66-element-types`
> **Versions:** v0.3.54 - v0.3.60
> **Key commit:** `7064ccc` - Remove drag & drop, keep Pick & Place only

**Current state:**
- Drag and drop: ✅ Implemented (current)
- Pick and place: ❌ **Needs implementation** (experimental code exists but needs reimplementation)

**Source:** [REQ-01](new-requirements-04.md#req-01-pick-and-place-replaces-drag-and-drop)

---

## REQ-02: Right Click Context Menu

> ✅ Implemented in v0.3.58

**Description:**
Add a right-click context menu on tiles that provides quick access to common actions. The menu replaces visible buttons (eye, swap arrows) for a cleaner interface optimized for power users.

**Current behavior:**
```
┌─ Tile ─────────────────────────────┐
│ PRINT-001 · Client                 │
│                      [👁] [↑] [↓]  │ ← Visible buttons (cluttered)
└────────────────────────────────────┘
```

**Expected behavior:**
```
Right-click on tile:
                                    ┌─────────────────────┐
┌─ Tile ─────────────────────────┐  │ 👁 View details     │
│ PRINT-001 · Client             │──│ ☐ Mark complete     │
│                                │  │ ─────────────────── │
└────────────────────────────────┘  │ ↑ Move up           │
                                    │ ↓ Move down         │
                                    └─────────────────────┘
```

**Menu options:**

| Option | Icon | Action |
|--------|------|--------|
| Voir détails | Eye | Select job → show Job Details panel |
| Marquer terminé/non terminé | Square/CheckSquare | Toggle completion status |
| Déplacer vers le haut | ChevronUp | Swap with tile above (if exists) |
| Déplacer vers le bas | ChevronDown | Swap with tile below (if exists) |

**Menu positioning:**
- Appears at cursor position (x, y)
- Flips horizontally if near right viewport edge
- Flips vertically if near bottom viewport edge
- Portal-based rendering (z-index: 9999)

**Close triggers:**
- Click outside menu
- Press ESC key
- Scroll event (position would be stale)

**Scope:**
- Only works on tiles (not on empty cells)
- No "Pick" option in menu (pick is via single click)

**Affected files:**
- `apps/web/src/components/Tile/TileContextMenu.tsx` (new)
- `apps/web/src/components/Tile/Tile.tsx`

**Experimental implementation reference:**
> **Branch:** `feature/v0.3.66-element-types`
> **File:** `apps/web/src/components/Tile/TileContextMenu.tsx`
> **Version:** v0.3.63

**Current state:**
- Visible buttons: ✅ Implemented (current)
- Context menu: ❌ **Needs implementation** (experimental code exists)

**Source:** [REQ-02](new-requirements-04.md#req-02-right-click-context-menu)

---

## REQ-03: Column Focus During Pick from Job Details

**Description:**
When picking an unscheduled task from the Job Details panel (sidebar), automatically scroll to and focus on the target station column. Non-target columns should fade to improve focus.

**Pick from Sidebar (unscheduled task):**

```
Before pick:
┌─ Sidebar ─┐ ┌─ Station A ─┐ ┌─ Station B ─┐ ┌─ Station C ─┐
│           │ │  (target)   │ │             │ │             │
│ [Task 1]  │ │             │ │             │ │             │
│   click   │ │             │ │             │ │             │
└───────────┘ └─────────────┘ └─────────────┘ └─────────────┘

After pick (Station A is target):
┌─ Sidebar ─┐ ┌─ Station A ─┐ ┌─ Station B ─┐ ┌─ Station C ─┐
│           │ │  (target)   │ │  opacity:   │ │  opacity:   │
│ [Task 1]  │ │   FOCUSED   │ │    15%      │ │    15%      │
│  (picked) │ │   100%      │ │  disabled   │ │  disabled   │
└───────────┘ └─────────────┘ └─────────────┘ └─────────────┘
             ← Grid scrolls to show target column on left
```

**Behavior table:**

| Phase | Action |
|-------|--------|
| **Pick** | Save current scroll position (for cancel restoration) |
| **Pick** | Scroll target column to left edge (smooth, 300ms) |
| **Pick** | Fade non-target columns to 15% opacity + disable pointer events |
| **Place** | Restore all columns to 100% opacity |
| **Cancel (ESC)** | Restore scroll position + restore opacity |

**Pick from Grid (reschedule existing tile):**

When picking an already-placed tile for rescheduling:
- **No** opacity change (all columns remain visible)
- **No** scroll (user is already viewing the tile location)

```typescript
// Opacity logic in StationColumn.tsx
if (pickSource === 'sidebar') {
  return 'opacity-15 pointer-events-none';  // Non-target stations
}
// pickSource === 'grid' → no opacity change
```

**Scroll logic:**

```typescript
// Scroll to target station column (300ms animation)
const stationX = LAYOUT.PADDING_LEFT + stationIndex * (LAYOUT.STATION_WIDTH + LAYOUT.GAP);
const scrollTargetX = Math.max(0, stationX - LAYOUT.PADDING_LEFT);
gridRef.current.scrollTo(scrollTargetX, gridRef.current.getScrollY(), 'smooth');
```

**Affected files:**
- `apps/web/src/App.tsx` - handlePickTask, handlePickTileFromGrid
- `apps/web/src/components/StationColumns/StationColumn.tsx` - opacity logic

**Experimental implementation reference:**
> **Branch:** `feature/v0.3.66-element-types`
> **Versions:** v0.3.55, v0.3.61

**Current state:**
- Column collapse on drag: ✅ Implemented (current)
- Column focus on pick: ❌ **Needs implementation**
- Scroll restoration on cancel: ❌ **Needs implementation**

**Source:** [REQ-03](new-requirements-04.md#req-03-column-focus-during-pick-from-job-details)

---

## REQ-04: Job Details Panel - Fixed Tile Height

**Description:**
Change the task tile height in the Job Details panel from proportional (based on duration) to a fixed 32px height. This provides a cleaner, more consistent list view.

**Current behavior:**
```
┌─ Job Details Panel ─────────────────┐
│                                     │
│ ┌─ Task 1 (30 min) ────────────┐    │
│ │                              │    │ ← Small, hard to read
│ └──────────────────────────────┘    │
│                                     │
│ ┌─ Task 2 (4 hours) ───────────┐    │
│ │                              │    │
│ │                              │    │
│ │                              │    │ ← Very tall, wastes space
│ │                              │    │
│ │                              │    │
│ └──────────────────────────────┘    │
│                                     │
│ ┌─ Task 3 (15 min) ────────────┐    │
│ └──────────────────────────────┘    │ ← Tiny, barely visible
│                                     │
└─────────────────────────────────────┘
```

**Expected behavior:**
```
┌─ Job Details Panel ─────────────────┐
│                                     │
│ ┌─ Task 1 (30 min) ────────────┐    │
│ │ Station A · 30 min           │    │ ← 32px fixed height
│ └──────────────────────────────┘    │
│                                     │
│ ┌─ Task 2 (4 hours) ───────────┐    │
│ │ Station B · 4h               │    │ ← 32px fixed height
│ └──────────────────────────────┘    │
│                                     │
│ ┌─ Task 3 (15 min) ────────────┐    │
│ │ Station C · 15 min           │    │ ← 32px fixed height
│ └──────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

**Why fixed height?**

| Problem with proportional | Solution with fixed |
|---------------------------|---------------------|
| Short tasks too small (unreadable) | All tasks equally readable |
| Long tasks too tall (waste space) | Consistent, compact list |
| Visual inconsistency | Clean, predictable layout |

**Specification:**
- Height: **32px** (fixed, not configurable)

**Affected files:**
- `apps/web/src/components/JobDetailsPanel/TaskTile.tsx`

**Experimental implementation reference:**
> **Branch:** `feature/v0.3.66-element-types`
> **Commit:** `204809d` - refactor(JobDetailsPanel): Use fixed height for task tiles

**Current state:**
- Proportional height: ✅ Implemented (current)
- Fixed 32px height: ❌ **Needs implementation**

**Source:** [REQ-04](new-requirements-04.md#req-04-job-details-panel---fix-tile-height)

---

## REQ-05: Unavailability Overlay - CSS Gradient to SVG

**Description:**
Replace the CSS gradient-based stripe pattern for non-working hours overlay with an SVG file. This change is motivated by **performance** improvements.

**Current implementation (CSS gradient):**

```css
.bg-stripes-dark {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(255, 255, 255, 0.03) 10px,
    rgba(255, 255, 255, 0.03) 20px
  );
}
```

**Visual appearance (unchanged):**

```
┌─ Station Column ─────────────────────┐
│ 06:00  Working hours                 │
│ 07:00                                │
│ 08:00                                │
├──────────────────────────────────────┤
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░  12:00-13:00 LUNCH  ░░░░░░░░░ │ ← Diagonal stripes
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├──────────────────────────────────────┤
│ 13:00  Working hours                 │
│ 14:00                                │
└──────────────────────────────────────┘
```

**Pattern specifications (to be reproduced in SVG):**

| Property | Value |
|----------|-------|
| Angle | 45° (diagonal) |
| Stripe color | `rgba(255, 255, 255, 0.03)` (very subtle white) |
| Stripe width | 10px |
| Gap width | 10px |
| Pattern repeat | 20px |

**Implementation approach:**

```css
/* New implementation */
.bg-stripes-dark {
  background-image: url('/stripes.svg');
  background-repeat: repeat;
}
```

**Affected files:**

| File | Change |
|------|--------|
| `apps/web/src/index.css` | Modify `.bg-stripes-dark` class |
| `apps/web/public/stripes.svg` | New file |
| `UnavailabilityOverlay.tsx` | No change (class name unchanged) |

**Current state:**
- CSS gradient stripes: ✅ Implemented (current)
- SVG stripes: ❌ **Needs implementation**

**Source:** [REQ-05](new-requirements-04.md#req-05-unavailability-overlay---css-gradient--svg)

---

## Summary Table

| REQ | Title | Priority | Complexity | Category |
|-----|-------|----------|------------|----------|
| REQ-01 | Pick and Place | High | High | Performance/UX |
| REQ-02 | Right Click Context Menu | Medium | Medium | UX |
| REQ-03 | Column Focus During Pick | Medium | Medium | UX |
| REQ-04 | Job Details Panel Fixed Height | Low | Low | UI |
| REQ-05 | Unavailability Overlay SVG | Low | Low | Performance |

---

## Suggested Release Grouping

| Release | Requirements | Focus |
|---------|--------------|-------|
| v0.3.54 | REQ-01 (partial) | Pick & Place - sidebar tasks |
| v0.3.55 | REQ-01 (partial), REQ-03 | Visual feedback, column focus |
| v0.3.57 | REQ-01 (complete) | Pick & Place from grid tiles |
| v0.3.63 | REQ-02 | Context menu |
| v0.3.XX | REQ-04 | Fixed tile height |
| v0.3.XX | REQ-05 | SVG stripes |

> **Note:** Version numbers for REQ-04 and REQ-05 are TBD based on release planning.

---

## Experimental Branch Reference

All requirements in this document have experimental implementations on:

> **Branch:** `feature/v0.3.66-element-types`

**Important:** The experimental code needs reimplementation to fit the `ux-ui-development` branch architecture:
- Build on `ux-ui-development` branch codebase
- Use mock mode (like all v0.3.x releases)
- Use existing `@flux/types` types
