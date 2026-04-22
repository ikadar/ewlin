# Planning improvement — Full-job outsourcing suggestions in compute report (WIP)

> **Status:** Work in progress — design captured from discussion on 2026-04-22
> **Scope note:** This document is about **full-job outsourcing to partner print shops** as a purely analytical signal in the compute report. It is **distinct from** the existing task-level outsourcing model (see [outsourcing.md](./outsourcing.md) and [outsourcing-impact-assessment.md](./outsourcing-impact-assessment.md)), which covers specialized finishing providers (lamination, gilding, binding). The two topics share a word but are different features.

---

## Problem statement

The current Rust engine output has a blind spot: it measures the **symptom** (e.g., *"83 jobs late"*) but not the **causes** or the **available levers**. Operators need diagnostic and prescriptive analytics, not just aggregate outcomes.

Target questions the report should answer:

- Which jobs are the biggest bottlenecks in the plan?
- Which machines are most overloaded?
- **What concrete actions would unblock the plan?**

## Chosen angle: full-job outsourcing

Three families of actionable levers were considered:

1. **Machine reassignment** — move job X from saturated machine A to underused machine B.
2. **Full-job outsourcing** — send a whole job to a partner print shop. ← **chosen first**
3. **Deadline renegotiation** — flag irredeemable cases for commercial action.

**Why outsourcing first:** it is the only lever that **actually adds capacity** to the plan (the others redistribute internal capacity). In a saturated shop with a clear bottleneck, outsourcing 1 job can rescue 10. Economically it is a clean trade: sacrifice a job's value-added margin, save 10 others' deadlines.

### Key domain clarification

Initial analysis examined the existing `OutsourcedProvider` model (finishing stages sent to specialized providers). The domain expert clarified that the intent is different:

- The target is **full-job outsourcing to a competitor print shop** (the full job leaves the shop).
- **Everything is technically outsourceable** (no eligibility filter needed).
- Preference is to keep work internal for margin, but outsourcing becomes a real option when the multiplier is high.
- The current Flux model has **no entity** for partner print shops (no margin data, no partner directory). The feature is therefore **purely analytical**: flag the best candidates; the operator handles the business side (call, negotiate, contract).

## Decisions (2026-04-22)

| Question | Decision |
|---|---|
| Scan scope | Late jobs **and** on-time jobs that block others (with distinct visual label) |
| Number of suggestions | Top 5, well justified |
| Priority weighting | Geometric: `impératif=8, important=4, standard=2, flexible=1` |
| Sensitivity attribute | Not modeled — operator judgment only |

Rationale for the weights: an impératif (prio 0) job is worth 2× an important (prio 1), which is worth 2× a standard (prio 2), which is worth 2× a flexible (prio 3). This yields a log-base-2 scale with a clean algebraic property: sacrificing a job of priority N is justified by unblocking 2 jobs of the same priority **or** 1 job of a higher priority.

## Scoring formula

For each candidate job `C`:

```
weight(j)       = 2^(3 − deadlinePriority(j))
                  impératif (0) → 8
                  important (1) → 4
                  standard  (2) → 2
                  flexible  (3) → 1

gain(C)         = Σ weight(j) for each job j that transitions
                  from "late" → "on time" if C is outsourced

sacrifice(C)    = weight(C) if C was on-time in the plan
                  0         if C was already late (outsourcing cannot
                            degrade what is already broken)

score(C)        = gain(C) − sacrifice(C)
```

### Emergent property

This single formula **naturally surfaces both types of candidates** without requiring two separate lists.

- Late jobs have `sacrifice = 0`, so their gain is pure — they dominate the ranking easily.
- On-time jobs must unblock enough to overcome their own weight — so only the **truly non-obvious high-impact** on-time candidates make the top 5.

### Examples

| Candidate | gain | sacrifice | score | Rank outcome |
|---|---|---|---|---|
| Impératif, **late**, unblocks 2 standards | +4 | 0 | **+4** | Modest, but easy win |
| Standard, **on-time**, unblocks 3 impératifs | +24 | −2 | **+22** | Rises to top despite being on-time |
| Important, **on-time**, unblocks 1 flexible | +1 | −4 | **−3** | Filtered out (net negative) |

## Output structure (proposed)

Each of the top 5 entries in the compute report:

