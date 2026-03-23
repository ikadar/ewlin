# Auto-Place Algorithm V1 — Design Discussion Recap

## 1. Problem Statement

**Given:** N jobs, each containing elements with ordered tasks, a set of stations with operating schedules and capacity constraints, precedence rules (intra-element sequence, cross-element dependencies, dry time), and per-job deadlines (`workshopExitDate`).

**Find:** A valid assignment of all unplaced internal tasks to time slots on stations that:
1. Respects all precedence constraints (intra-element, cross-element, cross-job, dry time)
2. Respects station capacity and group concurrency limits
3. Meets job deadlines where possible
4. Uses ALAP (just-in-time) placement by default to minimize WIP
5. Degrades gracefully when ideal placement is infeasible

**Constraint:** The algorithm must build on existing ASAP/ALAP single-task placement primitives and the existing validation suite — not reimplement them.

---

## 2. Evolution — What Already Exists

### Phase 1: Frontend single-job ASAP
- Client-side algorithm dispatching one HTTP request per task (~300ms x N).
- For 100 tiles: ~30 seconds. Unacceptable for batch scheduling.

### Phase 2: Server-side ASAP (`AsapPlacementService`)
- Single POST → 1 DB transaction → ~1s regardless of task count.
- `SchedulingHelper` extracted from `CompactStationService` (precedence floor, snap-to-working-time, dry time).
- `AsapPlacementService` with topological sort, `findEarliestGap`, `EndTimeCalculator`.
- Frontend simplified: one RTK mutation, snapshot refetch on success.

### Phase 3: Server-side ALAP (`AlapPlacementService`)
- Two-pass approach: phantom ASAP (in-memory) to find earliest possible completion → ALAP backward from `max(asapLatestEnd, workshopExitDate)`.
- New infrastructure: `ScheduleReadInterface`, `InMemorySchedule`, `EndTimeCalculator::calculateStartFromEnd`, `SchedulingHelper::getPrecedenceCeiling`, backward BusinessCalendar methods.
- `findLatestGap` scanning station assignments from latest to earliest.

### Phase 4: Multi-job strategies (`GeneralAutoPlaceService`)
- Five strategies benchmarked: EDD, CR, Dynamic CR, FBI, Hybrid CPM.
- SSE streaming for progress during long-running placement.
- Benchmark comparator (per-strategy JSON requests after SSE timeout issues).
- `computeScore()` for lexicographic evaluation (late count, total lateness, makespan, etc.).
- Auto-split for late jobs: identify blockers, split to free capacity, re-run.

---

## 3. Key Design Decisions

### Decision 1: Per-task Dynamic CR ordering
Jobs are not sorted once. After every task placement, CR is **recomputed** for remaining tasks because each placement changes the available capacity landscape. This prevents stale orderings that don't reflect the current schedule state.

### Decision 2: ASAP for CR < 1.0, ALAP for CR >= 1.0
- **CR < 1.0** means more work than available time — the task is already critical or late. Place it ASAP to secure the earliest possible slot.
- **CR >= 1.0** means there's enough slack. Place it ALAP (just-in-time) to minimize WIP and free early capacity for critical tasks.

### Decision 3: Iterative FBI loop until convergence
FBI (Forward-Backward Improvement) alternates two passes:
- **Forward pass (ASAP):** Place all tasks at earliest positions. Proves minimum makespan.
- **Backward pass (ALAP):** Within the makespan envelope from the forward pass, push tasks as late as possible (JIT).
- Iterate until makespan delta converges (< threshold) or max 6 iterations.
- **Dampening:** If a task is assigned to the same station in both passes, lock that station assignment to prevent oscillation.

### Decision 4: Lexicographic optimization
Score comparison is lexicographic, not a weighted sum:
1. **Minimize late job count** (primary — most important)
2. **Minimize total lateness in minutes** (secondary — how late the late jobs are)
3. **Minimize makespan** (tertiary — tighter is better)
4. **Maximize average slack** (quaternary — comfort margin)

