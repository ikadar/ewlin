# Assignment Validation Rules

This document describes all validation rules enforced when placing (assigning) a task tile onto a station in the scheduler grid. It covers both placement modes: **pick-and-place** and **quick placement**.

## Overview

All assignment validation is orchestrated by `validateAssignment()` in `@flux/schedule-validator`. Seven validators run sequentially on every proposed assignment. Most return a single `ScheduleConflict | null`; the approval gate validator returns `ScheduleConflict[]` (multiple gates can fail simultaneously).

Both the frontend and the backend classify conflicts as **blocking** or **non-blocking** to determine whether placement is allowed. The classification logic **differs per placement mode** on the frontend and also **differs between frontend and backend** for some conflict types — see [Blocking vs Non-Blocking Classification](#blocking-vs-non-blocking-classification).

**Architecture:** The validation logic is implemented in a shared TypeScript package (`@flux/schedule-validator`), deployed as a standalone Node.js service. The PHP backend calls this service via HTTP (`ValidationServiceClient`). The frontend runs the same package inline for real-time feedback.

**Entry points:**

| File | Function | Purpose |
|------|----------|---------|
| `packages/validator/src/validate.ts` | `validateAssignment()` | Full validation with conflict details |
| `packages/validator/src/validate.ts` | `isValidAssignment()` | Quick boolean check |
| `apps/web/src/hooks/useDropValidation.ts` | `useDropValidation()` | React hook for real-time quick placement hover feedback |

---

## Placement Modes

The scheduler has two placement modes:

| Mode | Trigger | Validation | Auto-Snap | Push-Down |
|------|---------|------------|-----------|-----------|
| **Pick-and-Place** | Click tile (sidebar or grid) to pick, click grid to place | Inline `validateAssignment()` on hover + placement | Yes (suggestedStart) | Yes |
| **Quick Placement** | Click grid cell in quick placement mode | `useDropValidation` hook on hover, inline `validateAssignment()` on click | **No** | Yes |

> **Note:** There is no HTML5 drag & drop system. Pick-and-place uses click-to-pick + mouse-move + click-to-place with a `PickPreview` ghost component. The `DragPreview` component and `useDropValidation` hook names are legacy — `DragPreview` is only used for utility exports (`snapToGrid`, `yPositionToTime`); `useDropValidation` is used by quick placement hover.

---

## Validation Rules

### 1. Station Match

**Validator:** `packages/validator/src/validators/stationMatch.ts`
**Conflict type:** `StationMismatchConflict`

Each internal task has a designated `stationId`. The task can **only** be placed on that exact station. Placing it on any other station produces a blocking conflict.

- Outsourced tasks are exempt (they have no station designation).
- Conflict details include the designated station name and the attempted target station name.

### 2. Station Conflict (Double-Booking)

**Validator:** `packages/validator/src/validators/station.ts`
**Conflict type:** `StationConflict`

Two internal tasks cannot occupy the same station during overlapping time periods. Time ranges are calculated from `scheduledStart` to `scheduledEnd` (derived from task duration).

- **Non-blocking** in both placement modes and the backend — **push-down** auto-resolution (`apps/web/src/utils/pushDown.ts`) shifts overlapping tiles forward in time.
- **Red ring in pick hover** — pick hover intentionally shows a red ring for station conflicts as a visual warning that overlap exists. The actual placement still succeeds via push-down. Quick placement hover uses a more permissive filter (green ring for resolvable station conflicts).
- **Blocking** if the existing (overlapped) task is marked as `isCompleted` — completed tasks cannot be pushed.
- Outsourced tasks are exempt.

### 3. Group Capacity

**Validator:** `packages/validator/src/validators/group.ts`
**Conflict type:** `GroupCapacityConflict`

Station groups define a `maxConcurrent` limit (the number of stations in the group that may have active tasks simultaneously). When a task is assigned, the validator counts all concurrent assignments within the group during the proposed time span. If the count would exceed `maxConcurrent`, a conflict is raised.

- `maxConcurrent === null` means unlimited capacity.
- Outsourced tasks are exempt.

### 4. Precedence (Sequence Order)

**Validator:** `packages/validator/src/validators/precedence.ts`
**Conflict type:** `PrecedenceConflict`

Tasks must respect ordering constraints at two levels:

**A) Intra-element (same element):**
Tasks follow `sequenceOrder` within an element. A task cannot start before its predecessor in the same element has completed.

