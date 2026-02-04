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
| **Deadline conflict** (late job) | Red background, "En retard" badge | Jobs List (Problèmes section) |
| **Scheduling conflict** (incoherent) | Amber background, "Conflit" badge | Jobs List (Problèmes section) |
| **Approval gate conflict (BAT)** | Red drop zone highlight (blocking) | On station column during drag |
| **Approval gate conflict (Plates)** | Orange drop zone highlight (warning, non-blocking) | On station column during drag |
| **Availability conflict** | Gray hatched overlay | On the time slot |

---

## Precedence Violation

**When:** A scheduled predecessor task ends after the successor task starts.

**Important:** Unscheduled predecessors do **not** create conflicts. This enables backward scheduling where users place the last task first and work backwards.

**Conflict conditions:**
1. Predecessor task IS scheduled, AND
2. Predecessor's `scheduledEnd` > successor's `scheduledStart`

**Visual:**
- Red halo/glow effect around the tile
- Job appears in Jobs List "Problèmes" section with "Conflit" badge

**Resolution:** Move the tile to a later time, or move predecessor earlier

---

## Station Conflict (Double-Booking)

**When:** Two tasks overlap on a capacity-1 station

**Visual:**
- Both tiles highlighted in red
- Job appears in Jobs List "Problèmes" section

**Note:** System normally prevents this via tile insertion (push down). Conflict may occur due to external schedule changes.

---

## Group Capacity Exceeded

**When:** More tasks running simultaneously than `MaxConcurrent` allows for a station group

**Visual:**
- Time slot highlighted in yellow/orange across affected columns
- Jobs appear in "Problèmes" section

---

## Deadline Conflict (Late Job)

**When:** Job's last task completes after `workshopExitDate`

**Visual:**
- Job appears in Jobs List "Problèmes" section at top
- Red background (`bg-red-500/10`)
- Red border (`border-red-500/20`)
- "En retard" badge
- `alert-circle` icon

### HTML Example

```html
<div class="job-item bg-red-500/10 border border-red-500/20">
  <div class="flex items-center gap-2">
    <span class="font-mono text-red-300">12342</span>
    <span class="text-zinc-300">AXA</span>
    <i data-lucide="alert-circle" class="text-red-400"></i>
  </div>
  <div class="text-zinc-100">Contrat assurance habitation</div>
  <span class="text-xs text-red-400 font-medium">En retard</span>
</div>
```

---

## Scheduling Conflict (Incoherent)

> Updated from REQ-13

**When:** Job has precedence violations or other scheduling inconsistencies

**Created when:**
- User places a task before its predecessor completes using Alt+drop bypass

**Cleared when:**
- Task is rescheduled to a valid position (after predecessor completes)
- Conflict is automatically removed from the schedule

**Visual:**
- Job appears in Jobs List "Problèmes" section
- Amber background (`bg-amber-500/10`)
- Amber border (`border-amber-500/20`)
- "Conflit" badge
- `shuffle` icon

### HTML Example

```html
<div class="job-item bg-amber-500/10 border border-amber-500/20">
  <div class="flex items-center gap-2">
    <span class="font-mono text-amber-300">12341</span>
    <span class="text-zinc-300">Michelin</span>
    <i data-lucide="shuffle" class="text-amber-400"></i>
  </div>
  <div class="text-zinc-100">Guide vert Bretagne</div>
  <span class="text-xs text-amber-400 font-medium">Conflit</span>
</div>
```

---

## Jobs List: Problèmes Section

Problematic jobs appear at the **top** of the Jobs List in a dedicated section:

```
+------------------------+
|  PROBLÈMES (2)         |
+------------------------+
| [Late job card]        |
|  12342 · AXA           |
|  En retard             |
+------------------------+
| [Conflict job card]    |
|  12341 · Michelin      |
|  Conflit               |
+------------------------+
|  TRAVAUX               |
+------------------------+
| [Normal job cards...]  |
+------------------------+
```

### Section Header

```html
<div class="px-3 py-2 flex items-center gap-2">
  <span class="text-[11px] font-semibold text-red-400/80 uppercase tracking-wider">Problèmes</span>
  <span class="text-[11px] text-zinc-600">2</span>
</div>
```

---

## Severity Levels

| Severity | Examples | Blocking? |
|----------|----------|-----------|
| **High** | Station conflict, approval gate | Yes (prevents save) |
| **Medium** | Precedence violation, deadline | Warning (can proceed with Alt) |
| **Low** | Informational | No |

---

## Precedence Constraint Lines (During Drag)

> Implemented from REQ-10

**When:** User drags a task that has precedence relationships (predecessor and/or successor tasks).

**Purpose:** Show the valid placement range before dropping a task.

### Line Types

| Line | Color | Meaning | Calculation |
|------|-------|---------|-------------|
| **Purple line** | `#A855F7` (purple-500) | Earliest possible start | `predecessor.scheduledEnd` + 4h dry time (if predecessor is printing task) |
| **Orange line** | `#F97316` (orange-500) | Latest possible start | `successor.scheduledStart` - current task duration - dry time (if current is printing task) |

### Visibility Rules

| Condition | Purple Line | Orange Line |
|-----------|-------------|-------------|
| Predecessor scheduled | ✅ Visible | — |
| Predecessor not scheduled | ❌ Hidden | — |
| Successor scheduled | — | ✅ Visible |
| Successor not scheduled | — | ❌ Hidden |
| Not dragging | ❌ Hidden | ❌ Hidden |
| Dragging but not over column | ❌ Hidden | ❌ Hidden |
| **Quick Placement Mode** | ✅ Visible (when hovering) | ✅ Visible (when hovering) |

### Visual Appearance

```
Station Column (during drag)
┌─────────────────────────────────────┐
│                                     │
│ ═══════════════════════════════════ │  ← Purple line (glow effect)
│         EARLIEST POSSIBLE           │
│                                     │
│         [Valid drop zone]           │
│                                     │
│          LATEST POSSIBLE            │
│ ═══════════════════════════════════ │  ← Orange line (glow effect)
│                                     │
└─────────────────────────────────────┘
```

### Styling

Based on `PlacementIndicator` component:

```tsx
// Purple line (earliest)
<div
  className="absolute left-0 right-0 h-1 bg-purple-500 z-30 pointer-events-none"
  style={{
    top: `${earliestY}px`,
    boxShadow: '0 0 12px rgba(168, 85, 247, 0.8)',
  }}
/>

// Orange line (latest)
<div
  className="absolute left-0 right-0 h-1 bg-orange-500 z-30 pointer-events-none"
  style={{
    top: `${latestY}px`,
    boxShadow: '0 0 12px rgba(249, 115, 22, 0.8)',
  }}
/>
```

### Drop Validation

- **Above purple line:** Drop snaps to purple line (auto-correct to earliest valid)
- **Between lines:** Valid drop zone (green border)
- **Below orange line:** Drop blocked (red border, successor constraint violation)
- **No valid zone (orange above purple):** Drop blocked entirely

### Dry Time Integration

Printing tasks (offset press category) add 4-hour dry time:
- Purple line: predecessor end + 4h (if predecessor is printing)
- Orange line: successor start - task duration - 4h (if current task is printing)

---

## Related Documents

- [Business Rules](../../domain-model/business-rules.md) — Validation rules
- [Drag and Drop](../01-interaction-patterns/drag-drop.md) — Precedence safeguard
- [Left Panel](../05-components/left-panel.md) — Jobs List with Problèmes section