### Decision 5: No similarity optimization in V1
Similarity grouping (placing tasks with matching paper type, format, inking adjacently to reduce changeover) is reserved for a separate "compact" feature. V1 focuses purely on deadline compliance and capacity utilization.

A `SimilarityPermutationService` design exists (adjacent-swap bubble pass, post-processing after any strategy) but is not part of V1 scope.

### Decision 6: Hard constraints
- **No precedence violations** — intra-element sequence, cross-element dependencies, cross-job dependencies, and dry time (240min after offset press) are all inviolable.
- **No placement before `$now`** — tasks cannot be scheduled in the past.
- **Deadline is non-blocking** — a task placed after its job's `workshopExitDate` is a soft violation (marked as late) but the placement is kept. "I'd rather have the algorithm lay down a tile after the job's deadline than not having these tiles placed."

### Decision 7: Auto-split for late jobs
When FBI converges with remaining late jobs:
1. Identify which station assignments are blocking the late job's tasks.
2. Split the blocking task into pieces that fit into available gaps.
3. Re-run FBI with splits applied.
This is an escalation mechanism — only triggered when simpler strategies fail.

### Decision 8: Backend-only PHP implementation with SSE streaming
The V1 algorithm runs entirely server-side in `GeneralAutoPlaceService`. Progress is streamed to the frontend via Server-Sent Events (SSE). This avoids the latency of per-task HTTP calls and keeps the algorithm logic in one place.

### Decision 9: Live modal with progress and score summary
A modal (`AutoPlaceModal`) shows real-time progress:
- Current phase (initial placement, FBI iteration, auto-split)
- Job counter (X / N jobs)
- Running stats (tiles placed, late count, FBI iteration, splits)
- On completion: full score summary (on-time rate, late count, lateness, makespan, avg slack, compute time)

### Decision 10: No cancel button
The algorithm runs to completion once started. Cancellation mid-algorithm would leave the schedule in a partial/inconsistent state. The close button only appears after completion or error.

---

## 4. Algorithm Architecture

```
POST /schedule/auto-place-all  (SSE stream)
│
├── Reset: clear all non-completed, non-in-progress assignments
│
├── INITIAL PLACEMENT (Phase 1)
│   ├── Sort jobs by Dynamic CR (ascending — most critical first)
│   ├── For each job:
│   │   ├── Recompute CR for all remaining tasks
│   │   ├── If CR < 1.0 → placeJobTasks (ASAP forward)
│   │   └── If CR >= 1.0 → placeJobTasksAlap (ALAP backward with phantom ASAP)
│   └── Stream progress events per job
│
├── FBI LOOP (Phase 2, up to 6 iterations)
│   ├── FORWARD PASS: reposition all tasks ASAP, ascending CR order
│   ├── BACKWARD PASS: reposition all tasks ALAP within makespan envelope
│   ├── CONVERGENCE CHECK: makespan delta < threshold?
│   └── Stream iteration events with late count
│
├── AUTO-SPLIT (Phase 3, if late jobs remain)
│   ├── For each late job: identify blocking tasks
│   ├── Split blockers into gap-fitting pieces
│   ├── Re-run FBI with splits
│   └── Stream split events
│
├── COMPUTE SCORE
│   └── lateCount, totalLateness, makespan, onTimeRate, avgSlack
│
└── COMPLETE EVENT with full score
```

### Core Primitives

| Primitive | Purpose | Key method |
|-----------|---------|------------|
| `findEarliestGap` | ASAP: scan forward for first non-overlapping slot | Walk station assignments, skip occupied slots |
| `findLatestGap` | ALAP: scan backward for last non-overlapping slot | Walk station assignments in reverse from ceiling |
| `getPrecedenceFloor` | Earliest possible start based on predecessors | Max of all predecessor ends + dry time |
| `getPrecedenceCeiling` | Latest possible end based on successors | Min of all successor starts - dry time |
| `calculateEndTime` | Working-hours-aware end from start + duration | Walk operating slots forward |
| `calculateStartFromEnd` | Working-hours-aware start from end + duration | Walk operating slots backward |
| `snapToNextWorkingTime` | Round up to next operating slot | Skip non-working hours |
| `snapToPreviousWorkingTimeEnd` | Round down to previous operating slot end | Skip non-working hours backward |

