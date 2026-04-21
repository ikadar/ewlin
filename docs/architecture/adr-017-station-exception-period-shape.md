# ADR-017 — Unify Station.scheduleExceptions with Operator.absences as period shape

**Status:** Accepted
**Date:** 2026-04-22
**Relates to:** [ADR-016](adr-016-remove-scheduling-constraint-entity.md)

---

## Context

After ADR-016, station unavailability was carried on the Station entity as
`scheduleExceptions`, a per-date structure inherited from the legacy
`SchedulingConstraint` modelling:

```json
{
  "date": "2026-04-25",
  "type": "CLOSED" | "MODIFIED",
  "schedule": { "isOperating": true, "slots": [{ "start": "08:00", "end": "12:00" }] } | null,
  "reason": "..."
}
```

`Operator.absences` already used a much simpler period shape:

```json
{ "startAt": "2026-04-25T08:00:00", "endAt": "2026-04-25T12:00:00", "reason": "..." }
```

During the UX rewrite of the station form (2026-04-21), the domain owner
pointed out that the two concepts are semantically parallel:

- An **operator absence** expresses "this person is unavailable during
  `[startAt, endAt]`".
- A **station exception** expresses "this machine is unavailable during
  `[startAt, endAt]`".

The per-date shape on `Station` was an artefact of the original
`SchedulingConstraint` table design, not a semantic requirement. A flat list
of periods can express every case the per-date shape supported (including
multiple disconnected windows on the same day, via multiple rows), and is
strictly simpler:

| Case                            | Per-date (old)                                                 | Period (new)                     |
|---------------------------------|----------------------------------------------------------------|----------------------------------|
| Full-day closed                 | `{date, type:"CLOSED", schedule:null}`                          | `[date T00:00, date T23:59]`      |
| Partial-day gap 08:00–12:00     | `{date, type:"MODIFIED", schedule:{slots:[{00:00-08:00},{12:00-23:59}]}}` | `[date T08:00, date T12:00]`     |
| Multi-day span 22→24            | 3 rows: day 22 slots, day 23 closed, day 24 slots              | 1 row: `[day 22 22:00, day 24 06:00]` |

In addition, the product-owner conversation surfaced a domain rule that the
per-date shape invited confusion about: **shop-wide closures (holidays, weekends,
strike days) are modelled as an absence on every operator, NOT as an
exception on every station.** Station exceptions are strictly *machine-specific*
events (individual maintenance, breakdown, cleaning). Adopting the same period
shape as operator absences makes the two channels structurally interchangeable
but keeps their domain scopes distinct.

---

## Decision

Replace the per-date structure on `Station.scheduleExceptions` with the same
period shape used on `Operator.absences`:

```json
{ "startAt": "2026-04-25T08:00:00", "endAt": "2026-04-25T12:00:00", "reason": "..." }
```

Endpoints are inclusive, matching operator absences.

---

## Implementation

1. **Rust engine** (`services/scheduling-engine/src/model/station.rs`)
   - `ScheduleException` struct reshaped to `{startAt: NaiveDateTime, endAt: NaiveDateTime, reason: Option<String>}`.
   - `StationInput::blocked_ranges()` rewritten to clip each period into the
     horizon, then convert directly to tick ranges (no per-day expansion, no
     complement computation).
   - `ExceptionSchedule` struct removed along with the `DaySchedule` alias trick.
   - 9 unit tests cover: empty, full-day, intra-day partial, multiple same-day
     periods, period crossing midnight, horizon-clipped at start/end, fully
     outside horizon, before horizon.

2. **@flux/types** (`packages/types/src/station.ts`)
   - `ScheduleException` interface updated to `{startAt, endAt, reason: string | null}`.

3. **PHP API**
   - `ValueObject/ScheduleException.php`: same shape; validates ISO-8601
     naive local datetime; normalises to include seconds for lex-safe
     comparison; exposes `covers(moment)` and `overlapsDateRange(from, to)`.
   - `Entity/Station.php`: `replaceScheduleExceptions`, `addScheduleException`,
     `removeScheduleException(startAt)`, `hasExceptionAt(moment)` replace the
     per-date methods. `getEffectiveScheduleForDate` now narrows the weekly
     schedule by subtracting any overlapping exception window(s).
   - `Event/Station/ScheduleExceptionAdded`: payload simplified to
     `{stationId, startAt, endAt, reason}`.
   - `Controller/Api/V1/StationExceptionController`:
     - `POST /api/v1/stations/{id}/exceptions` accepts `{startAt, endAt, reason}`.
     - `DELETE /api/v1/stations/{id}/exceptions/{startAt}` (URL-encoded).
     - Overlapping periods on the same station are allowed (no more per-date
       unique constraint).
   - `Service/StationService` + `SnapshotBuilder::buildExceptions` updated to
     the new shape (snapshot field `stations[].exceptions` mirrors the entity
     JSON 1:1 now).
   - `Enum/ExceptionType` removed (no longer needed).
   - New migration `Version20260422100000.php` transforms any existing rows
     from per-date to period shape in-place and ships a reverse-direction
     `down()` to collapse periods back into per-date entries.

