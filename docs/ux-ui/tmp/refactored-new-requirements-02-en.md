# Refactored Requirements (Part 2)

This document contains the reformulated, precise requirements from the second batch.

---

## REQ-01/02/03: Drag Snapping Consistency

> ✅ **Implemented in v0.3.41** (2026-01-06)

**Description:**
During drag operations, there is an inconsistency between the visual snap position of the tile and the validation/drop position. The tile visually snaps to the grid, but validation and border color feedback are based on the cursor position, not the snapped position.

**Problem breakdown:**

| REQ | Issue | Root Cause |
|-----|-------|------------|
| REQ-01 | Tile top doesn't snap to actual drop position during drag-over | Visual snap and drop calculation mismatch |
| REQ-02 | Border color (green/red/amber) based on cursor, not snapped tile | Validation uses cursor position |
| REQ-03 | `calculateScheduledStartFromPointer` doesn't apply `snapToGrid` | Missing snap step before validation |

**Example scenario:**
```
1. User drags tile to 12:45
2. DragPreview snaps and shows 13:00 (visual)
3. Validation checks 12:45 → red border (lunch break 12:00-13:00)
4. User drops → tile lands at 13:00 (valid position)
5. User confused: red border shown, but drop succeeded
```

**Expected behavior:**
```
1. User drags tile to 12:45
2. DragPreview snaps and shows 13:00 (visual)
3. Validation checks 13:00 → green border (valid)
4. User drops → tile lands at 13:00
5. Consistent feedback throughout
```

**Fix location:** `apps/web/src/App.tsx` - `calculateScheduledStartFromPointer` function

**Fix implementation:**
```typescript
// Current (buggy):
const absoluteY = calculateTileTopPosition(clientY, rect.top, grabOffsetY);
const dropTime = yPositionToTime(absoluteY, START_HOUR, startDate);

// Fixed:
const absoluteY = calculateTileTopPosition(clientY, rect.top, grabOffsetY);
const snappedY = snapToGrid(absoluteY);  // ← ADD THIS
const dropTime = yPositionToTime(snappedY, START_HOUR, startDate);
```

**Current state:**
- Visual snap during drag: ✅ Implemented (DragLayer.tsx)
- Snap on drop: ✅ Implemented
- Snap before validation: ❌ **Missing**

