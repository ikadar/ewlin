# Flux Scheduler - DateStrip & Pick&Place Manual QA

> **Feature Group:** DateStrip & Pick&Place
> **Batch:** B8
> **Features:** SCHED-115 – SCHED-152 (38 Active)
> **Releases:** v0.3.47 – v0.3.60

---

## Overview

Ez a dokumentum a DateStrip & Pick&Place feature-ök Manual QA tesztjeit tartalmazza. A feature csoport a következő fő területeket fedi le:

- **DateStrip Visual Markers** - ViewportIndicator, Task Markers, ExitTriangle, Task Timeline
- **DateStrip UX** - Date tooltip, clickable dates, zoom-aware snapping
- **Drying Time Visualization** - Yellow arrow indicator, "End of drying" label
- **Validation Messages** - French validation feedback, working hours support
- **Pick & Place System** - Sidebar pick, column focus, visual feedback, grid pick
- **Context Menu** - Right-click tile actions
- **UI Polish** - Fixed tile height, SVG overlay

---

## Test Fixtures

| Fixture | URL | Leírás |
|---------|-----|--------|
| `datestrip-markers` | `?fixture=datestrip-markers` | ViewportIndicator, task markers testing |
| `validation-messages` | `?fixture=validation-messages` | Jobs with validation warnings |
| `sidebar-drag` | `?fixture=sidebar-drag` | Sidebar pick: 1 job, 1 unscheduled task |
| `context-menu` | `?fixture=context-menu` | Multiple tiles for context menu testing |
| `alt-bypass` | `?fixture=alt-bypass` | Precedence bypass: Task 1 scheduled, Task 2 unscheduled |
| `drying-time` | `?fixture=drying-time` | Printing task with successor for drying visualization |

---

## Test Scenarios

### DS-001: ViewportIndicator Display

**Feature:** SCHED-115 (ViewportIndicator)
**Fixture:** `datestrip-markers`
**Priority:** P1

**Steps:**
1. Load the application (`http://localhost:5173/?fixture=datestrip-markers`)
2. Look at the DateStrip column
3. Scroll the grid vertically
4. Observe ViewportIndicator movement

**Expected Results:**
- [ ] Gray semi-transparent rectangle visible in DateStrip
- [ ] Rectangle height proportional to visible grid portion
- [ ] Rectangle position updates as grid scrolls
- [ ] Background color: `bg-white/5`

**Related Tests:** `datestrip-markers.spec.ts`

---

### DS-002: Task Markers in DateStrip

**Feature:** SCHED-116 (Task Markers), SCHED-117 (Marker Status Colors)
**Fixture:** `datestrip-markers`
**Priority:** P1

**Steps:**
1. Select a job with multiple scheduled tasks
2. Look at the DateStrip column
3. Observe colored horizontal lines

**Expected Results:**
- [ ] Colored lines appear at task start times
- [ ] Lines span 50% of DateStrip cell width (ml-[50%])
- [ ] Colors match task status:
  - Emerald: Completed tasks
  - Amber: Scheduled but incomplete
  - Rose: Validation warnings
- [ ] Multiple tasks on same time stack vertically (gap-0.5)

**Related Tests:** `datestrip-markers.spec.ts`

---

### DS-003: ExitTriangle Marker

**Feature:** SCHED-118 (ExitTriangle)
**Fixture:** `datestrip-markers`
**Priority:** P2

**Steps:**
1. Select a job with a departure date
2. Look at the DateStrip at the departure date

**Expected Results:**
- [ ] Red triangle marker visible on departure date
- [ ] Triangle positioned at right edge of cell
- [ ] Triangle points left (indicating deadline)
- [ ] Triangle color: red-500

**Related Tests:** `datestrip-markers.spec.ts`

---

### DS-004: Task Timeline Dotted Line

**Feature:** SCHED-119 (Task Timeline)
**Fixture:** `datestrip-markers`
**Priority:** P2

**Steps:**
1. Select a job with scheduled tasks and departure date
2. Look at the DateStrip between tasks and exit

**Expected Results:**
- [ ] Dotted vertical line connects task markers to ExitTriangle
- [ ] Line style: `border-dashed border-l-2`
- [ ] Line color: white/30
- [ ] Line spans from last task marker to exit triangle

