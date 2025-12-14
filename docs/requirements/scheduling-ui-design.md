---
tags:
  - specification
  - requirements
---

# Scheduling UI Design — Flux Print Shop Scheduling System

This document defines the **primary scheduling interface** — the time-based grid where schedulers place and manage task assignments. This is the **core value-generating UI** of the application.

---

## 1. Overview

### 1.1 Purpose

The scheduling UI allows print shop managers to:
- Visualize all stations and their scheduled tasks
- Assign tasks to stations via drag-and-drop
- Identify and resolve scheduling conflicts
- Monitor job progress and deadlines
- View time-saving opportunities between consecutive jobs

### 1.2 Layout Structure

The screen is divided into **3 main areas**:

```
┌─────────────────────────────────────────────────────────────────┐
│                          HEADER                                  │
├──────────────┬─────────────────────────────┬────────────────────┤
│              │                             │                    │
│    LEFT      │          CENTER             │       RIGHT        │
│    PANEL     │          (GRID)             │       PANEL        │
│              │                             │                    │
│  Jobs List   │   Station Columns           │   Late Jobs        │
│  + Actions   │   + Time (vertical)         │   + Job Details    │
│              │   + Tiles                   │                    │
│              │                             │                    │
└──────────────┴─────────────────────────────┴────────────────────┘
```

---

## 2. Left Panel

### 2.1 Structure

The left panel contains **two sub-columns**:

| Sub-column | Purpose |
|------------|---------|
| Column 1 | List of jobs |
| Column 2 | List of tasks for highlighted job |

### 2.2 Jobs List (Column 1)

- **Content:** List of all jobs with status indicators
- **Selection:** Clicking a job highlights it and shows its tasks in Column 2
- **Filtering:** Text filter to search jobs by reference, client, or description
- **Add Job:** "Add Job" button at top opens job creation modal

#### Job Row Display
- Job reference
- Client name (truncated)
- Status indicator (color-coded)
- Deadline indicator if approaching

### 2.3 Actions List (Column 2)

- **Content:** Ordered list of tasks for the selected job
- **Display:** Tasks shown as mini-tiles with real durations
- **Reordering:** Tasks can be reordered via drag-and-drop (updates sequence)

#### Task Tile Display (in left panel)

| State | Appearance |
|-------|------------|
| Unscheduled | Full opacity, draggable |
| Scheduled | Semi-transparent, "recall" button on hover |

- Tasks are represented as tiles with real durations
- Scheduled tasks appear faded with a "recall tile" button on hover
- Clicking "recall" removes the assignment (tile returns to center grid as unscheduled)

---

## 3. Center Panel (Scheduling Grid)

### 3.1 Axis Orientation

**IMPORTANT: Time flows vertically (downward)**

| Axis | Content |
|------|---------|
| Horizontal (X) | Station columns |
| Vertical (Y) | Time (flows downward) |

This is a **vertical time axis** design (like a calendar view), not a horizontal Gantt chart.

### 3.2 Station Columns

- One column per station
- Column order configurable (stored setting)
- Column header shows station name and status
- Keyboard shortcut to navigate columns left/right

#### Outsourced Provider Columns
- Providers also have columns (like stations)
- For providers with capacity >1 (unlimited), column splits into subcolumns like calendar apps handle overlapping meetings

### 3.3 Time Representation

- Time flows **downward** (top = earlier, bottom = later)
- **Snap grid:** 30 minutes
- Day/hour markers on left edge
- "Today" marker line (horizontal, highlighted)
- Dropdown to jump to specific date/time

### 3.4 Station Unavailability

- Non-operating periods shown as visual overlay
- Tasks that overlap unavailability:
  - Tile stretches "across" the unavailability
  - Different visual appearance during unavailable period (e.g., hatched pattern)
  - Total duration = work time + unavailability gap

### 3.5 Tile Display

Each tile represents a scheduled task assignment:

