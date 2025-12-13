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

## Position

| Tile Location | Indicator Position |
|---------------|-------------------|
| Above viewport (earlier time) | **Top** of the station column |
| Below viewport (later time) | **Bottom** of the station column |

---

## Quantity

- **One indicator per off-screen tile** from the selected job
- If multiple tiles are above/below, multiple indicators appear (stacked)
- Rare in practice — most jobs have few tiles per station

---

## Content

Each indicator displays:
- **Colored mark** using the job's assigned color
- **Date/time** of the tile

---

## Visual Distinction

Indicators for **preceding and following tasks** (in sequence order) have distinct styling:

| Indicator Type | Description | Visual Style |
|----------------|-------------|--------------|
| **Preceding task** (N-1) | Task immediately before currently visible tiles | Distinct style A |
| **Following task** (N+1) | Task immediately after currently visible tiles | Distinct style B |
| **Other tiles** | Other tiles from same job | Standard style |

This helps users understand sequence context.

---

## Interaction

| Action | Result |
|--------|--------|
| **Click on indicator** | Grid scrolls to that specific tile |

Each indicator is independently clickable.

---

## Visual Example

```
Column: [Komori]

  [Dec 12, 09:00] ← indicator (preceding, distinct style)
  [Dec 12, 14:00] ← indicator (standard)
+-----------------+
|                 |
|  (visible area) |
|                 |
|  +-----------+  |
|  | Tile 3    |  |
|  +-----------+  |
|                 |
+-----------------+
  [Dec 15, 10:00] ← indicator (following, distinct style)
```

---

## Rationale

- **Awareness:** Know where job's tiles are without scrolling
- **Navigation:** Click to jump directly to any tile
- **Sequence context:** Preceding/following distinction shows schedule flow

---

## Related Documents

- [Tile Component](../05-components/tile-component.md) — Job color
- [Grid Navigation](grid-navigation.md) — Other navigation methods
- [Left Panel](../05-components/left-panel.md) — Task list as alternative navigation