---

### DS-005: "Now" Line in DateStrip

**Feature:** SCHED-120 (DateStrip Now Line)
**Fixture:** `test`
**Priority:** P1

**Steps:**
1. Load the application
2. Find today's date in DateStrip
3. Compare with grid "now" line

**Expected Results:**
- [ ] Thin red horizontal line at current time
- [ ] Line position matches grid's "now" line
- [ ] Line color: red-500
- [ ] Line height: 1px

---

### DS-006: Zoom-Aware Snapping

**Feature:** SCHED-121 (Zoom-Aware Snapping)
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Set zoom to 25%
2. Pick a task and place it
3. Set zoom to 200%
4. Pick and place another task

**Expected Results:**
- [ ] At 25% zoom: snapping to 60-minute intervals
- [ ] At 50% zoom: snapping to 30-minute intervals
- [ ] At 100%+ zoom: snapping to 15-minute intervals
- [ ] Visual preview snaps to correct intervals at each zoom

---

### DS-007: Hidden Scrollbar

**Feature:** SCHED-122 (Hidden Scrollbar)
**Fixture:** `test`
**Priority:** P3

**Steps:**
1. Load the application
2. Observe the DateStrip column
3. Try to scroll within DateStrip

**Expected Results:**
- [ ] No visible scrollbar in DateStrip
- [ ] DateStrip syncs with grid scroll (not independent)
- [ ] Clean visual appearance

---

### DS-008: Date Tooltip (French)

**Feature:** SCHED-123 (Date Tooltip)
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Hover over a date cell in DateStrip
2. Wait for tooltip to appear

**Expected Results:**
- [ ] Tooltip appears with full date in French format
- [ ] Format: "mercredi 15 janvier 2026"
- [ ] Tooltip positioned below cursor
- [ ] Tooltip disappears on mouse leave

---

### DS-009: Clickable Departure Date

**Feature:** SCHED-124 (Clickable Departure Date)
**Fixture:** `datestrip-markers`
**Priority:** P1

**Steps:**
1. Select a job with departure date
2. Find the departure date in DateStrip (red highlight)
3. Click on the departure date

**Expected Results:**
- [ ] Grid scrolls to show departure date at top
- [ ] Scroll animation is smooth
- [ ] Focus remains on selected job
- [ ] Departure date visible in viewport after click

---

### DS-010: Drying Time Indicator

**Feature:** SCHED-125 (DryingTimeIndicator), SCHED-126 (Yellow Arrow)
**Fixture:** `drying-time`
**Priority:** P1

**Steps:**
1. Select a job with printing task (has successor)
2. Look at the printing tile on the grid
3. Find the drying time indicator

**Expected Results:**
- [ ] Yellow arrow appears at end of printing tile
- [ ] Arrow points down (↓)
- [ ] Arrow positioned at tile's bottom edge
- [ ] Arrow color: yellow-500

---

### DS-011: "End of Drying" Label

**Feature:** SCHED-127 (End of Drying Label)
**Fixture:** `drying-time`
**Priority:** P2

**Steps:**
1. Select a job with printing task
2. Look at the grid +4h after printing ends

**Expected Results:**
- [ ] "End of drying" label appears in timeline
- [ ] Label positioned at printing end + 4 hours
- [ ] Label in French: "Fin de séchage"
- [ ] Yellow text color

---

### DS-012: Validation Message Display

**Feature:** SCHED-128 (ValidationMessage), SCHED-129 (French Messages)
**Fixture:** `validation-messages`
**Priority:** P1

**Steps:**
1. Load the fixture with validation warnings
2. Pick a task
3. Hover over an invalid drop zone

**Expected Results:**
- [ ] Validation message appears near cursor
- [ ] Message in French (e.g., "Station incompatible")
- [ ] Background: semi-transparent dark
- [ ] Message disappears when moving to valid zone

**French validation messages:**
- "Station incompatible" - Wrong station type
- "Chevauchement de tâche" - Overlapping task
- "Hors des heures ouvrables" - Outside working hours
- "Violation de précédence" - Precedence violation
- "Temps de séchage insuffisant" - Insufficient drying time