```
┌─────────────────────────┐
│  Setup                  │ ← Setup section (lighter shade)
├─────────────────────────┤
│                         │
│  Run                    │ ← Run section (full color)
│  Reference              │
│  Description            │
│  Start time             │
│  End time               │
│                         │
└─────────────────────────┘
```

#### Tile Content
- Job reference
- Job description (truncated)
- Start time
- End time
- Setup/run visual differentiation
- Completion checkbox (manually toggled; does not affect precedence validation)

#### Tile Styling
- Random job color (consistent per job)
- Setup section distinguishable from run section
- Red halo effect if precedence rules violated
- Highlighting when group capacity exceeded

### 3.6 Similarity Indicators

Between consecutive tiles on the same station:

```
     ┌──────────────┐
     │   Tile A     │
     └──────────────┘
           ●○●○     ← Similarity circles
     ┌──────────────┐
     │   Tile B     │
     └──────────────┘
```

- Circles positioned vertically between tiles
- Overlap both tiles equally
- Filled circle (●) = criterion matched
- Hollow circle (○) = criterion not matched
- Number of circles = criteria count for station category

---

## 4. Right Panel

### 4.1 Structure

The right panel contains **two zones stacked vertically**:

| Zone | Purpose |
|------|---------|
| Top | Late jobs list |
| Bottom | Job actions / contextual info |

### 4.2 Late Jobs Zone

- **Content:** Jobs where scheduled completion exceeds workshopExitDate
- **Display:** List with job reference, deadline, and delay amount
- **Actions that break precedence** also listed here

### 4.3 Job Actions Zone

- **Content:** Complete task list with time frames for:
  - The highlighted tile's job (if tile selected)
  - OR the highlighted job from left panel
- **Display:** All tasks with their scheduled start/end (or "unscheduled")

---

## 5. Interactions

### 5.1 Drag and Drop

| Source | Target | Result |
|--------|--------|--------|
| Left panel (unscheduled task) | Center grid | Create new assignment |
| Center grid (tile) | Center grid (different position) | Reschedule assignment |
| Center grid (tile) | Left panel | Recall (unassign) |

#### Drag Behavior

1. **During drag:** Real-time validation (<10ms feedback)
2. **Precedence safeguard:**
   - If drop violates precedence rules → snap to nearest valid timeslot
   - Holding Alt bypasses this safeguard
3. **On drop:** Server validates (authoritative)
4. **If invalid:** Show conflict resolution panel

### 5.2 Tile Shortcuts

Within a tile:
- **Swap up button:** Switch position with tile above
- **Swap down button:** Switch position with tile below

### 5.3 Recall Tile

- Hover over scheduled task in left panel → "Recall" button appears
- Click "Recall" → removes assignment only for that specific task
- Consecutive tiles remain in place (only recalled tile is affected)

### 5.4 Precedence Violation Handling

| Situation | Visual Feedback |
|-----------|-----------------|
| Drag would violate precedence | Snap to nearest valid position |
| Alt+Drag | Allow placement (bypass safeguard) |
| Tile violates precedence (after placement) | Red halo effect |

**Note:** In MVP, precedence violations are allowed with visual warning only — no hard blocks prevent the user from creating the assignment.

### 5.5 Tile Insertion Behavior

When inserting a tile at a position occupied by existing tiles:

| Station Type | Behavior |
|--------------|----------|
| Capacity-1 | Tiles CANNOT overlap. Subsequent tiles are pushed down (later in time) automatically. |
| Capacity > 1 | Tiles CAN overlap up to the station's capacity limit. |

Tiles are inserted **between** existing tiles, not **over** them.

---

## 6. Navigation

### 6.1 Scrolling

- **Vertical scroll:** Navigate time (mouse wheel, trackpad)
- **Horizontal scroll:** Navigate stations (shift + wheel, or trackpad)
- **Keyboard shortcut:** Jump to columns right of current view

### 6.2 Jump Controls

- **Dropdown:** Jump to specific date/time
- **"Today" button:** Jump to current time

