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
- Decision needed

### Off-Screen Indicator Distinct Styles

- Preceding task (N-1): specific style TBD
- Following task (N+1): specific style TBD
- Need to define exact visual treatment

### Task Completion Checkbox

- Position on tile: TBD
- Visual style: TBD

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

### Status Bar Icons

- Exact icons to use: TBD
- Colorblind-friendly considerations

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
| 2025-12-13 | Right panel content | Late jobs + violations only | Job details moved to left panel with new UX improvements |
| 2025-12-13 | View mode names | Timeline / Sequence | Clear distinction between time-aligned and list views |

---

## Related Documents

- [Domain Open Questions](../domain-model/domain-open-questions.md) — Domain-level questions
- [Non-Functional Requirements](../requirements/non-functional-requirements.md) — Performance targets
