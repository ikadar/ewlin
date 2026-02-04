---
tags:
  - specification
  - ux-ui
  - state
---

# State Machines – Flux Scheduling UI

This document defines the state machines for key UI interactions.

---

## SM-DRAG: Drag Operation State Machine

### States

| State | Description |
|-------|-------------|
| `IDLE` | No drag in progress |
| `DRAGGING` | User is dragging a tile |
| `VALIDATING` | Real-time validation during drag |
| `DROPPING` | User released, processing drop |
| `CANCELLED` | Drag was cancelled |

### State Data

```typescript
interface DragState {
  isDragging: boolean;
  activeTask: Task | null;
  activeJob: Job | null;
  isRescheduleDrag: boolean;       // true = moving existing tile
  activeAssignmentId: string | null;
  grabOffset: { x: number; y: number };
  validation: DragValidationState;
}

interface DragValidationState {
  targetStationId: string | null;
  scheduledStart: string | null;
  isValid: boolean;
  hasPrecedenceConflict: boolean;
  suggestedStart: string | null;   // Auto-snap suggestion
  hasWarningOnly: boolean;         // Soft constraint (e.g., Plates)
}
```

### Transitions

```
IDLE
  ├─ onDragStart (from sidebar tile) ──► DRAGGING (isRescheduleDrag: false)
  └─ onDragStart (from grid tile) ────► DRAGGING (isRescheduleDrag: true)

DRAGGING
  ├─ onDrag (cursor moves) ───────────► VALIDATING
  ├─ onDragEnd (outside column) ──────► CANCELLED
  └─ onDrop (on valid column) ────────► DROPPING

VALIDATING
  ├─ validation complete ─────────────► DRAGGING (validation updated)
  └─ (continuous during drag)

DROPPING
  ├─ drop successful ─────────────────► IDLE (state updated)
  └─ drop failed ─────────────────────► IDLE (no change)

CANCELLED
  └─ (immediate) ─────────────────────► IDLE (tile returns to origin)
```

### State Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌──────┐   dragStart    ┌──────────┐   cursor    ┌─────┐  │
│   │ IDLE │───────────────►│ DRAGGING │◄───────────►│VALID│  │
│   └──────┘                └──────────┘   move      └─────┘  │
│       ▲                        │                            │
│       │                        │                            │
│       │   ┌──────────┐   drop  │  release                   │
│       │◄──│CANCELLED │◄────────┤  outside                   │
│       │   └──────────┘         │                            │
│       │                        ▼                            │
│       │   ┌──────────┐   drop on                            │
│       └───│ DROPPING │◄──column                             │
│           └──────────┘                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## SM-TILE: Tile State Machine

### States

| State | Description | Visual |
|-------|-------------|--------|
| `IDLE` | Normal display | Default colors |
| `HOVERED` | Mouse over tile | Swap buttons visible |
| `SELECTED` | Part of selected job | Glow effect |
| `DRAGGING` | Being dragged | Ghost at origin |
| `MUTED` | Other job's tile during drag | Desaturated |
| `COMPLETED` | Task marked complete | Green gradient |

### Transitions

```
IDLE
  ├─ mouseEnter ──────────────────────► HOVERED
  ├─ job selected ────────────────────► SELECTED
  ├─ other job starts drag ───────────► MUTED
  └─ task completed ──────────────────► COMPLETED

HOVERED
  ├─ mouseLeave ──────────────────────► IDLE (or SELECTED/MUTED)
  └─ dragStart ───────────────────────► DRAGGING

SELECTED
  ├─ job deselected ──────────────────► IDLE
  ├─ dragStart ───────────────────────► DRAGGING
  └─ other job starts drag ───────────► MUTED

DRAGGING
  ├─ drop (successful) ───────────────► IDLE (new position)
  └─ drop (cancelled) ────────────────► IDLE (original position)

MUTED
  └─ drag ends ───────────────────────► previous state (IDLE/SELECTED)

COMPLETED
  └─ task uncompleted ────────────────► IDLE
```

### Visual Mapping

| State | Filter | Opacity | Box Shadow | Border |
|-------|--------|---------|------------|--------|
| IDLE | none | 1 | none | job color |
| HOVERED | none | 1 | none | job color |
| SELECTED | none | 1 | glow | job color |
| DRAGGING | none | 0.8 | none | job color |
| MUTED | saturate(0.2) | 0.6 | none | grey |
| COMPLETED | none | 1 | none | job color + gradient |

---

## SM-QUICK: Quick Placement Mode State Machine

### States

| State | Description |
|-------|-------------|
| `INACTIVE` | Normal mode |
| `ACTIVE` | Quick placement mode on |
| `HOVERING` | Cursor over valid station |
| `PLACING` | Processing click placement |

### State Data

```typescript
interface QuickPlacementState {
  isActive: boolean;
  hoverStationId: string | null;
  hoverY: number | null;
  snappedY: number | null;
  availableStations: Set<string>;
}
```

### Transitions