### 6.3 Filtering

- **Left panel filter:** Search jobs by reference, client, description
- Filter updates jobs list in real-time

---

## 7. Schedule Management

### 7.1 Current State (MVP)

Single schedule, auto-saved on every change.

### 7.2 Future State (Post-MVP)

**Schedule Branching:**

- **"Branch" floating button:** Duplicate current schedule
- **Schedule creation modal:**
  - Required: Name
  - Optional: Comments
- **Schedule list view:**
  - All schedules listed
  - "Create branch" option per schedule
  - "Set as PROD" dropdown (only one PROD at a time)
- **Auto-save:** No explicit save button

---

## 8. Job Creation Modal

Triggered by "Add Job" button in left panel.

### 8.1 Modal Fields

| Field | Type | Required |
|-------|------|----------|
| Reference | Text | Yes |
| Client | Text | Yes |
| Description | Text | Yes |
| Workshop Exit Date | Date picker | Yes |
| Paper Type | Text | No |
| Paper Format | Text | No |
| Paper Status | Dropdown (InStock/ToOrder) | No |
| Notes | Textarea | No |

### 8.2 Task Definition

- **Textarea with DSL syntax**
- **Autocomplete** on `[` for station names, `ST [` for provider names
- **Syntax highlighting** for DSL elements
- **Real-time validation** with error indicators
- One task per line

```
[Komori] 20+40 "vernis"
[Massicot] 15
ST [Clément] Pelliculage 2JO
[Conditionnement] "au mieux" 30
```

---

## 9. Visual Specifications

### 9.1 Colors

| Element | Purpose |
|---------|---------|
| Job color | Assigned at job creation, consistent across all tiles |
| Setup section | Lighter shade of job color |
| Run section | Full job color |
| Precedence violation | Red halo |
| Group capacity exceeded | Yellow/orange highlight |
| Unavailability overlay | Gray hatched pattern |

#### Job Color Assignment
- Colors are assigned **randomly** when a job is created
- Uses a predefined palette of 12 visually distinct colors
- **Dependent jobs** (via requiredJobIds) use **shades of the same base color** for visual grouping
- Palette selected for accessibility (colorblind-friendly)
- Color stored in Job.Color field as hex string (e.g., "#3B82F6")

### 9.2 Time Grid

| Element | Specification |
|---------|---------------|
| Snap unit | 30 minutes |
| Day markers | Bold horizontal line with date |
| Hour markers | Lighter horizontal line |
| Current time | Colored horizontal line (e.g., red) |

### 9.3 Tile Dimensions

- **Width:** Column width minus padding
- **Height:** Proportional to duration (setup + run)
- **Minimum height:** Enough to display core info

---

## 10. Responsive Behavior

### 10.1 Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| Large (desktop) | All 3 panels visible |
| Medium (tablet) | Right panel collapses to icon strip |
| Small (mobile) | Single panel view with navigation |

### 10.2 Panel Sizing

- Left panel: Collapsible, resizable
- Center panel: Expands to fill available space
- Right panel: Collapsible, fixed width

---

## 11. Performance Requirements

| Metric | Target |
|--------|--------|
| Drag feedback | <10ms |
| Grid render (100 tiles) | <100ms |
| Assignment validation | <50ms (client-side) |
| Initial load | <2s |

---

## 12. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Arrow keys | Navigate tiles |
| Enter | Open tile details |
| Escape | Cancel drag / close modal |
| Ctrl+Z | Undo last action |
| Ctrl+Shift+Z | Redo |
| Page Down/Up | Scroll time (day increments) |
| Home | Jump to today |

---

## 13. Accessibility

- ARIA labels on all interactive elements
- Focus management for keyboard navigation
- Color not sole indicator (patterns/icons for status)
- Drag-and-drop alternatives (keyboard tile placement)

---

This document defines the complete UI specification for the Flux scheduling interface. Implementation should follow these specifications while iterating on visual polish and interaction refinements based on user feedback.
