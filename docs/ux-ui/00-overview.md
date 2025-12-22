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

The interface uses a **column-based layout** with the following structure:

```
+--------+------------+-------------+------+----------+-------------------+
|        |            |             |      |          |                   |
| SIDE-  |   JOBS     |    JOB      | DATE | TIMELINE |   STATION         |
| BAR    |   LIST     |   DETAILS   | STRIP|          |   COLUMNS         |
|        |            |             |      |          |                   |
| w-14   |   w-72     |    w-72     | w-12 |   w-12   |   flex-1          |
|        |            |             |      |          |                   |
+--------+------------+-------------+------+----------+-------------------+
```

| Column | Width | Purpose |
|--------|-------|---------|
| **Sidebar** | 56px (w-14) | Navigation icons (grid, calendar, settings) |
| **Jobs List** | 288px (w-72) | All jobs with problems section at top |
| **Job Details** | 288px (w-72) | Selected job info + task list |
| **Date Strip** | 48px (w-12) | Day navigation (clickable dates) |
| **Timeline** | 48px (w-12) | Hour markers, "now" line |
| **Station Columns** | flex | Scheduling grid with tiles |

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
| [timeline-vs-sequence.md](02-view-modes/timeline-vs-sequence.md) | Timeline view (default) vs Sequence view (post-MVP) |

> **Note:** Only Timeline View is implemented for MVP. Sequence View is post-MVP.

### 03 — Navigation

| Document | Description |
|----------|-------------|
| [grid-navigation.md](03-navigation/grid-navigation.md) | Scrolling, jump to date, today button |
| [date-navigation-strip.md](03-navigation/date-navigation-strip.md) | Standalone date column |
| [job-navigation.md](03-navigation/job-navigation.md) | Previous/next job shortcuts |
| [backward-scheduling.md](03-navigation/backward-scheduling.md) | Jump to deadline workflow |
| [off-screen-indicators.md](03-navigation/off-screen-indicators.md) | Indicators for tiles outside viewport |

### 04 — Visual Feedback

| Document | Description |
|----------|-------------|
| [tile-states.md](04-visual-feedback/tile-states.md) | Normal, dragging, placed, invalid states |
| [conflict-indicators.md](04-visual-feedback/conflict-indicators.md) | Red halo, group capacity highlight |
| [similarity-circles.md](04-visual-feedback/similarity-circles.md) | Link icons showing time-saving potential |
| [station-unavailability.md](04-visual-feedback/station-unavailability.md) | Hatched overlay, task stretching |

### 05 — Components

| Document | Description |
|----------|-------------|
| [sidebar.md](05-components/sidebar.md) | Navigation icon strip |
| [left-panel.md](05-components/left-panel.md) | Jobs list with problems section |
| [job-details-panel.md](05-components/job-details-panel.md) | Selected job info and task list |
| [scheduling-grid.md](05-components/scheduling-grid.md) | Time axis, station columns |
| [tile-component.md](05-components/tile-component.md) | Tile anatomy, job colors |

### 06 — Specifications

| Document | Description |
|----------|-------------|
| [ui-interaction-stories.md](specifications/ui-interaction-stories.md) | UI Interaction Stories (US-UI-*) for all interactions |
| [acceptance-criteria.md](specifications/acceptance-criteria.md) | Acceptance Criteria in Given-When-Then format |
| [non-functional-requirements.md](specifications/non-functional-requirements.md) | Performance, accessibility, i18n requirements |
| [design-tokens.md](specifications/design-tokens.md) | Colors, spacing, typography, animations |
| [state-machines.md](specifications/state-machines.md) | Drag, tile, quick placement state diagrams |
| [keyboard-shortcuts.md](specifications/keyboard-shortcuts.md) | All keyboard shortcuts reference |
| [component-api.md](specifications/component-api.md) | Component props and interfaces |

### Other

| Document | Description |
|----------|-------------|
| [06-edge-cases.md](06-edge-cases.md) | What happens when X, error states |
| [07-open-questions.md](07-open-questions.md) | Keyboard shortcuts TBD, future items |

---

## Related Documentation

- [Scheduling UI Design](../requirements/scheduling-ui-design.md) — Original UI requirements
- [Business Rules](../domain-model/business-rules.md) — UI behavior rules (UI-001 to UI-005)
- [User Stories](../requirements/user-stories.md) — Backend user stories for scheduling features
- [Acceptance Criteria](../requirements/acceptance-criteria.md) — Backend testable criteria
- **UI Specifications:**
  - [UI Interaction Stories](specifications/ui-interaction-stories.md) — UI-specific interaction stories (US-UI-*)
  - [UI Acceptance Criteria](specifications/acceptance-criteria.md) — UI-specific acceptance criteria (AC-UI-*)
  - [Non-Functional Requirements](specifications/non-functional-requirements.md) — Performance, accessibility, i18n
  - [Design Tokens](specifications/design-tokens.md) — Colors, spacing, typography, animations
  - [State Machines](specifications/state-machines.md) — Interaction state diagrams
  - [Keyboard Shortcuts](specifications/keyboard-shortcuts.md) — All shortcuts reference
  - [Component API](specifications/component-api.md) — Component props and interfaces

---

## Version History

| Date | Change |
|------|--------|
| 2025-12-18 | Added complete specifications: NFR, design tokens, state machines, keyboard shortcuts, component API |
| 2025-12-18 | Added specifications folder with UI user stories and acceptance criteria |
| 2025-12-16 | Updated to column-based layout, removed Right Panel |
| 2025-12-13 | Initial structure with 8 new UX improvements |
