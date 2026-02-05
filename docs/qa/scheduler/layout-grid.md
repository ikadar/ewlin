# Layout Grid - Manual QA Plan

> **Last Updated:** 2026-02-03
>
> **Related Features:** SCHED-001 – SCHED-034 (B4: Mock Data, Layout, Grid)
>
> **Fixtures:** `test`, `swap`, `layout-redesign`

---

## Overview

This document covers manual testing of the Scheduler UI basic layout and grid functionality. The feature group includes:

- Mock data generators and API
- Sidebar navigation
- Jobs List panel (left-side job list)
- Job Details panel (selected job details)
- DateStrip (day navigation)
- Timeline Column (hour indicators)
- Station Headers and Columns (scheduling grid)
- Tile component (scheduled task display)
- Similarity Indicators

---

## Test Fixtures

| Fixture | URL | Description |
|---------|-----|-------------|
| `test` | `http://localhost:5173/?fixture=test` | Default test data with 3 jobs, 5 tasks, 3 assignments |
| `swap` | `http://localhost:5173/?fixture=swap` | Swap test: 3 consecutive tiles on the same station |
| `layout-redesign` | `http://localhost:5173/?fixture=layout-redesign` | Layout testing (zoom, sidebar) |

---

## Test Scenarios

### SCHED-011 - Sidebar Component

#### Scenario: Sidebar appears with visible icons

**Feature:** SCHED-011 (Sidebar Component)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- Grid visible

**Steps:**
1. Open the application in the browser
2. Check the narrow strip on the left side (Sidebar)

**Expected Results:**
- [ ] Sidebar visible on the left edge of the screen
- [ ] Sidebar width is 56px (w-14)
- [ ] Sidebar height is full viewport height
- [ ] Background color: dark (`bg-zinc-900/50`)
- [ ] Right border visible (`border-r border-white/5`)

---

#### Scenario: Navigation icons and states

**Feature:** SCHED-011 (Sidebar Component)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- Sidebar visible

**Steps:**
1. Find the Grid icon (LayoutGrid) at the top of the Sidebar
2. Find the Calendar icon
3. Find the Settings icon

**Expected Results:**
- [ ] Grid icon in active state (lighter background: `bg-white/10`, text: `text-zinc-300`)
- [ ] Calendar icon in inactive state (dark background, text: `text-zinc-500`)
- [ ] Settings icon in disabled state (text: `text-zinc-700`, cursor-not-allowed)
- [ ] Hover on Grid icon: background `bg-white/15`
- [ ] Hover on Calendar icon: background `bg-white/10`, text `text-zinc-300`
- [ ] Hover on Settings icon has no effect (disabled)

---

### SCHED-013 - JobsList Container

#### Scenario: Jobs List panel display

**Feature:** SCHED-013 (JobsList Container)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- App loaded

**Steps:**
1. Look at the panel next to the Sidebar (Jobs List)

**Expected Results:**
- [ ] Panel width is 288px (w-72)
- [ ] Panel is vertically scrollable
- [ ] Background color: `bg-zinc-900/30`
- [ ] Two sections visible: "PROBLÈMES" and "TRAVAUX"

---

#### Scenario: Jobs List header elements

**Feature:** SCHED-013 (JobsList Container)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- Jobs List panel visible

**Steps:**
1. Look at the top of the Jobs List panel

**Expected Results:**
- [ ] "+" (Add Job) button visible
- [ ] Search field visible
- [ ] Add Job button is green (may be disabled in MVP)

---

### SCHED-015 - ProblemsSection

#### Scenario: Problematic jobs display

**Feature:** SCHED-015 (Problems Section)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- Jobs with late/conflict status exist

**Steps:**
1. Check the "PROBLÈMES" section

**Expected Results:**
- [ ] Late jobs appear with red background (`bg-red-500/10`)
- [ ] Late jobs show "En retard" badge
- [ ] Alert-circle icon on late jobs
- [ ] Conflict jobs appear with yellow/amber background (`bg-amber-500/10`)
- [ ] Conflict jobs show "Conflit" badge
- [ ] Shuffle icon on conflict jobs

---

### SCHED-016 - JobCard

#### Scenario: Job card content

**Feature:** SCHED-016 (JobCard)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- Jobs exist in the Jobs List

**Steps:**
1. Look at any job card in the "TRAVAUX" section

