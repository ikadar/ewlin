# Flux Scheduler - Navigation, Layout, UX Manual QA

> **Feature Group:** Navigation, Layout, UX
> **Batch:** B7
> **Features:** SCHED-084 – SCHED-114 (29 Active, 2 Deprecated)
> **Releases:** v0.3.34 – v0.3.46

---

## Overview

This document contains the Manual QA tests for the Navigation, Layout, and UX features. The feature group covers the following main areas:

- **Top Navigation Bar** - Zoom control, Quick Placement button
- **Timeline Compaction** - Global 4h/8h/24h compact buttons
- **Dry Time Precedence** - +4h drying time after printing
- **Multi-Day DateStrip** - Click-to-scroll, departure date highlight, scheduled day markers
- **Group Capacity** - Station header group info, capacity warning (DEPRECATED)
- **Provider Columns** - Outsourcing display with subcolumn layout
- **Similarities** - paperWeight and inking fields
- **Layout Redesign** - Full-height sidebar, 25% zoom level
- **DateStrip Redesign** - Focused day, today indicator line
- **Precedence Visualization** - Purple/orange constraint lines during pick
- **Virtual Scrolling** - 365-day windowed rendering

---

## Test Fixtures

| Fixture | URL | Description |
|---------|-----|-------------|
| `test` | `?fixture=test` | Standard test data with multiple jobs |
| `layout-redesign` | `?fixture=layout-redesign` | Layout testing (sidebar, zoom) |
| `datestrip-redesign` | `?fixture=datestrip-redesign` | DateStrip visual states testing |
| `precedence-visualization` | `?fixture=precedence-visualization` | Precedence constraint lines testing |
| `virtual-scroll` | `?fixture=virtual-scroll` | 365-day virtual scrolling testing |

---

## Test Scenarios

### NAV-001: TopNavBar Visibility

**Feature:** SCHED-084 (Top Navigation Bar)
**Fixture:** `test`
**Priority:** P1

**Steps:**
1. Load the application (`http://localhost:5173/?fixture=test`)
2. Observe the top of the screen

**Expected Results:**
- [ ] TopNavBar visible at the very top (after sidebar in layout)
- [ ] Quick Placement button visible
- [ ] Zoom control visible ([-] 100% [+] format)
- [ ] Compact control section visible ([4h] [8h] [24h])
- [ ] Height is 48px (h-12)
- [ ] Background is dark zinc (bg-zinc-900)

**Related Tests:** `top-nav-bar.spec.ts`

---

### NAV-002: Quick Placement Button States

**Feature:** SCHED-086 (Quick Placement Button)
**Fixture:** `test`
**Priority:** P1

**Steps:**
1. Observe Quick Placement button before selecting a job
2. Select a job from the Jobs List
3. Click the Quick Placement button
4. Click the button again

**Expected Results:**
- [ ] Button disabled before job selection (grayed out)
- [ ] Button enabled after job selection
- [ ] First click: mode activates (button shows emerald active state)
- [ ] Second click: mode deactivates
- [ ] ALT+Q keyboard shortcut still works

**Related Tests:** `top-nav-bar.spec.ts`

---

### NAV-003: Zoom Control

**Feature:** SCHED-085 (Zoom Control 50%-200%), SCHED-107 (25% Zoom Level)
**Fixture:** `test`
**Priority:** P1

**Steps:**
1. Note current zoom level (should be 100%)
2. Click [-] button repeatedly until minimum
3. Note minimum level
4. Click [+] button repeatedly until maximum
5. Observe tile sizes at different zoom levels

**Expected Results:**
- [ ] Initial zoom shows "100%"
- [ ] Minimum zoom is 25% (after 3 clicks on [-])
- [ ] Maximum zoom is 200% (after 2 clicks on [+])
- [ ] All 6 zoom levels available: 25%, 50%, 75%, 100%, 150%, 200%
- [ ] Tile heights scale with zoom level
- [ ] Timeline hour markers scale with zoom
- [ ] Grid scroll height changes with zoom

**Related Tests:** `top-nav-bar.spec.ts`, `layout-redesign.spec.ts`

---

### NAV-004: Global Timeline Compaction

**Feature:** SCHED-087 (Timeline Compaction), SCHED-088 (compactTimeline)
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Note current task positions in the timeline
2. Click the "4h" compact button
3. Observe loading state
4. Check task positions after compaction
5. Repeat for "8h" and "24h" buttons

