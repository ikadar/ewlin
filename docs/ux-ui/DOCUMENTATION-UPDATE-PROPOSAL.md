# UX-UI Documentation Update Proposals

This document summarizes discrepancies identified between the existing documentation and the current implementation (based on code and tests).

**Created:** 2025-12-17
**Status:** Awaiting approval

---

## 1. Quick Placement Mode (`01-interaction-patterns/quick-placement-mode.md`)

### 1.1 Task Selection Logic modification (lines 77-103)

**Current documentation:**
> "The last unscheduled task (highest sequence number) **for that station**"
> "Task is only available if its immediate successor is already placed"

**Current implementation:**
- Only ONE task is available for the ENTIRE job (the highest sequenceOrder unscheduled internal task)
- Only the station containing this task is available
- No per-station selection

**Proposed new text:**

```markdown
## Task Selection Logic

Quick Placement Mode enforces **strict backward scheduling** — stricter than drag-drop:

1. **Global selection:** Only ONE task is available at any time — the highest sequenceOrder unscheduled internal task for the entire job
2. **Station constraint:** Only the station containing this task is highlighted/available for placement
3. **No out-of-order:** Unlike drag-drop, there's no way to place tasks out of sequence

### Comparison with Drag-Drop

| Aspect | Drag-Drop | Quick Placement |
|--------|-----------|-----------------|
| Task selection | Any unscheduled task | Only the last unscheduled |
| Out-of-order placement | Allowed (with warning) | Not possible |
| Alt bypass | Available | Not applicable |

### Example

Job has: Task 1 (Komori, seq 1) → Task 2 (Massicot, seq 2) → Task 3 (Stahl, seq 3)

All tasks unscheduled:
- Only **Task 3** is available → Only **Stahl** column is highlighted
- Hovering Komori or Massicot shows "forbidden" cursor

After placing Task 3:
- Only **Task 2** is available → Only **Massicot** column is highlighted

After placing Task 2:
- Only **Task 1** is available → Only **Komori** column is highlighted

**Note:** This strict behavior guides users through optimal backward scheduling. Use drag-drop for flexibility.
```

---

## 2. Tile Component (`05-components/tile-component.md`)

### 2.1 Anatomy diagram modification (lines 15-29)

**Current documentation:**
The diagram shows the header row (checkbox + reference + client) in the Run Section.

**Current implementation:**
The header row is in the **Setup Section** (if there is setup time), not in the Run Section.

**Proposed new diagram:**

```markdown
## Anatomy

```
+-----------------------+
|  Setup Section        |  ← Lighter shade of job color
|  ○ 12345 · Client     |  ← Checkbox + Reference + Client (in setup section)
+-----------------------+
|                       |
|  Run Section          |  ← Full job color
|                       |
|  [↑] [↓]              |  ← Swap buttons (on hover, bottom-right)
+-----------------------+
```

**Note:** If there is no setup time (setupMinutes = 0), the header row appears in the Run Section.
```

### 2.2 Content table modification (lines 34-42)

**Proposed modification:**

```markdown
| Element | Description |
|---------|-------------|
| **Setup section** | Visual representation of setup time (top portion, lighter shade). **Contains the header row if setup > 0.** |
| **Run section** | Visual representation of run time (main portion, full color). **Contains header row only if setup = 0.** |
| ... |
```

---

## 3. Tile Recall (`01-interaction-patterns/tile-recall.md`)

### 3.1 Add recall from Grid

**Current documentation:**
Only documents recall from the Task List (Job Details Panel).

**Current implementation:**
Double-click recall also works on tiles directly on the grid.

**Proposed new section (after "Methods"):**

```markdown
### From Grid (Scheduled Tiles)

Tiles on the scheduling grid can also be recalled directly:

| Action | Result |
|--------|--------|
| **Single-click** | Selects the job (highlights all tiles of that job) |
| **Double-click** | Recalls the tile (removes from schedule) |

This provides a quick way to unschedule tasks without navigating to the Job Details Panel.
```

---

## 4. Column Focus on Drag (`01-interaction-patterns/column-focus-on-drag.md`)

### 4.1 Add Station Headers behavior

**Current documentation:**
Only describes station column collapse.

**Current implementation:**
Station **headers** also collapse (same 240px → 120px transition).

**Proposed new section (after "Column Collapse"):**

```markdown
### Header Collapse

Station headers follow the same collapse behavior as columns:

| Element | Full Width | Collapsed |
|---------|------------|-----------|
| Station column | 240px (w-60) | 120px (w-30) |
| Station header | 240px (w-60) | 120px (w-30) |

Both animate with the same `transition: width 150ms ease-out`.
```

