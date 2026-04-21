# ADR-015 — Two-phase compute architecture + lexicographic LNS objective

**Status:** Accepted
**Date:** 2026-04-21
**Relates to:** [ADR-005](decision-records.md#adr-005--technology-stack-selection), [ADR-009](decision-records.md#adr-009--hybrid-backend-architecture-php--nodejs), [ADR-008](decision-records.md#adr-008--optimistic-locking-for-schedule-aggregate)

---

## Context

Before this release, the scheduling engine exposed a single synchronous endpoint `POST /compute` that ran the full pipeline (FBI multi-start → Moore escape → LNS improvement) and returned the final schedule. Two problems emerged:

1. **LNS inside the request path is a false economy.** The LNS budget was capped at 3 s so the caller wouldn't time out, which wasn't enough to consistently improve on the FBI baseline. Extending it to 60 s would freeze the UI for a full minute on every compute, unacceptable for users who just saved a job and expect the planning to refresh immediately.
2. **LNS was never triggered outside manual compute.** Auto-recompute after an edit (added in this release) needs to react quickly and cannot afford a 60 s wait. Running LNS synchronously inside every auto-trigger would make every edit painful.

Additionally, the LNS objective function was scored on `(late_job_count, weighted_lateness_minutes)`. The product owner's feedback: *"I want jobs-with-zero-late-jobs-but-better-calage-continuity to be preferred over jobs-with-zero-late-jobs-and-scattered-calage"*. The `weighted_lateness_minutes` tertiary dominated at ties even when the two schedules had identical late counts, which meant calage bonus improvements never surfaced in LNS acceptance decisions.

---

## Decision

### Two-phase compute

Split the engine pipeline into two HTTP endpoints:

- **`POST /compute-fast`** — runs FBI (multi-start + perturbed) and Moore escape, but skips LNS. Returns in < 1 s on a realistic workload (~1000–2000 tasks). This is the endpoint that user actions (JCF save, admin changes) hit via the PHP proxy.
- **`POST /compute-lns/stream`** — SSE endpoint that runs LNS for up to 60 s with the FBI baseline as seed. Emits `LnsIteration` and `LnsDone` progress events and finally an applied schedule. The caller opens this stream after `/compute-fast` returns; improvements are auto-persisted by the PHP proxy.

The engine keeps the existing `POST /compute` and `/compute-stream` endpoints for backward compatibility with external callers that still want the in-request LNS behaviour.

### Cancellation via global token

The Rust engine holds a single `Arc<AtomicBool>` in a module-scope `OnceLock<Mutex<...>>`. Each `/compute-lns/stream` request installs a new token and flips the previous one to `true`. The LNS loop checks the token on every iteration and exits cleanly. This gives correct supersession semantics under the mono-user deployment assumption without the complexity of per-session tokens or a queue.

### Lexicographic objective

Replace the LNS acceptance rule from `(late_job_count, weighted_lateness_minutes)` to:

- **Primary:** `late_job_count` — strict decrease is always accepted, strict increase always rejected.
- **Secondary (at tied primary):** any-of-strict improvement on the `(calage_bonus_sum, calage_bonus_mean, calage_bonus_median)` triple. Accept if at least one metric is strictly higher AND no metric is strictly lower.

The calage bonus is the existing forward-pass reward for placing a task on the same station as the previous assignment of the same job (100 if same-job-previous, 0 otherwise). It is now aggregated into `ScheduleStats.calage_bonus_sum / mean / median` so both the engine and downstream consumers can read it off the wire.

### Frontend orchestration

A module-scope singleton (`hooks/autoRecomputeRuntime.ts`) drives the debounced Phase-1 trigger and the Phase-2 SSE consumer. A React Context at `RootLayout` level (`AutoRecomputeContext`) exposes the trigger to consumers and hosts the unified `ComputeToastStack`. A typed RTK listener middleware (`autoRecomputeMiddleware`) triggers the runtime on an allow-list of 17 mutation endpoint names, covering every CRUD operation that touches the scheduling problem.

---

## Consequences

### Positive

- Every edit feels instant: the planning re-renders in ~500 ms while LNS keeps working in the background.
- LNS now has ~20× the budget (60 s vs 3 s) it had before, consistently finding improvements a human planner can see.
- Manual compute (Alt+P / FAB) and auto compute share the same Waze-style improvement notification so the user learns one feedback pattern.
- Renaming an RTK Query mutation breaks the middleware at compile time, not silently at runtime.
- The Rust engine objective function is now unambiguously aligned with the product owner's prioritisation.

### Negative

- The Rust engine now has two `compute` entry points with similar but not identical semantics. The `POST /compute` path will be deprecated in a later release once no external caller depends on it.
- Supersession assumes a single user: two planners triggering concurrent computes on the same instance would see one of their LNS runs cancelled by the other's. The mono-user assumption held at the time of writing and is documented in the release notes. A multi-user deployment will require per-session tokens.
- The Phase-2 stream pipes events through the PHP proxy, which means SSE has two hops. Acceptable latency in practice (~50 ms per event, LNS emits ≤ 10 events/60 s) but theoretically more fragile than a direct FE → engine stream.
- Calage bonus stats are stored on every `ScheduleStats` emitted by the engine, slightly bloating the payload. Measured impact: < 1 % size increase on typical payloads.

### Neutral

- The frontend uses `useSyncExternalStore` to subscribe to the runtime singleton; React 18+ requirement already held.
- The safety zone feature (pinning cards within `now + Nh`) is what makes auto-apply of LNS improvements visually acceptable: near-term cards don't reshuffle, only the far horizon does. The two architectures are synergistic — safety zone couldn't ship alone without the two-phase flow, and two-phase without safety zone would cause visible card shuffling on every edit.

---

## Alternatives Considered

1. **Keep LNS in `/compute` but shorten to 1 s.** Rejected — the 1 s budget rarely finds meaningful improvements.
2. **Dedicated worker process queue + polling.** Rejected for V1 — the mono-user assumption lets a global cancel token do the same job with far less infrastructure.
3. **Weighted scalar objective** `α·late + β·calage`. Rejected — weights are hard to tune and hide the product-owner intent ("late count dominates everything else").
4. **Full all-of-strict objective** on (sum, mean, median). Rejected — too strict; rejects legitimate improvements where one metric plateaus.
5. **Per-call-site auto-recompute wiring.** Rejected — N call sites means N opportunities to forget. The middleware centralises the allow-list.

---

## Follow-ups

- Add observability counters (`lns.improved_count`, `lns.no_change_count`, `lns.cancelled_count`) to monitor LNS ROI in production.
- Benchmark `/compute-fast` p50/p95 on realistic workloads; confirm the < 1 s target holds.
- Consider deprecating `POST /compute` once external callers migrate.
- Per-session LNS tokens if the mono-user assumption breaks.