**Expected Results:**
- [ ] "Compact:" label visible with [4h] [8h] [24h] buttons
- [ ] Loading spinner appears briefly during compaction
- [ ] Gaps between tasks within horizon are removed
- [ ] Tasks outside horizon remain unchanged
- [ ] All tiles remain visible after compaction
- [ ] No crashes or visual glitches

**Related Tests:** `timeline-compaction.spec.ts`

---

### NAV-005: Dry Time Precedence Label

**Feature:** SCHED-089 (Dry Time Precedence), SCHED-090 (DRY_TIME_MINUTES)
**Fixture:** `test` (with printing task)
**Priority:** P2

**Steps:**
1. Select a job with printing task followed by another task
2. Look at JobDetailsPanel task list
3. Verify precedence bar between tasks

**Expected Results:**
- [ ] "+4h drying" label visible between printing and successor task
- [ ] Label appears on the precedence bar
- [ ] Non-printing predecessors do NOT show dry time label
- [ ] Drag validation respects 4h dry time for printing tasks

**Related Tests:** `dry-time-precedence.spec.ts`

---

### NAV-006: Multi-Day Grid Navigation

**Feature:** SCHED-091 (Multi-Day DateStrip Navigation)
**Fixture:** `test`
**Priority:** P1

**Steps:**
1. Load the application
2. Click on a date in DateStrip (3-5 days from now)
3. Observe grid scrolling
4. Scroll the grid manually with mouse wheel
5. Observe DateStrip position

**Expected Results:**
- [ ] DateStrip shows multiple days (365 days with virtual scroll)
- [ ] Click on date scrolls grid smoothly to that day
- [ ] Grid and DateStrip scroll are synchronized
- [ ] Clicked date becomes visible at top of viewport

**Related Tests:** `multi-day-grid.spec.ts`

---

### NAV-007: Departure Date Highlight

**Feature:** SCHED-092 (Departure Date Highlight)
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Select a job with a future departure date
2. Look at the DateStrip

**Expected Results:**
- [ ] Departure date cell has red styling
- [ ] Text color: red-300
- [ ] Background: red-500/10
- [ ] Exit triangle marker visible on departure date

**Related Tests:** `multi-day-grid.spec.ts`

---

### NAV-008: Scheduled Days Indicator

**Feature:** SCHED-093 (Scheduled Day Markers)
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Select a job that has scheduled tasks
2. Look at the DateStrip

**Expected Results:**
- [ ] Days with scheduled tasks show emerald indicator dot
- [ ] Days without tasks have no dot
- [ ] Dot position is consistent across all dates

**Related Tests:** `multi-day-grid.spec.ts`

---

### NAV-009: Provider Columns Display

**Feature:** SCHED-096 (Provider Columns), SCHED-097 (Provider Headers), SCHED-098 (Subcolumn Layout)
**Fixture:** `test`
**Priority:** P1

**Steps:**
1. Load the application
2. Scroll right past station columns

**Expected Results:**
- [ ] Provider columns (Clément, Reliure Express) visible after station columns
- [ ] Provider header shows Building2 icon
- [ ] Provider columns have dotted vertical border
- [ ] Provider columns have darker background (bg-zinc-900)
- [ ] Outsourced tiles have dotted thick border
- [ ] Parallel tasks display side by side in subcolumns

**Related Tests:** `provider-columns.spec.ts`

---

### NAV-010: Similarities Feature

**Feature:** SCHED-099 (paperWeight Field), SCHED-100 (inking Field)
**Fixture:** `test`
**Priority:** P3

**Steps:**
1. Select a job with printing task on offset press station
2. Look at similarity indicators between adjacent tiles

**Expected Results:**
- [ ] Similarity indicators show varied icons (not all matched)
- [ ] Different inking values show unlink icon
- [ ] Same inking values show link icon
- [ ] Paper weight comparison works correctly

---

### NAV-011: Layout Redesign - Sidebar Full Height

**Feature:** SCHED-105 (Sidebar Full Height), SCHED-106 (Logo Removed)
**Fixture:** `layout-redesign`
**Priority:** P1

**Steps:**
1. Load the application
2. Observe the sidebar position
3. Check for "Flux" logo in toolbar

**Expected Results:**
- [ ] Sidebar starts at viewport top (y=0)
- [ ] Sidebar extends to viewport bottom (full viewport height)
- [ ] "Flux" text/logo NOT visible in toolbar
- [ ] User/Settings icons visible at sidebar bottom
- [ ] User/Settings icons NOT in toolbar right section

**Related Tests:** `layout-redesign.spec.ts`

---