---

### DS-013: Working Hours Precedence Lines

**Feature:** SCHED-130 (addWorkingTime), SCHED-131 (subtractWorkingTime)
**Fixture:** `precedence-visualization`
**Priority:** P2

**Steps:**
1. Select a job with precedence constraints
2. Pick the second task
3. Observe precedence lines

**Expected Results:**
- [ ] Purple line (earliest) accounts for working hours
- [ ] Line skips lunch break (12:00-13:00)
- [ ] Line skips non-working hours (before 06:00, after 18:00)
- [ ] Orange line (latest) also accounts for working hours

---

### DS-014: Sidebar Task Pick

**Feature:** SCHED-132 (PickStateContext), SCHED-133 (Sidebar Pick)
**Fixture:** `sidebar-drag`
**Priority:** P1

**Steps:**
1. Select a job with unscheduled task
2. Click on the unscheduled task in Job Details Panel
3. Move cursor to grid

**Expected Results:**
- [ ] Task becomes "picked" (visual feedback in sidebar)
- [ ] Cursor changes to indicate pick mode
- [ ] PickPreview appears under cursor on grid
- [ ] No drag-and-drop - just click-to-pick

---

### DS-015: Pick Preview Positioning

**Feature:** SCHED-134 (PickPreview RAF)
**Fixture:** `sidebar-drag`
**Priority:** P1

**Steps:**
1. Pick a task from sidebar
2. Move cursor rapidly across the grid
3. Observe preview tile movement

**Expected Results:**
- [ ] Preview follows cursor smoothly (60 FPS)
- [ ] No jank or stuttering during rapid movement
- [ ] Preview positioned with correct offset from cursor
- [ ] Preview shows task duration (height)

---

### DS-016: Pick Cancel (ESC)

**Feature:** SCHED-135 (ESC Cancel)
**Fixture:** `sidebar-drag`
**Priority:** P1

**Steps:**
1. Pick a task from sidebar
2. Move cursor to grid
3. Press ESC key

**Expected Results:**
- [ ] Pick mode cancelled immediately
- [ ] Preview disappears
- [ ] Cursor returns to normal
- [ ] Task remains unscheduled in sidebar

---

### DS-017: Ring Color Feedback

**Feature:** SCHED-136 (Ring Color Feedback)
**Fixture:** `sidebar-drag`
**Priority:** P2

**Steps:**
1. Pick a task from sidebar
2. Hover over valid station column
3. Hover over invalid station column

**Expected Results:**
- [ ] Valid drop zone: green ring around preview
- [ ] Invalid drop zone: red ring around preview
- [ ] Ring color updates in real-time
- [ ] Ring visible at all zoom levels

---

### DS-018: Column Focus - Auto Scroll

**Feature:** SCHED-137 (Column Focus Auto-Scroll)
**Fixture:** `sidebar-drag`
**Priority:** P1

**Steps:**
1. Scroll grid so target station is off-screen
2. Pick a task from sidebar
3. Observe grid scroll

**Expected Results:**
- [ ] Grid auto-scrolls to show target station column
- [ ] Target column centered in viewport
- [ ] Scroll animation is smooth
- [ ] Scroll happens immediately after pick

---

### DS-019: Column Focus - Fade Effect

**Feature:** SCHED-138 (Column Fade 15%)
**Fixture:** `sidebar-drag`
**Priority:** P2

**Steps:**
1. Pick a task from sidebar
2. Observe non-target station columns

**Expected Results:**
- [ ] Non-target columns fade to 15% opacity
- [ ] Target column remains at 100% opacity
- [ ] Provider columns also fade
- [ ] Fade effect uses transition animation

---

### DS-020: Column Focus - Scroll Restoration

**Feature:** SCHED-139 (Scroll Restoration)
**Fixture:** `sidebar-drag`
**Priority:** P2

**Steps:**
1. Note current grid scroll position
2. Pick a task (grid auto-scrolls to target)
3. Press ESC to cancel pick

**Expected Results:**
- [ ] Grid scrolls back to original position
- [ ] Restore animation is smooth
- [ ] Column opacities return to 100%
- [ ] No visual glitches during restoration

---

### DS-021: Global Grabbing Cursor

