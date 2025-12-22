# Refactored Requirements

This document contains the reformulated, precise requirements.

---

## REQ-01: Job Focus Visual Effect

**Description:**
When the user selects (focuses) a job, the same visual effect should appear on the scheduling grid as during a drag operation.

**Visual behavior:**

| Element | Style |
|---------|-------|
| **Selected job's tiles** | Glow effect: `box-shadow: 0 0 12px 4px ${job.color}99` |
| **Other jobs' tiles** | Muted: `filter: saturate(0.2); opacity: 0.6` |

**Triggering event:**
- Job selection in the jobs list (click)
- Job selection by clicking a tile on the grid

**Reset:**
- Job deselect (selecting another job, or clicking the same job again)

**Current state:**
- Glow effect is already implemented for selected tiles (`isSelected` prop)
- Muting effect is only active during drag (`activeJobId` prop based)
- **Missing:** Applying muting effect on job selection as well (not just during drag)

**Implementation suggestion:**
In the `Tile` component, extend the `isMuted` logic: tile should be muted if `selectedJobId !== undefined && selectedJobId !== job.id` (not just based on `activeJobId`).

**Clarifying questions:**

| Question | Answer |
|----------|--------|
| What are the exact visual styles during drag? | Based on source code (`Tile.tsx`): Muting: `filter: saturate(0.2); opacity: 0.6`, Glow: `box-shadow: 0 0 12px 4px ${job.color}99` |