4. **Frontend** (`apps/web`)
   - `pages/StationsPage.tsx`: form serializer is now a passthrough —
     each UI row `{startAt, endAt, reason}` maps 1:1 to a DB entry. Removed
     ~60 lines of per-date expansion + complement-slot computation.
   - `components/StationColumns/StationColumn.tsx::getDaySchedule`: checks
     period intersection against the rendered date, narrowing the weekly
     schedule's slots to exclude covered sub-intervals.
   - `store/api/stationApi.ts`: `StationResponse.scheduleExceptions` now
     typed as `Array<{startAt, endAt, reason}> | null`.
   - `store/api/mockBaseQuery.ts`: shape-mapping between snapshot and API
     simplified to 1:1.
   - `mock/generators/stations.ts`: generator emits the period shape.
   - `components/ScheduleEditor/ExceptionsEditor.tsx` deleted (dead code).

5. **Console service** (`services/console-service`)
   - `tools/constraints.ts`: `add_station_maintenance` input becomes
     `{fromDate, toDate, startTime?, endTime?, reason?}`; output is the same
     period shape as `add_operator_absence`. `cancel_constraint` IDs are now
     composite `st:{stationId}:{startAt}:{endAt}` (parallel to operator key).
     `list_active_constraints` aggregates both channels over the same shape.
   - `llm/systemPrompt.ts` wording updated: the two channels share the same
     shape, and shop-wide closures go through operator absences.

---

## Consequences

### Positive

- **Single shape for the two unavailability channels.** Operator absence and
  station exception are now structurally identical. UI, serialization, and
  tooling are parallel — the operator-absence form editor was mirrored
  verbatim for stations, and vice-versa.
- **No impedance mismatch in the frontend.** UI state, wire payload, and DB
  shape all coincide. The entire expand-per-date / merge-overlaps / compute
  complement-slots pipeline is gone.
- **Period crossing midnight = 1 row.** Previously required 2 or 3 rows.
- **Simpler Rust engine code.** `blocked_ranges()` went from ~65 lines to ~30.
- **Clearer domain vocabulary.** Station exceptions are scoped to
  machine-specific events only; shop closures are expressed via operator
  absences. The reshape makes that scoping natural rather than enforced by
  convention.

### Negative

- **Breaking API change.** Any external caller posting the old `{date, type,
  schedule}` shape to `POST /stations/{id}/exceptions` or the bulk PUT
  endpoint now receives a validation error. The migration transforms existing
  DB rows but does not tolerate old-shape payloads on the wire.
- **DB migration required.** `Version20260422100000` transforms every row in
  `stations.schedule_exceptions` in place. On the dev database there was no
  data to migrate (all NULL), but a production deploy must run the migration
  before new PHP/Rust code is live.
- **LLM retraining overhead.** Any prompt history that memorised the old
  `add_station_maintenance` argument schema (`date`, `operatingSlots`) will
  need a round of re-learning. The system prompt was updated.

### Neutral

- Per-date unique constraint dropped. Two overlapping exception periods on
  the same station are now legal — the engine treats the union of covered
  moments as unavailable. This is semantically cleaner (no artificial
  uniqueness requirement) and matches operator absences.

---

## Alternatives considered

1. **Keep per-date backend, translate in frontend only.** Rejected —
   the per-date shape leaks into Rust (via `StationInput::blocked_ranges`),
   into console-service tools, into snapshot serialization. Translating on
   each hop creates multiple places where the two representations can drift.

2. **Move to period shape only at the API boundary.** Would have kept the
   Doctrine entity on the per-date shape and translated in `StationService`.
   Rejected as strictly worse: the entity is the canonical source, and the
   per-date shape does not buy anything there.

3. **Make the refactor additive (accept both shapes transitionally).**
   Rejected — no live callers outside the monorepo that we know of, no
   production data to protect, and dual-shape code paths are exactly the
   kind of complexity we keep removing.

---

## Follow-ups

- Wire `Station.operatingSchedule` (weekly base) into the Rust engine when
  per-station working hours become a real need.
- If external integrations ever emerge, expose a legacy adapter behind a
  versioned endpoint rather than re-introducing dual-shape code on the
  canonical path.
