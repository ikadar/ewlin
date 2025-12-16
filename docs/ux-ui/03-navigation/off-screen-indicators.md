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

## Display: Header Count

Off-screen indicators appear in the **station column headers** as a compact count:

### Position

- Inside the sticky header row
- Right side of each station header
- Only shown when there are off-screen tiles for the selected job

### Appearance

```
+----------------------------------------------------------+
| Komori G40                                    ↑ 2        |
+----------------------------------------------------------+
```

- Chevron icon (`chevron-up` or `chevron-down`) indicating direction
- Count of off-screen tiles in that direction
- Subtle styling (`text-zinc-500`)

### HTML Example

```html
<div class="w-60 shrink-0 py-2 px-3 text-sm font-medium text-zinc-300 flex items-center justify-between">
  <span>Komori G40</span>
  <!-- Off-screen indicator: 2 tiles above viewport -->
  <div class="flex items-center gap-1 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
    <i data-lucide="chevron-up" class="w-3 h-3"></i>
    <span>2</span>
  </div>
</div>
```

---

## Interaction: Click for Details

Clicking on the header indicator reveals a **dropdown** with details:

### Dropdown Content

| Element | Description |
|---------|-------------|
| **Tile entries** | List of off-screen tiles |
| **Per entry:** | Date/time + task info |
| **Click entry** | Scrolls grid to that tile |

### Dropdown Example

```
+------------------------+
| ↑ 2 tiles above        |
+------------------------+
| Dec 12, 09:00          |
| Task 1 - Impression    |
+------------------------+
| Dec 12, 14:00          |
| Task 4 - Vernis        |
+------------------------+
```

### HTML Structure

```html
<div class="absolute top-full right-0 mt-1 bg-zinc-800 border border-white/10 rounded-lg shadow-lg z-40 min-w-48">
  <div class="px-3 py-2 text-xs text-zinc-400 border-b border-white/5">
    2 tiles above
  </div>
  <div class="py-1">
    <button class="w-full px-3 py-2 text-left hover:bg-white/5 text-sm">
      <div class="text-zinc-300">Dec 12, 09:00</div>
      <div class="text-zinc-500 text-xs">Task 1 - Impression</div>
    </button>
    <button class="w-full px-3 py-2 text-left hover:bg-white/5 text-sm">
      <div class="text-zinc-300">Dec 12, 14:00</div>
      <div class="text-zinc-500 text-xs">Task 4 - Vernis</div>
    </button>
  </div>
</div>
```

---

## Direction Indicators

| Tile Location | Indicator |
|---------------|-----------|
| Above viewport (earlier time) | `chevron-up` + count |
| Below viewport (later time) | `chevron-down` + count |

If tiles exist both above and below:

```
+----------------------------------------------------------+
| Komori G40                                ↑ 2    ↓ 1     |
+----------------------------------------------------------+
```

---

## Distinct Styling for Sequence Context

In the dropdown, **preceding and following tasks** (in sequence order) can have distinct styling:

| Indicator Type | Description | Visual Style |
|----------------|-------------|--------------|
| **Preceding task** (N-1) | Task immediately before visible tiles | Highlighted/bold |
| **Following task** (N+1) | Task immediately after visible tiles | Highlighted/bold |
| **Other tiles** | Other tiles from same job | Standard style |

This helps users understand sequence context.

---

## Behavior

| Action | Result |
|--------|--------|
| **Hover on header indicator** | Slight highlight |
| **Click on header indicator** | Toggle dropdown open/close |
| **Click on dropdown entry** | Grid scrolls to that tile, dropdown closes |
| **Click outside dropdown** | Dropdown closes |

---

## Rationale

- **Compact:** Header count keeps UI clean
- **Progressive disclosure:** Details available on click
- **Actionable:** Each entry is a navigation shortcut
- **Sequence context:** Preceding/following distinction helps workflow

---

## Related Documents

- [Tile Component](../05-components/tile-component.md) — Job color
- [Grid Navigation](grid-navigation.md) — Other navigation methods
- [Job Details Panel](../05-components/job-details-panel.md) — Task list as alternative navigation
