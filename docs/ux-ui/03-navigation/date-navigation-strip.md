# Date Navigation Strip

A standalone column for quick day-based navigation.

> Implemented from REQ-09 (v0.3.44)

---

## Overview

The Date Navigation Strip provides a compact way to navigate to specific days without using the main dropdown or scrolling. It acts as a bridge between the job context (left side) and the scheduling grid (right side).

**Key features (REQ-09):**
- Extended date range (365 days) for "infinite" scroll effect
- Focused day always centered, synced with grid scroll
- Visual states for today, focused day, departure date, and scheduled days

---

## Position

- **Location:** Standalone column between Job Details Panel and Timeline
- **Width:** 48px (w-12)
- **Height:** Full viewport height
- **Background:** `bg-zinc-950`
- **Border:** `border-r border-white/5`

---

## Structure

```
+------+
| Lu   |
| 09   |
+------+
| Ma   |  ← Focused (highlighted bg)
| 10   |
+------+
| Me   |  ← Today (thin red line)
| 11   |
+------+
| Je   |  ← Departure (red bg)
| 12   |  ● (green dot = scheduled)
+------+
```

Each day zone shows:
- **Day abbreviation:** Lu, Ma, Me, Je, Ve, Sa, Di (French)
- **Day number:** 09, 10, 11, etc.

---

## Dimensions

| Property | Value |
|----------|-------|
| Zone height | 40px (h-10) |
| Font | Monospace, text-xs |
| Day abbrev | 10px (text-[10px]) |
| Day number | text-zinc-400 font-medium |

---

## Visual States

> REQ-09.3: Visual states overhaul

| State | Appearance | Priority |
|-------|------------|----------|
| **Departure date** | Red background (`bg-red-500/10`, `border-red-500/30`) | 1 (highest) |
| **Focused day** | White highlight (`bg-white/10`, `border-white/20`) | 2 |
| **Normal** | `text-zinc-500`, `border-b border-white/5` | 3 (lowest) |
| **Hover** | `hover:bg-white/5` | (overlay) |
| **Today** | Thin red line indicator (independent of above) | (overlay) |
| **Scheduled day** | Green dot indicator (REQ-16) | (overlay) |

### Today Indicator (REQ-09.3)

Today is indicated by a **thin red horizontal line** inside the cell, similar to the grid's "now" line. This replaces the previous amber background.

```html
<button class="h-10 w-full relative ...">
  <!-- Thin red line for today -->
  <div class="absolute left-1 right-1 top-1/2 h-0.5 bg-red-500 -translate-y-1/2 pointer-events-none" />
  <span class="text-[10px]">Me</span>
  <span class="font-medium">11</span>
</button>
```

### Focused Day (REQ-09.3)

The focused day (currently visible in the grid center) has a subtle white highlight:

```html
<button class="h-10 w-full ... bg-white/10 border-white/20 text-zinc-200">
  <span class="text-[10px]">Ma</span>
  <span class="font-medium text-zinc-100">10</span>
</button>
```

### Departure Date (REQ-15)

When a job is selected, its departure date has red styling:

```html
<button class="h-10 w-full ... bg-red-500/10 border-red-500/30 text-red-300">
  <span class="text-[10px]">Je</span>
  <span class="font-medium text-red-300">12</span>
</button>
```

### Scheduled Day Indicator (REQ-16)

Days with scheduled tasks for the selected job show a green dot:

```html
<button class="h-10 w-full relative ...">
  ...
  <span class="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
</button>
```

---

## Date Range

> REQ-09.1: Extended to 365 days

| Property | Value |
|----------|-------|
| Default range | 365 days (180 before + 185 after today) |
| Start date | Same as grid start date (6 days before today) |

The extended range provides an "infinite scroll" experience without the complexity of dynamic date loading.

---

## Scroll Synchronization

> REQ-09.2: Focused day sync

The DateStrip automatically scrolls to keep the **focused day** centered when the grid scrolls.

### Sync Logic

```
Grid scroll → Calculate focused date → Update DateStrip scroll position
```

1. Grid reports its `scrollTop` position
2. App calculates which date is at the viewport center
3. DateStrip scrolls to center that date and highlights it

### Implementation

```typescript
// App.tsx - Calculate focused date from grid scroll
const handleGridScroll = (scrollTop: number) => {
  const centerY = scrollTop + viewportHeight / 2;
  const hoursFromStart = centerY / pixelsPerHour;
  const focusedTime = new Date(gridStartDate.getTime() + hoursFromStart * 60 * 60 * 1000);
  setFocusedDate(focusedTime);
};

// DateStrip.tsx - Auto-scroll to center focused date
useEffect(() => {
  if (focusedDate && containerRef.current) {
    const dateIndex = dates.findIndex((d) => isSameDay(d, focusedDate));
    const targetScroll = dateIndex * CELL_HEIGHT - containerHeight / 2 + CELL_HEIGHT / 2;
    containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }
}, [focusedDate]);
```

---

## Interactions

| Action | Result |
|--------|--------|
| **Click on day** | Grid scrolls to that day, DateStrip updates focus |
| **Scroll grid** | DateStrip scrolls to keep focused day centered |

---

## Rationale

- **Speed:** Faster than dropdown for common date ranges
- **Context:** Shows current position in time (focused day)
- **Consistency:** Today indicator matches grid's "now" line style
- **Clarity:** Visual states clearly distinguish today, focused, departure, and scheduled days

---

## Related Documents

- [00-overview.md](../00-overview.md) — Screen layout
- [Grid Navigation](grid-navigation.md) — Other navigation methods
- [Backward Scheduling](backward-scheduling.md) — Jump to deadline
