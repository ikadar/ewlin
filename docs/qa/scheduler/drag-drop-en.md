# Drag & Drop - Manual QA Plan

> **Last Updated:** 2026-02-03
>
> **Related Features:** SCHED-041 – SCHED-083 (B5: Drag & Drop Basics + B6: Station Compact, Fixes)
>
> **Fixtures:** `test`, `swap`, `alt-bypass`, `sidebar-drag`, `drag-snapping`

---

## Overview

This document covers manual testing of the Scheduler UI drag & drop, pick & place, and related functionality. The feature group includes:

- Real-time validation feedback during drag/pick
- ALT key validation bypass
- Tile swap buttons (up/down)
- Quick Placement mode
- Keyboard shortcuts (ALT+↑, ALT+↓, Home, ALT+D)
- Job Details panel interactions (single-click, double-click recall)
- Selection glow and conflict glow effects
- Station Compact API and UI
- Ghost placeholder during drag
- 30-minute grid snapping
- Task completion toggle
- Progress segments visualization

**Note:** The dnd-kit based drag & drop was deprecated in v0.3.57, replaced by Pick & Place mechanism.

---

## Test Fixtures

| Fixture | URL | Description |
|---------|-----|-------------|
| `test` | `http://localhost:5173/?fixture=test` | Default: 3 jobs, 5 tasks, 3 assignments |
| `swap` | `http://localhost:5173/?fixture=swap` | Swap test: 3 consecutive tiles on Komori |
| `alt-bypass` | `http://localhost:5173/?fixture=alt-bypass` | Precedence bypass: Task 1 @ 10:00-11:00, Task 2 unscheduled |
| `sidebar-drag` | `http://localhost:5173/?fixture=sidebar-drag` | Sidebar pick: 1 job, 1 unscheduled task |
| `drag-snapping` | `http://localhost:5173/?fixture=drag-snapping` | Snapping test |

---

## Test Scenarios

### SCHED-041 - Realtime Validation Feedback

#### Scenario: Valid position with green indicator

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=sidebar-drag`
- SIDE-001 job selected
- task-sidebar-1 unscheduled task visible in Job Details panel

**Steps:**
1. Click on the SIDE-001 job card
2. Click on the unscheduled task tile in the Job Details panel (pick mode starts)
3. Move the mouse over the Komori column, at 08:00 height
4. Observe the visual feedback

**Expected Results:**
- [ ] Pick preview (ghost tile) follows the cursor
- [ ] Valid position shows green ring/highlight (`ring-2 ring-green-500`)
- [ ] Validation runs in <10ms (no noticeable delay)

---

#### Scenario: Invalid position with red indicator

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=alt-bypass`
- Job BYPASS-001 selected
- Task 1 scheduled 10:00-11:00, Task 2 unscheduled

**Steps:**
1. Click on the BYPASS-001 job card
2. Click on the Task 2 tile (task-bypass-2) in the sidebar
3. Move the mouse over the Polar column, at 09:00 height (before Task 1 ends)
4. Observe the visual feedback

**Expected Results:**
- [ ] Pick preview follows the cursor
- [ ] Invalid position (09:00 < 11:00 precedence) shows red ring (`ring-2 ring-red-500`)
- [ ] The system auto-snaps to valid position (11:00)

---

### SCHED-042 - ALT Key Validation Bypass

#### Scenario: Bypassing precedence rule with ALT pressed

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=alt-bypass`
- BYPASS-001 job selected
- Task 1 @ 10:00-11:00 on Komori, Task 2 unscheduled

**Steps:**
1. Click on the Task 2 tile in the sidebar
2. Press and hold the ALT key
3. Move the mouse over the Polar column, to 09:00 position
4. Click on the position while holding ALT

**Expected Results:**
- [ ] With ALT pressed: amber/orange warning ring visible (`ring-2 ring-amber-500`)
- [ ] On click, the tile is placed at 09:00 (precedence bypass)
- [ ] Job appears in "PROBLÈMES" section with "Conflit" badge
- [ ] The tile gets amber glow (PrecedenceConflict indicator)

---

#### Scenario: Auto-snap to valid position without ALT

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=alt-bypass`
- BYPASS-001 job selected

**Steps:**
1. Click on the Task 2 tile in the sidebar
2. DO NOT press ALT
3. Move the mouse over the Polar column, to 09:00 position
4. Click

**Expected Results:**
- [ ] The system auto-snaps to 11:00 (after Task 1 ends)
- [ ] The tile appears at 11:00
- [ ] Job does NOT appear in "PROBLÈMES" section
- [ ] No amber conflict glow

---

### SCHED-044/045 - Tile Swap Up/Down Buttons