---

## 5. Job Navigation (`03-navigation/job-navigation.md`)

### 5.1 Fill in shortcuts (lines 15-18)

**Current documentation:**
```
| Previous job | TBD |
| Next job | TBD |
```

**Current implementation:**
```
| Previous job | ALT+↑ |
| Next job | ALT+↓ |
```

**Proposed modification:**

```markdown
## Shortcuts

| Action | Shortcut |
|--------|----------|
| Previous job | **ALT+↑** (Arrow Up) |
| Next job | **ALT+↓** (Arrow Down) |
```

---

## 6. Backward Scheduling (`03-navigation/backward-scheduling.md`)

### 6.1 Fill in Jump to Deadline shortcut (line 17)

**Current documentation:**
```
| Shortcut | TBD |
```

**Current implementation:**
```
| Shortcut | ALT+D |
```

**Proposed modification:**

```markdown
| Shortcut | **ALT+D** |
```

### 6.2 Add Grid Navigation shortcuts

**Current implementation includes:**
- `Home` - Jump to current time (today, now)
- `PageUp` - Scroll up by one day
- `PageDown` - Scroll down by one day

**Proposed new section:**

```markdown
## Grid Navigation Shortcuts

| Action | Shortcut |
|--------|----------|
| Jump to now | **Home** |
| Scroll up one day | **PageUp** |
| Scroll down one day | **PageDown** |
| Jump to departure date | **ALT+D** (requires selected job) |

These shortcuts work independently of Quick Placement Mode.
```

---

## 7. Drag and Drop (`01-interaction-patterns/drag-drop.md`)

### 7.1 Clarify push-down behavior (lines 95-105)

**Current documentation:**
> "New tile is placed at the drop position"
> "Subsequent tiles on the same station are pushed down"

**Current implementation clarification:**
- Push-down also works when **dropping onto an existing tile** (not just into gaps)
- Overlapping tiles shift starting from the **end of the new tile**

**Proposed clarification:**

```markdown
## Tile Insertion ("Push Down")

When placing a tile that would overlap with existing tiles:

1. **Drop on gap:** Tile is placed at the drop position
2. **Drop on existing tile:** Tile is inserted, overlapping tiles are pushed down
3. **Cascade effect:** All subsequent overlapping tiles shift to maintain no-overlap

The pushed tiles are repositioned to start **after the new tile ends**, not just shifted by a fixed amount.

**Note:** During drag, existing tiles become non-interactive (pointer-events: none) to allow dropping onto them.
```

---

## 8. NEW: Keyboard Shortcuts summary document

**Proposed new file:** `03-navigation/keyboard-shortcuts.md`

```markdown
# Keyboard Shortcuts

Complete reference of keyboard shortcuts in the scheduling interface.

---

## Quick Placement Mode

| Shortcut | Action |
|----------|--------|
| **ALT+Q** | Toggle Quick Placement Mode ON/OFF |
| **ESC** | Exit Quick Placement Mode |

---

## Job Navigation

| Shortcut | Action |
|----------|--------|
| **ALT+↑** | Select previous job |
| **ALT+↓** | Select next job |

---

## Grid Navigation

| Shortcut | Action |
|----------|--------|
| **Home** | Jump to current time (now) |
| **PageUp** | Scroll up by one day |
| **PageDown** | Scroll down by one day |
| **ALT+D** | Jump to selected job's departure date |

---

## During Drag Operations

| Shortcut | Action |
|----------|--------|
| **ALT** (hold) | Bypass precedence validation (allows out-of-order placement) |

---

## Related Documents

- [Quick Placement Mode](../01-interaction-patterns/quick-placement-mode.md)
- [Job Navigation](job-navigation.md)
- [Backward Scheduling](backward-scheduling.md)
```

---

## Summary

| # | Document | Change Type |
|---|----------|-------------|
| 1 | quick-placement-mode.md | Rewrite Task Selection Logic |
| 2 | tile-component.md | Anatomy diagram + Content table |
| 3 | tile-recall.md | Add Grid recall section |
| 4 | column-focus-on-drag.md | Add Header collapse section |
| 5 | job-navigation.md | Fill in shortcuts |
| 6 | backward-scheduling.md | Fill in shortcut + Grid nav shortcuts |
| 7 | drag-drop.md | Clarify push-down behavior |
| 8 | **NEW** keyboard-shortcuts.md | Complete shortcut reference |

---

## Next Steps

1. Request approval for each document
2. Apply approved modifications
3. Delete DOCUMENTATION-UPDATE-PROPOSAL.md
