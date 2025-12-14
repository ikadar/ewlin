# Left Panel

The left side of the screen showing jobs, tasks, status, and navigation aids.

---

## Overview

The left panel provides job context — what the user is working on. It contains multiple sub-components arranged vertically/horizontally.

---

## Structure

```
+------------------+-------+
|   JOBS LIST      | DATE  |
|                  | STRIP |
+------------------+       |
|   STATUS BAR     |       |
+------------------+       |
|   TASK LIST      |       |
|                  |       |
|                  |       |
|                  |       |
+------------------+-------+
```

---

## Jobs List

### Content

- List of all jobs (filtered/sorted)
- Each row shows:
  - Job reference
  - Client name (truncated)
  - Status indicator (color-coded)
  - Deadline indicator (if approaching)

### Interactions

| Action | Result |
|--------|--------|
| Click job | Select job (highlights, shows tasks) |
| Keyboard prev/next | Navigate between jobs |
| Filter input | Filter by reference, client, description |
| "Add Job" button | Opens job creation modal |

### Visual States

| State | Appearance |
|-------|------------|
| Normal | Default styling |
| Selected | Highlighted background |
| Late | Warning indicator |

---

## Status Bar

Shown when a job is selected. Displays job-level status information.

### Content

| Element | Values | Visual |
|---------|--------|--------|
| **BAT status** | Awaiting file / Sent / Approved / No proof required | Icon: ⚠ / ○ / ✓ / — |
| **Plates status** | Todo / Done | Icon: ○ / ✓ |
| **Paper status** | InStock / ToOrder / Ordered / Received | Icon with state |

### Interactions

- Icons are informational (display only)
- Editing done via job edit modal
- Tooltips show full status on hover

---

## Task List

Shows tasks for the selected job.

### Content

- Ordered list of tasks (sequence order)
- Each task shown as mini-tile with:
  - Task info (station, duration)
  - Scheduled state (opacity difference)

### Visual States

| State | Appearance |
|-------|------------|
| Unscheduled | Full opacity |
| Scheduled | Lower opacity |

### Interactions

| Action | Result |
|--------|--------|
| **Single-click** (scheduled) | Scroll grid to tile |
| **Double-click** (scheduled) | Recall tile |
| **Hover** (scheduled) | Show "Jump to" and "Recall" buttons |
| **Drag** (unscheduled) | Start drag to grid |
| **Reorder** (drag within list) | Change task sequence |

See [Tile Recall](../01-interaction-patterns/tile-recall.md) for details.

---

## Date Navigation Strip

Narrow column to the right of the task list.

### Content

- Day zones from today to job's departure date
- Highlights: today, departure date, days with placed tiles

### Interactions

| Action | Result |
|--------|--------|
| Click day | Scroll grid to that day |
| Hover 2 seconds | Auto-scroll to that day |

See [Date Navigation Strip](../03-navigation/date-navigation-strip.md) for details.

---

## Comments Access

- **Icon** on job row or status bar
- **Badge** indicates unread/recent comments
- **Click** opens comments popover or modal

---

## Panel Behavior

| Feature | Behavior |
|---------|----------|
| Collapsible | Yes (toggle to hide) |
| Resizable | TBD |
| Responsive | Adjusts for smaller screens |

---

## Related Documents

- [Job Navigation](../03-navigation/job-navigation.md) — Keyboard navigation
- [Date Navigation Strip](../03-navigation/date-navigation-strip.md) — Day navigation
- [Tile Recall](../01-interaction-patterns/tile-recall.md) — Task list interactions
