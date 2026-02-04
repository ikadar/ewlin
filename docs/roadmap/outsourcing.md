# Outsourcing Model Specification

> **Status:** Draft
> **Last Updated:** 2026-02-03

---

## Overview

This document describes the target behavior for outsourced tasks (sous-traitance) in the Flux Print Shop Scheduling System. Outsourced tasks represent work sent to external providers (e.g., lamination, gilding, binding) that cannot be performed in-house.

In terms of **grid behavior**, outsourcing works like drying time: an invisible constraint that affects precedence calculations. However, unlike drying time (a fixed rule), outsourcing is **user-configurable** through the Job Details Panel.

## Core Concept

**Outsourced tasks are precedence constraints, not scheduled tiles.**

### Similarity with Drying Time (Grid Behavior)

Like drying time after printing, outsourced tasks:
- Influence precedence rules and earliest/latest start calculations
- Do **not** appear as tiles in the scheduling grid
- Do **not** have dedicated columns in the grid
- Become visible during drag operations when they constrain tile placement

### Difference from Drying Time (Editability)

Unlike drying time (which is a fixed 4-hour rule after offset printing), outsourced tasks:
- Are visible in the Job Details Panel as **editable mini-forms**
- Have configurable duration (work days, transit days)
- Can be overridden with manual departure/return dates
- Reference a specific provider entity with its own parameters

## Provider Entity

Each outsourced provider is configured with the following parameters:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `name` | string | Provider name (unique identifier) | required |
| `latestDepartureTime` | time (HH:MM) | Latest time of day to dispatch work to provider | 14:00 |
| `receptionTime` | time (HH:MM) | Time of day when work returns from provider | 09:00 |
| `transitDays` | integer | Business days for transport (same for outbound and return) | 1 |

## Outsourced Task Definition

An outsourced task within an element's task sequence contains:

| Field | Type | Description |
|-------|------|-------------|
| `providerId` | UUID | Reference to the OutsourcedProvider |
| `actionType` | string | Type of work performed (e.g., "Pelliculage", "Dorure") |
| `workDays` | integer | Number of business days the provider needs to complete the work |
| `manualDeparture` | datetime? | Optional: user-specified departure date/time (overrides calculation) |
| `manualReturn` | datetime? | Optional: user-specified return date/time (overrides calculation) |

## Duration Calculation

### Timeline Structure

```
Departure (D)
  → [Transit: T business days]
  → [Work at Provider: N business days]
  → [Transit: T business days]
  → Return at receptionTime
```

Where:
- `T` = `transitDays` from provider (same for outbound and return)
- `N` = `workDays` from task

### Departure Date Rules

The departure date (D) is determined from the predecessor task's end time:

- If `predecessorEnd ≤ latestDepartureTime` on day X → **Departure = day X**
- If `predecessorEnd > latestDepartureTime` on day X → **Departure = next business day**

**Important:** The departure day is a transport day, not a work day. The first business day of actual work at the provider is the day **after** the outbound transit completes.

### Forward Calculation (Earliest Start of Successor)

Given:
- Predecessor task ends: Wednesday 11:00
- Provider: `latestDepartureTime` = 14:00, `receptionTime` = 09:00, `transitDays` = 1
- Task: `workDays` = 2

Calculation:
```
Wednesday 11:00  : Predecessor ends (11:00 < 14:00 ✓)
Wednesday        : Departure (D)
Thursday         : Transit outbound (T = 1)
Friday           : Work day 1 (N)
Monday           : Work day 2 (N)
Tuesday          : Transit return (T = 1)
Wednesday 09:00  : Return (receptionTime)
```

**Result:** `earliestStart(successor)` = Wednesday 09:00

### Forward Calculation (Late Departure Example)

Given:
- Predecessor task ends: Wednesday 16:00
- Same provider parameters, `workDays` = 2

Calculation:
```
Wednesday 16:00  : Predecessor ends (16:00 > 14:00 ✗)
Thursday         : Departure (D) - pushed to next business day
Friday           : Transit outbound (T = 1)
Monday           : Work day 1 (N)
Tuesday          : Work day 2 (N)
Wednesday        : Transit return (T = 1)
Thursday 09:00   : Return (receptionTime)
```

**Result:** `earliestStart(successor)` = Thursday 09:00

### Backward Calculation (Latest End of Predecessor)

Given:
- Successor task scheduled: Monday 10:00
- Provider: `latestDepartureTime` = 14:00, `receptionTime` = 09:00, `transitDays` = 1
- Task: `workDays` = 2

Calculation (working backwards):
```
Monday 10:00     : Successor starts (10:00 ≥ 09:00 ✓)
Monday 09:00     : Return possible (receptionTime)
Friday           : Transit return (T = 1)
Thursday         : Work day 2 (N)
Wednesday        : Work day 1 (N)
Tuesday          : Transit outbound (T = 1)
Monday           : Departure (D)
Monday 14:00     : Latest departure time
```

**Result:** `latestEnd(predecessor)` = Monday 14:00

### Backward Calculation (Early Successor Example)

Given:
- Successor task scheduled: Monday 08:00
- `receptionTime` = 09:00