### NAV-012: DateStrip Redesign - Today Indicator

**Feature:** SCHED-108 (Focused Day), SCHED-109 (Today Indicator)
**Fixture:** `datestrip-redesign`
**Priority:** P1

**Steps:**
1. Load the application
2. Look at the DateStrip column
3. Find today's date

**Expected Results:**
- [ ] Today has a thin red horizontal line inside the cell (not amber background)
- [ ] Line style similar to grid's "now" line
- [ ] Focused day has highlighted background/border (white/10)
- [ ] Focused day is centered in DateStrip
- [ ] Scrolling grid updates focused day in DateStrip

**Related Tests:** `datestrip-redesign.spec.ts`

---

### NAV-013: Precedence Constraint Visualization

**Feature:** SCHED-110 (PrecedenceLines), SCHED-111 (Purple Earliest Line), SCHED-112 (Orange Latest Line)
**Fixture:** `precedence-visualization`
**Priority:** P2

**Steps:**
1. Select job-pv-1 (has tasks with precedence constraints)
2. Pick task-pv-2 from JobDetailsPanel (middle task, unscheduled)
3. Hover over station column (Heidelberg)
4. Observe the constraint lines

**Expected Results:**
- [ ] Purple line appears (earliest possible start = predecessor end + 4h dry time)
- [ ] Orange line appears (latest possible start = successor start - task duration)
- [ ] Lines have glow effect (box-shadow)
- [ ] Lines visible only in hovered column
- [ ] Lines disappear when pick is cancelled (ESC)

**Related Tests:** `precedence-visualization.spec.ts`

---

### NAV-014: Virtual Scrolling Performance

**Feature:** SCHED-113 (Virtual Scrolling), SCHED-114 (DateStrip Windowing)
**Fixture:** `virtual-scroll`
**Priority:** P1

**Steps:**
1. Load the application
2. Use mouse wheel to scroll quickly through the grid
3. Check browser DevTools Performance tab
4. Count DOM elements

**Expected Results:**
- [ ] Scrolling is smooth (no jank or stuttering)
- [ ] No "Long Frame" warnings in Performance tab
- [ ] DateStrip stays synced with grid
- [ ] DOM element count < 1500 (vs 50,000+ without virtualization)
- [ ] Grid renders correctly at day 0 and day 364

**Related Tests:** `virtual-scroll.spec.ts`

---

### NAV-015: Virtual Scroll - Navigation

**Feature:** SCHED-113 (Virtual Scrolling)
**Fixture:** `virtual-scroll`
**Priority:** P2

**Steps:**
1. Click on a date 100+ days from today in DateStrip
2. Observe grid scroll
3. Scroll to first day (day 0)
4. Scroll to last day (day 364)

**Expected Results:**
- [ ] Grid scrolls to correct day when DateStrip clicked
- [ ] Tiles on target day are visible
- [ ] No blank areas during scroll
- [ ] No errors at grid boundaries (day 0 or day 364)
- [ ] Grid lines are continuous (no gaps between day slices)

**Related Tests:** `virtual-scroll.spec.ts`

---

### NAV-016: UI Bug Fixes - Unavailability Overlay

**Feature:** SCHED-102 (Multi-Day UnavailabilityOverlay)
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Scroll the grid to view Day 2, Day 3
2. Observe the unavailability overlay (striped pattern) for lunch hours

**Expected Results:**
- [ ] Day 1 shows striped overlay for 12:00-13:00 (lunch break)
- [ ] Day 2 shows striped overlay for 12:00-13:00
- [ ] Day 3 shows striped overlay for 12:00-13:00
- [ ] Weekend days (if visible) show full-day unavailability

**Related Tests:** `ui-bug-fixes.spec.ts`

---

### NAV-017: UI Bug Fixes - Job Card Overflow

**Feature:** SCHED-103 (JobCard Overflow Fix)
**Fixture:** `test` (with long client names)
**Priority:** P3

**Steps:**
1. Locate a job card with long client name in the sidebar
2. Observe the text content

**Expected Results:**
- [ ] Job card content is contained within the sidebar panel
- [ ] Long client name is truncated with ellipsis (...)
- [ ] No horizontal overflow or scrollbar visible
- [ ] Selected job card border is fully visible (not clipped)

---

### NAV-018: UI Bug Fixes - Muted Tile Click

**Feature:** SCHED-104 (Muted Tile Click Handler)
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Select job-a (its tile is highlighted)
2. Find job-b's tile on grid (muted/desaturated)
3. Click on job-b's tile