**Source:** [REQ-01](new-requirements.md#req-01)

---

## REQ-02/03: Job Deselection Methods

**Description:**
The user should be able to close/deselect the selected job (and thereby the Job Details Panel) in multiple ways.

**Expected deselection methods:**

| Method | Description | Location |
|--------|-------------|----------|
| **Close button (X)** | Click on X icon | Top right corner of Job Details Panel |
| **Toggle click** | Click again on already selected job | Jobs List (left panel) |

**Visual specification - Close button:**
- Position: Top right corner of Job Details Panel
- Icon: `X` (lucide-react)
- Size: `w-5 h-5`
- Color: `text-zinc-500 hover:text-zinc-300`

**Behavior:**
- Close button click → `setSelectedJobId(null)`
- Click on selected job in Jobs List → `setSelectedJobId(null)` (toggle)
- In both cases the Job Details Panel disappears

**Current state:**
- Close button: **Missing**
- Toggle click in Jobs List: **Missing** (only set, no toggle)
- Toggle click on grid tile: **Already implemented** (Tile.tsx)

**Implementation suggestion:**
1. `JobDetailsPanel.tsx`: Add close button, `onClose` prop
2. `JobsList.tsx` / `App.tsx`: Toggle logic: `onSelectJob?.(selectedJobId === job.id ? null : job.id)`

**Source:** [REQ-02](new-requirements.md#req-02), [REQ-03](new-requirements.md#req-03)

---

## REQ-04/05/06: Top Navigation Bar with Controls

**Description:**
Add a horizontal navigation bar at the top of the screen containing global controls for the scheduling view.

**Expected layout:**
```
+--------------------------------------------------------------------------------+
|  [Logo]    [Quick Placement]    [Zoom: -  100%  +]         [User] [Settings]   |
+--------------------------------------------------------------------------------+
+--------+------------+-------------+------+----------+-------------------+
| SIDE-  |   JOBS     |    JOB      | DATE | TIMELINE |   STATION         |
| BAR    |   LIST     |   DETAILS   | STRIP|          |   COLUMNS         |
+--------+------------+-------------+------+----------+-------------------+
```

**Components in the nav bar:**

| Element | Position | Description |
|---------|----------|-------------|
| **Logo / App name** | Left | Flux branding |
| **Quick Placement button** | Center-left | Toggle button alongside ALT+Q |
| **Zoom control** | Center | Vertical zoom % selector |
| **User / Settings** | Right | Account, settings |

**REQ-05: Quick Placement Button**
- Toggle button that activates/deactivates Quick Placement Mode
- Visual feedback for active state (highlighted/pressed state)
- Same behavior as ALT+Q (ALT+Q still works)
- Prerequisite: Job selected (disabled if none)

**REQ-06: Zoom Mode (Vertical Grid Zoom)**
- Vertical zoom of the grid, i.e., changing the `PIXELS_PER_HOUR` value
- Zoom levels expressed in % (100% = current 80px/hour)
- Suggested levels: 50%, 75%, 100%, 150%, 200%
- UI: `[-]  100%  [+]` buttons or dropdown

| Zoom % | PIXELS_PER_HOUR | Effect |
|--------|-----------------|--------|
| 50% | 40px | More hours visible, smaller tiles |
| 75% | 60px | More compact view |
| 100% | 80px | Current default |
| 150% | 120px | Larger tiles, fewer hours |
| 200% | 160px | More detailed view |

**Visual specification - Nav Bar:**
- Height: `h-12` (48px)
- Background: `bg-zinc-900`
- Border: `border-b border-white/5`
- Full width

**Sidebar:** Stays in its current position (below nav bar, on the left)

**Current state:**
- Horizontal nav bar: **Missing**
- Quick Placement button: **Missing** (only ALT+Q)
- Zoom control: **Missing** (fixed 80px/hour)

**Clarifying questions:**

| Question | Answer |
|----------|--------|
| What is the exact meaning of "task granularity" zoom? | Vertical zoom of the grid, i.e., changing the `PIXELS_PER_HOUR` value |
| Zoom levels in % or named presets (Hour/Day/Week)? | Expressed in % |
| Should the sidebar stay in its current position or move to the nav bar? | Stay in current position (below nav bar, on the left) |

**Source:** [REQ-04](new-requirements.md#req-04), [REQ-05](new-requirements.md#req-05), [REQ-06](new-requirements.md#req-06)

---

## REQ-07: Enhanced Job Progression Visualization

**Description:**
On job cards in the Jobs List, replace the current progress dots with a more advanced visualization that shows both task status and size.

**Visual behavior - Task states:**

| State | Condition | Color |
|-------|-----------|-------|
| **Unscheduled** | `!assignment` (no assignment for the task) | Empty (border only, `border-zinc-700`) |
| **Scheduled, incomplete** | `assignment && !isCompleted && scheduledEnd > now` | Gray (`bg-zinc-500`) |
| **Scheduled, completed** | `assignment && isCompleted` | Green (`bg-emerald-500`) |
| **Scheduled, late** | `assignment && !isCompleted && scheduledEnd < now` | Red (`bg-red-500`) |

**Visual behavior - Segments (size-based):**

| Task type | Duration | Appearance |
|-----------|----------|------------|
| Internal, ≤ 30 min | `setupMinutes + runMinutes` | Standard size (fixed width, e.g., `w-2`) |
| Internal, > 30 min | `setupMinutes + runMinutes` | Proportional width, rounded corners |
| Outsourced | `durationOpenDays` | 5× standard size, with label (e.g., "2JO") |

**Layout:**
- Segments can wrap to multiple lines (`flex-wrap`)
- No maximum width restriction

**Goal:**
> "The goal is to be able to, at a glance, get a feel of the size of the jobs and actions"

At a glance, it should be visible:
- How many tasks are in the job
- Which are scheduled, which are not
- Which are completed, which are late
- Relative size of tasks

**Current state:**
- `ProgressDots` component: **Only completed/pending, doesn't check assignment**
- Size-based visualization: **Missing**
- Late (red) state: **Missing**

**Implementation suggestion:**
1. New component: `ProgressSegments` instead of `ProgressDots`
2. Input: `tasks: Task[]`, `assignments: TaskAssignment[]` (not just counts)
3. For each task: state calculation based on assignment
4. Internal task width: `Math.max(8, duration / 30 * 8)` px
5. Outsourced task width: 5 × standard (40px), + label

**Clarifying questions:**

| Question | Answer |
|----------|--------|
| Task duration: `setupMinutes + runMinutes`? | Yes |
| What should be the size for outsourced tasks? | 5× standard size, with duration label inside (e.g., "2JO") |
| Is maximum width restriction needed? | No, visualization can wrap to multiple lines |

**Source:** [REQ-07](new-requirements.md#req-07)

---

## REQ-08/09: Snapping Drag Preview with Vertical Constraint

**Description:**
The drag preview should snap to the grid position during drag so the user can clearly see where the tile will land. Additionally, drag should only be possible vertically (tiles cannot move between columns).

**REQ-08: Drag Preview Snapping**

| Current behavior | Expected behavior |
|------------------|-------------------|
| DragPreview freely follows the cursor | DragPreview snaps to nearest 30-minute position |
| Snap only happens on drop | Snap in real-time, during drag |

**Implementation details:**
- In `DragLayer.tsx`, the `top` position needs to be snapped: `snapToGrid(position.y - grabOffset.y)`
- Horizontal position (`left`) can remain fixed (center of column)

**REQ-09: Vertical-Only Drag**

Tiles can only be moved vertically (in time), not horizontally (station is predetermined for the task).

| Context | Behavior |
|---------|----------|
| Task from sidebar to grid | Can only drop in the target station column |
| Tile on the grid | Can only move vertically, column is fixed |

**Current state:**
- Horizontal restriction: **Already implemented** (can only drop in one column based on task.stationId)
- Snap during drag: **Missing** (only snaps on drop)

**Clarifying questions:**

| Question | Answer |
|----------|--------|
| Tile snap during drag or only on drop? | Snap during drag (real-time) |

**Source:** [REQ-08](new-requirements.md#req-08), [REQ-09](new-requirements.md#req-09)

---

## REQ-10: Global Timeline Compaction

**Description:**
Global "compaction" function that removes gaps between tasks on all stations within a specified time horizon. The function will be available in the top nav bar (REQ-04/05/06).

**Difference from existing station compact:**

| Property | Station Compact (existing) | Timeline Compaction (new) |
|----------|----------------------------|---------------------------|
| Scope | One station | All stations |
| Trigger | Button in station header | Button in top nav bar |
| Time horizon | None (all tasks) | Selectable: 4h / 8h / 24h |
| Reference | None | Current time |
| Protection | None | Tasks in progress are immobile |
| Precedence | Doesn't check | Respects precedence rules |

**Time horizon options:**

| Option | Meaning |
|--------|---------|
| 4h | Next 4 hours |
| 8h | Next 8 hours |
| 24h | Next 24 hours |

**Behavior:**
1. Starting point: `now` (current system time)
2. End point: `now + selectedHorizon`
3. **Immobile tasks:** Those where `scheduledStart < now` OR in progress (`scheduledStart <= now && scheduledEnd > now`)
4. **Movable tasks:** Those where `scheduledStart >= now` AND within the time horizon
5. Compaction proceeds left to right (station order) and top to bottom (time order)
6. **Respects precedence rules:** Compaction cannot create precedence violations

**UI specification (in top nav bar):**
```
[Compact: 4h] [8h] [24h]   -->  Segmented buttons
```

**Current state:**
- Global timeline compaction: **Missing**
- Per-station compact: **Implemented** (v0.3.22)

**Clarifying questions:**

| Question | Answer |
|----------|--------|
| UI form: Dropdown or segmented buttons? | Segmented buttons |
| Is a "Compact All" option needed (without time horizon)? | No |
| Does compaction respect precedence rules? | Yes |

**Source:** [REQ-10](new-requirements.md#req-10)

---

## REQ-11: Dry Time (Drying Delay After Printing)

**Description:**
After printing, drying time is needed before the next task can start. This does not appear as a separate station or column but modifies the precedence rules.

**Domain concept:**

| Property | Description |
|----------|-------------|
| **Dry time** | Fixed waiting time between printing completion and next task start |
| **Scope** | Application-level constant (not configurable) |
| **Application** | After every printing task (offset press category) |
| **Not a station** | Does not appear as a column on the grid |
| **Precedence modifier** | `printingTask.scheduledEnd + DRY_TIME > successor.scheduledStart` = conflict |

**Example:**
```
DRY_TIME = 4 hours (constant)

Traditional precedence:
  Printing ends at 10:00 → Next task can start at 10:00

With dry time:
  Printing ends at 10:00 → Next task can start at 14:00
  Precedence check: scheduledEnd (10:00) + DRY_TIME (4h) = 14:00
```

**Visual behavior:**
- Precedence violation feedback same as other violations (red halo)
- **Label** on the precedence bar in Job Details Panel: `+4h drying`

```
Job Details Panel - Task List:
┌─────────────────────────────────┐
│ [Komori] Printing  ──────────   │
│        ════════════════════     │  ← precedence bar
│        +4h drying               │  ← dry time label
│ [Massicot] Cutting  ─────────   │
└─────────────────────────────────┘
```

**Implementation suggestion:**
1. Constant: `DRY_TIME_MINUTES = 240` (4 hours) - application level
2. Modify precedence validation: if predecessor is printing task, then `scheduledEnd + DRY_TIME`
3. Based on station category: `category.id === 'offset-press'` or similar

**Current state:**
- Dry time concept: **Missing**
- Precedence: `predecessor.scheduledEnd > successor.scheduledStart`
- No delay support between tasks

**Clarifying questions:**

| Question | Answer |
|----------|--------|
| Where should dry time be configurable? | Application-level constant (not user-configurable) |
| Fixed values or freely specifiable? | Fixed value |
| Required after every print, or only certain types? | After every print |

**Source:** [REQ-11](new-requirements.md#req-11)

---

## REQ-12: Persistent Visual Feedback for Precedence Violations

**Description:**
When a task is scheduled with a precedence violation (Alt+drag bypass), the tiles should show **persistent visual feedback**, not just during drag.

**Current behavior:**
```
1. User drags task
2. Precedence conflict detected → column shows amber ring
3. User presses Alt → column shows amber warning
4. User drops task
5. Tile placed → NO VISUAL INDICATION of the conflict
6. Job appears in Problems section (conflict) ✓
```

**Expected behavior:**
```
1. User drags task
2. Precedence conflict detected → column shows amber ring
3. User presses Alt → column shows amber warning
4. User drops task
5. Tile placed → PERSISTENT YELLOW/AMBER GLOW on affected tiles
6. Job appears in Problems section (conflict) ✓
```

**Visual specification:**

| State | Tile appearance |
|-------|-----------------|
| Normal | No glow |
| Selected | Job color glow: `box-shadow: 0 0 12px 4px ${job.color}99` |
| **Precedence conflict** | **Amber glow: `box-shadow: 0 0 12px 4px #F59E0B99`** |
| Selected + Conflict | Amber glow overrides job color glow |

**Affected tiles:**
- The task tile violating precedence (placed in wrong position)
- Optionally: the predecessor task tile as well (the one in conflict with)

**Data model change:**
- `ScheduleConflict` already exists and contains the `taskId`
- The `Tile` component needs to know if there's an active conflict for its task

**Current state:**
- Persistent conflict glow: **Missing**
- Conflict data available: **Yes** (`conflicts` array in snapshot)
- Problems section: **Already exists**

**Implementation suggestion:**
1. `Tile` component: new prop `hasConflict?: boolean`
2. If `hasConflict`, then amber glow: `box-shadow: 0 0 12px 4px #F59E0B99`
3. Determining conflict tiles: `conflicts.filter(c => c.type === 'PrecedenceConflict').map(c => c.taskId)`

**Source:** [REQ-12](new-requirements.md#req-12)

---

## REQ-13: Fix Alt+Drag Bypass Conflict Recording (BUG)

**Description:**
The original request of REQ-12 and REQ-13 ("Precedence violations should affect job appearance and position") is already implemented. The UX designer couldn't see it working because:

1. **BUG: Alt+drag bypass doesn't record the conflict** - The validator returns no conflict when `bypassPrecedence=true`, so the `hasPrecedenceConflict` flag is false, and the conflict is not saved
2. **Mock data inconsistency** - Mock only generates static conflicts based on `CONFLICT_TEST` marker, not based on actual precedence violations

**Current (buggy) behavior:**
```
1. User drags task over invalid position
2. Precedence conflict detected → hasPrecedenceConflict = true
3. User presses Alt → bypassPrecedence = true
4. Validation re-runs → returns NO conflict (bypass active)
5. hasPrecedenceConflict = false (!)
6. bypassedPrecedence = wasAltPressed && hasPrecedenceConflict = true && false = false
7. No conflict added → Job NOT in Problems section
```

**Expected behavior:**
```
1. User drags task over invalid position
2. Precedence conflict detected → hasPrecedenceConflict = true
3. User presses Alt → bypassPrecedence = true (visual warning shown)
4. User drops task
5. Conflict IS recorded (bypassedPrecedence = true)
6. Job appears in Problems section with amber styling
7. Tile shows persistent amber glow (REQ-12)
```

**Fix suggestion:**
Modify the `bypassedPrecedence` flag calculation in `App.tsx`:
```typescript
// Current (buggy):
const bypassedPrecedence = wasAltPressed && currentValidation.hasPrecedenceConflict;

// Fixed:
// Validation WITHOUT bypass to detect if conflict exists
const conflictCheckValidation = validateAssignment(
  { ...proposed, bypassPrecedence: false },
  snapshot
);
const hadPrecedenceConflict = conflictCheckValidation.conflicts.some(
  c => c.type === 'PrecedenceConflict'
);
const bypassedPrecedence = wasAltPressed && hadPrecedenceConflict;
```

**Current state:**
- Problems section styling: ✅ Implemented
- JobCard conflict styling: ✅ Implemented
- Alt+drag bypass: ⚠️ Bug - conflict not saved
- Persistent tile glow (REQ-12): ❌ Missing

**Relationship with REQ-12:**
This bug fix is a prerequisite for REQ-12 (persistent glow) to work. If no conflict is saved, there's nothing to display.

**Source:** [REQ-13](new-requirements.md#req-13)

---

## REQ-14/15/16/17: Multi-Day Grid Navigation & Date Strip Integration

**Description:**
Navigation and synchronization between grid and DateStrip doesn't work, and multi-day support and contextual highlighting are missing.

**Problem summary:**

| REQ | Problem | Current state |
|-----|---------|---------------|
| REQ-14 | Day navigation | Grid only shows 1 day, `onDateClick` not connected, no scroll sync |
| REQ-15 | Departure date highlight | No highlighted departure date on DateStrip |
| REQ-16 | Scheduled days highlight | No indication which days have scheduled tasks |
| REQ-17 | Virtual scrolling | Scroll doesn't extend background, fixed-size grid |

**REQ-14: Day Navigation & Scroll Sync**

| Feature | Description |
|---------|-------------|
| Click-to-scroll | DateStrip day click → Grid scrolls there |
| Bidirectional scroll sync | DateStrip and Grid scroll together |
| Multi-day support | Grid should show multiple days, scrollable between days |

**REQ-15: Departure Date Highlight**

Selected job's departure date highlighted on DateStrip.

| State | Appearance |
|-------|------------|
| Normal day | `text-zinc-500`, `border-white/5` |
| Today | `text-amber-200`, `bg-amber-500/15` |
| **Departure date (selected job)** | **`text-red-300`, `bg-red-500/10`, `border-red-500/30`** |

**REQ-16: Scheduled Days Highlight**

Days where the selected job has scheduled tasks.

| State | Appearance |
|-------|------------|
| **Has scheduled task** | **Small indicator dot or `bg-emerald-500/10` background** |

**REQ-17: Virtual Scrolling / Extended Grid Background**

The grid background (grid lines, unavailability overlay) should extend when scrolling.

| Current | Expected |
|---------|----------|
| Fixed-size grid (24h × hoursToDisplay) | Dynamically expanding grid or virtual scrolling |
| Scroll doesn't extend background | Scroll → background follows |

**Implementation suggestions:**

1. **Scroll sync:** Shared scroll container, or `onScroll` event handler that synchronizes
2. **DateStrip props extension:**
   ```typescript
   interface DateStripProps {
     startDate: Date;
     dayCount?: number;
     onDateClick?: (date: Date) => void;
     departureDate?: Date;  // REQ-15
     scheduledDays?: Date[];  // REQ-16
   }
   ```
3. **Virtual scrolling:** Use `react-virtualized` or `@tanstack/virtual`

**Current state:**
- Multi-day grid: ❌ Only 1 day (24h)
- Click-to-scroll: ❌ `onDateClick` not connected
- Scroll sync: ❌ DateStrip and Grid independent
- Departure date highlight: ❌ Missing
- Scheduled days highlight: ❌ Missing
- Virtual scrolling: ❌ Fixed size

**Clarifying questions:**

| Question | Answer |
|----------|--------|
| "Scrolling doesn't pass to next day" | Grid currently only shows 1 day |
| "Day column behaviours" | Click → scroll, Grid scroll → DateStrip follows |
| DateStrip fixed or scrolls? | Scrolls together with grid |

**Source:** [REQ-14](new-requirements.md#req-14), [REQ-15](new-requirements.md#req-15), [REQ-16](new-requirements.md#req-16), [REQ-17](new-requirements.md#req-17)

---

## REQ-18: Machine Group Capacity Limits Visualization

**Description:**
The parallel capacity limits (`maxConcurrent`) belonging to station groups (StationGroup) are not visible and not validated in the UI. The UX designer cannot see:
- Which station belongs to which group
- What is the group's maximum parallel capacity
- When the capacity is utilized/exceeded

**Domain context:**

| Concept | Description |
|---------|-------------|
| **StationGroup** | Logical grouping with capacity restriction |
| **maxConcurrent** | Max parallel tasks in the group (null = unlimited) |
| **isOutsourcedProviderGroup** | Outsource provider groups are always unlimited |
| **GroupCapacityConflict** | Conflict type when capacity is exceeded |

**Current state:**

| Component | Status |
|-----------|--------|
| `StationGroup.maxConcurrent` type | ✅ Defined (`packages/types`) |
| `validateGroupCapacity` validator | ✅ Implemented (`packages/validator`) |
| `GroupCapacityConflict` conflict type | ✅ Exists |
| Station header: group display | ❌ **Missing** |
| Grid: capacity utilization visualization | ❌ **Missing** |
| Drag: capacity conflict feedback | ❌ **Missing** |
| Tile: conflict glow on capacity exceeded | ❌ **Missing** |

**Expected features:**

**1. Station Header - Group information:**
```
┌─────────────────────────────────────┐
│ Komori 5L          [↑2] [↓1] [⊕]   │
│ Offset Press (2/3)                  │  ← Group name + capacity
└─────────────────────────────────────┘
```

| Element | Description |
|---------|-------------|
| Group name | The group.name belonging to the station's groupId |
| Capacity display | `(active/maxConcurrent)`, e.g., "(2/3)" |
| If unlimited | Only group name, no capacity number |

**2. Grid - Capacity visualization:**

According to documentation (`conflict-indicators.md`):
> "Time slot highlighted in yellow/orange across affected columns"

| State | Visual |
|-------|--------|
| Capacity < 50% | Normal |
| Capacity 50-99% | Light yellow background (optional warning) |
| **Capacity = 100% (limit)** | **Yellow/orange time slot highlight** |
| **Capacity > 100% (exceeded)** | **Red time slot highlight** |

**3. Drag - Capacity validation:**

| Drag state | Feedback |
|------------|----------|
| Drop wouldn't exceed capacity | Green ring (valid drop) |
| **Drop would exceed capacity** | **Red ring (blocked drop)** |

The `validateGroupCapacity` already returns `GroupCapacityConflict`, but the UI needs to display it.

**4. Conflict display:**

After placement if group capacity is exceeded:
- Affected tiles: Yellow/orange glow (similar to precedence conflict)
- Job appears in Problems section

**Business Rules reference:**
- `BR-GROUP-002`: "At any point in time, the number of active tasks on stations in a group CANNOT exceed MaxConcurrent"
- `BR-SCHED-002`: "The system MUST prevent any state where station group concurrent task count exceeds MaxConcurrent"

**Mock data context:**
The `generateStationGroups()` generator currently creates these groups:

| Group | maxConcurrent |
|-------|---------------|
| offset-press-group | 3 |
| finishing-group | null (unlimited) |
| binding-group | 2 |
| Outsource provider groups | null (always unlimited) |

**Clarifying questions:**

| Question | Answer |
|----------|--------|
| Should there be capacity info in the station header? | The capacity overload should be displayed in the timeline as a red indicator that, on hover, gives contextual clues such as which group is causing the capacity overload, "Capacity exceeded" with the current capacity employed and the maximum capacity. For example "Folding group capacity exceeded : 4/3.". The tiles of the overloaded group get a red glow and "conflict" color glow.|
| Real-time capacity display (e.g., "2/3") or only on conflict? | Only conflict. |
| Grid time slot highlight format? | Yellow/orange background on affected time period |

**Source:** [REQ-18](new-requirements.md#req-18)

---

## REQ-19: Outsourcing Columns (Provider Display)

**Description:**
Outsourced providers (external suppliers) do not appear on the scheduling grid, despite existing in the data model and being documented as columns.

**Domain context:**

| Concept | Description |
|---------|-------------|
| **OutsourcedProvider** | External company that performs certain workflows |
| **isOutsourced** | Assignment flag: true = assigned to provider, false = assigned to station |
| **Unlimited capacity** | Provider groups are always unlimited capacity |
| **Provider group** | `StationGroup` where `isOutsourcedProviderGroup: true` |

**Current state:**

| Component | Status |
|-----------|--------|
| `OutsourcedProvider` type | ✅ Defined (`packages/types`) |
| `TaskAssignment.isOutsourced` flag | ✅ Exists |
| Mock provider data (Clément, Reliure Express) | ✅ Generated |
| Outsourced assignments generation | ✅ Works |
| **Provider columns on grid** | ❌ **Missing** |
| **Outsourced assignment rendering** | ❌ **Skipped!** |

**Critical bug in code (`SchedulingGrid.tsx`):**
```typescript
assignments.forEach((assignment) => {
  // Skip outsourced assignments - they go to providers, not stations
  if (assignment.isOutsourced) return;  // <-- Skips them!
  ...
});
```

**Expected appearance:**

Provider columns after station columns, to the right:
```
Station Columns                    Provider Columns
┌──────────┬──────────┐           ┌────────────────────┐
│ Komori   │ Massicot │           │ Clément            │
├──────────┼──────────┤           ├─────────┬──────────┤
│  Tile A  │  Tile C  │           │ Task X  │ Task Y   │  ← Parallel subcolumns
│          │          │           │         │          │
│  Tile B  │          │           │         │ Task Z   │
└──────────┴──────────┘           └─────────┴──────────┘
```

**Visual difference from stations:**

| Property | Station Column | Provider Column |
|----------|----------------|-----------------|
| Background | `bg-[#0a0a0a]` | Slightly different (e.g., `bg-zinc-900/80`) |
| Header icon | None or machine icon | Company/outsource icon (e.g., `building-2`) |
| Capacity | Fixed (1 or maxConcurrent) | Unlimited (subcolumn layout) |
| Overlap | Not possible (push down) | Subcolumns (calendar-like) |

**Subcolumn layout (Calendar-style parallel tasks):**

When multiple outsourced tasks overlap in time, they appear **side by side** within the same column:

```
Provider: Clément (width: 240px)
─────────────────────────────────
08:00  ┌────────────┬────────────┐
       │   Task A   │   Task B   │   ← 2 parallel → subcolumn width = 120px
09:00  ├────────────┤            │
       │   Task C   │            │   ← Task C starts, still 2 subcolumns
10:00  └────────────┴────────────┘
10:00  ┌────────────────────────┐
       │       Task D           │   ← 1 task → full width (no subcolumns)
11:00  └────────────────────────┘
11:00  ┌────────┬────────┬──────┐
       │ Task E │ Task F │Task G│   ← 3 parallel → 3 subcolumns
12:00  └────────┴────────┴──────┘
```

**Subcolumn calculation algorithm:**
1. Determine max concurrent task count at each time point
2. Assign subcolumn index to each task (greedy: first free slot)
3. Subcolumn width: `column_width / max_concurrent_in_range`

**Mock data context:**

| Provider | Supported Actions | Group |
|----------|-------------------|-------|
| Clément | binding, laminating | grp-clement |
| Reliure Express | binding | grp-reliure |

**Implementation suggestions:**

1. **Add provider columns to SchedulingGrid:**
   - After station columns
   - Own header component with outsource icon

2. **Enable outsourced assignment rendering:**
   - Remove the `if (assignment.isOutsourced) return;`
   - Route to provider columns

3. **Implement subcolumn layout:**
   - Concurrent task detection
   - Subcolumn index assignment
   - Width and left position calculation

**Business Rules reference:**
- `BR-PROVIDER-003`: "Provider has unlimited capacity"
- `BR-GROUP-003`: "Outsourced provider groups are unlimited"

**Clarifying questions:**

| Question | Answer |
|----------|--------|
| Where should provider columns appear? | They should have an order assigned to them exaclty like the other stations do |
| Visual difference from station columns? | Yes, Column header has a dedicated icon and the column border is dotted, as well as the placed job tile's thick border |
| Is parallel layout needed now? | Yes, calendar-like subcolumns for overlapping tasks |
| Subcolumn = parallel tasks side by side? | Yes, within the same column, side by side with reduced width |

**Source:** [REQ-19](new-requirements.md#req-19)

---

## REQ-20: Similarities Feature Completion

**Description:**
The similarity indicators infrastructure is partially implemented, but the printing press criteria don't fully work because fields are missing from the `Job` type and mock data.

**REQ-20 request (printing press criteria):**

| Criterion | Job field | Status |
|-----------|-----------|--------|
| Same paper type | `paperType` | ✅ Exists |
| Same paper weight | `paperWeight` | ❌ **Missing** |
| Same paper sheet size | `paperFormat` | ✅ Exists |
| Same inking | `inking` | ❌ **Missing** |

**Current state:**

| Component | Status |
|-----------|--------|
| `SimilarityIndicators` component | ✅ Implemented |
| `compareSimilarity` logic | ✅ Works |
| SchedulingGrid integration | ✅ Passes `similarityResults` |
| `Job.paperType` | ✅ Exists, mock generates value |
| `Job.paperFormat` | ✅ Exists, mock generates value |
| `Job.inking` | ❌ **Missing from type** |
| `Job.paperWeight` | ❌ **Missing from type** |

**The problem in detail:**

The mock criteria (`stations.ts`):
```typescript
const OFFSET_PRESS_CRITERIA = [
  { name: 'Même type de papier', fieldPath: 'paperType' },   // ✅ works
  { name: 'Même format', fieldPath: 'paperFormat' },         // ✅ works
  { name: 'Même encrage', fieldPath: 'inking' },             // ⚠️ ALWAYS MATCHED!
];
```

Since the `inking` field doesn't exist on Job, both jobs have `undefined`, and `valuesMatch(undefined, undefined) = true` → **misleading "matched" icon**.

**Required changes:**

**1. Extend Job type (`packages/types/src/job.ts`):**
```typescript
export interface Job {
  // ... existing fields ...

  /** Paper type and weight description (e.g., "CB300") */
  paperType?: string;
  /** Paper dimensions (e.g., "63x88") */
  paperFormat?: string;
  /** Paper weight in g/m² (e.g., 300) */
  paperWeight?: number;           // ← NEW
  /** Inking configuration (e.g., "CMYK", "4C+0", "Pantone 123") */
  inking?: string;                // ← NEW
}
```

**2. Extend mock generator (`apps/web/src/mock/generators/jobs.ts`):**
```typescript
const PAPER_WEIGHTS = [80, 100, 120, 150, 170, 200, 250, 300, 350];
const INKINGS = ['CMYK', '4C+0', '4C+4C', '2C+0', 'Pantone 485+Black', '1C+0'];

// In job generator:
paperType: randomElement(PAPER_TYPES),
paperFormat: randomElement(PAPER_FORMATS),
paperWeight: randomElement(PAPER_WEIGHTS),    // ← NEW
inking: randomElement(INKINGS),               // ← NEW
```

**3. Backend API synchronization (future task):**
- Job entity extension needed in PHP API as well
- DTO updates
- Migration for existing data

**Visual behavior (already implemented):**

```
+------------------------+
|     Tile A (Job A)     |
+------------------------+
         🔗 🔗 🔗 ⛓️‍💥      ← 3 matched, 1 not matched
+------------------------+
|     Tile B (Job B)     |
+------------------------+
```

- `🔗` (link icon, `text-zinc-400`) = criterion matches
- `⛓️‍💥` (unlink icon, `text-zinc-800`) = criterion doesn't match

**Clarifying questions:**

| Question | Answer |
|----------|--------|
| Type of `inking` field? | Free-form string (e.g., "CMYK", "4C+0", "Pantone 123") |
| Type of `paperWeight` field? | Number in g/m² (e.g., 300) |
| "paper sheet size" = `paperFormat`? | Yes |
| Other similarity criteria needed? | Not now, only printing press |

**Source:** [REQ-20](new-requirements.md#req-20)