Since 08:00 < 09:00, return cannot be Monday. Must be previous business day:
```
Friday 09:00     : Return (receptionTime)
Thursday         : Transit return (T = 1)
Wednesday        : Work day 2 (N)
Tuesday          : Work day 1 (N)
Monday           : Transit outbound (T = 1)
Friday           : Departure (D) - previous week
Friday 14:00     : Latest departure time
```

**Result:** `latestEnd(predecessor)` = Friday 14:00 (previous week)

## Manual Override

Users can override the automatic calculation by specifying explicit **date and time** values in the Job Details Panel:

| Field | Type | Effect |
|-------|------|--------|
| `manualDeparture` | datetime (date + time) | Sets a fixed departure date/time. `latestEnd(predecessor)` = this value |
| `manualReturn` | datetime (date + time) | Sets a fixed return date/time. `earliestStart(successor)` = this value |

**Important:** Both date AND time must be specified, not just the date. This allows precise scheduling (e.g., "Tuesday 10:00" not just "Tuesday").

When manual values are set:
- They become **immutable constraints** for precedence calculations
- The automatic calculation based on `workDays` and provider parameters is ignored
- The only way to change them is through the mini-form in Job Details Panel

## Final Outsourcing (No Return)

When outsourcing is the **final step** of an element (product ships directly from provider to end customer):

- `manualReturn` is not applicable (or set to null)
- The **departure date** becomes the effective "workshop exit" date
- The job's `workshopExitDate` constraint applies to the departure date

> **To be arbitrated:** Should the system track a separate "final delivery date" (from provider to customer) distinct from `workshopExitDate`? Current decision: keep it simple, `workshopExitDate` refers to when work leaves the workshop.

## User Interface

### Job Details Panel

Outsourced tasks appear as **TaskTiles with an embedded form**. The form is displayed directly inside the tile (not collapsed/expandable).

#### Tile Content

| Field | Editable | Description |
|-------|----------|-------------|
| Provider name | No | Displayed in tile header |
| Action type | No | Displayed in tile header (e.g., "Pelliculage") |
| Work days (JO) | Yes | Number input, default estimation for duration |
| Departure | Yes | Date/time picker |
| Return | Yes | Date/time picker (hidden if final step) |

#### Behavior

**All fields are always editable.** The user can override any value at any time.

**Initial state (predecessor not scheduled):**
- Work days field shows default value (from task definition)
- Departure/Return fields are **empty** (no date displayed)
- User can manually enter Departure/Return dates even before predecessor is placed

**After predecessor is scheduled:**
- Departure/Return fields are **automatically populated** based on:
    - Predecessor end time
    - Provider parameters (`latestDepartureTime`, `receptionTime`, `transitDays`)
    - Task `workDays` value
- Editing `workDays` recalculates Departure/Return
- Editing Departure/Return directly sets manual overrides

**Precedence violations:**
- If user-entered values conflict with predecessor/successor placement, a **precedence violation** is triggered
- The system handles violations through existing violation display mechanisms (not blocked at input)

**No Pick & Place:**
- Outsourced tasks cannot be picked or placed (they are constraints, not grid tiles)
- The tile is **not interactive** for scheduling purposes
- It serves as a **read/edit form** for the outsourcing parameters

### Scheduling Grid

- **No provider columns** in the grid
- Outsourced tasks are **invisible** as tiles
- During **drag operations**, outsourcing constraints appear as visual indicators (similar to drying time) showing why a tile cannot be placed earlier

### Precedence Visualization

When dragging a tile that has an outsourcing predecessor:
- The system shows the outsourcing constraint duration
- The earliest valid drop position accounts for the full outsourcing timeline
- Alt+drag can bypass the constraint (with warning) per existing UI rules

## Business Rules

### New/Modified Rules

| Rule ID | Description |
|---------|-------------|
| BR-OUTSOURCE-001 | Outsourced tasks are precedence constraints, not schedulable tiles |
| BR-OUTSOURCE-002 | Departure date is calculated from predecessor end + latestDepartureTime |
| BR-OUTSOURCE-003 | Return date is calculated from departure + outboundTransitDays + workDays + returnTransitDays |
| BR-OUTSOURCE-004 | Manual departure/return values override automatic calculation |
| BR-OUTSOURCE-005 | Final outsourcing (no return) uses departure date as effective workshop exit |

### Deprecated Rules

The following rules from the current model will be replaced:
- BR-TASK-008, BR-TASK-008b, BR-TASK-009 (simplified into new calculation model)
- Provider column display logic (removed)

## Migration Considerations

When implementing this model:
1. Existing `OutsourcedProvider` entities need new field (`transitDays`)
2. Provider columns in the scheduling grid are removed
3. Job Details Panel needs the outsourcing mini-form component
4. Precedence calculation engine needs to incorporate outsourcing as constraint type
5. Drag visualization needs to show outsourcing constraints like drying time

---

## Summary

| Aspect | Current Model | Target Model |
|--------|---------------|--------------|
| Grid representation | Provider columns with tiles | No representation (invisible constraint) |
| Duration unit | Business days only | Business days + transit days |
| User input | Duration in days | Default calculation OR manual dates |
| Precedence | Treated like station tasks | Treated like drying time |
| Job Details | Task in list | Editable mini-form |