**Source:** [REQ-01](new-requirements-02.md#req-01), [REQ-02](new-requirements-02.md#req-02), [REQ-03](new-requirements-02.md#req-03)

---

## REQ-04: UnavailabilityOverlay Multi-Day Support

**Description:**
The `UnavailabilityOverlay` (striped background for unavailable time periods like lunch breaks) only appears on the first day in a multi-day grid. Other days show no unavailability indication.

**Current behavior:**
```
Day 1 (Mon)     Day 2 (Tue)     Day 3 (Wed)
┌──────────┐    ┌──────────┐    ┌──────────┐
│          │    │          │    │          │
│ ░░░░░░░░ │    │          │    │          │  ← No overlay!
│ (12-13)  │    │          │    │          │
│          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘
```

**Expected behavior:**
```
Day 1 (Mon)     Day 2 (Tue)     Day 3 (Wed)
┌──────────┐    ┌──────────┐    ┌──────────┐
│          │    │          │    │          │
│ ░░░░░░░░ │    │ ░░░░░░░░ │    │ ░░░░░░░░ │  ← Overlay on all days
│ (12-13)  │    │ (12-13)  │    │ (12-13)  │
│          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘
```

**Root cause:**
`StationColumn` renders a single `UnavailabilityOverlay` for the entire column, using only the first day's schedule. Multi-day grid requires per-day overlay rendering.

**Affected files:**
- `apps/web/src/components/StationColumns/StationColumn.tsx`
- `apps/web/src/components/UnavailabilityOverlay/UnavailabilityOverlay.tsx`

**Implementation suggestion:**
1. Calculate day boundaries in the visible grid
2. For each day, render a separate `UnavailabilityOverlay` with that day's schedule
3. Position each overlay at the correct Y offset for its day

**Current state:**
- UnavailabilityOverlay component: ✅ Exists
- Single-day rendering: ✅ Works
- Multi-day rendering: ❌ **Missing**

**Source:** [REQ-04](new-requirements-02.md#req-04)

---

## REQ-05: Job Card Overflow Fix

**Description:**
Job cards in the left sidebar panel overflow their container. The date field ("11/01/2026") extends beyond the panel boundary.

**Current behavior:**
```
┌─ Jobs Panel (w-72) ─────────┐
│ ┌─ Job Card ─────────────────│──┐  ← Overflow!
│ │ Reference: TEST-001        │  │
│ │ Client: Very Long Client N │me│
│ │ Date: 11/01/2026          │  │
│ └────────────────────────────│──┘
└──────────────────────────────┘
```

**Expected behavior:**
```
┌─ Jobs Panel (w-72) ─────────┐
│ ┌─ Job Card ───────────────┐│
│ │ Reference: TEST-001      ││
│ │ Client: Very Long Cli... ││  ← Truncated with ellipsis
│ │ Date: 11/01/2026         ││
│ └──────────────────────────┘│
└──────────────────────────────┘
```

**Root cause:**
Missing overflow handling CSS properties on job card container.

**Affected files:**
- `apps/web/src/components/JobDetailsPanel/` components
- `apps/web/src/components/JobsList/` components

**Fix implementation:**
```css
/* Add to job card container */
overflow: hidden;
max-width: 100%;

/* Add to text elements that may overflow */
text-overflow: ellipsis;
white-space: nowrap;
overflow: hidden;
```

Or with Tailwind:
```tsx
<div className="overflow-hidden max-w-full">
  <span className="truncate block">...</span>
</div>
```

**Current state:**
- Job card layout: ✅ Exists
- Overflow handling: ❌ **Missing**

**Source:** [REQ-05](new-requirements-02.md#req-05)

---

## REQ-06: Non-Selected Tiles Should Be Clickable

**Description:**
When a job is selected, tiles belonging to other jobs on the grid cannot be clicked. Expected behavior: clicking any tile should select its associated job.

**Current behavior:**
```
Job A selected:
┌─────────────────────┐
│ [Tile A] ← Clickable │
│ [Tile B] ← NOT clickable (other job) │
│ [Tile C] ← NOT clickable (other job) │
└─────────────────────┘
```

**Expected behavior:**
```
Job A selected:
┌─────────────────────┐
│ [Tile A] ← Clickable (stays selected) │
│ [Tile B] ← Clickable (selects Job B)  │
│ [Tile C] ← Clickable (selects Job C)  │
└─────────────────────┘
```

**Root cause:**
Likely one of:
1. Non-selected tiles have `pointer-events: none` CSS
2. An overlay covers non-selected tiles
3. Click handler doesn't fire for muted tiles

**Affected files:**
- `apps/web/src/components/Tile/Tile.tsx`
- `apps/web/src/components/SchedulingGrid/SchedulingGrid.tsx`

**Investigation needed:**
Check for `pointer-events-none` class on muted tiles in `Tile.tsx`.

**Current state:**
- Tile click handler: ✅ Exists (`onClick` prop)
- Click on non-selected tiles: ❌ **Not working**

**Source:** [REQ-06](new-requirements-02.md#req-06)

---

## REQ-07: Toolbar/Sidebar Layout Reorganization

**Description:**
Restructure the main layout so the sidebar spans full viewport height and the toolbar sits to the right of the sidebar.

**Current layout:**
```
┌─────────────────────────────────────┐
│ Flux Logo   [toolbar]        ⚙  👤  │  ← Full-width toolbar
├────────┬────────────────────────────┤
│        │                            │
│  SIDE  │         CONTENT            │
│  BAR   │                            │
│        │                            │
└────────┴────────────────────────────┘
```

**Expected layout:**
```
┌────────┬────────────────────────────┐
│        │      [toolbar]             │  ← Toolbar beside sidebar
│        ├────────────────────────────┤
│  SIDE  │                            │
│  BAR   │         CONTENT            │
│        │                            │
│   ⚙   │                            │  ← Icons at sidebar bottom
│   👤   │                            │
└────────┴────────────────────────────┘
```

**Changes required:**

| REQ | Change | Description |
|-----|--------|-------------|
| 7.1 | Sidebar full height | Sidebar spans from viewport top to bottom |
| 7.2 | Remove "Flux" logo | Delete logo/branding from toolbar |
| 7.3 | Move right icons | Settings/user icons move to sidebar bottom |

**Affected files:**
- `apps/web/src/App.tsx` - main layout structure
- `apps/web/src/components/TopNavBar/TopNavBar.tsx` - toolbar component
- `apps/web/src/components/Sidebar/Sidebar.tsx` - sidebar component

**Implementation suggestion:**
```tsx
// App.tsx layout change
<div className="h-screen flex">
  {/* Sidebar - full height */}
  <Sidebar className="h-full flex flex-col justify-between">
    <nav>{/* Navigation icons */}</nav>
    <div>{/* Settings, User icons at bottom */}</div>
  </Sidebar>

  {/* Main content area */}
  <div className="flex-1 flex flex-col">
    <TopNavBar /> {/* No logo, no right icons */}
    <main>{/* Grid content */}</main>
  </div>
</div>
```

**Current state:**
- Full-width toolbar: ✅ Implemented
- Full-height sidebar: ❌ **Missing**
- Logo in toolbar: ✅ Exists (to be removed)
- Icons in toolbar: ✅ Exists (to be moved)

**Source:** [REQ-07](new-requirements-02.md#req-07-toolbarsidebar-layout-átszervezés)

---

## REQ-08: Extended Zoom Levels

**Description:**
Extend the available zoom levels to include smaller (25%) and current set options.

**Current zoom levels:**
| Zoom % | PIXELS_PER_HOUR |
|--------|-----------------|
| 50% | 40px |
| 75% | 60px |
| 100% | 80px |
| 150% | 120px |
| 200% | 160px |

**Expected zoom levels:**
| Zoom % | PIXELS_PER_HOUR |
|--------|-----------------|
| **25%** | **20px** |
| 50% | 40px |
| 75% | 60px |
| 100% | 80px |
| 150% | 120px |
| 200% | 160px |

**Affected files:**
- `apps/web/src/components/TopNavBar/TopNavBar.tsx` - zoom selector
- Zoom state/context where `ZOOM_LEVELS` is defined

**Implementation:**
Add 25% option to the zoom levels array:
```typescript
const ZOOM_LEVELS = [25, 50, 75, 100, 150, 200];
// or
const ZOOM_CONFIGS = [
  { percent: 25, pixelsPerHour: 20 },
  { percent: 50, pixelsPerHour: 40 },
  // ...
];
```

**Current state:**
- Zoom control: ✅ Implemented
- 25% zoom level: ❌ **Missing**

**Source:** [REQ-08](new-requirements-02.md#req-08-zoom-szintek)

---

## REQ-09: DateStrip Redesign

**Description:**
Comprehensive redesign of the DateStrip component with infinite scrolling, centered focus, and updated visual states.

### REQ-09.1: Infinite DateStrip

**Current behavior:**
- Fixed `dayCount` (default 21 days)
- Cannot scroll beyond the defined range

**Expected behavior:**
- Infinite scroll in both directions
- Days loaded dynamically as user scrolls
- No fixed limit

### REQ-09.2: Focused Day Centering

**Current behavior:**
- Visible/focused day position varies
- Grid and DateStrip scroll independently (partially)

**Expected behavior:**
- The day visible in the grid viewport is always centered in the DateStrip
- Grid scroll ↔ DateStrip scroll synchronized bidirectionally

**Visual representation:**
```
DateStrip (visible area):
         ┌─────────────────────┐
... Mo Tu│ We  Th [FR] Sa  Su │Mo Tu ...
         └─────────────────────┘
                  ↑
            Focused/visible day
            always centered
```

### REQ-09.3: Visual States Overhaul

**Current state (`DateCell.tsx:55-61`):**
- `isToday`: Amber background (`bg-amber-500/15`)

**Expected visual states:**

| State | Description | Visual Indicator |
|-------|-------------|------------------|
| **Current day** | Today's date | Thin vertical line inside cell (NOT background color), similar to grid's current time line |
| **Focused day** | Day visible in grid viewport | Highlighted background or border |
| **Departure date** | Selected job's deadline | Red background/text (REQ-15, already implemented) |
| **Scheduled day** | Has scheduled task for active job | Green dot indicator (REQ-16, already implemented) |

**Current day indicator change:**
```
BEFORE (background):          AFTER (line):
┌──────────┐                  ┌──────────┐
│ ▓▓▓▓▓▓▓▓ │                  │    │     │
│ ▓▓ Tu ▓▓ │        →         │ Tu │     │
│ ▓▓ 06 ▓▓ │                  │ 06 │     │
│ ▓▓▓▓▓▓▓▓ │                  │    │     │
└──────────┘                  └──────────┘
   Amber bg                    Thin line
```

**Affected files:**
- `apps/web/src/components/DateStrip/DateStrip.tsx`
- `apps/web/src/components/DateStrip/DateCell.tsx`

**Current state:**
- Fixed day count: ✅ (to be removed)
- Infinite scroll: ❌ **Missing**
- Centered focus: ❌ **Missing**
- Today amber background: ✅ (to be changed to line)
- Departure date highlight: ✅ Implemented
- Scheduled day indicator: ✅ Implemented

**Source:** [REQ-09](new-requirements-02.md#req-09-datestrip-átdolgozás)

---

## REQ-10: Precedence Constraint Visualization

**Description:**
During drag operations, display visual guides showing the valid time range based on precedence constraints. Two horizontal lines indicate the earliest and latest possible start times.

### When to Display

| Condition | Lines shown |
|-----------|-------------|
| During drag | Yes |
| Not dragging | No |
| Hovering over target column | Yes |
| Hovering over other columns | No |
| No predecessor scheduled | No purple line |
| No successor scheduled | No orange line |

### Line Specifications

| Line | Color | When Visible | Position |
|------|-------|--------------|----------|
| **Earliest possible** | Purple (`#A855F7`) | Predecessor task is scheduled | `predecessor.scheduledEnd` (+ 4h dry time if printing task) |
| **Latest possible** | Orange (`#F97316`) | Successor task is scheduled | `successor.scheduledStart - currentTask.duration` |

### Calculation Logic

```typescript
// Get predecessor and successor from task's job
const job = findJob(snapshot, task.jobId);
const taskIndex = job.tasks.findIndex(t => t.id === task.id);
const predecessorTask = taskIndex > 0 ? job.tasks[taskIndex - 1] : null;
const successorTask = taskIndex < job.tasks.length - 1 ? job.tasks[taskIndex + 1] : null;

// Earliest start (purple line)
let earliestStart: Date | null = null;
if (predecessorTask) {
  const predecessorAssignment = findAssignment(predecessorTask.id);
  if (predecessorAssignment) {
    earliestStart = new Date(predecessorAssignment.scheduledEnd);
    // Add dry time if predecessor is printing task
    if (isPrintingTask(snapshot, predecessorAssignment.targetId)) {
      earliestStart = addMinutes(earliestStart, DRY_TIME_MINUTES); // 240 min
    }
  }
}

// Latest start (orange line)
let latestStart: Date | null = null;
if (successorTask) {
  const successorAssignment = findAssignment(successorTask.id);
  if (successorAssignment) {
    const taskDuration = getTaskDurationMinutes(task);
    latestStart = subMinutes(
      new Date(successorAssignment.scheduledStart),
      taskDuration
    );
  }
}
```

### Visual Appearance

Similar style to `PlacementIndicator` (horizontal line with glow effect):

```tsx
// Purple line (earliest)
<div
  className="absolute left-0 right-0 h-1 bg-purple-500 z-30 pointer-events-none"
  style={{
    top: `${earliestY}px`,
    boxShadow: '0 0 12px rgba(168, 85, 247, 0.8)',
  }}
/>

// Orange line (latest)
<div
  className="absolute left-0 right-0 h-1 bg-orange-500 z-30 pointer-events-none"
  style={{
    top: `${latestY}px`,
    boxShadow: '0 0 12px rgba(249, 115, 22, 0.8)',
  }}
/>
```

### Visual Example

```
Station Column (during drag)
┌────────────────────────────┐
│                            │
│ ════════════════════════   │ ← Purple line (earliest: 09:00)
│                            │
│      ┌──────────────┐      │
│      │  Drag tile   │      │ ← Tile being dragged
│      └──────────────┘      │
│                            │
│ ════════════════════════   │ ← Orange line (latest: 14:00)
│                            │
│      ┌──────────────┐      │
│      │ Successor    │      │ ← Successor task (starts 15:00)
│      └──────────────┘      │
└────────────────────────────┘
```

**Affected files:**
- `apps/web/src/components/StationColumns/StationColumn.tsx` - line rendering
- `apps/web/src/dnd/DragStateContext.tsx` - add constraint data to drag state
- `packages/validator/src/validators/precedence.ts` - reuse `getEffectivePredecessorEnd`

**New component suggestion:**
```tsx
// PrecedenceLines.tsx
interface PrecedenceLinesProps {
  earliestY: number | null;  // null = no line
  latestY: number | null;    // null = no line
}

export function PrecedenceLines({ earliestY, latestY }: PrecedenceLinesProps) {
  return (
    <>
      {earliestY !== null && <div className="..." style={{ top: earliestY }} />}
      {latestY !== null && <div className="..." style={{ top: latestY }} />}
    </>
  );
}
```

**Current state:**
- Precedence validation: ✅ Implemented
- Dry time calculation: ✅ Implemented (`getEffectivePredecessorEnd`)
- Visual constraint lines: ❌ **Missing**

**Source:** [REQ-10](new-requirements-02.md#req-10-precedence-constraint-vizualizáció)

---

## Summary Table

| REQ | Title | Priority | Complexity |
|-----|-------|----------|------------|
| REQ-01/02/03 | Drag Snapping Consistency | High | Low |
| REQ-04 | UnavailabilityOverlay Multi-Day | Medium | Medium |
| REQ-05 | Job Card Overflow Fix | Low | Low |
| REQ-06 | Non-Selected Tiles Clickable | Medium | Low |
| REQ-07 | Layout Reorganization | Medium | Medium |
| REQ-08 | Extended Zoom Levels | Low | Low |
| REQ-09 | DateStrip Redesign | Medium | High |
| REQ-10 | Precedence Constraint Visualization | Medium | Medium |

---

## Planned Releases

| Release | Requirements | Focus |
|---------|--------------|-------|
| v0.3.41 | REQ-01, 02, 03 | Drag Snapping Consistency |
| v0.3.42 | REQ-04, 05, 06 | UI Bug Fixes |
| v0.3.43 | REQ-07, 08 | Layout Redesign & Zoom |
| v0.3.44 | REQ-09 | DateStrip Redesign |
| v0.3.45 | REQ-10 | Precedence Constraint Visualization |