**B) Cross-element (prerequisite elements):**
Elements can declare `prerequisiteElementIds`. The first task of a dependent element cannot start before the last task of each prerequisite element has completed.

**Dry time:**
If the predecessor task runs on a printing station, a **4-hour dry time** (`DRY_TIME_MINUTES = 240`) is added after its completion before the successor may begin. Printing station detection uses **name matching** (`category.name.toLowerCase().includes('offset')`), not the `PRINTING_CATEGORY_ID` constant.

**Suggested start:**
When a predecessor conflict is detected, the validator calculates a `suggestedStart` — the earliest valid start time that satisfies all precedence constraints (including dry time). The suggested start is **snapped to the target station's operating hours** via `snapToNextWorkingTime()`, ensuring it always lands on a valid working time.

**Alt-key bypass:**
When the user holds the Alt key, the `bypassPrecedence` flag is set to `true` and precedence validation is skipped entirely. The conflict is still detected (via a separate validation pass without bypass) for visual feedback but does not block placement.

### 5. Approval Gates

**Validator:** `packages/validator/src/validators/approval.ts`
**Conflict type:** `ApprovalGateConflict`

Element-level prerequisites checked for every task in the element. The validator checks all 4 gates and returns **all** conflicts as an array (not early-returning on the first failure). All gate conflicts are **warning-only** — they produce an amber ring but do **not** block placement on any mode or on the backend.

Gate check order: Paper → BAT → Plates → Forme.

**A) Paper:**
The element's `paperStatus` must be in `PAPER_READY_STATES` (`'none'`, `'in_stock'`, `'delivered'`). The following states trigger a warning:
- `'to_order'` — paper needs to be ordered
- `'ordered'` — paper has been ordered but not yet delivered

**B) BAT (Proof approval):**
The element's `batStatus` must be `'none'` (no proof required) or `'bat_approved'` (proof approved). The following states trigger a warning:
- `'waiting_files'` — files not yet received from client
- `'files_received'` — proof in preparation
- `'bat_sent'` — proof sent to client, awaiting approval

**C) Plates:**
The element's `plateStatus` must be `'none'` or `'ready'`. The state `'to_make'` triggers a warning.

**D) Forme (die-cutting tool):**
The element's `formeStatus` must be in `FORME_READY_STATES` (`'none'`, `'in_stock'`, `'delivered'`). The following states trigger a warning:
- `'to_order'` — forme needs to be ordered
- `'ordered'` — forme has been ordered but not yet delivered

### 6. Station Availability (Operating Hours)

**Validator:** `packages/validator/src/validators/availability.ts`
**Conflict type:** `AvailabilityConflict`

The target station must meet two conditions:

1. **Status:** `station.status === 'Available'`. Stations with other statuses (e.g., maintenance) are blocked.
2. **Operating hours:** The proposed start time must fall within the station's operating schedule, defined per day-of-week. Schedule exceptions can override regular hours for specific dates.

> **MVP limitation:** Only the **start time** is checked against operating hours. The full task duration is not validated — a task starting at 21:30 on a station closing at 22:00 will pass validation even if the task takes 2 hours. Duration stretching across operating hours is handled separately by `addWorkingTime()` in end-time calculation.

All date/time calculations use the `Europe/Paris` timezone.

### 7. Deadline

**Validator:** `packages/validator/src/validators/deadline.ts`
**Conflict type:** `DeadlineConflict`

Each job has a `workshopExitDate`. The task's projected completion time (start + duration) must not exceed this deadline. The deadline time is derived via `getDeadlineDate()`:
- For **date-only** strings (e.g., `'2025-01-20'`): the deadline is set to **14:00** (`SHIPPING_DEPARTURE_HOUR`) on that date.
- For **ISO datetime** strings (containing `T`): the exact timestamp is used as-is.

Conflict details include the job ID, workshop exit date, expected completion time, and the number of days late.

---

## Conflict Types Reference

Defined in `packages/types/src/assignment.ts`:

