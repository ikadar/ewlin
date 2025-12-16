# Open Questions

Decisions to be made and items for future consideration.

---

## Keyboard Shortcuts (TBD)

The following keyboard shortcuts need to be assigned:

| Action | Proposed | Final |
|--------|----------|-------|
| Toggle Sequence/Timeline View | | TBD |
| Toggle Quick Placement Mode | | TBD |
| Jump to job's departure date | | TBD |
| Previous job | | TBD |
| Next job | | TBD |
| Navigate columns left | | TBD |
| Navigate columns right | | TBD |

### Considerations

- Avoid conflicts with browser shortcuts
- Consider vim-style keys for power users (`j`/`k`, `h`/`l`)
- Ensure discoverability (help panel, tooltips)

---

## Visual Design (TBD)

### Date Strip Day Separators

- Currently: horizontal lines
- Alternative: distinct boxes/zones
- Decision needed before implementation

### Swap Buttons Visibility

- Option A: Always visible
- Option B: Only on hover
- Decision: **Hover** (per mockup)

### Off-Screen Indicator Distinct Styles

- Preceding task (N-1): specific style TBD
- Following task (N+1): specific style TBD
- Need to define exact visual treatment in dropdown

### Task Completion Checkbox

- Position on tile: TBD
- Visual style: **circle/circle-check icons** (per mockup)

### Quick Placement Mode Visuals

- Placement indicator: shape, color, size TBD
- Tooltip: position relative to cursor TBD
- Tooltip: styling (background, border, font) TBD
- "No task available" indicator styling TBD

### Column Focus on Drag Details

- Collapsed column width TBD
- Job-colored band height/styling TBD
- Target station detection method TBD
- Animation timing/easing TBD

### View Mode Toggle Button Location

- Option A: Station headers row (right side)
- Option B: Sidebar (new icon)
- Option C: Timeline column top
- Decision needed

### Jump to Date / Today Button Location

- Option A: Date Strip top
- Option B: Station headers row (left side)
- Option C: Separate toolbar row
- Decision needed

### Selected Tile State

- Trigger: click? keyboard?
- How many tiles can be selected: one? multiple?
- What happens on selection: panel update? scroll?
- Glow/border styling: exact CSS TBD

### Outsourced Task Tiles

- Visual distinction from internal tasks TBD
- Provider column appearance TBD
- Duration display format: "2 JO" vs "2 jours" TBD

---

## Interaction Details (TBD)

### Unscheduled Tile Single-Click

- Currently: no action defined for single-click on unscheduled tile
- Option: open task details
- Option: start drag
- Option: no action

### Comments UI

- Popover vs modal: TBD
- Threading support (future): TBD

### Approval Gates Workflow

- How to change BAT/Plates/Paper status from UI?
- Read-only display vs interactive controls?
- What happens when scheduling is blocked by gates?
- Visual feedback for blocked scheduling attempts?

### Keyboard Shortcuts Help

- Help panel design
- Keyboard shortcut overlay (e.g., "?" to show)
- Tooltips on hover for buttons with shortcuts

---

## Modals & Dialogs (TBD)

### Job Creation Modal

- Fields to include: reference, client, description, departure date, etc.
- Validation rules and error display
- Task definition within modal or separate step?
- Layout and sizing

### Task Details View

- Popover vs modal vs sidebar panel?
- Content: duration breakdown, notes, history?
- When to show: click on tile? dedicated button?

### Confirmation Dialogs

- When required: tile recall, job delete, swap with violation?
- Standard dialog layout
- "Don't ask again" option?

---

## System UI (TBD)

### Error/Success Messages (Toast/Notifications)

- Position: top-right? bottom-right?
- Auto-dismiss timing
- Stacking behavior for multiple notifications
- Action buttons in notifications?

### Loading States

- Initial page load: skeleton screens?
- Data fetching: inline spinners?
- Save operations: button loading state?
- Grid loading: overlay or inline?

### Settings Page

- What settings are configurable?
- Station management UI?
- Operating schedule editor?
- User preferences (theme, language)?
- Provider management?

---

## Future Features (Post-MVP)

### Zoom Levels

- Day / Week / Month views
- Mentioned in domain questions as post-MVP

### Column Customization

- Reorderable columns
- Resizable column widths
- Hide/show columns

### Compact View

- High-density display for many tiles
- Mentioned in domain questions

### Offline Mode

- Local storage of schedule data
- Sync when reconnected

### Multi-User

- Real-time updates
- Conflict resolution when two users edit same schedule
- User presence indicators

### Schedule Branching

- Multiple schedule versions
- PROD designation
- Branch comparison

---

## Performance Targets (To Validate)

| Metric | Target | Validated? |
|--------|--------|------------|
| Drag feedback | < 10ms | |
| Grid render (100 tiles) | < 100ms | |
| Initial load | < 2s | |
| Animation frame rate | 60 FPS | |

---

## Accessibility (TBD)

- Keyboard-only navigation: full coverage needed
- Screen reader support: ARIA labels
- Color contrast: WCAG AA compliance
- Reduced motion preference: respect user settings

---

## Internationalization (TBD)

- Date format: locale-specific
- Time format: 24h vs 12h
- Right-to-left support: future consideration
- Language: French primary, others future

---

## Notes

This document should be updated as decisions are made. Move resolved items to the relevant specification documents.

---

## Decision Log

| Date | Question | Decision | Rationale |
|------|----------|----------|-----------|
| 2025-12-13 | View mode names | Timeline / Sequence | Clear distinction between time-aligned and list views |
| 2025-12-16 | Layout structure | Column-based (no Right Panel) | Simpler layout, problems in Jobs List |

---

## Related Documents

- [Domain Open Questions](../domain-model/domain-open-questions.md) — Domain-level questions
- [Non-Functional Requirements](../requirements/non-functional-requirements.md) — Performance targets