```
INACTIVE
  └─ Alt+Q (job selected) ────────────► ACTIVE

ACTIVE
  ├─ Alt+Q ───────────────────────────► INACTIVE
  ├─ Escape ──────────────────────────► INACTIVE
  ├─ job deselected ──────────────────► INACTIVE
  ├─ mouseEnter (valid station) ──────► HOVERING
  └─ click (invalid station) ─────────► ACTIVE (no change)

HOVERING
  ├─ mouseLeave ──────────────────────► ACTIVE
  ├─ mouseMove ───────────────────────► HOVERING (indicator updates)
  └─ click ───────────────────────────► PLACING

PLACING
  ├─ placement successful ────────────► ACTIVE (or INACTIVE if no more tasks)
  └─ placement failed ────────────────► ACTIVE
```

### Station Visual States

| Station State | Visual |
|---------------|--------|
| Has available task | Green highlight |
| No available task | Dimmed (opacity-50) |
| Being hovered | Placement indicator line |

---

## SM-VALID: Drop Validation State Machine

### States

| State | Description | Ring Color |
|-------|-------------|------------|
| `NONE` | Not over drop target | none |
| `VALID` | Drop allowed | green |
| `INVALID` | Drop blocked | red |
| `WARNING` | Soft constraint | orange |
| `BYPASS` | Alt+precedence bypass | amber |

### Validation Logic

```typescript
function validateDrop(task, station, time, isAltPressed): ValidationState {
  // 1. Station constraint (hard block)
  if (task.stationId !== station.id) {
    return INVALID;
  }

  // 2. BAT approval (hard block)
  if (!job.batApproved) {
    return INVALID;
  }

  // 3. Precedence constraint
  if (hasPrecedenceConflict) {
    if (isAltPressed) {
      return BYPASS;  // User chose to override
    }
    return INVALID;   // Or auto-snap to suggestedStart
  }

  // 4. Plates gate (soft warning)
  if (!job.platesReady) {
    return WARNING;
  }

  return VALID;
}
```

### Transitions

```
NONE
  └─ dragEnter (station column) ──────► validate()

VALID/INVALID/WARNING/BYPASS
  ├─ dragMove (position change) ──────► revalidate()
  ├─ Alt key toggle ──────────────────► revalidate()
  └─ dragLeave ───────────────────────► NONE
```

---

## SM-JOB: Job Selection State Machine

### States

| State | Description |
|-------|-------------|
| `NONE_SELECTED` | No job selected |
| `JOB_SELECTED` | A job is selected |

### State Data

```typescript
interface JobSelectionState {
  selectedJobId: string | null;
  selectedJob: Job | null;
}
```

### Transitions

```
NONE_SELECTED
  ├─ click job card ──────────────────► JOB_SELECTED
  └─ click tile on grid ──────────────► JOB_SELECTED

JOB_SELECTED
  ├─ click same job card ─────────────► NONE_SELECTED
  ├─ click different job card ────────► JOB_SELECTED (new job)
  ├─ click tile (different job) ──────► JOB_SELECTED (new job)
  ├─ Alt+↑ / Alt+↓ ───────────────────► JOB_SELECTED (adjacent job)
  └─ job deleted ─────────────────────► NONE_SELECTED
```

### Side Effects

When job selection changes:

1. **Job Details Panel** updates to show selected job
2. **Task List** shows tasks for selected job
3. **Off-screen indicators** show for selected job's tiles
4. **Date Strip** highlights departure date
5. **Grid tiles** update selection glow
6. **Quick Placement Mode** deactivates if active

---

## SM-BYPASS: Precedence Bypass State Machine

### States

| State | Description |
|-------|-------------|
| `NORMAL` | Standard validation |
| `BYPASS_READY` | Alt key held, bypass available |

### State Data

```typescript
interface BypassState {
  isAltPressed: boolean;
}
```

### Transitions

```
NORMAL
  └─ Alt keydown ─────────────────────► BYPASS_READY

BYPASS_READY
  └─ Alt keyup ───────────────────────► NORMAL
```

### Effect on Validation

| Drag State | Alt State | Precedence Conflict | Result |
|------------|-----------|---------------------|--------|
| Dragging | NORMAL | Yes | Auto-snap or INVALID |
| Dragging | BYPASS_READY | Yes | BYPASS (amber ring) |
| Dragging | NORMAL | No | VALID |
| Dragging | BYPASS_READY | No | VALID |

---

## Implementation Reference

### Context Providers

| State Machine | Implementation File |
|---------------|---------------------|
| SM-DRAG | `src/dnd/DragStateContext.tsx` |
| SM-TILE | `src/components/Tile/Tile.tsx` (local state) |
| SM-QUICK | `src/App.tsx` (useState hooks) |
| SM-VALID | `src/hooks/useDropValidation.ts` |
| SM-JOB | `src/App.tsx` (selectedJobId state) |
| SM-BYPASS | `src/App.tsx` (isAltPressed state) |

---

## Related Documents

- [Drag and Drop](../01-interaction-patterns/drag-drop.md)
- [Quick Placement Mode](../01-interaction-patterns/quick-placement-mode.md)
- [Tile States](../04-visual-feedback/tile-states.md)
