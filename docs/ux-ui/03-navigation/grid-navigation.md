# Grid Navigation

Scrolling and navigation within the scheduling grid.

---

## Overview

The scheduling grid can display a large time range and many station columns. Navigation features help users move efficiently.

---

## Scrolling

### Vertical Scroll (Time)

| Method | Action |
|--------|--------|
| Mouse wheel | Scroll through time |
| Trackpad | Two-finger vertical scroll |
| Page Up/Down | Scroll by day increments |

### Horizontal Scroll (Stations)

| Method | Action |
|--------|--------|
| Shift + mouse wheel | Scroll through stations |
| Trackpad | Two-finger horizontal scroll |
| Keyboard shortcut | Jump to columns right/left of current view (TBD) |

---

## Jump to Date

### Dropdown

- Location: Header or toolbar (TBD)
- Allows selection of specific date/time
- Grid scrolls to show selected time

### Today Button

- Location: Near date dropdown
- Action: Scrolls grid to current date/time
- "Today" marker line becomes visible

---

## Today Marker

- **Visual:** Colored horizontal line (e.g., red) across all columns
- **Position:** At current date/time
- **Always visible:** When current time is in viewport

---

## Zoom Levels

> Implemented from REQ-08

The grid supports 6 zoom levels that control how much time is visible:

| Zoom Level | Pixels per Hour | Description |
|------------|-----------------|-------------|
| **25%** | 20px | Maximum overview, shows many hours |
| **50%** | 40px | Compact view |
| **75%** | 60px | Medium view |
| **100%** (default) | 80px | Standard view |
| **150%** | 120px | Detailed view |
| **200%** | 160px | Maximum detail |

### Zoom Control

Located in the Top Navigation Bar:

```
[ - ] 100% [ + ]
```

- **Zoom out (-):** Decrease zoom (show more time)
- **Zoom level:** Current zoom percentage
- **Zoom in (+):** Increase zoom (show more detail)

### Button States

| Zoom Level | Zoom Out | Zoom In |
|------------|----------|---------|
| 25% | Disabled | Enabled |
| 50%-150% | Enabled | Enabled |
| 200% | Enabled | Disabled |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Home | Jump to today |
| Page Up | Scroll up by one day |
| Page Down | Scroll down by one day |
| Arrow keys | Navigate between tiles (when tile selected) |

---

## Column Headers

- Station names remain visible while scrolling vertically
- Sticky header behavior

---

## Virtual Scrolling (Performance)

> Implemented from REQ-09 in v0.3.46

The scheduling grid uses virtual scrolling to handle large time ranges (365 days) without performance degradation.

### How It Works

```
┌─────────────────────────────────────────────────────┐
│                 365 Days Total                       │
│  ┌────────────────────────────────────────────────┐ │
│  │ Day 0-2    (off-screen, not rendered)          │ │
│  ├────────────────────────────────────────────────┤ │
│  │ Day 3-9    ← VISIBLE + BUFFER (rendered)       │ │
│  ├────────────────────────────────────────────────┤ │
│  │ Day 10-364 (off-screen, not rendered)          │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| **totalDays** | 365 | Full scrollable range |
| **bufferDays** | 3 | Days rendered around focused day |
| **Rendered days** | ~7 | bufferDays × 2 + 1 |

### DOM Element Reduction

| Component | Without Virtual Scroll | With Virtual Scroll |
|-----------|----------------------|---------------------|
| Hour markers | 8,760 | ~168 |
| Grid lines per station | 8,760 | ~168 |
| Total elements | ~50,000+ | ~1,500 |

### Performance Targets

| Metric | Target | Without VS | With VS |
|--------|--------|------------|---------|
| **Drag FPS** | 60 FPS | <10 FPS | 60 FPS |
| **INP** | <200ms | >400ms | <200ms |
| **DOM count** | <2,000 | ~50,000 | ~1,500 |

### Implementation Details

- **useVirtualScroll hook:** Calculates visible day range from scroll position
- **visibleDayRange prop:** Passed to TimelineColumn, StationColumn
- **Stable references:** visibleRange object stabilized with useRef to prevent unnecessary re-renders
- **React.memo:** Components memoized with custom comparison functions

---

## Related Documents

- [Date Navigation Strip](date-navigation-strip.md) — Quick day navigation
- [Backward Scheduling](backward-scheduling.md) — Jump to deadline
- [Scheduling Grid](../05-components/scheduling-grid.md) — Grid component
