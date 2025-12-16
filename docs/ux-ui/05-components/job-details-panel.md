# Job Details Panel

The panel showing detailed information about the selected job and its task list.

---

## Overview

When a job is selected in the Jobs List, this panel displays comprehensive job information and a visual task list. It serves as the primary context for scheduling decisions.

---

## Structure

```
+------------------------+
|  JOB INFORMATION       |
|  Code: 12345           |
|  Client: Autosphere    |
|  Title: Brochures...   |
|  Departure: 18/12/2025 |
+------------------------+
|  BAT: Reçu 12/12 14:30 |
|  Paper: Commandé       |
|  Plates: Prêtes        |
+------------------------+
|  TASK LIST             |
|  [Task tile]           |
|  [Task tile]           |
|  [Task tile]           |
+------------------------+
```

---

## Dimensions

| Property | Value |
|----------|-------|
| Width | 288px (w-72) |
| Height | Full viewport height |
| Background | `bg-zinc-900/50` |
| Border | `border-r border-white/5` |

---

## Job Information Section

### Fields

| Field | Label | Content |
|-------|-------|---------|
| **Code** | "Code" | Job reference number (monospace) |
| **Client** | "Client" | Client name |
| **Title** | "Intitulé" | Job description |
| **Departure** | "Départ" | Workshop exit date (DD/MM/YYYY) |

### HTML Structure

```html
<div class="p-3 border-b border-white/5 space-y-2.5 text-sm">
  <div>
    <div class="text-zinc-500 text-xs uppercase tracking-wide">Code</div>
    <div class="text-zinc-200 font-mono">12345</div>
  </div>
  <div>
    <div class="text-zinc-500 text-xs uppercase tracking-wide">Client</div>
    <div class="text-zinc-200">Autosphere</div>
  </div>
  <!-- ... -->
</div>
```

---

## Status Section

Shows job prerequisites status with visual indicators.

### Fields

| Field | Possible Values |
|-------|-----------------|
| **BAT** | Awaiting / Sent / Approved / No proof required |
| **Papier** | InStock / ToOrder / Ordered / Received |
| **Plaques** | Todo / Done |

### Example Values

```
BAT: Reçu 12/12 14:30
Papier: Commandé
Plaques: Prêtes
```

---

## Task List Section

Shows all tasks for the selected job as mini-tiles.

### Task Tile in Panel

```html
<div class="pt-0.5 px-2 pb-2 text-sm border-l-4 border-l-purple-500 bg-purple-950/35" style="height: 60px;">
  <div class="flex items-center justify-between gap-2">
    <span class="text-purple-300 font-medium truncate">Polar 137</span>
    <span class="text-purple-300 font-medium truncate">12345 · Autosphere</span>
    <span class="text-zinc-400 shrink-0">0h15</span>
    <span class="text-zinc-400 shrink-0">Di 15/12 08:30</span>
  </div>
</div>
```

### Task Tile Content

| Element | Description |
|---------|-------------|
| **Station name** | Target station for the task |
| **Job reference + Client** | Job context (useful when comparing multiple jobs) |
| **Duration** | Task duration (e.g., "0h15", "2h30") |
| **Scheduled time** | Start datetime if scheduled |
| **Height** | Proportional to duration (Timeline View) |

### Visual States

| State | Appearance |
|-------|------------|
| **Unscheduled** | Full opacity, no time shown |
| **Scheduled** | Shows scheduled time |
| **Completed** | Green gradient from left |

---

## Interactions

| Action | Result |
|--------|--------|
| **Click task (scheduled)** | Scroll grid to that tile |
| **Double-click task (scheduled)** | Recall tile (unschedule) |
| **Drag task (unscheduled)** | Start drag to grid |
| **Reorder tasks** | Drag within list to change sequence |

---

## Panel Behavior

| Feature | Behavior |
|---------|----------|
| Visible when | A job is selected |
| Scrollable | Task list section scrolls independently |
| Collapsible | TBD |

---

## Related Documents

- [Left Panel](left-panel.md) — Jobs list
- [Tile Recall](../01-interaction-patterns/tile-recall.md) — Task list interactions
- [Drag and Drop](../01-interaction-patterns/drag-drop.md) — Dragging tasks to grid