**Expected Results:**
- [ ] Job reference number visible (e.g., "TEST-001")
- [ ] Client name visible (e.g., "Test Client A")
- [ ] Description visible (e.g., "Test Job 1 - Brochures")
- [ ] Progress dots visible in the bottom right corner

---

### SCHED-017 - ProgressDots

#### Scenario: Task completion visualization

**Feature:** SCHED-017 (ProgressDots)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- At least one job card has multiple tasks

**Steps:**
1. Look at the progress dots on job cards

**Expected Results:**
- [ ] Completed tasks: filled green dot (`bg-emerald-500`)
- [ ] Incomplete tasks: empty outline (`border border-zinc-700`)
- [ ] Number of dots matches the job's task count

---

### SCHED-018 - Search Filtering

#### Scenario: Job filtering via search field

**Feature:** SCHED-018 (Search Filtering)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- Multiple jobs visible in the list

**Steps:**
1. Click on the search field
2. Type: "TEST-001"
3. Observe the job list
4. Clear the search
5. Type: "Client A"
6. Observe the list

**Expected Results:**
- [ ] "TEST-001" search shows only the TEST-001 job
- [ ] "Client A" search shows Test Client A jobs
- [ ] Empty search field shows all jobs
- [ ] Search works in reference, client, and description fields

---

### SCHED-019 - JobDetailsPanel

#### Scenario: Job details panel appears on selection

**Feature:** SCHED-019 (JobDetailsPanel)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- No job selected

**Steps:**
1. Verify the Job Details panel is not visible
2. Click on a job card in the Jobs List
3. Check the appearing panel

**Expected Results:**
- [ ] Initially, Job Details panel is not visible
- [ ] After click, panel appears
- [ ] Panel width is 288px (w-72)
- [ ] Panel appears next to the Jobs List

---

### SCHED-020 - JobInfo Section

#### Scenario: Job information display

**Feature:** SCHED-020 (JobInfo Section)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- A job is selected

**Steps:**
1. Select a job (e.g., TEST-001)
2. Look at the top of the Job Details panel

**Expected Results:**
- [ ] "CODE" field: job reference (e.g., "TEST-001"), monospace font
- [ ] "CLIENT" field: client name (e.g., "Test Client A")
- [ ] "INTITULÉ" field: job description (e.g., "Test Job 1 - Brochures")
- [ ] "DÉPART" field: date in French format (e.g., "18/12/2025")
- [ ] Labels: text-zinc-500, text-xs, uppercase

---

### SCHED-021 - TaskList Component

#### Scenario: Task list in Job Details panel

**Feature:** SCHED-021 (TaskList Component)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- TEST-001 job selected (2 tasks: print, cut)

**Steps:**
1. Scroll down in the Job Details panel to the task list

**Expected Results:**
- [ ] 2 task tiles visible
- [ ] Scheduled task: dark background (`bg-slate-800/40`), station name and time
- [ ] Unscheduled task: job color background, `cursor-grab`
- [ ] Task tile has border-l-4 on the left side

---

### SCHED-022 - DateStrip Component

#### Scenario: Day navigation column

**Feature:** SCHED-022 (DateStrip Component)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- Grid visible

**Steps:**
1. Find the narrow date column (DateStrip)

**Expected Results:**
- [ ] Column width is 48px (w-12)
- [ ] French day abbreviations: Lu, Ma, Me, Je, Ve, Sa, Di
- [ ] Day number also visible for each day (e.g., "09")
- [ ] Cell height is 40px (h-10)

---

### SCHED-023 - DateCell

#### Scenario: Today highlight

**Feature:** SCHED-023 (DateCell)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- DateStrip visible

**Steps:**
1. Find today's date in the DateStrip

**Expected Results:**
- [ ] Today highlighted with amber background (`bg-amber-500/15`)
- [ ] Today's text: `text-amber-200`
- [ ] Today's border: `border-amber-500/30`
- [ ] Other days: `text-zinc-500`, `border-b border-white/5`

---

### SCHED-024 - TimelineColumn

#### Scenario: Hour indicators display

**Feature:** SCHED-024 (TimelineColumn)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- Grid visible

**Steps:**
1. Find the hour column (Timeline Column)

**Expected Results:**
- [ ] Column width is 48px (w-12)
- [ ] Hour labels visible: "6h", "7h", "8h"... format
- [ ] Hour labels: `text-sm font-mono text-zinc-600`
- [ ] Horizontal lines at each hour
- [ ] 30-minute tick mark (w-3)
- [ ] 15/45-minute tick mark (w-2)