#### Scenario: Swap up button functionality

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=swap`
- 3 tiles visible on Komori: SWAP-001 @ 7:00, SWAP-002 @ 8:00, SWAP-003 @ 9:00

**Steps:**
1. Hover over the middle tile (SWAP-002 @ 8:00)
2. Wait for swap buttons to appear
3. Click on the Chevron-up (swap up) button

**Expected Results:**
- [ ] Swap buttons appear on hover (bottom right corner)
- [ ] After click, SWAP-002 moves up: 7:00-8:00
- [ ] SWAP-001 moves down: 8:00-9:00
- [ ] SWAP-003 stays in place: 9:00-10:00
- [ ] Tile heights (duration) remain unchanged

---

#### Scenario: No swap-up button on topmost tile

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=swap`

**Steps:**
1. Hover over the topmost tile (SWAP-001 @ 7:00)
2. Observe the displayed buttons

**Expected Results:**
- [ ] Only Chevron-down (swap down) button visible
- [ ] Chevron-up button NOT visible or disabled

---

#### Scenario: No swap-down button on bottommost tile

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=swap`

**Steps:**
1. Hover over the bottommost tile (SWAP-003 @ 9:00)
2. Observe the displayed buttons

**Expected Results:**
- [ ] Only Chevron-up (swap up) button visible
- [ ] Chevron-down button NOT visible or disabled

---

### SCHED-048/049 - Keyboard Shortcuts (ALT+↑, ALT+↓)

#### Scenario: ALT+↑ moves selected tile up

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=swap`
- A tile is selected (e.g., SWAP-002)

**Steps:**
1. Click on the middle tile (SWAP-002) to select it
2. Press ALT+↑

**Expected Results:**
- [ ] SWAP-002 moves up (swaps with the one above)
- [ ] New position: 7:00-8:00

---

### SCHED-052 - Job Details Double-Click Recall

#### Scenario: Double-click recalls the tile

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=test`
- TEST-001 job selected
- print task is scheduled on the grid

**Steps:**
1. Click on the TEST-001 job card
2. In the Job Details panel, find the scheduled task tile (dark background, station+time)
3. Double-click on the tile

**Expected Results:**
- [ ] The tile disappears from the grid
- [ ] The task returns to "unscheduled" state in the sidebar
- [ ] Task tile color changes back to job color (cursor-grab)

---

### SCHED-053 - Job Details Single-Click Jump

#### Scenario: Single click scrolls to grid position

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=test`
- TEST-001 job selected
- print task is scheduled

**Steps:**
1. Scroll away from the grid so the tile is not visible
2. In the Job Details panel, single-click on the scheduled task tile

**Expected Results:**
- [ ] The grid automatically scrolls to the tile position
- [ ] The tile becomes visible in the viewport

---

### SCHED-054 - Selection Glow Effect

#### Scenario: Selected tile glow effect

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=test`

**Steps:**
1. Click on a job card (e.g., TEST-001)
2. Observe the associated tiles on the grid

**Expected Results:**
- [ ] Selected job's tiles get glow effect
- [ ] Glow color matches job color (e.g., purple: `box-shadow: 0 0 12px 4px #8b5cf699`)
- [ ] Non-selected jobs' tiles are in muted state (`opacity: 0.6`, `filter: saturate(0.2)`)

---

### SCHED-058 - Station Compact Button

#### Scenario: Station compact button functionality

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=test`
- Komori station has 2 tiles with a gap between them

**Steps:**
1. Find the Komori station header
2. Click on the Compact button (if there's a gap between tiles)

**Expected Results:**
- [ ] Spinner appears during compact
- [ ] Tiles close up (gap disappears)
- [ ] Precedence rules respected (tile doesn't move before predecessor)

---

### SCHED-063 - Grid Tile Drag Repositioning

#### Scenario: Repositioning scheduled tile with drag

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=test`
- TEST-001 print task scheduled @ 7:00 on Komori

**Steps:**
1. Click on the tile on the grid and hold
2. Drag down to 9:00 position
3. Release

**Expected Results:**
- [ ] During drag, ghost placeholder visible at original position (dashed outline)
- [ ] Tile follows the cursor
- [ ] After drop, tile moves to 9:00 (30-minute snap)
- [ ] Tile only moves vertically (station is fixed)

---

### SCHED-073 - Job Focus Muting (Non-Drag)

#### Scenario: Other jobs' tiles fade when job is selected

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=test`
- Multiple jobs' tiles visible on the grid

**Steps:**
1. Click on TEST-001 job card

**Expected Results:**
- [ ] TEST-001 tiles get glow effect
- [ ] TEST-002, TEST-003 tiles enter muted state
- [ ] Muted styling: `opacity: 0.6`, `filter: saturate(0.2)`

---

### SCHED-074 - Persistent Amber Glow for Conflicts

#### Scenario: Precedence conflict tile with amber glow

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=alt-bypass`
- Create a precedence conflict with ALT+drop

