# Refactored Requirements (Part 3)

This document contains the reformulated, precise requirements from the third batch.

---

## REQ-01: Month Visibility in DateStrip

**Description:**
The DateStrip (vertical day list) currently only displays day names and numbers (e.g., "Ve 09", "Sa 10"), making it difficult to determine which month is being viewed. Users lose context when navigating between months.

**Current behavior:**
```
┌───────────┐
│  Ve  09   │
├───────────┤
│  Sa  10   │
├───────────┤
│  Di  11   │  ← Which month is this? Unknown!
├───────────┤
│  Lu  12   │
├───────────┤
│  Ma  13   │
└───────────┘
```

**Expected behavior:**
```
Option A: Sticky month header (above DateStrip)
┌───────────┐
│ JAN 2026  │  ← Always visible, updates on scroll
├───────────┤
│  Ve  09   │
├───────────┤
│  Sa  10   │
├───────────┤
│  Di  11   │
└───────────┘

Option B: Tooltip on hover
┌───────────┐
│  Ve  09   │ ──→ "Friday, January 9, 2026"
├───────────┤
│  Sa  10   │
└───────────┘

Option C: Month indicator on first day of month (within cell)
┌───────────┐
│  Me  31   │
├───────────┤
│ JAN       │  ← Small month label inside the "01" cell
│  Je  01   │
├───────────┤
│  Ve  02   │
└───────────┘
```

**Possible implementations:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Sticky header | Always shows current month | Takes vertical space |
| B | Tooltip on hover | No layout changes | Requires user action |
| C | Month in first-day cell | Maintains consistency | May be missed when scrolling |

**Affected files:**
- `apps/web/src/components/DateStrip/DateStrip.tsx`
- `apps/web/src/components/DateStrip/DateCell.tsx`

**Current state:**
- Day display: ✅ Implemented
- Month visibility: ❌ **Missing**

