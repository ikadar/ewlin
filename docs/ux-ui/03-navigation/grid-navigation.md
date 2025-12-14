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

## Related Documents

- [Date Navigation Strip](date-navigation-strip.md) — Quick day navigation
- [Backward Scheduling](backward-scheduling.md) — Jump to deadline
- [Scheduling Grid](../05-components/scheduling-grid.md) — Grid component
