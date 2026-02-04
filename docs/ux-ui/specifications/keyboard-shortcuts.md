---
tags:
  - specification
  - ux-ui
  - accessibility
---

# Keyboard Shortcuts – Flux Scheduling UI

This document defines all keyboard shortcuts available in the scheduling UI.

---

## Overview

The UI is designed for **power users** who work with the system daily. Keyboard shortcuts enable efficient workflows without mouse interaction.

### Design Principles

1. **Alt-based modifiers** — Most shortcuts use Alt to avoid conflicts with browser shortcuts
2. **Mnemonic keys** — Letters relate to action (Q=Quick, D=Departure)
3. **Arrow navigation** — Directional keys for spatial navigation
4. **Escape to cancel** — Escape always exits current mode

---

## Global Shortcuts

These shortcuts work regardless of current mode or selection.

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Home` | Jump to Today | Scrolls grid to current time |
| `PageUp` | Scroll Up 24h | Scrolls grid up one day |
| `PageDown` | Scroll Down 24h | Scrolls grid down one day |

---

## Job Navigation

These shortcuts navigate between jobs in the job list.

| Shortcut | Action | Condition |
|----------|--------|-----------|
| `Alt + ↑` | Previous Job | Always |
| `Alt + ↓` | Next Job | Always |
| `Alt + D` | Jump to Departure | Job selected |

### Behavior Details

**Alt + ↑ / Alt + ↓**
- Cycles through jobs in list order
- If no job selected, selects first/last job
- Wraps around at list boundaries

**Alt + D**
- Scrolls grid to show the selected job's departure date
- Departure date line (blue) becomes visible
- No effect if job has no departure date

---

## Quick Placement Mode

| Shortcut | Action | Condition |
|----------|--------|-----------|
| `Alt + Q` | Toggle Quick Placement | Job selected |
| `Escape` | Exit Quick Placement | In Quick Placement mode |

### Quick Placement Workflow

1. Select a job (click job card or tile)
2. Press `Alt + Q` to enter Quick Placement mode
3. Move cursor over station columns
4. Click to place the next task at cursor position
5. Repeat for additional tasks
6. Press `Escape` or `Alt + Q` to exit

---

## Drag Modifiers

These keys modify behavior during drag operations.

| Shortcut | Action | Effect |
|----------|--------|--------|
| `Alt` (hold) | Precedence Bypass | Allows placement before predecessor ends |

### Precedence Bypass Details

- Hold `Alt` while dragging to enable bypass mode
- Visual indicator changes to amber ring
- On drop, creates a `PrecedenceConflict` record
- Release `Alt` to return to normal validation

---

## Column Navigation (Planned)

> **Status:** Defined but not yet implemented

| Shortcut | Action |
|----------|--------|
| `Alt + ←` | Focus previous column |
| `Alt + →` | Focus next column |

---

## Future Shortcuts (Post-MVP)

These shortcuts are planned for future releases:

| Shortcut | Action | Notes |
|----------|--------|-------|
| `?` | Show shortcuts help | Modal overlay |
| `Ctrl + Z` | Undo last action | Requires undo stack |
| `Ctrl + Shift + Z` | Redo | Requires undo stack |
| `j` / `k` | Previous/Next job | Vim-style navigation |
| `h` / `l` | Previous/Next column | Vim-style navigation |
| `g g` | Go to start | Vim-style |
| `G` | Go to end | Vim-style |

---

## Shortcut Implementation

### Handler Location

All keyboard shortcuts are handled in `apps/web/src/App.tsx`:

```typescript
// Global keyboard event handler
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Alt key state for precedence bypass
    if (e.key === 'Alt') {
      setIsAltPressed(true);
    }

    // Quick Placement toggle: Alt+Q
    if (e.altKey && e.key.toLowerCase() === 'q') {
      handleToggleQuickPlacement();
    }

    // Job navigation: Alt+Up/Down
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      handleJobNavigation(e.key === 'ArrowUp' ? 'up' : 'down');
    }

    // Jump to departure: Alt+D
    if (e.altKey && e.key.toLowerCase() === 'd') {
      handleJumpToDeparture();
    }

    // Exit Quick Placement: Escape
    if (e.key === 'Escape' && isQuickPlacementMode) {
      setIsQuickPlacementMode(false);
    }

    // Jump to today: Home
    if (e.key === 'Home') {
      handleJumpToToday();
    }

    // Scroll by day: PageUp/PageDown
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      handlePageScroll(e.key === 'PageUp' ? 'up' : 'down');
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [dependencies]);
```

---

## Conflict Avoidance

### Browser Shortcut Conflicts

| Avoided | Reason |
|---------|--------|
| `Ctrl + S` | Browser save |
| `Ctrl + P` | Browser print |
| `Ctrl + F` | Browser find |
| `F5` | Browser refresh |
| `Alt + F4` | OS close window |

### Application Considerations

| Consideration | Decision |
|---------------|----------|
| Text input focus | Shortcuts disabled when input focused |
| Modal open | Shortcuts disabled except Escape |
| Drag in progress | Only Alt modifier active |

---

## Accessibility

### Keyboard-Only Users

All critical workflows are accessible via keyboard:

| Workflow | Keys Required |
|----------|---------------|
| Select job | `Alt + ↓` / `Alt + ↑` |
| Navigate to date | `Alt + D`, `PageUp`, `PageDown`, `Home` |
| Place tasks | `Alt + Q`, mouse move, click |
| Cancel operation | `Escape` |

### Screen Reader Support

> **Note:** Screen reader support is post-MVP. Current focus is keyboard navigation for power users.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│  FLUX SCHEDULING - KEYBOARD SHORTCUTS                       │
├─────────────────────────────────────────────────────────────┤
│  NAVIGATION                                                 │
│  ─────────                                                  │
│  Alt + ↑/↓     Previous/Next job                           │
│  Alt + D       Jump to departure date                       │
│  Home          Jump to today                                │
│  PageUp/Down   Scroll up/down one day                       │
│                                                             │
│  QUICK PLACEMENT                                            │
│  ───────────────                                            │
│  Alt + Q       Toggle quick placement mode                  │
│  Escape        Exit quick placement                         │
│                                                             │
│  DRAG MODIFIERS                                             │
│  ──────────────                                             │
│  Alt (hold)    Bypass precedence constraint                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documents

- [Quick Placement Mode](../01-interaction-patterns/quick-placement-mode.md)
- [Drag and Drop](../01-interaction-patterns/drag-drop.md)
- [Job Navigation](../03-navigation/job-navigation.md)
- [Grid Navigation](../03-navigation/grid-navigation.md)
