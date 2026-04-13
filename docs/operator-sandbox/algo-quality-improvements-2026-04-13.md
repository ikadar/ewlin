# Algo Quality Improvements — 2026-04-13

Tracking session: reduce late_job_count by improving the Rust scheduling engine.

## Baseline

- Tests: 36 passed, 0 failed
- late_job_count metric: not measured in existing tests (no deadline scenarios)
- Improvements planned: #2, #3, #4 (improvement #1 already in place: EDD within tier in backward pass)

---

## Improvement #2 — Deadline proximity bonus in forward pass

**Problem:** The `job_boost` score in the forward pass fires *only* when `job_slack < 0` (job already past its deadline in estimated work). A job approaching its deadline but not yet violated receives no proactive boost, letting other jobs consume capacity until it's too late.

**Fix:** Add a `proximity_bonus` that scales from 0→300×tier_weight as `job_slack` drops from `ticks_per_day` to 0. Merged into the existing `job_boost` block to avoid double-lookup.

**Files changed:**
- `services/scheduling-engine/src/engine/forward_pass.rs`
- `services/scheduling-engine/src/engine/mod.rs` (test added)

**Result:** 38 tests, 0 failed (+2 new deadline scenario tests)

**Critical side-fix:** backward pass `place_backward()` called `productivity_at_tick()` BEFORE `grid.assign_operator()`. Since `productivity_at_tick` checks `grid.operator_stations_at()`, the operator was never "on station" → productivity=0 → work never decremented → all LAST values collapsed to 0. This meant **the entire urgency differentiation was broken** — all tasks had identical LAST=0 and were scheduled by secondary heuristics (chain_pressure, contention) instead of deadline urgency. Fixed by moving grid assignment before productivity computation.

---

## Improvement #3 — FBI convergence driven by lateness metrics

**Problem:** FBI breaks when makespan changes < 1%, ignoring late_job_count and weighted_lateness. Can converge with avoidable late jobs.

**Fix:** Convergence now requires BOTH makespan stability (< 1% change) AND lateness metrics stability (`late_job_count` and `weighted_lateness` unchanged). Best result selection also uses `(late_job_count, weighted_lateness, makespan)` tuple instead of makespan alone.

**Files changed:**
- `services/scheduling-engine/src/engine/fbi.rs`

**Result:** 38 tests, 0 failed (no new tests — behavioral improvement for multi-iteration FBI)

---

## Improvement #4 — Mid-FBI re-prioritization of late jobs

**Problem:** Moore escape fires only after convergence. Late jobs detected in iteration N don't affect iteration N+1's backward pass.

**Fix:** After each FBI iteration's compute_stats, late jobs get their `deadline_priority` boosted by one tier (e.g. standard→important, important→imperative, clamped to 0) for the next iteration's backward pass. The boost only affects the LAST computation — original priorities are preserved.

**Files changed:**
- `services/scheduling-engine/src/engine/fbi.rs`

**Result:** 38 tests, 0 failed

---