```typescript
type ConflictType =
  | 'StationMismatchConflict'
  | 'StationConflict'
  | 'GroupCapacityConflict'
  | 'PrecedenceConflict'
  | 'ApprovalGateConflict'
  | 'AvailabilityConflict'
  | 'DeadlineConflict'
```

**Priority order** for message display (highest to lowest):

1. `StationMismatchConflict`
2. `ApprovalGateConflict`
3. `AvailabilityConflict`
4. `PrecedenceConflict`
5. `GroupCapacityConflict`
6. `DeadlineConflict`

See `apps/web/src/utils/validationMessages.ts` for French localized messages.

---

## Blocking vs Non-Blocking Classification

The blocking/non-blocking classification **differs by placement mode and by layer (frontend vs backend)**.

### Frontend — Placement (what actually blocks assignment)

This table shows whether a conflict **blocks the placement action** (i.e., prevents the API call):

| Conflict Type | Pick-and-Place | Quick Placement |
|---------------|----------------|-----------------|
| `StationMismatchConflict` | Blocking | Blocking |
| `StationConflict` | Non-blocking (push-down) | Non-blocking (push-down) |
| `StationConflict` (completed tile) | Blocking | Blocking |
| `GroupCapacityConflict` | Blocking | Blocking |
| `PrecedenceConflict` (pred. + suggestedStart) | Non-blocking (auto-snap) | Non-blocking ¹ |
| `PrecedenceConflict` (successor) | Blocking | Blocking |
| `PrecedenceConflict` + Alt key | Non-blocking | Non-blocking |
| `ApprovalGateConflict` (all gates) | Non-blocking (warning) | Non-blocking (warning) |
| `AvailabilityConflict` | Blocking | Blocking |
| `DeadlineConflict` | Blocking | Blocking |