```
① Job #1234  [LATE — impératif]
   Frees     8h Heidelberg SM52 (23-25/04)
   Unblocks  3 impératifs, 1 important  (+28)
   Sacrifice 0 (already late)
   Score     +28

② Job #5678  [ON TIME — non-obvious candidate — standard]
   Frees     12h Komori G40 (24/04)
   Unblocks  2 impératifs  (+16)
   Sacrifice −2 (loses on-time, standard priority)
   Score     +14
```

The `[ON TIME — non-obvious candidate]` label and the explicit "Sacrifice" line are critical: they address the UX risk that an operator sees an on-time job suggested for outsourcing, assumes a bug, and disables the feature.

## UI placement

Natural home: the **ComputeReport** (recently toastified). Add a new section titled *"Outsourcing suggestions — top 5"*, expandable/collapsible. Keep spartan per UX restraint principle.

## Algorithmic challenge: search space

With 1000–2000 jobs per planning run, testing the removal of each candidate via full re-simulation is expensive. Proposed layered approach:

1. **Pre-filter** — only consider jobs booked on saturated machines during time windows overlapping with late jobs' deadlines. Eliminates ~80% of the search space with minimal signal loss.
2. **Critical-path approximation** — initial scoring via dependency graph analysis, no re-simulation. Fast but imprecise on 2nd-order cascade effects.
3. **Targeted re-simulation** — apply genuine what-if only to the top ~10 candidates from step 2, to refine their scores before cutting to the final top 5.

## Roadmap

### Phase 0 — Validate UX (playground)

Static HTML playground with 5 realistic example cards (2 late candidates, 2 non-obvious on-time candidates, 1 edge case) to validate:

- Info hierarchy legibility (2-second scan test)
- Visual distinction of non-obvious candidates
- Density, color, field order

Follows the **"playground before frontend"** rule from the project conventions.

### Phase 1 — Engine implementation

Post-solve analyzer in `services/scheduling-engine`:

- Pre-filter on saturated machines × lateness windows
- Critical-path scoring pass
- Targeted what-if re-simulation on top 10
- Output: top 5 candidates with full justification data (machine freed, jobs unblocked by priority tier, score breakdown)

### Phase 2 — API + Frontend

- Expose in compute response payload (shape aligned with playground)
- Render in ComputeReport toast/panel

### Rough estimate

| Phase | Estimate |
|---|---|
| 0. Playground | ~1 hour |
| 1. Engine | 1–2 days |
| 2. API + Frontend | 1 day |

## Design property: stateless, no new entity

The feature requires **no new persisted entity** — no table, no flag, no migration. Suggestions are **derived** fresh on each compute.

Consequences:

- Zero DB migration.
- Zero data coherence to maintain.
- Automatically reflects any changes (new jobs, priority edits, machine changes, provider availability).
- Fits the engine's stateless pattern (input → compute → output).

This contrasts with alternative designs that would persist recommendations — those go stale and create friction.

## Key insights captured

- **Capacity addition vs. redistribution.** Outsourcing is the only lever that adds real capacity to the plan. Every other lever (reassignment, swap, batching) redistributes existing internal capacity. This is why outsourcing has outsize value in saturated shops.
- **Pareto effect (Goldratt's Theory of Constraints).** In a job shop with a clear bottleneck, 1–2 jobs on the saturated machine create the majority of downstream lateness. The "1 sacrifice → 10 saves" ratio is the normal case, not a lucky outlier.
- **Algorithm vs. human intuition.** Operators easily spot late jobs as outsourcing candidates (visible symptom). They struggle to spot on-time jobs that block others (invisible symptom). The algorithm earns its keep specifically on these non-obvious candidates — **but only if the UI makes the reasoning legible**, otherwise the suggestion looks like a bug.
- **Knapsack analogy.** The ranking is formally a variant of the 0/1 knapsack problem (NP-hard in general). In practice, greedy top-N is sufficient because we target rare outsourcings — if the report suggests 20, the report has lost its purpose.

## Open questions / TODO

- [ ] Confirm the exact mapping of `Job.deadlinePriority` values (0–3, inverted) to the weight scale in production code — the memory says JCF field, 0 = impératif, but double-check before implementing the weight function.
- [ ] Decide cadence: should the outsourcing analysis run on every compute (slightly slower iterative replanning) or only on explicit operator request?
- [ ] Consider a "why this, not that" view for ranks 6–10 — transparency about candidates that were close to the cut.
- [ ] Verify the pre-filter assumption: in practice, are the top candidates truly always on saturated machines? If some valuable candidates live on non-saturated machines (via cascade paths), the filter may be too aggressive.
