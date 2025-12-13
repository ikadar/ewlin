# Station Unavailability

Visual representation of station non-operating periods and task stretching behavior.

---

## Overview

Stations have operating schedules defining when they are available. Non-operating periods are shown visually, and tasks that span these periods are stretched accordingly.

---

## Unavailability Overlay

### Visual

- **Gray hatched pattern** over time slots when station is unavailable
- Clearly distinguishes operating vs non-operating periods
- Pattern spans the full column width

### Sources of Unavailability

| Source | Example |
|--------|---------|
| Regular schedule | Daily lunch break 12:00-13:00 |
| Weekly pattern | Not operating on weekends |
| Schedule exceptions | Holiday closure, maintenance |

---

## Task Stretching

When a task overlaps an unavailability period, it **stretches** across:

### Behavior

- Task starts before unavailability → continues after unavailability ends
- **Work time** is preserved (e.g., 60 min task = 60 min of actual work)
- **Elapsed time** is extended to account for the gap

### Visual

```
Time    [Komori]

11:00   +---------+
        |  Work   |  <-- 30 min work
11:30   |---------|
        |/////////|  <-- unavailable (hatched, different appearance)
        |/////////|
13:00   |---------|
        |  Work   |  <-- 30 min work
13:30   +---------+

Total work: 60 min
Total elapsed: 11:00 - 13:30 = 2.5 hours
```

### Tile Appearance During Unavailability

- The portion of the tile overlapping unavailability has **different visual appearance**
- Indicates this time is "paused" — no work happening
- Could be: hatched pattern, lighter color, or subtle indicator

---

## Sequence View Behavior

In Sequence View mode:
- Station unavailability hatched overlay is still shown on the time axis
- Provides reference even though tiles are stacked as a list

---

## Schedule Exceptions

One-off exceptions override regular schedule:

| Exception Type | Effect |
|----------------|--------|
| Closed day | Full day unavailable |
| Modified hours | Custom operating times for that date |

---

## Related Documents

- [Operating Schedule](../../domain-model/domain-model.md#operatingschedule) — Schedule definition
- [Schedule Exceptions](../../domain-model/domain-model.md#scheduleexception) — Exception handling
- [Scheduling Grid](../05-components/scheduling-grid.md) — Grid rendering
- [Timeline vs Sequence](../02-view-modes/timeline-vs-sequence.md) — View mode behavior
