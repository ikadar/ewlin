# Date Navigation Strip

A narrow column next to the task list for quick day-based navigation.

---

## Overview

The date navigation strip provides a compact way to navigate to specific days without using the main dropdown or scrolling.

---

## Position

- **Location:** Immediately to the right of the task list column (left panel)
- **Width:** Narrow (just enough for date labels)
- **Height:** Full height of the task list area

---

## Structure

- Divided into **day zones** separated by horizontal lines
- Each zone represents one day
- Days are labeled (date format TBD)

---

## Date Range

| Context | Range Displayed |
|---------|-----------------|
| Job selected | From **today** to job's **departure date** |
| No job selected | Default range: **next 14 days** |

---

## Visual Indicators

| Element | Visual Treatment |
|---------|------------------|
| **Today** | Visually distinct marker (bold, different color) |
| **Departure date** | Highlighted (when job selected) |
| **Days with placed tiles** | Highlighted to show job's tile positions |
| **Weekends/holidays** | Omitted (may change in future) |

---

## Interactions

| Action | Result |
|--------|--------|
| **Click on day** | Immediate scroll to that day |
| **Hover (2 seconds)** | Auto-scroll to that day |

---

## Visual Example

```
+-------------+--------+
| Task List   | Days   |
+-------------+--------+
| [Task 1]    | Dec 13 | <-- Today (bold)
| [Task 2]    |--------|
| [Task 3]    | Dec 14 | <-- has tiles (highlighted)
| [Task 4]    |--------|
| [Task 5]    | Dec 15 |
|             |--------|
|             | Dec 16 | <-- has tiles (highlighted)
|             |--------|
|             | Dec 17 |
|             |--------|
|             | Dec 18 | <-- Departure (highlighted)
+-------------+--------+
```

---

## Rationale

- **Speed:** Faster than dropdown for common date ranges
- **Context:** Shows job's time span at a glance
- **Awareness:** Highlights where tiles are already placed

---

## Related Documents

- [Left Panel](../05-components/left-panel.md) — Parent component
- [Grid Navigation](grid-navigation.md) — Other navigation methods
- [Backward Scheduling](backward-scheduling.md) — Jump to deadline