---

### SCHED-025 - NowLine

#### Scenario: Current time indicator

**Feature:** SCHED-025 (NowLine)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- Grid visible, viewing today

**Steps:**
1. Find the red "now" line on the Timeline

**Expected Results:**
- [ ] Red horizontal line (`bg-red-500`) at current time
- [ ] Time label next to the line (e.g., "11:10")
- [ ] Label style: `text-xs font-mono text-red-400 bg-zinc-900 px-1 rounded`
- [ ] Line position corresponds to current time

---

### SCHED-026 - StationHeaders

#### Scenario: Station headers display

**Feature:** SCHED-026 (StationHeaders)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- Grid visible

**Steps:**
1. Look at the station names at the top of the grid

**Expected Results:**
- [ ] Station names visible (e.g., "Komori G40", "Polar 137", "Heidelberg")
- [ ] Header row is sticky (stays at top when scrolling)
- [ ] Header cell width is 240px (w-60)
- [ ] Text style: `text-sm font-medium text-zinc-300`

---

### SCHED-027 - OffScreenIndicator

#### Scenario: Off-screen indicators (when tiles are outside visible area for selected job)

**Feature:** SCHED-027 (OffScreenIndicator)
**Fixture:** `test`
**Priority:** P3

**Preconditions:**
- A job selected that has tiles partially outside visible area

**Steps:**
1. Select a job
2. Scroll so that the job's tiles are partially visible, partially not
3. Look at the station headers

**Expected Results:**
- [ ] Chevron icon (up or down) appears in the header
- [ ] Number indicates how many tiles are off-screen
- [ ] Icon style: `w-3 h-3 text-zinc-500`

---

### SCHED-028 - StationColumns Container

#### Scenario: Station columns container

**Feature:** SCHED-028 (StationColumns Container)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- Grid visible

**Steps:**
1. Look at the main grid area

**Expected Results:**
- [ ] Horizontal scrolling works (if there are more stations)
- [ ] Gap between columns is 12px (gap-3)
- [ ] Background color: `bg-[#050505]`

---

### SCHED-029 - StationColumn

#### Scenario: Individual station column

**Feature:** SCHED-029 (StationColumn)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- Grid visible

**Steps:**
1. Look at a station column

**Expected Results:**
- [ ] Column width is 240px (w-60)
- [ ] Background color: `bg-[#0a0a0a]`
- [ ] Hour grid lines visible (80px apart)

---

### SCHED-030 - Unavailability Overlay

#### Scenario: Non-operating periods indicator

**Feature:** SCHED-030 (Unavailability Overlay)
**Fixture:** `test`
**Priority:** P2

**Preconditions:**
- Station has non-operating period (e.g., before 6:00)

**Steps:**
1. Look at the station column during non-operating periods

**Expected Results:**
- [ ] Hatched pattern visible
- [ ] Pattern: 45-degree, transparent and light white stripes
- [ ] Overlay covers the non-operating period

---

### SCHED-032 - Tile Component

#### Scenario: Scheduled task tile display

**Feature:** SCHED-032 (Tile Component)
**Fixture:** `test`
**Priority:** P1

**Preconditions:**
- There is a scheduled task on the grid

**Steps:**
1. Look at the scheduled tile in the Komori column (TEST-001 print task)

