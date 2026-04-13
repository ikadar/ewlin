# Algorithm Quality Tracker

Tracking late job count and other key metrics as we improve the scheduling algorithm.

## Metrics

| Date | Change | Late Jobs | Late Tasks | Total Lateness (min) | Makespan (min) | Compute (ms) | FBI Iter |
|------|--------|-----------|------------|----------------------|----------------|--------------|----------|
| 2026-04-13 | **Baseline** (commit 4769f3d) | **206** | 808 | 5,680,715 | 146,080 | 10,382 | 3 |
| 2026-04-13 | Proficiency-aware backward pass + run-phase pairing | **177** (-14%) | 608 (-25%) | 2,779,130 (-51%) | 146,120 | 5,945 | 3 |
| 2026-04-13 | Chain pressure + station contention scoring | **146** (-29%) | 569 (-30%) | 3,041,110 (-46%) | 134,560 | 5,999 | 3 |

## Improvement Plan

| # | Improvement | Status |
|---|---|---|
| 1 | Backward pass multi-resource (realistic LAST) | **Done** — -29 late jobs, -51% lateness |
| 2 | Reactivate Moore escape hatch | **Done** — no effect (all jobs same priority), kept for future use |
| 3 | Chain pressure + station contention in scoring | **Done** — -31 late jobs, -8% makespan |
| 4 | Shift-aware pre-split | **Skipped** — no tasks exceed maxChunkMinutes, pre-split inactive |

## Tested but ineffective

| Change | Result | Why |
|--------|--------|-----|
| Multi-start (2 orderings) | Same result, 2x compute | TierFirst already optimal |
| FBI iterations 3→5 | Same result, longer compute | Converges at 3 |
| Bottleneck bonus (+300 for single-op stations) | Slightly worse (+3 late) | Over-concentrates on bottlenecks |
| Deferral penalty (penalize high-slack tasks) | No change | Scoring already orders correctly |
| Horizon 14→120 days | No change | Dynamic grid growth already handles it |

## Remaining bottleneck

The 146 remaining late jobs are caused by **physical capacity limits**, not algorithmic inefficiency:

- **Polar 137**: 208h work, 1 operator (Frédéric)
- **Ryobi 528**: 391h work, 1 operator (Bertrand)
- **Carton**: 214h work, 1 operator (Antoine)
- **Komori G40**: 411h work, 2 operators (Guilian, Nicolas)
- **Horizon**: 269h work, 1 operator (Christophe)

None of these bottleneck stations have concurrent groups (masked time pairing).
Further reduction requires either cross-training operators or architectural changes (local search / backtracking).