### Critical Ratio (CR)

```
CR(task) = availableWorkingMinutes(ASAP(task), job.workshopExitDate, station)
           / (task.duration.setupMinutes + task.duration.runMinutes)
```

| CR value | Meaning | Strategy |
|----------|---------|----------|
| < 1.0 | More work than time — already late | ASAP (secure earliest slot) |
| = 1.0 | Exactly fits — zero slack | Place carefully |
| 1.0–1.5 | Tight but feasible | ALAP (JIT, high priority) |
| > 2.0 | Comfortable slack | ALAP (JIT, can wait) |

### Escalation Levels (future, designed but only Level 0-2 in V1)

| Level | Strategy | Description |
|-------|----------|-------------|
| 0 | ALAP on assigned station | Ideal — JIT on planned machine |
| 1 | ALAP on alternative station | Machine change |
| 2 | ASAP on any eligible station | Early WIP to guarantee fit |
| 3 | Split on single station | Task broken into sequential pieces |
| 4 | Split across stations | Pieces on different machines |
| 5 | Parallel split | Simultaneous pieces on multiple machines |
| 6 | Infeasible | Escalate to human planner |

---

## 5. Bugs Fixed During Development

### Bug: Hybrid ALAP drops tasks when outsourced successor falls back to ASAP
**Root cause:** Backward pass processes outsourced task first → falls back to ASAP → departs from `$now` → predecessor can't fit before `$now` → dropped.
**Fix:** After backward pass, detect unplaced eligible tasks and fall back to ASAP forward pass for the entire job.

### Bug: ALAP ceiling too tight in Hybrid and FBI
**Root cause 1:** Hybrid's `placeJobTasksAlap` used `workshopExitDate` directly — no phantom ASAP pass. Station contention pushed tasks past the window.
**Fix:** Add phantom ASAP pass (using `InMemorySchedule`) to compute `ceiling = max(asapLatestEnd, workshopExitDate)`.

**Root cause 2:** FBI's `repositionJobTasksAlap` used `min(makespan, deadline)` — makespan constraint prevented on-time jobs from being pushed back to their actual deadline.
**Fix:** Use `ceiling = deadline` directly. Existing guard already prevents exceeding deadline.

### Bug: Fix 2 guard too aggressive in Hybrid CPM — drops valid ASAP placements
**Root cause:** After ALAP fails and ASAP fallback places a task successfully, a precedence ceiling guard (`scheduledEnd > successorCeiling`) nullifies it — even though `findEarliestGap` guarantees no physical overlap.
**Fix:** Remove the guard. A placed-but-out-of-order task is better than a dropped task.