**Steps:**
1. Select BYPASS-001 job
2. With ALT pressed, place Task 2 at 09:00 (conflict)
3. Observe the tile

**Expected Results:**
- [ ] The tile gets amber glow (`box-shadow: 0 0 12px 4px #F59E0B99`)
- [ ] Amber glow is persistent (not only during drag)
- [ ] Job appears in "PROBLÈMES" section

---

### SCHED-075 - Conflict Glow Priority

#### Scenario: Conflict glow overrides selection glow

**Preconditions:**
- Precedence conflict created (previous scenario)
- BYPASS-001 job selected

**Steps:**
1. Observe the conflicted tile

**Expected Results:**
- [ ] Amber glow visible (NOT job color glow)
- [ ] Conflict glow takes priority over selection glow

---

### SCHED-078 - Real-Time Drag Snapping

#### Scenario: Drag preview snaps to 30-minute grid

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=sidebar-drag`

**Steps:**
1. Select SIDE-001 job
2. Click on the unscheduled task tile
3. Move the mouse slowly over the Komori column

**Expected Results:**
- [ ] Pick preview snaps to 30-minute positions (6:00, 6:30, 7:00...)
- [ ] No "floating" position between grid lines

---

### SCHED-083 - Task Completion Toggle

#### Scenario: Completion icon toggleable on click

**Preconditions:**
- App loaded: `http://localhost:5173/?fixture=test`
- Scheduled tile visible on the grid (incomplete state)

**Steps:**
1. Find the completion icon on the tile (circle icon, left side)
2. Click on the icon

**Expected Results:**
- [ ] Icon changes: `circle` → `circle-check` (emerald color)
- [ ] Green gradient appears from left (`linear-gradient(to right, rgba(34,197,94,0.4)...)`)
- [ ] Job card progress dots update

---

#### Scenario: Reset completed to incomplete

**Preconditions:**
- Tile in completed state (circle-check icon)

**Steps:**
1. Click on the circle-check icon

**Expected Results:**
- [ ] Icon changes back: `circle-check` → `circle` (zinc color)
- [ ] Green gradient disappears
- [ ] Progress dots update

---

## Visual Checklist

### Validation Feedback
- [ ] Valid position: green ring (`ring-green-500`)
- [ ] Invalid position: red ring (`ring-red-500`)
- [ ] ALT bypass warning: amber ring (`ring-amber-500`)

### Glow Effects
- [ ] Selection glow: job color + `99` alpha
- [ ] Conflict glow: `#F59E0B99` (amber)
- [ ] Conflict glow > Selection glow priority

### Muting
- [ ] Muted tile: `opacity: 0.6`, `filter: saturate(0.2)`
- [ ] Active job tiles not muted

### Swap Buttons
- [ ] Position: bottom right corner
- [ ] Style: `w-6 h-6 rounded bg-white/10`
- [ ] Hover: `bg-white/20`

### Ghost Placeholder
- [ ] Dashed outline at original position
- [ ] Pulsating animation (`pulse-opacity` keyframes)

### Completion State
- [ ] Incomplete: `circle` icon, `text-zinc-600`
- [ ] Completed: `circle-check` icon, `text-emerald-500`
- [ ] Completed gradient: green from left to right

---

## Edge Cases

| Case | Expected behavior |
|------|-------------------|
| ALT pressed on valid position | No conflict created, normal placement |
| Drop on past time | Not allowed (snap to earliest valid position) |
| Swap with single tile | Swap buttons not visible |
| Compact on already compacted station | No change, "Nothing to compact" |
| Double-click on unscheduled tile | No effect (recall only for scheduled tiles) |
| Conflict resolution (moving tile to valid position) | Amber glow disappears, job removed from "PROBLÈMES" |
| Pick cancel with ESC | Pick preview disappears, scroll restores |

---

## Cross-feature Interactions

| Related feature | Interaction type |
|-----------------|------------------|
| Layout Grid (B4) | Tile display, station columns |
| Navigation UX (B7) | Zoom affects pixels-per-hour |
| DateStrip/Pick&Place (B8) | Pick & Place infrastructure |
| Context Menu (B8) | Right-click completion toggle, move up/down |

---

## Statistics

| Metric | Value |
|--------|-------|
| Processed features (B5) | 13 Active (8 Deprecated) |
| Processed features (B6) | 28 Active |
| Total Active features | 41 |
| Generated test scenarios | 20 |
| Edge cases | 7 |
