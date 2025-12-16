# Date Navigation Strip

A standalone column for quick day-based navigation.

---

## Overview

The Date Navigation Strip provides a compact way to navigate to specific days without using the main dropdown or scrolling. It acts as a bridge between the job context (left side) and the scheduling grid (right side).

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
| Ma   |
| 10   |
+------+
| Me   |  ← Today (highlighted)
| 11   |
+------+
| Je   |
| 12   |
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

| State | Appearance |
|-------|------------|
| **Normal** | `text-zinc-500`, `border-b border-white/5` |
| **Hover** | `hover:bg-white/5` |
| **Today** | `text-amber-200`, `bg-amber-500/15`, `border-amber-500/30` |
| **Has tiles** | TBD - may show indicator |
| **Departure date** | Special highlight when job selected |

### Today Highlight

```html
<div class="h-10 flex flex-col items-center justify-center text-xs font-mono text-amber-200 border-b border-amber-500/30 cursor-pointer bg-amber-500/15">
  <span class="text-[10px]">Di</span>
  <span class="font-medium">15</span>
</div>
```

### Normal Day

```html
<div class="h-10 flex flex-col items-center justify-center text-xs font-mono text-zinc-500 border-b border-white/5 cursor-pointer hover:bg-white/5">
  <span class="text-[10px]">Lu</span>
  <span class="font-medium text-zinc-400">09</span>
</div>
```

---

## Date Range

| Context | Range Displayed |
|---------|-----------------|
| Default | Scrollable range covering scheduled content |
| Job selected | Highlights days from today to departure date |

---

## Interactions

| Action | Result |
|--------|--------|
| **Click on day** | Immediate scroll to that day in grid |
| **Hover (2 seconds)** | Auto-scroll to that day |

---

## Scroll Behavior

- Scrolls **independently** from the main grid
- Allows quick overview of available days
- Can be synchronized with grid scroll (TBD)

---

## Rationale

- **Speed:** Faster than dropdown for common date ranges
- **Context:** Shows current position in time
- **Standalone:** Clear separation from job-specific panels

---

## Related Documents

- [00-overview.md](../00-overview.md) — Screen layout
- [Grid Navigation](grid-navigation.md) — Other navigation methods
- [Backward Scheduling](backward-scheduling.md) — Jump to deadline