**Expected Results:**
- [ ] Tile visible at the correct position (from 7:00)
- [ ] Left border: 4px thick, job color (purple: #8b5cf6)
- [ ] Setup section: lighter (`bg-purple-900/40`)
- [ ] Run section: darker (`bg-purple-950/35`)
- [ ] Content: completion icon + "TEST-001 · Test Client A"

---

### SCHED-033 - SwapButtons

#### Scenario: Swap buttons appear on hover

**Feature:** SCHED-033 (SwapButtons)
**Fixture:** `swap`
**Priority:** P2

**Preconditions:**
- 3 tiles visible in the Komori column

**Steps:**
1. Hover over the middle tile
2. Observe the appearing buttons

**Expected Results:**
- [ ] Swap buttons appear in the bottom right corner
- [ ] Chevron-up and Chevron-down icons
- [ ] Button style: `w-6 h-6 rounded bg-white/10`
- [ ] Hover: `bg-white/20`

---

#### Scenario: Swap up operation

**Feature:** SCHED-033 (SwapButtons)
**Fixture:** `swap`
**Priority:** P1

**Preconditions:**
- 3 tiles: 7:00-8:00 (SWAP-001), 8:00-9:00 (SWAP-002), 9:00-10:00 (SWAP-003)

**Steps:**
1. Hover over the middle tile (SWAP-002)
2. Click the Chevron-up (swap up) button
3. Observe tile positions

**Expected Results:**
- [ ] SWAP-002 tile moves up (new time: 7:00-8:00)
- [ ] SWAP-001 tile moves down (new time: 8:00-9:00)
- [ ] SWAP-003 tile stays in place (9:00-10:00)
- [ ] Tile heights (duration) remain unchanged

---

#### Scenario: No swap-up on topmost tile

**Feature:** SCHED-033 (SwapButtons)
**Fixture:** `swap`
**Priority:** P3

**Preconditions:**
- 3 tiles visible in the Komori column

**Steps:**
1. Hover over the topmost tile (SWAP-001)
2. Observe the appearing buttons

**Expected Results:**
- [ ] Only Chevron-down (swap down) button visible
- [ ] Chevron-up button NOT visible or disabled

---

### SCHED-034 - SimilarityIndicators

#### Scenario: Similarity indicators between consecutive tiles

**Feature:** SCHED-034 (SimilarityIndicators)
**Fixture:** `swap`
**Priority:** P3

**Preconditions:**
- Consecutive tiles on the same station

**Steps:**
1. Look at the boundary between two consecutive tiles

**Expected Results:**
- [ ] Link/Unlink icons appear between tiles
- [ ] Position: bottom tile's top right corner, `top: -10px`
- [ ] Matched criterion: `link` icon, `text-zinc-400`
- [ ] Not matched criterion: `unlink` icon, `text-zinc-800`

---

## Visual Checklist

### Sidebar
- [ ] Width: 56px
- [ ] Background: dark gray (`bg-zinc-900/50`)
- [ ] Icons: LayoutGrid, Calendar, Settings (Lucide)

### Jobs List Panel
- [ ] Width: 288px
- [ ] Header: Add button (green +) + search field
- [ ] Sections: PROBLÈMES (red/amber cards), TRAVAUX (normal cards)

### Job Details Panel
- [ ] Width: 288px
- [ ] JobInfo: CODE, CLIENT, INTITULÉ, DÉPART fields
- [ ] TaskList: colored tiles (unscheduled) and dark tiles (scheduled)

### DateStrip
- [ ] Width: 48px
- [ ] French days: Lu, Ma, Me, Je, Ve, Sa, Di
- [ ] Today: amber highlight

### Timeline Column
- [ ] Width: 48px
- [ ] Hour labels: "Xh" format
- [ ] NowLine: red line + time label

### Scheduling Grid
- [ ] Station headers: sticky, w-60 cells
- [ ] Station columns: w-60, hour grid lines
- [ ] Unavailability: hatched overlay
- [ ] Tiles: job color, setup/run sections, completion icon

### Tile Component
- [ ] Border-left: 4px, job color
- [ ] Setup section: lighter shade
- [ ] Run section: full color
- [ ] Content: circle/circle-check icon + reference · client
- [ ] Completed: green gradient from left
- [ ] Swap buttons: visible on hover

---

## Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| No job selected | Job Details Panel not visible |
| Empty search result | "Aucun travail trouvé" message (or empty list) |
| Single tile on station | Swap buttons not visible (or both disabled) |
| Topmost tile | Swap-up button not available |
| Bottommost tile | Swap-down button not available |
| Today off-screen | Amber highlight still marks today |
| Long job reference/client | Truncate with ellipsis |
| Non-operating period 00:00-06:00 | Hatched overlay covers the period |

---

## Cross-feature Interactions

| Related Feature | Interaction Type |
|-----------------|------------------|
| Pick & Place (B8) | Tile selection from panel starts pick mode |
| Drag & Drop (B5) | Tile drag & drop for repositioning |
| Context Menu (B8) | Right-click on tile opens context menu |
| Zoom Control (B7) | Zoom changes grid sizing |

---

## Statistics

| Metric | Value |
|--------|-------|
| Processed features | 34 (SCHED-001 – SCHED-034) |
| Generated test scenarios | 22 |
| Edge cases | 8 |
| Visual checklist items | 24 |