**Expected Results:**
- [ ] job-b becomes selected
- [ ] job-b's tile is now highlighted
- [ ] job-a's tile is now muted
- [ ] Job Details Panel shows job-b

**Related Tests:** `ui-bug-fixes.spec.ts`

---

### NAV-019: Drag Snapping Consistency

**Feature:** SCHED-101 (Drag Snapping Fix)
**Fixture:** `drag-snapping`
**Priority:** P2

**Steps:**
1. Select a job with unscheduled task
2. Pick task from sidebar
3. Move cursor to Y position corresponding to 12:45 (within lunch break)
4. Observe visual snap and border color

**Expected Results:**
- [ ] Tile visually snaps to 30-min grid (13:00, not 12:45)
- [ ] Border color reflects snapped position (GREEN for valid)
- [ ] Drop position matches visual preview
- [ ] Snapping works correctly at all zoom levels

**Related Tests:** `drag-snapping.spec.ts`

---

### NAV-020: Integration - Zoom After Compaction

**Feature:** SCHED-085, SCHED-087
**Fixture:** `test`
**Priority:** P2

**Steps:**
1. Perform compaction (click any compact button)
2. Use zoom in/out buttons
3. Select a job

**Expected Results:**
- [ ] Zoom controls remain functional after compaction
- [ ] Zoom level updates correctly (25% - 200%)
- [ ] Task positions scale correctly with zoom
- [ ] Job selection still works after compaction

**Related Tests:** `timeline-compaction.spec.ts`

---

## Visual Checklist

### TopNavBar
- [ ] Quick Placement button shows emerald active state when toggled
- [ ] Zoom level display updates correctly
- [ ] Compact buttons appear as segmented button group
- [ ] Loading spinner appears during compaction

### DateStrip
- [ ] Today line is thin (0.5 or 1px height) and red
- [ ] Focused day highlight is subtle (white/10)
- [ ] Departure date has red background
- [ ] Scheduled day has emerald dot
- [ ] Exit triangle marker on departure date

### Provider Columns
- [ ] Dotted border on columns and tiles
- [ ] Building2 icon in header
- [ ] Darker background (bg-zinc-900)
- [ ] Subcolumn layout for parallel tasks

### Precedence Lines
- [ ] Purple line color is #A855F7 (purple-500)
- [ ] Orange line color is #F97316 (orange-500)
- [ ] Lines have glow effect
- [ ] Lines span full column width
- [ ] Lines are 4px height (h-1)

### Layout
- [ ] Sidebar spans full viewport height
- [ ] No "Flux" logo in toolbar
- [ ] User/Settings icons at sidebar bottom

---

## Edge Cases

### NAV-E01: Compaction with No Tasks
**Feature:** SCHED-087
**Steps:** Click compact button when no tasks are scheduled
**Expected:** No crash, button remains functional

### NAV-E02: Zoom at Grid Boundaries
**Feature:** SCHED-085
**Steps:** Zoom in/out at minimum/maximum levels
**Expected:** Buttons disabled at limits, no further zoom

### NAV-E03: Virtual Scroll at Boundaries
**Feature:** SCHED-113
**Steps:** Navigate to day 0 and day 364
**Expected:** No blank content, no errors, grid renders correctly

### NAV-E04: DateStrip Click-to-Scroll Beyond Buffer
**Feature:** SCHED-091
**Steps:** Click date far from current view in DateStrip
**Expected:** Grid scrolls correctly, virtual window updates

---

## Cross-Feature Interactions

### Layout + Zoom
- Sidebar height persists at all zoom levels
- Toolbar position adjusts correctly with zoom

### DateStrip + Virtual Scroll
- DateStrip and Grid stay synchronized during scroll
- Focused day centering works with virtual scrolling

### Compaction + Precedence
- Compacted tasks respect precedence rules
- Dry time included in compaction calculations

### Provider Columns + Selection
- Clicking outsourced tile selects the job
- Provider tiles are not draggable

---

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| DOM elements | < 1500 | DevTools → Elements |
| Drag FPS | 60 FPS | DevTools → Performance |
| Scroll smoothness | No jank | Visual inspection |
| Initial render | < 100ms | DevTools → Performance |

---

## Deprecated Features

> **Note:** The following features have deprecated status and will not be tested:

| ID | Feature | Reason |
|----|---------|--------|
| SCHED-094 | Group Capacity in Headers | Removed in v0.3.50 for cleaner UI |
| SCHED-095 | Capacity Warning Red | Removed in v0.3.50 |
