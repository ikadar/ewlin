# Conflict Indicators

Visual feedback for scheduling conflicts and violations.

---

## Overview

The UI provides clear visual indicators when scheduling rules are violated. These help users identify and resolve issues.

---

## Conflict Types and Visuals

| Conflict Type | Visual Indicator | Location |
|---------------|------------------|----------|
| **Precedence violation** | Red halo effect around tile | On the violating tile |
| **Station conflict** (double-booking) | Red highlight on both tiles | On overlapping tiles |
| **Group capacity exceeded** | Yellow/orange highlight | On affected time slot |
| **Deadline conflict** (late job) | Listed in right panel | Right panel |
| **Approval gate conflict** | Tile grayed out / blocked | On the tile (if scheduling attempted) |
| **Availability conflict** | Gray hatched overlay | On the time slot |

---

## Precedence Violation

**When:** Task N is placed before Task N-1 completes (after Alt bypass)

**Visual:**
- Red halo/glow effect around the tile
- Listed in right panel under violations

**Resolution:** Move the tile to a later time, or move predecessor earlier

---

## Station Conflict (Double-Booking)

**When:** Two tasks overlap on a capacity-1 station

**Visual:**
- Both tiles highlighted in red
- Listed in right panel

**Note:** System normally prevents this via tile insertion (push down). Conflict may occur due to external schedule changes.

---

## Group Capacity Exceeded

**When:** More tasks running simultaneously than `MaxConcurrent` allows for a station group

**Visual:**
- Time slot highlighted in yellow/orange across affected columns
- Listed in right panel

---

## Deadline Conflict (Late Job)

**When:** Job's last task completes after `workshopExitDate`

**Visual:**
- Job appears in "Late Jobs" section of right panel
- Shows: job reference, deadline, expected completion, delay days

---

## Right Panel: Problems List

The right panel displays all active conflicts:

```
+------------------------+
|     LATE JOBS          |
+------------------------+
| Job 45113 A            |
| Deadline: Dec 15       |
| Expected: Dec 17       |
| Delay: 2 days          |
+------------------------+
|                        |
+------------------------+
|     VIOLATIONS         |
+------------------------+
| Task 3 (Job 45113 A)   |
| Precedence violation   |
+------------------------+
| Komori @ Dec 14 10:00  |
| Group capacity (3/2)   |
+------------------------+
```

---

## Severity Levels

| Severity | Examples | Blocking? |
|----------|----------|-----------|
| **High** | Station conflict, approval gate | Yes (prevents save) |
| **Medium** | Precedence violation, deadline | Warning (can proceed with Alt) |
| **Low** | Informational | No |

---

## Related Documents

- [Business Rules](../../domain-model/business-rules.md) — Validation rules
- [Drag and Drop](../01-interaction-patterns/drag-drop.md) — Precedence safeguard
- [Right Panel](../05-components/right-panel.md) — Problems display
