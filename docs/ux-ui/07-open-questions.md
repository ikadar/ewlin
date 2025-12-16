# Open Questions

Decisions to be made and items for future consideration.

---

## Keyboard Shortcuts (Resolved)

All keyboard shortcuts have been assigned:

| Action | Shortcut |
|--------|----------|
| Toggle Quick Placement Mode | ALT+Q |
| Jump to job's departure date | ALT+D |
| Previous job | ALT+↑ |
| Next job | ALT+↓ |
| Navigate columns left | ALT+← |
| Navigate columns right | ALT+→ |

### Notes

- Timeline/Sequence toggle removed from MVP (see Decision Log)
- Future: consider vim-style keys (`j`/`k`, `h`/`l`) for power users
- Help panel with shortcuts will be implemented later

---

## Visual Design (Resolved)

### Date Strip Day Separators (Resolved)

- Horizontal lines separate days
- Divs change background on hover (already implemented in mockup)

### Swap Buttons Visibility (Resolved)

- **Decision:** Shown on hover only

### Off-Screen Indicators (Resolved)

- **Design:** Rectangle with arrow (up/down) showing date/time of off-screen task
- No dropdown - simple indicator showing direction and timing
- Preceding/following tasks show their scheduled date/time in the indicator

### Task Completion Checkbox (Resolved)

- **Position:** Left of job ID in tile header row
- **Icon:** Lucide `circle` (incomplete) / `circle-check` (complete)
- **Location:** Before job reference number (per mockup)

### Quick Placement Mode Visuals (Resolved)

- **Placement indicator:** Glowing thick line in pure white
- **Active tile:** White ring/halo around the tile being placed
- **Tooltip:** Simple text next to cursor showing task info
- **No task available:** "Forbidden" icon (crossed-out circle) as mouse pointer

### Column Focus on Drag (Resolved)

- **Collapsed column width:** 120px (configurable)
- **Active job tiles:** Keep regular color
- **Other jobs:** Muted/desaturated border and background colors (near grey)
- **Target station:** Determined by task's assigned station (from backend)
- **Animation:** 150ms ease-out

### View Mode Toggle (Removed from MVP)

- Timeline/Sequence view toggle removed from MVP scope
- Only Timeline View implemented for now
- Sequence View may be added post-MVP

### Jump to Date / Today (Resolved)

- Today is visually highlighted in Date Strip
- Clicking any day jumps to that date
- While dragging: hovering over a day for 2s auto-jumps to it

### Tile Selection Behavior (Resolved)

- **Single click on tile (grid):** Selects that job (same as clicking in Jobs List)
- **Single click again (same tile):** Deselects
- **Double-click on tile (grid):** Recalls tile (removes from schedule)
- These behaviors are compatible (single vs double click)

### Outsourced Task Tiles (Resolved)

- Appear in dedicated outsourced provider columns
- **Border style:** Dotted (easily changeable)
- **Duration format:** "2 JO"

---

## Interaction Details (Resolved)

### Unscheduled Tile Single-Click (Resolved)

- **Single click on unscheduled tile:** Selects the job
- **Tiles already on grid:** Off-screen indicators (top/bottom markers) show when relevant for current viewport

### Comments UI (Post-MVP)

- Will be added later
- Location: Job Details column, below the task list

### Approval Gates Workflow (Resolved)

- **BAT/Plates/Paper status:** Read-only display for now
- **Editing status:** Not implemented in MVP
- **Scheduling restrictions:** No blocking based on gates currently
- Can be enhanced post-MVP

### Keyboard Shortcuts Help (Post-MVP)

- Help panel with keyboard shortcuts
- Shortcut overlay on "?" key press
- Tooltips showing shortcuts on hover
- All to be implemented later

---

## Modals & Dialogs (Post-MVP)

All modal and dialog designs will be defined post-MVP. Current focus is on the scheduling screen with mocked data.

- Job Creation Modal
- Task Details View
- Confirmation Dialogs

---

## System UI (Post-MVP)

All system UI designs will be defined post-MVP. Current focus is on the scheduling screen with mocked data.

- Error/Success Messages (Toast/Notifications)
- Loading States
- Settings Page

---

## Future Features (Post-MVP)

These features will be considered after MVP:

- **Zoom Levels:** Day / Week / Month views
- **Sequence View:** Alternative display mode (uniform tile heights)
- **Column Customization:** Reorderable, resizable, hide/show
- **Compact View:** High-density display for many tiles
- **Offline Mode:** Local storage with sync
- **Multi-User:** Real-time updates, conflict resolution
- **Schedule Branching:** Multiple versions, PROD designation

---

## Performance Targets (Validated)

| Metric | Target | Status |
|--------|--------|--------|
| Drag feedback | < 10ms | ✓ Agreed |
| Grid render (100 tiles) | < 100ms | ✓ Agreed |
| Initial load | < 2s | ✓ Agreed |
| Animation frame rate | 60 FPS | ✓ Agreed |

---

## Accessibility (Resolved)

- **Keyboard-only navigation:** Full coverage for power users
- **Screen reader support:** Not required (internal tool for experienced users)
- **Color contrast:** WCAG AA compliance maintained
- **Reduced motion:** Respect user settings

---

## Internationalization (Resolved)

- **Date format:** Locale-specific (configurable)
- **Time format:** 24h (French standard)
- **Right-to-left support:** Future consideration
- **Language:** French primary; may expand later

---

## Notes

This document should be updated as decisions are made. Move resolved items to the relevant specification documents.

---

## Decision Log

| Date | Question | Decision | Rationale |
|------|----------|----------|-----------|
| 2025-12-13 | View mode names | Timeline / Sequence | Clear distinction between time-aligned and list views |
| 2025-12-16 | Layout structure | Column-based (no Right Panel) | Simpler layout, problems in Jobs List |
| 2025-12-16 | Timeline/Sequence toggle | Removed from MVP | Focus on Timeline View only |
| 2025-12-16 | Off-screen indicators | Rectangles with arrows | Simple design showing date/time |
| 2025-12-16 | Checkbox position | Left of job ID | Per mockup specification |
| 2025-12-16 | Quick Placement indicator | White glow line | High visibility during placement |
| 2025-12-16 | Column focus animation | 150ms ease-out | Fast yet smooth |
| 2025-12-16 | Tile click behavior | Single=select, Double=recall | Compatible behaviors |
| 2025-12-16 | Departure date marker | Blue line on grid | Distinct from red "now" line |
| 2025-12-16 | Performance targets | All approved | Validated by stakeholder |
| 2025-12-16 | Placed tile in Job Details | Dark placeholder | Simple display with station + datetime |

---

## Related Documents

- [Domain Open Questions](../domain-model/domain-open-questions.md) — Domain-level questions
- [Non-Functional Requirements](../requirements/non-functional-requirements.md) — Performance targets