**Feature:** SCHED-140 (Global Cursor)
**Fixture:** `sidebar-drag`
**Priority:** P2

**Steps:**
1. Pick a task from sidebar
2. Move cursor across entire viewport

**Expected Results:**
- [ ] Cursor is "grabbing" hand everywhere
- [ ] Cursor consistent over sidebar, grid, toolbar
- [ ] Cursor set on document.body
- [ ] Original cursor restored on cancel/drop

---

### DS-022: Pulsating Animation

**Feature:** SCHED-141 (Pulse Animation)
**Fixture:** `sidebar-drag`
**Priority:** P3

**Steps:**
1. Pick a task from sidebar
2. Observe the preview tile on grid

**Expected Results:**
- [ ] Preview tile has subtle pulsing animation
- [ ] Animation: opacity oscillates (pulse-opacity)
- [ ] Animation smooth and not distracting
- [ ] Animation stops on drop or cancel

---

### DS-023: Validation Throttle

**Feature:** SCHED-142 (Validation Throttle)
**Fixture:** `sidebar-drag`
**Priority:** P2

**Steps:**
1. Pick a task
2. Move cursor rapidly across grid
3. Observe validation message updates

**Expected Results:**
- [ ] Validation runs ~2 times/second (not every frame)
- [ ] No performance degradation during rapid movement
- [ ] Validation still responsive enough for UX
- [ ] No flickering of validation messages

---

### DS-024: Pick from Grid Tile

**Feature:** SCHED-143 (Grid Pick), SCHED-144 (Remove Drag)
**Fixture:** `context-menu`
**Priority:** P1

**Steps:**
1. Select a job with scheduled tasks
2. Click on a scheduled tile on the grid
3. Observe pick behavior

**Expected Results:**
- [ ] Single click on tile picks it (enters pick mode)
- [ ] NO drag-and-drop behavior (removed entirely)
- [ ] Preview appears under cursor
- [ ] Can place tile in new location with another click

---

### DS-025: Grid Pick - Placeholder

**Feature:** SCHED-145 (Pulsating Placeholder)
**Fixture:** `context-menu`
**Priority:** P2

**Steps:**
1. Click on a scheduled tile to pick it
2. Observe original position

**Expected Results:**
- [ ] Pulsating placeholder remains at original position
- [ ] Placeholder has same dimensions as tile
- [ ] Placeholder has subtle pulse animation
- [ ] Placeholder disappears after drop/cancel

---

### DS-026: Context Menu - Open

**Feature:** SCHED-146 (TileContextMenu)
**Fixture:** `context-menu`
**Priority:** P1

**Steps:**
1. Right-click on a scheduled tile

**Expected Results:**
- [ ] Context menu appears near cursor
- [ ] Menu rendered via Portal (outside grid DOM)
- [ ] Menu positioned to avoid screen edges
- [ ] Menu has dark background (zinc-800)

---

### DS-027: Context Menu - Options

**Feature:** SCHED-147 (Menu Options), SCHED-148 (French Labels)
**Fixture:** `context-menu`
**Priority:** P1

**Steps:**
1. Right-click on a scheduled tile
2. Read menu options

**Expected Results:**
- [ ] "Déplacer" (Move) option visible
- [ ] "Marquer terminé" (Mark complete) option visible
- [ ] "Rappeler" (Recall) option visible
- [ ] "Annuler" (Cancel) option visible
- [ ] Each option has icon on left

---

### DS-028: Context Menu - Actions

**Feature:** SCHED-147 (Menu Options)
**Fixture:** `context-menu`
**Priority:** P1

**Steps:**
1. Right-click on a tile
2. Click "Déplacer"
3. Right-click on another tile
4. Click "Rappeler"

**Expected Results:**
- [ ] "Déplacer" enters pick mode for that tile
- [ ] "Marquer terminé" toggles completion status
- [ ] "Rappeler" removes tile from schedule (unassigns)
- [ ] "Annuler" closes menu without action

---

### DS-029: Context Menu - Close Triggers

**Feature:** SCHED-149 (Close Triggers)
**Fixture:** `context-menu`
**Priority:** P2

