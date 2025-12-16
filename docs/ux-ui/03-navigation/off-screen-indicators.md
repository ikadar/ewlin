# Off-Screen Tile Indicators

Visual indicators showing tiles from the selected job that are outside the current viewport.

---

## Overview

When a job is selected, tiles from that job may be scheduled at times not currently visible. Off-screen indicators show where these tiles are and provide quick navigation.

---

## Visibility

| Context | Indicators Shown |
|---------|------------------|
| Job selected | Yes — for that job's tiles |
| No job selected | No indicators |

---

## Design: Rectangle with Arrow

Off-screen indicators appear as **small rectangles with directional arrows** showing the date/time of tiles outside the viewport.

### Position

- **Above viewport:** Indicator at top of station column
- **Below viewport:** Indicator at bottom of station column
- Only shown when there are off-screen tiles for the selected job

### Appearance

```
+---------------------------+
|  ↑ Di 15/12 08:30         |  ← Rectangle with up arrow + datetime
+---------------------------+
```

- **Arrow:** Up (`↑`) for tiles above, Down (`↓`) for tiles below
- **Content:** Date and time of the off-screen tile
- **Styling:** Subtle background (`bg-zinc-800`), rounded corners

### Multiple Off-Screen Tiles

When multiple tiles are off-screen in the same direction, the indicator shows the **nearest tile's** information:

- Above viewport: Shows the latest (closest to visible area)
- Below viewport: Shows the earliest (closest to visible area)

### HTML Example

```html
<!-- Off-screen indicator: tile above viewport -->
<div class="absolute top-0 left-0 right-0 px-2 py-1 bg-zinc-800/90 text-xs flex items-center gap-1 cursor-pointer hover:bg-zinc-700/90 rounded-b">
  <i data-lucide="chevron-up" class="w-3 h-3 text-zinc-400"></i>
  <span class="text-zinc-300">Di 15/12 08:30</span>
</div>

<!-- Off-screen indicator: tile below viewport -->
<div class="absolute bottom-0 left-0 right-0 px-2 py-1 bg-zinc-800/90 text-xs flex items-center gap-1 cursor-pointer hover:bg-zinc-700/90 rounded-t">
  <i data-lucide="chevron-down" class="w-3 h-3 text-zinc-400"></i>
  <span class="text-zinc-300">Je 18/12 14:00</span>
</div>
```

---

## Direction Indicators

| Tile Location | Arrow | Content |
|---------------|-------|---------|
| Above viewport (earlier time) | `↑` (chevron-up) | Date/time of nearest tile |
| Below viewport (later time) | `↓` (chevron-down) | Date/time of nearest tile |

---

## Behavior

| Action | Result |
|--------|--------|
| **Click on indicator** | Grid scrolls to that tile's position |
| **Hover** | Slight highlight |

---

## Sequence Context

For tiles with sequence relationships:

| Indicator Type | Description |
|----------------|-------------|
| **Preceding task** (N-1) | Task immediately before visible tiles in sequence |
| **Following task** (N+1) | Task immediately after visible tiles in sequence |

The indicator can optionally show if the off-screen tile is the immediate predecessor or successor to help users understand workflow sequence.

---

## Rationale

- **Simple:** Clear rectangle with arrow and datetime
- **Actionable:** Click to navigate directly
- **Contextual:** Shows when the off-screen tile is scheduled
- **Non-intrusive:** Appears only when relevant (job selected)

---

## Related Documents

- [Tile Component](../05-components/tile-component.md) — Job color
- [Grid Navigation](grid-navigation.md) — Other navigation methods
- [Job Details Panel](../05-components/job-details-panel.md) — Task list as alternative navigation
