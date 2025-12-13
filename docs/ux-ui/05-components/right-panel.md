# Right Panel

The right side of the screen dedicated to schedule health — problems that need attention.

---

## Overview

The right panel shows "what's wrong" with the schedule. It displays late jobs and violations that require user action.

---

## Design Philosophy

The right panel is focused on **problems to solve**:

- **Left panel:** Job context (what I'm working on)
- **Center:** Schedule grid (where I'm scheduling)
- **Right panel:** Schedule health (what's wrong)

This keeps actionable alerts visible without cluttering the main work area.

---

## Structure

```
+------------------------+
|     LATE JOBS          |
+------------------------+
| [Job entry]            |
| [Job entry]            |
+------------------------+
|                        |
+------------------------+
|     VIOLATIONS         |
+------------------------+
| [Violation entry]      |
| [Violation entry]      |
+------------------------+
```

---

## Late Jobs Section

### Content

Jobs where scheduled completion exceeds `workshopExitDate`.

### Entry Display

| Field | Description |
|-------|-------------|
| Job reference | e.g., "45113 A" |
| Deadline | workshopExitDate |
| Expected completion | Calculated from last task |
| Delay | Number of days late |

### Example

```
Job 45113 A
Deadline: Dec 15
Expected: Dec 17
Delay: 2 days
```

### Interactions

| Action | Result |
|--------|--------|
| Click entry | Select job in left panel, scroll to relevant tiles |

---

## Violations Section

### Content

Active scheduling rule violations.

### Types Displayed

| Type | Description |
|------|-------------|
| **Precedence violation** | Task placed before predecessor completes |
| **Group capacity exceeded** | Station group over MaxConcurrent |
| **Approval gate conflict** | BAT or Plates not satisfied |

**Note:** Station conflicts (double-booking) are normally prevented by the system. If they occur due to external changes, they appear here.

### Entry Display

| Field | Description |
|-------|-------------|
| Task/Job reference | Which task is affected |
| Violation type | Precedence, capacity, etc. |
| Location | Station and time |

### Example

```
Task 3 (Job 45113 A)
Precedence violation
Komori @ Dec 14, 10:00

Offset Presses Group
Capacity exceeded (3/2)
Dec 14, 09:00-11:00
```

### Interactions

| Action | Result |
|--------|--------|
| Click entry | Scroll grid to affected tile/time |

---

## Empty State

When no problems exist:

```
+------------------------+
|                        |
|   ✓ No late jobs       |
|                        |
|   ✓ No violations      |
|                        |
+------------------------+
```

---

## Panel Behavior

| Feature | Behavior |
|---------|----------|
| Collapsible | Yes (toggle to hide) |
| Fixed width | Yes |
| Responsive | May collapse to icon strip on smaller screens |

---

## Updates

- Panel updates in real-time as schedule changes
- New problems appear immediately
- Resolved problems disappear

---

## Related Documents

- [Conflict Indicators](../04-visual-feedback/conflict-indicators.md) — Visual indicators on grid
- [Business Rules](../../domain-model/business-rules.md) — Validation rules
- [Backward Scheduling](../03-navigation/backward-scheduling.md) — Avoiding late jobs