### Bug: `computeScore` undercounts late jobs vs. validation service
**Root cause 1:** Missing "past deadline" check — jobs whose deadline has already passed but whose tasks end before the deadline appeared "on time."
**Root cause 2:** Minute rounding — 1-29 seconds past deadline rounded to 0.
**Fix:** Add `$today` at 14:00 (matching validation service's `SHIPPING_DEPARTURE_HOUR`), compare `$deadline < $today`, use seconds for exact overdue detection.

### Bug: Auto-place regression — tiles removed instead of kept with warnings
**Root cause:** Post-validation conflict removal (Bug 6 fix) was too aggressive. Outsourced predecessor chicken-and-egg: Phase 4B uses theoretical return time, Phase 5 recomputes actual return time, post-validation catches discrepancy and removes the successor.
**Fix:** Revert to warning-only post-validation. Keep all placements, flag conflicts as warnings.

### Bug: CTRL+ALT+Z doesn't unplace outsourced tiles
**Root cause:** Sequential unassignment triggers backend cascade removal → 404 on direct outsourced unassign → optimistic update rollback re-adds the tile.
**Fix:** Filter out outsourced assignments — they are cascade-removed when predecessor internal task is unassigned.

### Bug: Benchmark comparator SSE timeout
**Root cause:** Single long-lived SSE stream for all 5 strategies. Connection dies after ~3 strategies due to proxy timeouts, Doctrine identity map bloat, PHP-FPM `request_terminate_timeout`.
**Fix:** Replace single SSE with per-strategy JSON requests. Frontend drives the loop — one short-lived HTTP request per strategy.

---

## 6. Infrastructure Built

| Component | File | Purpose |
|-----------|------|---------|
| `ScheduleReadInterface` | `services/php-api/src/Service/ScheduleReadInterface.php` | Abstraction for phantom pass |
| `InMemorySchedule` | `services/php-api/src/Service/InMemorySchedule.php` | Wraps real Schedule + phantom assignments |
| `SchedulingHelper` | `services/php-api/src/Service/SchedulingHelper.php` | Shared precedence/timing utilities |
| `AsapPlacementService` | `services/php-api/src/Service/AsapPlacementService.php` | Single-job ASAP algorithm |
| `AlapPlacementService` | `services/php-api/src/Service/AlapPlacementService.php` | Single-job ALAP algorithm |
| `GeneralAutoPlaceService` | `services/php-api/src/Service/GeneralAutoPlaceService.php` | Multi-job V1 algorithm (FBI, auto-split, scoring) |
| `AutoPlaceModal` | `apps/web/src/components/AutoPlaceModal.tsx` | SSE progress modal |
| `BusinessCalendar` extensions | `services/php-api/src/Service/BusinessCalendar.php` | Backward date arithmetic |
| `EndTimeCalculator` extensions | `services/php-api/src/Service/EndTimeCalculator.php` | Backward duration calculation |

---

## 7. What V1 Does NOT Include

- **Similarity optimization** — no changeover minimization. Reserved for separate "compact" feature.
- **Multi-start with different tie-break strategies** — designed (CR_ASC, EDD_ASC, LPT_DESC, RANDOM) but not in V1.
- **Local search post-pass** — hill-climbing swaps designed but not implemented.
- **Level 1+ escalation** — alternative station assignment not in V1 auto-place (only Level 0 and ASAP fallback).
- **Cancel button** — algorithm runs to completion.
- **Per-job maxLevel policy** — all jobs treated equally.
- **Freedom interval computation** — designed (earliest-latest width) but not exposed as a standalone metric.

---

## 8. Frontend Integration

| Shortcut | Action | Implementation |
|----------|--------|----------------|
| `ALT+P S` | ASAP single-job auto-place | `POST /jobs/{id}/auto-place` → snapshot refetch |
| `ALT+P L` | ALAP single-job auto-place | `POST /jobs/{id}/auto-place-alap` → snapshot refetch |
| `CTRL+ALT+G` | V1 multi-job auto-place (all jobs) | `POST /schedule/auto-place-all` (SSE) → modal → snapshot refetch |
| `CTRL+ALT+Z` | Mass unschedule all clearable tiles | Sequential unassignment (internal only, outsourced cascade-removed) |

---

## 9. Scoring Formula

```php
PlacementScore {
    lateJobCount: int,           // Primary: jobs ending past deadline OR deadline past $today
    totalJobCount: int,
    totalLatenessMinutes: int,   // Secondary: sum of overrun minutes for late jobs
    maxLatenessMinutes: int,
    makespanMinutes: int,        // Tertiary: latest end - earliest start across all jobs
    onTimeRate: float,           // 100 * (1 - lateJobCount/totalJobCount)
    averageSlackMinutes: float,  // Average (deadline - jobEnd) across all evaluated jobs
}
```

Comparison is lexicographic: minimize `lateJobCount` → minimize `totalLatenessMinutes` → minimize `makespanMinutes`.
