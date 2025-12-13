# UX/UI Specification — Flux Print Shop Scheduling System

This folder contains detailed UX/UI specifications for the Flux scheduling interface.

---

## Design Philosophy

### Power-User Focused

The UI is optimized for **experienced schedulers** who work with the system daily. Key principles:

- **Keyboard-first**: Critical actions have keyboard shortcuts
- **Minimal clicks**: Common workflows require minimal mouse interaction
- **Information density**: Show relevant data without clutter
- **Predictable behavior**: Consistent patterns throughout the UI

### Backward Scheduling Workflow

The UI encourages **backward scheduling from deadline**:

1. Select a job
2. Jump to the departure date (keyboard shortcut)
3. Place the last task first, working backwards
4. Quick Placement Mode accelerates this workflow

This ensures jobs meet their deadlines by design.

---

## Screen Layout

```
+------------------+--------------------------------+------------------+
|                  |                                |                  |
|   LEFT PANEL     |         CENTER GRID            |   RIGHT PANEL    |
|                  |                                |                  |
|  Jobs List       |   Station Columns              |   Late Jobs      |
|  + Task List     |   + Time (vertical)            |   + Violations   |
|  + Date Strip    |   + Tiles                      |                  |
|  + Status Bar    |                                |                  |
|                  |                                |                  |
+------------------+--------------------------------+------------------+
```

| Panel | Purpose |
|-------|---------|
| **Left** | Job context — what I'm working on |
| **Center** | Schedule grid — where I'm scheduling |
| **Right** | Schedule health — what's wrong |

---

## Document Index

### 01 — Interaction Patterns

| Document | Description |
|----------|-------------|
| [drag-drop.md](01-interaction-patterns/drag-drop.md) | Core drag mechanics, snap grid, precedence safeguard |
| [quick-placement-mode.md](01-interaction-patterns/quick-placement-mode.md) | Toggle mode for fast backward scheduling |
| [column-focus-on-drag.md](01-interaction-patterns/column-focus-on-drag.md) | Column collapse during drag from left panel |
| [tile-recall.md](01-interaction-patterns/tile-recall.md) | Removing tiles from schedule |
| [tile-swap.md](01-interaction-patterns/tile-swap.md) | Swapping adjacent tile positions |

### 02 — View Modes

| Document | Description |
|----------|-------------|
| [timeline-vs-sequence.md](02-view-modes/timeline-vs-sequence.md) | Timeline view (default) vs Sequence view |

### 03 — Navigation

| Document | Description |
|----------|-------------|
| [grid-navigation.md](03-navigation/grid-navigation.md) | Scrolling, jump to date, today button |
| [date-navigation-strip.md](03-navigation/date-navigation-strip.md) | Day zones next to task list |
| [job-navigation.md](03-navigation/job-navigation.md) | Previous/next job shortcuts |
| [backward-scheduling.md](03-navigation/backward-scheduling.md) | Jump to deadline workflow |
| [off-screen-indicators.md](03-navigation/off-screen-indicators.md) | Indicators for tiles outside viewport |

### 04 — Visual Feedback

| Document | Description |
|----------|-------------|
| [tile-states.md](04-visual-feedback/tile-states.md) | Normal, dragging, placed, invalid states |
| [conflict-indicators.md](04-visual-feedback/conflict-indicators.md) | Red halo, group capacity highlight |
| [similarity-circles.md](04-visual-feedback/similarity-circles.md) | Time-saving indicators between tiles |
| [station-unavailability.md](04-visual-feedback/station-unavailability.md) | Hatched overlay, task stretching |

### 05 — Components

| Document | Description |
|----------|-------------|
| [scheduling-grid.md](05-components/scheduling-grid.md) | Time axis, station columns |
| [tile-component.md](05-components/tile-component.md) | Tile anatomy, job colors |
| [left-panel.md](05-components/left-panel.md) | Jobs list, task list, status bar |
| [right-panel.md](05-components/right-panel.md) | Late jobs, violations |

### Other

| Document | Description |
|----------|-------------|
| [06-edge-cases.md](06-edge-cases.md) | What happens when X, error states |
| [07-open-questions.md](07-open-questions.md) | Keyboard shortcuts TBD, future items |

---

## Related Documentation

- [Scheduling UI Design](../requirements/scheduling-ui-design.md) — Original UI requirements
- [Business Rules](../domain-model/business-rules.md) — UI behavior rules (UI-001 to UI-005)
- [User Stories](../requirements/user-stories.md) — User stories for scheduling features
- [Acceptance Criteria](../requirements/acceptance-criteria.md) — Testable criteria

---

## Version History

| Date | Change |
|------|--------|
| 2025-12-13 | Initial structure with 8 new UX improvements |