**¹** Quick placement classifies `PrecedenceConflict` (predecessor + suggestedStart) as non-blocking, but does **not** auto-snap to the `suggestedStart`. The original clicked time is sent to the backend. See [Known Issue: Quick Placement Precedence Gap](#known-issue-quick-placement-precedence-gap).

### Frontend — Hover Ring (visual feedback)

The hover ring color logic differs between the two modes:

**Pick hover** (`App.tsx:1834`) — only `ApprovalGateConflict` is filtered out. All other conflicts (including `StationConflict` and `PrecedenceConflict`) show as **red ring**. This is intentional — the user sees a visual warning that something will happen (push-down, auto-snap) upon placement.

**Quick placement hover** (`useDropValidation`) — `StationConflict` (resolvable), `PrecedenceConflict` (with suggestedStart), and `ApprovalGateConflict` are all filtered out. The ring is more permissive: green for resolvable conflicts, amber for approval gate warnings only.

### Backend Classification

The backend (`AssignmentService.hasBlockingConflicts()`, `RescheduleService.hasBlockingConflicts()`) uses a simpler model with exactly **two non-blocking types**:

```php
private const NON_BLOCKING_CONFLICT_TYPES = ['StationConflict', 'ApprovalGateConflict'];
```

| Conflict Type | Backend |
|---------------|---------|
| `StationConflict` | Non-blocking (push-down) |
| `StationConflict` (completed tile) | Blocking |
| `StationConflict` (outsourced target) | Blocking |
| `ApprovalGateConflict` (all gates) | Non-blocking (warning) |
| **Everything else** | **Blocking** |

Notable difference from frontend: `PrecedenceConflict` is **always blocking** on the backend. This works because:
- **Pick-and-place**: the frontend auto-snaps to `suggestedStart` before sending the API call, so the backend receives an already-valid time.
- **Alt bypass**: the frontend sends `bypassPrecedence: true`, which causes the validator to skip precedence entirely.
- **Quick placement**: see known issue below.

### Known Issue: Quick Placement Precedence Gap

Quick placement treats `PrecedenceConflict` (predecessor + suggestedStart) as non-blocking on the frontend, allowing the API call to proceed. But it does **not** auto-snap to `suggestedStart` and does **not** send `bypassPrecedence: true` (unless Alt is pressed). The backend receives the original clicked time, finds the `PrecedenceConflict`, and **rejects** the assignment with HTTP 409.

**Impact:** The user clicks a valid-looking grid cell, but the placement fails with an error toast.

**Resolution needed:** Quick placement should either auto-snap to `suggestedStart` (matching pick-and-place behavior) or treat `PrecedenceConflict` as blocking when Alt is not pressed.

---

## Visual Feedback (Ring States)

During hover, the ring color around the drop zone indicates validation status:

| Ring State | Color | Meaning |
|------------|-------|---------|
| `valid` | Green | No conflicts — placement allowed |
| `invalid` | Red | Blocking conflict(s) — placement denied |
| `warning` | Amber | Non-blocking warning (approval gate conflicts only) |
| `bypass` | Amber | Precedence bypassed via Alt key |

Implemented in `apps/web/src/components/StationColumns/StationColumn.tsx`.

---

## Placement Mode Details

### Common Behavior

Both modes:
- Call `validateAssignment()` with all 7 validators
- Support Alt-key precedence bypass
- Use 30-minute grid snapping (`SNAP_INTERVAL_MINUTES = 30`)
- Call the same backend API (`assignTask` / `rescheduleTask`)

### Differences

| Behavior | Pick-and-Place | Quick Placement |
|----------|---------------|-----------------|
| **Interaction** | Click tile to pick up, move cursor, click grid to place | Click directly on grid cell while in mode |
| **Task selection** | User picks any unassigned tile from sidebar or grid | Automatic — always the **last unscheduled** task in sequence order (backward scheduling) |
| **Station filtering** | N/A — tile already has a station | Only stations matching the auto-selected task are clickable |
| **Real-time validation** | Inline `validateAssignment()` on hover (conservative ring) | `useDropValidation` hook on hover (permissive ring) |
| **Precedence auto-snap** | **Yes** — auto-snaps to `suggestedStart` | **No** — see known issue above |
| **Reschedule support** | Yes — picking an already-placed tile from the grid reschedules it | No — only places unscheduled tasks |
| **Blocked placement** | Tile returns to original position; outsourced successor assignments are restored | Click is silently ignored (logged to console) |

### Precedence Auto-Snap Detail

**Pick-and-place** (`App.tsx:1946`):
```typescript
const effectiveStart = (!isAltPressed && hasPrecedenceConflict && suggestedStart)
  ? suggestedStart   // auto-snap to earliest valid time
  : scheduledStart;
```
When a predecessor conflict is detected and the validator provides a `suggestedStart`, the tile is silently moved to that time. The user sees the tile snap forward to the earliest valid position.

**Quick placement** (`App.tsx:1660–1667`):
The assignment is created with the original `scheduledStart` — no auto-snap occurs.

---

## Related Files

| File | Purpose |
|------|---------|
| `packages/validator/src/validate.ts` | Validation orchestrator |
| `packages/validator/src/validators/*.ts` | Individual validator implementations |
| `packages/validator/src/utils/time.ts` | Range overlap detection, concurrency counting |
| `packages/validator/src/utils/workingTime.ts` | Working hour calculations with station schedules |
| `packages/types/src/assignment.ts` | Conflict type definitions |
| `packages/types/src/constants.ts` | Ready-state constants (`PAPER_READY_STATES`, `FORME_READY_STATES`, etc.) |
| `apps/web/src/hooks/useDropValidation.ts` | Real-time quick placement hover validation (legacy name) |
| `apps/web/src/utils/quickPlacement.ts` | Quick placement task selection logic |
| `apps/web/src/utils/pushDown.ts` | Station conflict auto-resolution (push-down) |
| `apps/web/src/utils/validationMessages.ts` | French localized conflict messages |
| `apps/web/src/utils/conflictRecalculation.ts` | Post-placement conflict recalculation |
| `apps/web/src/components/DragPreview/snapUtils.ts` | 30-minute grid snapping (legacy location) |
| `apps/web/src/pick/PickPreview.tsx` | Ghost tile preview during pick-and-place |
| `services/php-api/src/Service/AssignmentService.php` | Backend assignment with blocking/non-blocking classification |
| `services/php-api/src/Service/RescheduleService.php` | Backend reschedule with blocking/non-blocking classification |
| `services/php-api/src/Service/ValidationServiceClient.php` | HTTP client calling the Node.js validation service |
