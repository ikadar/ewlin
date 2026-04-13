# Algorithm Quality Tracker

Tracking late job count and other key metrics as we improve the scheduling algorithm.

## Metrics

| Date | Change | Late Jobs | Late Tasks | Total Lateness (min) | Makespan (min) | Compute (ms) | FBI Iter |
|------|--------|-----------|------------|----------------------|----------------|--------------|----------|
| 2026-04-13 | **Baseline** (commit 4769f3d) | **206** | 808 | 5,680,715 | 146,080 | 10,382 | 3 |
| 2026-04-13 | Proficiency-aware backward pass + run-phase pairing | **177** (-14%) | 608 (-25%) | 2,779,130 (-51%) | 146,120 | 5,945 | 3 |

## Improvement Plan

| # | Improvement | Status |
|---|---|---|
| 1 | Backward pass multi-resource (realistic LAST) | **Done** — -29 late jobs, -51% lateness |
| 2 | Reactivate Moore escape hatch | Pending |
| 3 | Chain pressure + station contention in scoring | Pending |
| 4 | Shift-aware pre-split | Pending |
