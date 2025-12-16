# Edge Cases

Documentation of edge cases and error states for the UI.

---

## Overview

This document catalogs edge cases — unusual situations that the UI must handle gracefully.

---

## Drag and Drop

### What if the user drags a tile and releases outside the grid?

- Tile returns to original position (or task list if new)
- No assignment created/changed

### What if the user drags to a position exactly on a grid line?

- Tile snaps to the 30-minute boundary
- No ambiguity — always snaps to nearest valid slot

### What if validation fails after drop?

- Optimistic UI shows tile briefly
- Server rejects → tile reverts to previous state
- Error message shown

### What if network disconnects during drag?

- Local validation continues (offline-capable for preview)
- On drop, retry logic attempts server validation
- If persistent failure, show error and revert

---

## Quick Placement Mode

### What if no tasks are available for any station?

- All columns show "no task available" indicator
- User can exit mode or select a different job

### What if user clicks outside a column?

- No action (click must be on a station column)

### What if the selected job has no tasks?

- Tooltip shows "No tasks defined"
- No placement possible

### What if job is changed while placement indicator is showing?

- Indicator updates immediately for new job
- Task availability recalculates

---

## Column Focus on Drag

### What if all tiles from the job are on one station?

- Only that column remains full width
- All others collapse
- Collapsed columns have no job-colored bands (no other tiles exist)

### What if user cancels drag very quickly?

- Columns animate back before fully collapsing
- Animation should handle interruption smoothly

---

## Navigation

### What if user presses "next job" when job list is empty?

- No action (nothing to navigate to)

### What if user presses "jump to deadline" when job has no departure date?

- Edge case: all jobs should have a departure date (required field)
- If somehow missing: no action or error message

### What if selected job has departure date in the past?

- Still jump to that date
- User can see historical schedule

### What if date strip range is very long (job months away)?

- Strip shows condensed view or pagination
- Consider grouping by week/month

---

## Tile Interactions

### What if user double-clicks an unscheduled tile?

- No action (recall only applies to scheduled tiles)
- Or: open task details (TBD)

### What if user tries to recall a tile for a task that's already executing?

- Show warning: "Task in progress, cannot recall"
- Or: allow recall but warn about implications

### What if user swaps tiles that would violate precedence?

- Validation runs
- Warning shown, confirmation required
- Or: auto-refuse with explanation

---

## Off-Screen Indicators

### What if job has many tiles off-screen (10+)?

- Indicators stack
- Consider grouping or scrollable indicator list
- Rare case — most jobs have few tiles per station

### What if viewport is very small?

- Indicator sizing adapts
- Minimum readable size enforced

---

## View Modes (Post-MVP)

> View mode switching is post-MVP. Only Timeline View is implemented.

### What if user switches view mode while dragging?

- Drag operation continues
- View switches, drag adapts to new layout
- (Or: view switch disabled during drag)

### What if tiles have very long durations in Sequence View?

- Same height as all others (uniform)
- Duration shown in text

---

## Job Selection

### What if user deselects job (clicks empty area)?

- No job selected state
- Task list empty
- Status bar hidden
- Date strip shows default range (14 days)
- Off-screen indicators hidden

### What if job is deleted while selected?

- Selection clears
- UI updates to reflect deleted job
- Any in-progress operations cancelled

---

## Performance Edge Cases

### What if there are 500+ tiles visible?

- Virtualization should handle
- Only visible tiles rendered
- Smooth scrolling maintained

### What if user rapidly switches jobs?

- Cancel pending operations for previous job
- Show loading state if needed
- Debounce if necessary

---

## Error States

### Network Error

- Show error notification
- Allow retry
- Local state preserved where possible

### Server Validation Rejection

- Clear error message explaining why
- Suggestions for resolution if possible
- Easy to dismiss and try again

### Data Inconsistency

- If client and server state diverge: full refresh option
- Show what changed

---

## Future Considerations

- Multi-user conflicts (same schedule edited by multiple users)
- Large dataset pagination
- Offline mode (future)

---

## Related Documents

- [Drag and Drop](01-interaction-patterns/drag-drop.md)
- [Quick Placement Mode](01-interaction-patterns/quick-placement-mode.md)
- [Conflict Indicators](04-visual-feedback/conflict-indicators.md)
