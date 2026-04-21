# ADR-016 — Remove SchedulingConstraint entity, adopt domain-entity channels

**Status:** Accepted
**Date:** 2026-04-21
**Relates to:** [ADR-015](adr-015-two-phase-compute-lns-objective.md), [ADR-013](decision-records.md#adr-013--element-layer-with-hybrid-sequencing)

---

## Context

The `SchedulingConstraint` entity (`services/php-api/src/Entity/SchedulingConstraint.php`) was introduced as a generic "directive" table feeding the Rust scheduling engine. Four constraint types were defined:

- `MachineUnavailable` — station blocked on a time range
- `OperatorAbsent` — operator unavailable on a time range
- `DurationOverride` — task duration forced to a given value
- `PinnedStart` — task must start at a specific tick

In practice:

| Type | Actual behaviour |
|------|------------------|
| `OperatorAbsent` | Silent failure — Rust ignores these rows (`mod.rs` explicitly skips non-`MachineUnavailable`); `Operator.absences` on the domain entity was already the working path |
| `DurationOverride` | Silent failure — never consumed by Rust; task durations come from the JCF DSL (`setupMinutes + runMinutes`) |
| `PinnedStart` | Silent failure — never consumed; pin semantics live on `Assignment.isPinned` (user's pin widget on the tile) |
| `MachineUnavailable` | Working — the only type the engine handled (`station_blocked_ranges`) |

The session in which this ADR was written surfaced an even deeper issue: `Station.scheduleExceptions` (the per-date override declared on the Station domain entity) was sent to Rust but never consumed. A user editing the station's maintenance window in Settings had *no* effect on scheduling — they had to go through `SchedulingConstraint(MachineUnavailable)`, which required the separate admin page we had just shipped.

The product-owner review (non-developer domain expert) framed this cleanly: *"le user édite des entités domain (Operator, Station, Task via JCF), le système dérive les contraintes"*. Every constraint type already had a natural domain-entity home, so the generic table was pure overhead — and a silent-failure trap for three of its four types.

---

## Decision

Remove `SchedulingConstraint` entirely, in both backend and front, and have the Rust engine consume the corresponding domain entity fields directly.

Mapping:

| Former constraint type | Canonical channel |
|------------------------|-------------------|
| `OperatorAbsent`       | `Operator.absences` (already wired in Rust) |
| `MachineUnavailable`   | `Station.scheduleExceptions` (newly wired in Rust — see Implementation below) |
| `DurationOverride`     | JCF DSL edit (`setupMinutes` / `runMinutes` on the task) |
| `PinnedStart`          | `Assignment.isPinned` + `pinnedStartTick` (pin widget on the tile) |

---

## Implementation

1. **Rust: wire `Station.scheduleExceptions`** (commit `bac4850`)
   - New `ScheduleException` struct in `model/station.rs` mirroring the PHP shape (`date`, `type`, optional `schedule { isOperating, slots[] }`, `reason`).
   - `StationInput::blocked_ranges(start_date, horizon_days, tick_minutes)` computes `(start_tick, end_tick)` tuples:
     - `"closed"` or null/non-operating day → whole-day block.
     - `"custom"` with slots → block the gaps between slots.
   - `engine::compute_inner` feeds these tuples into `station_blocked_ranges`.
   - 7 new unit tests cover the boundary cases.
   - Base weekly `operatingSchedule` is explicitly *not* wired in this change; station base availability is still derived from operator availability. A later change can wire the base schedule if per-station weekly patterns become a real need.

2. **Frontend: remove the admin UI** (commit `d8e8157`)
   - Deleted: `SchedulingConstraintsPage.tsx`, `constraintApi.ts`, the types file, submenu entry, route, middleware allow-list entries.

3. **Console service: rewire the LLM tools** (commit `963a056`)
   - `add_operator_absence` now does `GET /api/v1/operators/{id}` → append to `absences[]` → `PUT /operators/{id}`.
   - `add_station_maintenance` now does the equivalent on `Station.scheduleExceptions`. Input shape simplified to `{ date, operatingSlots?, reason? }`.
   - `cancel_constraint` takes a composite id (`op:{operatorId}:{startAt}:{endAt}` or `st:{stationId}:{date}`) and removes the entry from the corresponding array.
   - `list_active_constraints` aggregates `GET /operators` + `GET /stations`.

4. **PHP: remove the entity + controller + DTOs** (commits TBD)
   - Deleted: entity, repository, controller, DTOs.
   - `ScheduleComputeController::buildConstraints()` removed; the `constraints` payload field is now always `[]` (kept in the JSON for a graceful transition, dropped from Rust in step 5).
   - New migration `Version20260421160000` drops the `scheduling_constraints` table (with a `down()` that recreates the schema for rollback).

5. **Rust: remove the constraints surface** (commit TBD)
   - `ConstraintInput` struct removed.
   - `ComputeRequest.constraints` field removed (serde ignores unknown JSON fields by default, so rolling deploys aren't broken).
   - All engine-internal references to the old parsing block removed.

---

## Consequences

### Positive

- **No more silent-failure admin UI** — the removed page could create `OperatorAbsent`, `DurationOverride`, `PinnedStart` entries that did nothing. That trap is gone.
- **Domain-entity-first surface** — users edit operators in the Operators page, stations in the Stations page, tasks in the JCF. One concept, one UI, one source of truth per concept.
- **Smaller API surface** — `/api/v1/scheduling-constraints` is gone, console-service tools are simpler, the Rust `ComputeRequest` has one fewer optional field.
- **Station maintenance now actually respects the domain entity** — `Station.scheduleExceptions` had been accepted by the PHP API for a long time but silently discarded by the engine. Now it blocks ticks for real.

### Negative

- **Prod data migration required** — any existing rows in `scheduling_constraints` on a prod DB need to be re-expressed on the corresponding domain entity before the `DROP TABLE` migration runs. The dev DB was empty, so it wasn't done; a future deployment must include a migration script.
- **LLM re-training overhead** — console-service LLM may have memorised the old `/scheduling-constraints` endpoint from the system prompt pre-2026-04-21. Updated prompt points it to the domain entities; cached behaviour may take a few rounds to catch up.
- **Rolling-deploy sequencing** — PHP must deploy before Rust (or at the same time). A Rust service that no longer deserialises `constraints` but a still-live PHP that sends it: serde silently drops unknown fields, so this is fine. But a PHP that's already on the new build while Rust is still old: Rust still expects `constraints`, PHP sends `[]`, works. No actual risk.

### Neutral

- The `MachineUnavailable` use case is preserved under a cleaner name and a richer shape: `scheduleExceptions` can express closed-day and custom-hours exceptions, whereas the old constraint only had a single time range.
- Base `Station.operatingSchedule` wiring is still deferred. Current station availability is driven by operator availability, which is enough in practice for Flux today.

---

## Alternatives considered

1. **Scope back to "remove only the 3 silent-failure types"** — keep `SchedulingConstraint(MachineUnavailable)` as the working channel for station maintenance. Rejected after the product-owner conversation: the goal is for users to edit stations in the Stations page, not a separate generic constraints page.

2. **Wire full `Station.operatingSchedule` immediately** — more work than needed for this sprint. Left as a separate future change.

3. **Keep the entity as a façade** — old callers could still post to `/scheduling-constraints`, which would translate server-side into writes on `Operator.absences` / `Station.scheduleExceptions`. Rejected: the dual-path is exactly the kind of complexity the cleanup is trying to remove.

---

## Follow-ups

- Wire `Station.operatingSchedule` (weekly recurring) into Rust when per-station working hours become necessary.
- Deprecate the `constraints` field in external API consumers' code and docs, if any exist outside the monorepo.
- Write a one-shot migration script for prod if any rows remain in `scheduling_constraints` at deploy time.
