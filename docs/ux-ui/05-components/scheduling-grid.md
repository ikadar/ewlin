# Scheduling Grid

The main scheduling area consisting of Timeline and Station Columns.

---

## Overview

The scheduling grid is the core visualization of the schedule. It consists of two parts:
- **Timeline column:** Hour markers and "now" line
- **Station columns:** Tiles representing scheduled tasks

---

## Layout Position

The scheduling grid occupies the right portion of the screen:

```
... | Date Strip | Timeline | Station Columns |
    |    w-12    |   w-12   |     flex-1      |
```

The Timeline and Station Columns scroll together horizontally and vertically.

---

## Timeline Column

### Dimensions

| Property | Value |
|----------|-------|
| Width | 48px (w-12) |
| Background | `bg-zinc-900/50` |
| Border | `border-r border-white/5` |

### Hour Markers

```
6h  ────────────────
    ··· (15 min tick)
    ─── (30 min tick)
    ··· (45 min tick)
7h  ────────────────
```

- **Hour lines:** Full width, `bg-zinc-700/50`
- **30 min lines:** Partial width, `bg-zinc-700/50`
- **15/45 min lines:** Short ticks, `bg-zinc-800/50`
- **Hour labels:** `text-sm font-mono text-zinc-600`

### Now Line

```html
<div class="absolute left-0 right-0 h-0.5 bg-red-500 z-20" style="top: 413px;"></div>
<span class="absolute left-1 text-xs font-mono text-red-400 bg-zinc-900 px-1 rounded z-20">11:10</span>
```

- Horizontal red line at current time
- Time label on left side

### Departure Date Marker

- Horizontal **blue line** (`bg-blue-500`) indicating selected job's deadline
- Spans across all station columns
- Only visible when a job is selected

```html
<div class="absolute left-0 right-0 h-0.5 bg-blue-500 z-20 pointer-events-none" style="top: {position}px;"></div>
```

**Visual distinction:**
- Red line = Current time ("now")
- Blue line = Selected job's departure date

---

## Station Columns

### Structure

- One column per station
- Column header: Station name (sticky during vertical scroll)
- Column width: 240px (w-60) each
- Background: `bg-[#0a0a0a]`

### Column Header

Each station column has a sticky header showing:
- Station name
- Optional status indicator

### Ordering

- Station order is configurable (stored setting)
- Keyboard shortcut to navigate columns left/right

### Outsourced Providers

- Providers appear as columns (like stations)
- Unlimited capacity: Column splits into subcolumns when tiles overlap

---

## Axes

| Axis | Content | Direction |
|------|---------|-----------|
| **Horizontal (X)** | Station columns | Left to right |
| **Vertical (Y)** | Time | Top to bottom (earlier → later) |

**Important:** Time flows **downward** (like a calendar, not a Gantt chart).

---

## Grid Elements

| Element | Description |
|---------|-------------|
| **Tiles** | Scheduled task assignments |
| **Unavailability overlay** | Striped pattern for non-operating periods |
| **Similarity indicators** | Link icons between consecutive tiles |
| **Now line** | Horizontal red line at current time |
| **Departure date marker** | Horizontal line for selected job's deadline |
| **Hour grid lines** | Light lines at each hour |
| **Off-screen indicators** | Top/bottom of columns for out-of-view tiles |

### Unavailability Overlay

```css
.bg-stripes-dark {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(255,255,255,0.03) 10px,
    rgba(255,255,255,0.03) 20px
  );
}
```

---

## Column States

### Normal

- Full width (w-60)
- Shows all tiles and unavailability overlays

### Collapsed (during drag)

- Thin line
- Shows job-colored bands indicating tile positions
- See [Column Focus on Drag](../01-interaction-patterns/column-focus-on-drag.md)

### Compact (schedule optimization)

Button in station header that automatically removes empty time gaps between tiles, moving them as early as possible while respecting precedence rules.

**Compact button:**
- Located in station header
- Icon: Compress/minimize icon
- Click to trigger compact algorithm

**Compact algorithm:**
1. Process tiles from earliest to latest
2. For each tile, find earliest valid start:
   - After predecessor's `scheduledEnd` (if scheduled)
   - After previous tile on same station ends
   - Not in the past
3. Move tile to earliest valid position if it's earlier than current

**Example:**
```
Before compact:           After compact:
08:00 ┌─────────┐         08:00 ┌─────────┐
      │  Tile A │               │  Tile A │
09:00 └─────────┘         09:00 └─────────┘
                          09:00 ┌─────────┐
10:00    (gap)                  │  Tile B │
                          10:00 └─────────┘
11:00 ┌─────────┐         10:00 ┌─────────┐
      │  Tile B │               │  Tile C │
12:00 └─────────┘         11:00 └─────────┘

13:00    (gap)            (gaps removed)

14:00 ┌─────────┐
      │  Tile C │
15:00 └─────────┘
```

**Constraints:**
- Respects precedence rules (no conflicts created)
- Respects station capacity (no overlaps)
- Cannot schedule into the past
- Considers predecessors on other stations

**Use cases:**
- Optimize station utilization after manual adjustments
- Close gaps left by recalled tiles
- Quick schedule tightening

---

## Scroll Behavior

| Direction | Method |
|-----------|--------|
| Vertical (time) | Mouse wheel, trackpad, Page Up/Down |
| Horizontal (stations) | Shift + wheel, trackpad, keyboard shortcut |

### Synchronized Scrolling

**Critical requirement:** Timeline and Station Columns **must** scroll together vertically.

| Element | Vertical Scroll | Horizontal Scroll |
|---------|-----------------|-------------------|
| Timeline column | Synced with grid | N/A (fixed position) |
| Station columns | Synced | Scrolls horizontally |
| Date Strip | Independent | N/A |

**Implementation note:** The Timeline column and Station columns must be in the **same scroll container** to ensure synchronized vertical scrolling. Do not put them in separate scroll containers.

### Sticky Elements

- Column headers remain visible during vertical scroll
- Timeline labels remain visible during horizontal scroll

---

## View Modes

The grid supports two display modes:

| Mode | Tile Height | Tile Position |
|------|-------------|---------------|
| **Timeline View** | Proportional to duration | Aligned to time |
| **Sequence View** | Uniform | Stacked as list |

See [Timeline vs Sequence](../02-view-modes/timeline-vs-sequence.md)

---

## Performance

| Metric | Target |
|--------|--------|
| Render (100 tiles) | < 100ms |
| Scroll | 60 FPS |
| Drag feedback | < 10ms |

---

## Related Documents

- [Tile Component](tile-component.md) — Individual tile structure
- [Grid Navigation](../03-navigation/grid-navigation.md) — Scroll and jump
- [Column Focus on Drag](../01-interaction-patterns/column-focus-on-drag.md) — Collapse behavior
- [Similarity Indicators](../04-visual-feedback/similarity-circles.md) — Link icons between tiles
- [Off-screen Indicators](../03-navigation/off-screen-indicators.md) — Out-of-view tiles
