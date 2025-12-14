# Similarity Circles

Visual indicators showing time-saving potential between consecutive tiles.

---

## Overview

When consecutive tiles on a station share characteristics (same paper type, same paper size, etc.), setup time can be reduced. Similarity circles indicate which criteria are met.

---

## Criteria Source

Similarity criteria are defined per **Station Category**:

- Each category has a list of criteria (e.g., "Same paper type", "Same paper size", "Same inking")
- Criteria reference job attributes for comparison
- Number of circles = number of criteria in the category

---

## Visual Representation

### Position

- Circles displayed **vertically between consecutive tiles**
- Equal overlap on both tiles (straddling the boundary)
- Centered horizontally in the column

### Appearance

| State | Visual |
|-------|--------|
| **Criterion matched** | Filled circle (●) |
| **Criterion not matched** | Hollow circle (○) |

### Example

Category "Offset Printing Press" has 4 criteria.
Jobs A and B share 2 criteria.

```
+-----------------+
|     Tile A      |
|   (Job A)       |
+-----------------+
      ●○●○         <-- 2 filled (matched), 2 hollow (not matched)
+-----------------+
|     Tile B      |
|   (Job B)       |
+-----------------+
```

---

## Comparison Logic

For each criterion in the station category:

1. Get the field path (e.g., `paperType`)
2. Compare values between the two jobs
3. If equal → filled circle
4. If different → hollow circle

---

## Display Rules

| Situation | Circles Shown |
|-----------|---------------|
| Two consecutive tiles from different jobs | Yes |
| Two consecutive tiles from same job | Yes (same job can have multiple tasks on same station) |
| Only one tile on station | No circles (no consecutive pair) |
| First tile has no predecessor | No circles above it |
| Last tile has no successor | No circles below it |

---

## No Automatic Optimization

- Similarity circles are **informational only** (MVP)
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
- [Tile Component](../05-components/tile-component.md) — Where circles are rendered
- [Business Rules](../../domain-model/business-rules.md#similarity-indicators) — UI-005
