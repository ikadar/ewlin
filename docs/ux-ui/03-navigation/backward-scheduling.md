# Backward Scheduling

Jump to deadline workflow for scheduling jobs from their departure date backwards.

---

## Overview

Backward scheduling is the recommended workflow: start from the deadline and place tasks in reverse order to ensure jobs meet their departure dates.

---

## Jump to Deadline Shortcut

| Prerequisite | A job must be selected |
|--------------|------------------------|
| Shortcut | TBD |
| Action | Grid scrolls so job's departure date appears at **bottom** of viewport |

### Why Bottom of Viewport?

- User sees time **before** the deadline
- Natural starting point for placing the last task
- Aligns with the "work backwards" mental model

---

## Visual Marker

- **Horizontal line** on the grid indicates the selected job's departure date
- Line spans all columns
- Visually distinct color/style

---

## No Job Selected

If no job is selected when shortcut is pressed:
- **Nothing happens**
- Shortcut requires job context to determine departure date

---

## Recommended Workflow

1. **Select job** in left panel
2. **Press shortcut** → Grid shows departure date at bottom
3. **Place last task** just before the deadline
4. **Place second-to-last task** before that
5. **Continue backwards** through task list
6. **Result:** Schedule is built to meet the deadline

### With Quick Placement Mode

1. Select job
2. Press backward scheduling shortcut (jump to deadline)
3. Activate Quick Placement Mode
4. Click to place tasks rapidly (system auto-selects last available)
5. Use job navigation to move to next job
6. Repeat

---

## Rationale

- **Deadline-driven:** Ensures jobs are scheduled to meet their exit dates
- **Visual context:** Departure date at bottom = space above for tasks
- **Efficiency:** Combined with Quick Placement Mode, enables rapid scheduling

---

## Related Documents

- [Quick Placement Mode](../01-interaction-patterns/quick-placement-mode.md) — Fast placement
- [Job Navigation](job-navigation.md) — Switch between jobs
- [Date Navigation Strip](date-navigation-strip.md) — Visual departure date indicator
