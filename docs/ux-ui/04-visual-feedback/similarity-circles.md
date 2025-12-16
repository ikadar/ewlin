# Similarity Indicators

Visual indicators showing time-saving potential between consecutive tiles.

---

## Overview

When consecutive tiles on a station share characteristics (same paper type, same paper size, etc.), setup time can be reduced. Similarity indicators show which criteria are met using link icons.

---

## Criteria Source

Similarity criteria are defined per **Station Category**:

- Each category has a list of criteria (e.g., "Same paper type", "Same paper size", "Same inking")
- Criteria reference job attributes for comparison
- Number of icons = number of criteria in the category

---

## Visual Representation

### Position

- Icons displayed in a **horizontal row at the top-right corner** of the lower tile
- Positioned at the junction between two consecutive tiles
- Slightly overlapping the tile boundary

### Appearance

| State | Icon | Color |
|-------|------|-------|
| **Criterion matched** | `link` (chain link) | `text-zinc-400` |
| **Criterion not matched** | `unlink` (broken chain) | `text-zinc-800` |

Uses Lucide icons: `link` and `unlink`.

### Example

Category "Offset Printing Press" has 4 criteria.
Jobs A and B share 3 criteria.

```
+------------------------+
|     Tile A (Job A)     |
+------------------------+
         🔗 🔗 🔗 ⛓️‍💥      <-- 3 linked (matched), 1 unlinked (not matched)
+------------------------+
|     Tile B (Job B)     |
+------------------------+
```

### HTML Structure

```html
<div class="absolute right-3 flex gap-0.5 px-1.5 py-1 rounded-full" style="top: -10px;">
  <i data-lucide="link" class="w-3.5 h-3.5 text-zinc-400"></i>
  <i data-lucide="link" class="w-3.5 h-3.5 text-zinc-400"></i>
  <i data-lucide="link" class="w-3.5 h-3.5 text-zinc-400"></i>
  <i data-lucide="unlink" class="w-3.5 h-3.5 text-zinc-800"></i>
</div>
```

---

## Comparison Logic

For each criterion in the station category:

1. Get the field path (e.g., `paperType`)
2. Compare values between the two jobs
3. If equal → `link` icon (visible, zinc-400)
4. If different → `unlink` icon (dimmed, zinc-800)

---

## Display Rules

| Situation | Indicators Shown |
|-----------|------------------|
| Two consecutive tiles from different jobs | Yes |
| Two consecutive tiles from same job | Yes (same job can have multiple tasks on same station) |
| Only one tile on station | No indicators (no consecutive pair) |
| First tile has no predecessor | No indicators above it |
| Last tile has no successor | No indicators below it |

---

## No Automatic Optimization

- Similarity indicators are **informational only** (MVP)
- No automatic scheduling optimization based on similarity
- Users use this information to manually optimize if desired

---

## Rationale

- **Awareness:** Users see time-saving opportunities at a glance
- **Manual control:** Users decide whether to act on the information
- **Future potential:** Could inform auto-scheduling suggestions post-MVP

---

## Related Documents

- [Station Category](../../domain-model/domain-model.md#stationcategory-aggregate-root) — Criteria definition
- [Tile Component](../05-components/tile-component.md) — Where indicators are rendered
- [Business Rules](../../domain-model/business-rules.md#similarity-indicators) — UI-005