**Source:** [REQ-01](new-requirements-03.md#req-01-month-visibility-in-datestrip)

---

## REQ-02: Clickable Dates in Job Details Panel

**Description:**
The "Départ" (workshop exit date) and "BAT Approuvé" (proof approval date) fields in the Job Details Panel should be interactive. Clicking on them should navigate the DateStrip to that date.

**Current behavior:**
```
┌─ Job Details ─────────────────┐
│ Départ: 15/01/2026            │  ← Static text, not clickable
│ BAT: Approuvé 07/01 12:00     │  ← Static text, not clickable
└───────────────────────────────┘
```

**Expected behavior:**
```
┌─ Job Details ─────────────────┐
│ Départ: [15/01/2026]          │  ← Clickable, scrolls to Jan 15
│ BAT: Approuvé [07/01] 12:00   │  ← Clickable, scrolls to Jan 07
└───────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ ... 13  14 [15] 16  17 ...              │  ← DateStrip scrolls and focuses
└─────────────────────────────────────────┘
```

**Click behavior:**
1. DateStrip scrolls to center the clicked date
2. The date cell becomes focused/highlighted
3. Smooth scroll animation

**Affected files:**
- `apps/web/src/components/JobDetailsPanel/JobDetailsPanel.tsx` - clickable dates
- `apps/web/src/components/DateStrip/DateStrip.tsx` - `scrollToDate` API

**Implementation suggestion:**
```tsx
// JobDetailsPanel.tsx
<span
  onClick={() => scrollToDate(job.workshopExitDate)}
  className="cursor-pointer hover:underline text-blue-400"
>
  {formatDate(job.workshopExitDate)}
</span>

// DateStrip.tsx
export interface DateStripHandle {
  scrollToDate: (date: Date) => void;
}
```

**Current state:**
- Date display: ✅ Implemented
- Clickable dates: ❌ **Missing**
- DateStrip scrollTo API: ❌ **Missing**

**Source:** [REQ-03](new-requirements-03.md#req-03-clickable-dates-in-job-details)

---

## REQ-03: Precedence Lines Should Respect Non-Working Hours

**Description:**
The precedence constraint lines (purple for earliest start, orange for latest start) do not account for non-working hours (lunch breaks, weekends, etc.) when calculating positions.

**Current behavior:**
```
Predecessor task ends: 11:30
Dry time: +4 hours
Current calculation: 15:30 ← WRONG (ignores lunch break)

Timeline:
11:00 ──┬── 12:00 ──┬── 13:00 ──┬── 14:00 ──┬── 15:00 ──┬── 16:00
        │ Pred ends │░░░░░░░░░░░│           │           │
        │   11:30   │  LUNCH    │           │  Purple   │
        │           │ (ignored) │           │  line at  │
        │           │           │           │  15:30    │
```

**Expected behavior:**
```
Predecessor task ends: 11:30
Dry time: +4 hours
Lunch break: 12:00-13:00 (1 hour non-working)
Correct calculation: 16:30 ← Accounts for lunch

Timeline:
11:00 ──┬── 12:00 ──┬── 13:00 ──┬── 14:00 ──┬── 15:00 ──┬── 16:00 ──┬── 17:00
        │ Pred ends │░░░░░░░░░░░│           │           │           │
        │   11:30   │  LUNCH    │           │           │  Purple   │
        │           │ (counted) │           │           │  line at  │
        │           │           │           │           │  16:30    │
```

**Calculation logic:**
```typescript
// Current (incorrect):
earliestStart = predecessorEnd + dryTime;

// Expected (correct):
earliestStart = addWorkingTime(predecessorEnd, dryTime, station.operatingSchedule);
```

**Time periods to account for:**
- Daily lunch breaks (from operatingSchedule)
- Non-working hours (before/after business hours)
- Weekend days
- Station exceptions (holidays, closures)

**Affected files:**
- `apps/web/src/App.tsx` - constraint calculation logic
- `packages/validator/src/validators/precedence.ts` - shared logic
- New utility: `addWorkingTime.ts` or extend existing time utilities

**Current state:**
- Precedence lines: ✅ Implemented (v0.3.45)
- Working hours consideration: ❌ **Missing**

**Source:** [REQ-04](new-requirements-03.md#req-04-precedence-lines-ignore-non-working-hours)

---

## REQ-04: Visual Hint for Impossible Placement

**Description:**
When the earliest possible start time (purple line) is after the latest possible start time (orange line), it means the task cannot fit between its predecessor and successor. This situation is currently difficult to interpret visually.

**Current behavior:**
```
Station Column:
┌────────────────────────────┐
│                            │
│ ════════════════════════   │ ← Orange line (latest: 09:00)
│                            │
│                            │  ← User confused: what does this mean?
│                            │
│ ════════════════════════   │ ← Purple line (earliest: 11:00)
│                            │
└────────────────────────────┘
```

**Expected behavior:**
```
Station Column:
┌────────────────────────────┐
│                            │
│ ════════════════════════   │ ← Orange line (latest: 09:00)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │ ← Red/striped zone
│ ▓▓▓  IMPOSSIBLE ZONE  ▓▓▓  │ ← Clear visual indication
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
│ ════════════════════════   │ ← Purple line (earliest: 11:00)
│                            │
│      ⚠ Task cannot fit     │ ← Optional tooltip/message
└────────────────────────────┘
```

**Visual indicators:**

| Element | Description |
|---------|-------------|
| Red/striped zone | Covers area between orange and purple lines when inverted |
| Warning icon | Appears in the zone or near the tile |
| Tooltip | "Task cannot fit between predecessor and successor" |
| Border color | Could use a distinct color (not just red) |

**Detection logic:**
```typescript
const isImpossiblePlacement = earliestStart > latestStart;

if (isImpossiblePlacement) {
  // Show visual warning
  // Optionally: show specific message about time gap needed
  const gapNeeded = earliestStart - latestStart;
}
```

**Affected files:**
- `apps/web/src/components/ConstraintLines/` or similar
- Drag validation logic in `App.tsx`

**Current state:**
- Precedence lines: ✅ Implemented
- Impossible placement detection: ❌ **Missing**
- Visual warning for impossible placement: ❌ **Missing**

**Source:** [REQ-05](new-requirements-03.md#req-05-visual-hint-for-impossible-placement)

---

## REQ-05: Dragover Performance with Many Tiles

**Description:**
Dragover performance is still slow when there are many tiles on the grid, despite optimization efforts in v0.3.46 (Tile memoization).

**Observed symptoms:**
- Noticeable lag with 20+ tiles
- Tile component is memoized, but other components may be re-rendering unnecessarily
- Potential causes: StationColumn re-renders, constraint line calculations per frame

**Current architecture:**
```
Drag event
    │
    ▼
┌─────────────────┐
│   DragLayer     │  ← Updates on every mouse move
└────────┬────────┘
         │
    ▼    ▼    ▼
┌───────┐┌───────┐┌───────┐
│Station││Station││Station│  ← May re-render unnecessarily
│Column ││Column ││Column │
└───┬───┘└───┬───┘└───┬───┘
    │        │        │
  ┌─┴─┐    ┌─┴─┐    ┌─┴─┐
  │Tile│   │Tile│   │Tile│  ← Memoized, but parent re-renders
  └───┘    └───┘    └───┘
```

**Investigation checklist:**
- [ ] Profile with React DevTools Profiler
- [ ] Check StationColumn render frequency during drag
- [ ] Check if constraint line calculation runs every frame
- [ ] Verify Tile memo comparison function
- [ ] Check for unnecessary context subscriptions

**Potential optimizations:**

| Area | Optimization |
|------|--------------|
| StationColumn | Memoize with custom comparison |
| Constraint lines | Calculate only when target changes |
| Drag state | Use refs for high-frequency updates |
| Event throttling | Throttle dragover handler (~60fps) |

**Affected files:**
- `apps/web/src/components/StationColumns/StationColumn.tsx`
- `apps/web/src/components/Tile/Tile.tsx`
- `apps/web/src/dnd/DragStateContext.tsx`
- Drag-related hooks

**Current state:**
- Tile memoization: ✅ Implemented (v0.3.46)
- StationColumn memoization: ❓ Needs investigation
- Constraint line optimization: ❓ Needs investigation
- Overall drag performance: ❌ **Needs improvement**

**Source:** [REQ-06](new-requirements-03.md#req-06-dragover-performance-with-many-tiles)

---

## REQ-06: Clarify Group Capacity Display

**Description:**
The station column headers display group capacity information (e.g., "Presses Offset (0/10)"), but the meaning is not immediately clear to users.

**Current display:**
```
┌─ Station Header ─────────────────┐
│ Komori G40                       │
│ Presses Offset (0/10)            │ ← What does this mean?
└──────────────────────────────────┘
```

**Actual meaning (from REQ-18 implementation):**
| Field | Description |
|-------|-------------|
| `currentUsage` | Number of tasks running concurrently in the group **at current real time** |
| `maxConcurrent` | Maximum allowed concurrent tasks for this group |

**Reference time:** `new Date()` - actual current moment (`SchedulingGrid.tsx:182`)
- NOT the focused/viewed time on the grid
- NOT the maximum usage across the entire schedule

**Example:** `(0/10)` = "Right now, 0 tasks are running, max 10 can run concurrently in this group"

**Problems:**
1. Meaning is not clear at first glance
2. Not obvious that it refers to "right now"
3. For scheduling purposes, max usage or focused time usage might be more useful

**Current tooltip (`StationHeader.tsx:189-191`):**
```
"Presses Offset: 0/10 concurrent tasks"
```
Only visible on hover, not very explanatory.

**Possible improvements:**

| Option | Description |
|--------|-------------|
| Better tooltip | "Currently 0 active / max 10 parallel" |
| Visual indicator | Progress bar instead of text |
| Different metric | Show max usage across schedule |
| Show focused time | Usage at the time currently viewed |
| Localization | French tooltip for French UI |

**Affected files:**
- `apps/web/src/components/StationHeaders/StationHeader.tsx`
- `apps/web/src/utils/groupCapacity.ts`

**Current state:**
- Capacity display: ✅ Implemented
- Clear explanation: ❌ **Needs improvement**

**Source:** [REQ-08](new-requirements-03.md#req-08-clarify-group-capacity-display)

---

## REQ-07: Human-Readable Validation Messages

**Description:**
When a tile cannot be placed at a position, a red border appears but the reason is unknown. Users need clear, human-readable explanations for why a drop is invalid.

**Current behavior:**
```
┌─────────────────────┐
│  ┌──────────────┐   │
│  │ 🔴 Red border │   │  ← Why can't I drop here?
│  │              │   │
│  └──────────────┘   │
└─────────────────────┘
```

**Expected behavior:**
```
┌─────────────────────┐
│  ┌──────────────┐   │
│  │ 🔴 Red border │   │
│  │              │   │
│  └──────────────┘   │
│  ┌────────────────┐ │
│  │ ⚠ Station not  │ │  ← Clear explanation
│  │   operating    │ │
│  └────────────────┘ │
└─────────────────────┘
```

**Display options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| Tooltip on tile | Shows on hover during drag | Contextual | May be hard to read |
| Side panel | Fixed position overlay | Always visible | Takes space |
| Toast notification | Appears briefly | Non-intrusive | May miss it |

**Validation message types:**

| Conflict Type | Example Message |
|---------------|-----------------|
| Station unavailable | "Station is not operating at this time (lunch break 12:00-13:00)" |
| Task conflict | "Conflicts with existing task: PRINT-001" |
| Precedence (early) | "Predecessor task ends at 14:00, earliest start is 14:00 (+ 4h dry time)" |
| Precedence (late) | "Successor task starts at 10:00, latest start is 08:30" |
| BAT not approved | "BAT not yet approved for this job" |
| Group capacity | "Group capacity exceeded (3/2 concurrent tasks)" |

**Implementation approach:**
```typescript
interface ValidationResult {
  isValid: boolean;
  conflicts: ConflictInfo[];
  messages: string[]; // Human-readable messages
}

// During drag, show first/most important message
const primaryMessage = validation.messages[0];
```

**Affected files:**
- `apps/web/src/components/DragPreview/DragPreview.tsx` - tooltip display
- `packages/validator/` - message generation
- `apps/web/src/dnd/` - validation hooks

**Current state:**
- Validation logic: ✅ Implemented
- Visual feedback (border color): ✅ Implemented
- Human-readable messages: ❌ **Missing**

**Source:** [REQ-09](new-requirements-03.md#req-09-human-readable-validation-messages)

---

## REQ-08: Hide DateStrip Scrollbar

> ✅ **Implemented in v0.3.49**

**Description:**
The DateStrip displays a scrollbar during scrolling, which is visually distracting and doesn't fit the UI design. The scrollbar should be hidden while maintaining scroll functionality.

**Current behavior:**
```
┌─ DateStrip ─────────────────────────────┬───┐
│  Lu   Ma   Me   Je   Ve   Sa   Di   Lu  │ ▒ │ ← Visible scrollbar
│  12   13   14   15   16   17   18   19  │ ▒ │
└─────────────────────────────────────────┴───┘
```

**Expected behavior:**
```
┌─ DateStrip ─────────────────────────────────┐
│  Lu   Ma   Me   Je   Ve   Sa   Di   Lu      │ ← No scrollbar
│  12   13   14   15   16   17   18   19      │
└─────────────────────────────────────────────┘
   (scroll still works via mouse wheel/touch)
```

**Implementation:**

```css
/* Webkit (Chrome, Safari, Edge) */
.datestrip-container::-webkit-scrollbar {
  display: none;
}

/* Firefox */
.datestrip-container {
  scrollbar-width: none;
}

/* IE/Edge legacy */
.datestrip-container {
  -ms-overflow-style: none;
}
```

Or with Tailwind CSS:
```tsx
<div className="overflow-x-auto scrollbar-hide">
  {/* DateStrip content */}
</div>

// tailwind.config.js - add plugin or custom utility
```

**Affected files:**
- `apps/web/src/components/DateStrip/DateStrip.tsx`

**Current state:**
- DateStrip scroll: ✅ Implemented
- Hidden scrollbar: ❌ **Missing**

**Source:** [REQ-11](new-requirements-03.md#req-11-hide-datestrip-scrollbar)

---

## Summary Table

| REQ | Title | Priority | Complexity | Category |
|-----|-------|----------|------------|----------|
| REQ-01 | Month Visibility in DateStrip | Medium | Low | UX |
| REQ-02 | Clickable Dates in Job Details | Low | Low | UX |
| REQ-03 | Precedence Lines + Working Hours | Medium | High | Logic |
| REQ-04 | Impossible Placement Visual | Medium | Medium | UX |
| REQ-05 | Dragover Performance | High | High | Performance |
| REQ-06 | Group Capacity Clarification | Low | Low | UX |
| REQ-07 | Validation Messages | Medium | Medium | UX |
| REQ-08 | Hide DateStrip Scrollbar | Low | Low | UI |

> **Note:** REQ-02 (Auto-Scroll on Drag), REQ-07 (Undo/Redo), and REQ-10 (Auto-Scroll to Valid Position) have been moved to [backlog.md](backlog.md).

---

## Suggested Release Grouping

| Release | Requirements | Focus |
|---------|--------------|-------|
| v0.3.49 | REQ-08 | Quick UI fix (scrollbar) |
| v0.3.50 | REQ-01, REQ-02, REQ-06 | DateStrip & UX improvements |
| v0.3.51 | REQ-04 | Visual hint for impossible placement |
| v0.3.52 | REQ-07 | Validation messages |
| v0.3.53 | REQ-03 | Precedence + working hours |
| v0.3.54 | REQ-05 | Performance optimization |