**Steps:**
1. Open context menu
2. Click outside menu
3. Open again, press ESC
4. Open again, scroll the grid

**Expected Results:**
- [ ] Click outside closes menu
- [ ] ESC key closes menu
- [ ] Scroll closes menu
- [ ] Menu action also closes menu

---

### DS-030: Context Menu - Edge Positioning

**Feature:** SCHED-150 (Edge Positioning)
**Fixture:** `context-menu`
**Priority:** P2

**Steps:**
1. Right-click on tile near right edge of screen
2. Right-click on tile near bottom edge

**Expected Results:**
- [ ] Menu repositions to stay within viewport
- [ ] Near right edge: menu opens to the left
- [ ] Near bottom: menu opens above cursor
- [ ] Menu never clipped by viewport

---

### DS-031: Fixed Tile Height in Job Details

**Feature:** SCHED-151 (Fixed 32px Height)
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Select a job with multiple tasks (varying durations)
2. Look at the Job Details Panel task list

**Expected Results:**
- [ ] All task tiles have same height (32px / h-8)
- [ ] Height is fixed regardless of task duration
- [ ] Task info truncated if too long
- [ ] Consistent visual rhythm in task list

---

### DS-032: SVG Unavailability Overlay

**Feature:** SCHED-152 (SVG Overlay)
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Scroll to view lunch break (12:00-13:00)
2. Observe the unavailability overlay pattern
3. Try different zoom levels

**Expected Results:**
- [ ] Diagonal stripe pattern visible (45° angle)
- [ ] Stripes are subtle white (~3% opacity)
- [ ] Pattern seamlessly tiles
- [ ] Pattern looks crisp at all zoom levels
- [ ] No performance issues when scrolling

---

## Visual Checklist

### DateStrip Markers
- [ ] ViewportIndicator is semi-transparent gray rectangle
- [ ] Task Markers use correct status colors (emerald/amber/rose)
- [ ] ExitTriangle is red and points left
- [ ] Task Timeline is dotted white line
- [ ] "Now" line is thin red horizontal

### Pick & Place
- [ ] PickPreview follows cursor smoothly
- [ ] Valid drop: green ring
- [ ] Invalid drop: red ring
- [ ] Grabbed cursor appears globally
- [ ] Pulsating animation is subtle

### Context Menu
- [ ] Dark background (zinc-800)
- [ ] Icons aligned left
- [ ] French labels
- [ ] Hover state visible

### Column Focus
- [ ] Target column at 100% opacity
- [ ] Non-target columns at 15% opacity
- [ ] Smooth fade transition

---

## Edge Cases

### DS-E01: Pick with No Valid Stations
**Feature:** SCHED-133
**Steps:** Pick a task that has no compatible stations
**Expected:** Error message displayed, pick mode not entered

### DS-E02: Context Menu at Screen Corner
**Feature:** SCHED-150
**Steps:** Right-click tile at bottom-right corner
**Expected:** Menu positions itself to stay fully visible

### DS-E03: ESC During Validation
**Feature:** SCHED-135
**Steps:** Press ESC while validation message is showing
**Expected:** Both validation and pick mode cancelled cleanly

### DS-E04: Double Pick Attempt
**Feature:** SCHED-143
**Steps:** While in pick mode, try to pick another tile
**Expected:** First pick cancelled, second pick active OR prevented

### DS-E05: Place on Original Position
**Feature:** SCHED-143
**Steps:** Pick tile, place it back in exact same position
**Expected:** No change, or subtle confirmation that it stayed

---

## Cross-Feature Interactions

### DateStrip + Pick
- Task Markers update when task is placed
- ViewportIndicator updates during scroll to target column

### Column Focus + Zoom
- Fade effect works at all zoom levels
- Auto-scroll calculates center correctly at each zoom

### Context Menu + Pick
- "Déplacer" option triggers same pick behavior as click
- Menu closes before pick mode activates

### Validation + Working Hours
- Validation messages include working hours violations
- Precedence lines skip non-working hours

---

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| Pick preview FPS | 60 FPS | DevTools → Performance |
| Validation rate | ~2/sec | Code inspection |
| Column fade transition | 200ms | Visual inspection |
| Context menu open | < 50ms | Visual inspection |
