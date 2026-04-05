# Implementation Plan — Critical Review Summary

> **Date:** 2026-04-04
> **Reviewer:** Claude + Julien
> **Document reviewed:** `implementation-plan.md`

## Review outcome

3 corrections applied to the plan, 2 corrections to the analysis document. The algorithm itself was correct — the most severe critiques were misreadings of the original PDF's branching logic.

## All 14 points

### Critical (resolved before coding)

| # | Point | Verdict | Action |
|---|-------|---------|--------|
| 1 | LAST check only in NON branch of sub-loop | **INVALID** — algo is correct, check is unconditional at every Ut | Analysis §4.8 corrected, §5.1 marked RESOLVED |
| 2 | Backward pass ignores operators | **INVALID** — algo checks operator availability, plan just omitted it from the list | Added "Operator availability" to plan §2.2 |
| 3 | Degraded mode productivity formula missing from pseudocode | **VALID** — documentation gap | Added `productivity = min(attention_received / attention_required, 1.0)` and `ART by tick × productivity` to plan §2.3 |
| 4 | Scoring calage function underspecified | **VALID** — but building blocks exist (SimilarityCriterion system) | Added reference to existing similarity criteria in plan §2.3 scoring |

### Important (clarified)

| # | Point | Verdict | Action |
|---|-------|---------|--------|
| 5 | Phases 1A/1B = data entry with no visible result | **Suggestion only** — Julien prefers real data first, then algo | No change. Approach validated. |
| 6 | Two databases, no sync strategy | **Architecture changed** — Julien decided: all data in PHP API + PostgreSQL, Rust engine is stateless | Plan architecture completely rewritten. No SQLite, no import endpoint. |
| 7 | Performance budget underestimated (FBI × pre-split) | **Exaggerated** — even 37.5M iterations well under 5s in Rust | No change needed. |
| 8 | Operator continuity vs attention optimization tension | **Not a real problem** — inherent to greedy approach, already documented as accepted tradeoff | No change. |

### Secondary (no action)

| # | Point | Verdict |
|---|-------|---------|
| 9 | Constraint model limited to 4 types | Correct for Phase 4 scope. New types = just new enum values later. |
| 10 | No scenario comparison / what-if | Feature suggestion for post-Phase 4. Not needed now. |
| 11 | Frontend coordination between two APIs | **Eliminated** by architecture change (single PHP API). |
| 12 | Chunk boundaries and working hours | Non-issue — algo handles day boundaries via operating schedule. |
| 13 | FBI convergence criteria too simple | Minor — can be refined during implementation if oscillations observed. |
| 14 | Operating schedule format not defined | Non-issue — format exists in codebase, same structure as Station. |

## Additional changes from discussion

| Change | Source | Applied to |
|--------|--------|------------|
| Operator Gantt screen detailed (new screen, one column per operator) | Julien request | Plan §2.6 expanded |
| Operator configuration screens detailed (3 screens) | Julien request | Plan Phase 1B expanded |
| Proficiency slider UI (not checkbox) with snap to 0 and 1, grouped by station category | Julien feedback | OperatorsPage.tsx |

## Key decisions confirmed by Julien

1. **LAST check is unconditional** at every Ut of the sub-loop (both OUI and NON branches)
2. **All data in PostgreSQL** via PHP API — no separate Rust database
3. **Real data first** — no minimal demo with hardcoded data
4. **Pre-split approach** preserved as agreed in the analysis
5. **Proficiency UI** = slider with magnetic snap, not checkbox, grouped by category

## Architectural rethink (2026-04-05)

### Why we rolled back

After implementing Phase 1C (operator Gantt), Phase 2 (Rust engine), and the compute pipeline, we realized the system was incoherent:
- Station Gantt and operator Gantt were independent pages with no shared data source
- Computed assignments were persisted without operator info (the `operators[]` from the engine was discarded)
- The data flow from engine → DB → snapshot → frontend was not designed upfront, just cobbled together
- The persistence step (saving computed assignments as TaskAssignment records) wasn't in the original plan — it was discovered during implementation
- Station filtering (hide Maintenance stations) was an afterthought

Julien asked to roll back to Phase 1B (test data) and redesign the architecture before reimplementing.

### Key decisions after rethink

**1. `operators` array on TaskAssignment** (not a single operatorId, not a separate entity):
- Array of `{operatorId, attention}` — supports multi-operator machines (Hohner needs 2 operators)
- Stored in the existing JSON column on the Schedule entity — zero DB migration
- Both Gantt views derive from the same TaskAssignment data
- Empty array = no operator assigned (manual placement or outsourced task)
- Backward compatible: existing assignments without `operators` default to empty array

**2. `operators[]` in ScheduleSnapshot**:
- Single snapshot feeds all views (station Gantt, operator Gantt, flux)
- No separate API call for operator data in scheduling context
- The snapshot is the ONLY data source for all scheduling views

**3. Two pages, not a toggle** (revised from initial "toggle" idea):
- The SchedulingGrid component is 700+ lines, deeply coupled to stations (StationColumn, StationHeader, drag & drop, pick & place, virtual scroll)
- Making it generic for both stations and operators is a risky, large refactor
- Two separate pages sharing reusable sub-components (TimelineColumn, Tile, UnavailabilityOverlay) is cleaner
- Both pages read the same snapshot → always synchronized
- Navigation via sidebar buttons
- "Calculer" button on both pages → snapshot updates → both pages reflect the change

**4. Compute replaces the schedule (no confirmation)**:
- "Calculer" clears non-pinned, non-completed assignments (same as Ctrl+Alt+Z) then inserts computed ones
- Pinned and completed tiles are preserved
- No confirmation dialog — the user expects the compute to produce a new schedule

**5. Multi-operator tile display**:
- Operator names comma-separated on the tile: "Paul, Emma"
- Station Gantt tiles show operator names; operator Gantt tiles show station name
- A task with 2 operators appears as a tile in BOTH operator columns

**6. Validator unchanged for MVP**:
- Existing validator checks station conflicts (capacity, availability, precedence)
- Operator double-booking is handled by the Rust engine, not the validator
- Post-MVP: add operator conflict type to the validator
