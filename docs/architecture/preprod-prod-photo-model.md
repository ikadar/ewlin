# Préprod-Live / Prod-Photo Architecture Model

**Status**: Decided 2026-05-06. Locked design awaiting implementation.

**Audience**: Engineering, Product, Domain experts.

## 1. Context

Today, the scheduling system has two "scenarios" — Prod and Préprod — but they share the same physical rows for `Job`, `Element`, `Task`, etc. Visibility is gated via `PublicationFilter` (`published_at IS NOT NULL`). Concretely: when the user modifies a deadline in Préprod, the same row Prod reads is mutated, and the change becomes visible in Prod's view immediately.

This breaks the user's mental model. In the user's vocabulary:

- **Prod** = published plan, executing in workshop.
- **Préprod** = experimentation zone, *antichambre de la prod*. Modifications are tentative; they only become real on push.
- **Mur** = canonical real-world data: gates (paper, BAT, plate, forme), task progress (lastSetupAt, recordedProgressPct), operator absences. Read-only from Préprod, written by reality flows.

Because today's implementation merges Prod and Préprod via a flag rather than separating them physically, modifications "feel" committed even when conceptually tentative — hence the user's complaint that *"la deadline est sur le mur"*.

## 2. The Two Pillars

This model has two independent but reinforcing pillars:

| Pillar | What it changes | Status in this doc |
|---|---|---|
| **A. Préprod-live / Prod-photo + Wall layer** | Data model (entities, scenario isolation), publication mechanism, wall extraction for gates. | **Detailed implementation roadmap below.** |
| **B. JCF de modification** | UX/form: a dedicated post-creation modification surface for jobs whose elements have started gates or tasks. Cut-point + DSL suffix-rebuild. | **Designed, not implemented in this chantier.** Scheduled for a follow-up. |

Pillar A is foundational — it's the data model that makes Préprod truly tentative. Pillar B is built on top — it provides the right UX for editing under physical constraints. The user has chosen to land Pillar A first.

## 3. Pillar A — Préprod-live / Prod-photo + Wall

### 3.1 Decision data (per-scenario, physical rows)

These entities are owned by a scenario. Préprod has its rows (live, modifiable freely). Prod has its rows (frozen photo, refreshed at push).

- `Job` (deadline, priority, batDeadline, JCF metadata)
- `Element` (sortOrder, sequence DSL, prerequisiteElementIds, spec)
- `Task` (sequence within element, taskType, stationId/providerId, durations)
- `TaskAssignment` (pins / placement decisions)
- `Operator`, `Station` (planning resources — schedule, skills, availability)
- `OperatorConcurrentGroup` and station relations

### 3.2 Wall data (shared, read by both, written by reality)

These columns/entities are NOT scenario-scoped. They live on a shared wall layer. Reality writes them once; Prod and Préprod both read.

- **Gates** (extracted from Element): `paperStatus`, `batStatus`, `plateStatus`, `formeStatus`.
- **Task progress** (already task-level today, kept that way): `lastSetupAt`, `lastSetupStationId`, `recordedProgressPct`, `recordedAt`, `productivityRatio`, `lastSaisieAt`.
- Operator/Station real-time state (closures already constated, pre-existing absences).

### 3.3 Logical identity across scenarios

For wall data to be shared between a Préprod Element and its Prod photo counterpart, both rows must point to the same wall row. Introducing `logical_element_id`:

- A stable UUID generated at JCF creation.
- Copied verbatim through `ScenarioForkService` and through the photo refresh (publication).
- The wall row is keyed by `logical_element_id`, not by scenario-local `id`.

A similar `logical_job_id` may be needed if any wall data attaches to job level. (Open: today, gates are at element level, so job-level wall is not strictly required. Confirming during implementation.)

### 3.4 Replan semantics — pin vs seed

**Pin** = planner's intent (*"démarre ici, à cette heure"*) — per-scenario, lives in `TaskAssignment` or equivalent.
**Seed** = reality state (*"à NOW, tu es ici dans cet état d'élapsement"*) — on the wall.

At each replan:
1. The scheduler reads wall data → builds the seed (in-progress tasks frozen verbatim pre-NOW).
2. The scheduler reads the scenario's pins → applies as constraints.
3. Past pre-NOW = verbatim. Post-NOW = mutable (modulo chunk-mini and safety zone).

**Reality writes never create auto-pins.** The scheduler interprets wall progress as seed, not as a placement lock.

### 3.5 Publication semantics

Today: `UPDATE jobs SET published_at = NOW() WHERE id = ?`.

After refonte: publication = copy decision rows from Préprod to Prod scenario, atomically.

```
BEGIN
  -- For each entity type (Job, Element, Task, TaskAssignment, Operator, Station, …)
  -- DELETE prod rows for the affected scope
  -- INSERT prod rows from preprod, preserving logical_*_id
COMMIT
```

The wall layer is **untouched** by publication: it's already shared.

The **archive** (former Prod) is captured before the publication transaction (existing rotation mechanism is reused).

### 3.6 Fork semantics (Simulation scenarios)

Simulations remain technically possible but stay out of UX scope (per memory `feedback_preprod_vs_scenarios.md`). Existing `ScenarioForkService` still works; just needs to:
- Copy `logical_element_id` verbatim alongside the Element row.
- Not duplicate wall data (it's shared via logical_id).

### 3.7 Edge cases (YAGNI)

- **New JCF entered while user is in flight**: the new job lands in Préprod, auto-replan picks it up. Visibility to Prod is delayed until push. In practice, gates are blocking initially → no operator could work on it anyway → no real loss. Accepted.

## 4. Pillar B — JCF de modification (designed, not yet implemented)

### 4.1 Trigger condition

Activated as soon as any element of a job has touched reality:
- Any gate is open (paperStatus/batStatus/plateStatus/formeStatus → ready)
- Any task has progress: `recordedProgressPct > 0` or `lastSetupAt` non-null

In that case, the original JCF (creation form, full schema) is no longer suitable. A modification form is offered.

### 4.2 Cut-point per element

For each element, the cut point is computed as:

```
cut_point(element) = max(sequenceOrder of any task with
                         recordedProgressPct > 0 OR lastSetupAt != null) + 1
```

Tasks before the cut point are **immutable** (they're physically gravé). Tasks at or after the cut point are **fully replaceable** via DSL.

### 4.3 Suffix DSL editor

UI: per element, two zones:
- Read-only prefix display (with progress / setup / station info).
- Editable DSL textarea for the suffix. Same DSL grammar as JCF creation (`Komori(20+40); Massicot(15); ST:Clement(3j):Pelliculage`). Can mix internal and outsourced tasks freely.

Backend: `PATCH /jobs/{id}/elements/{eid}/sequence-suffix` accepts a DSL string; computes a new task list for the suffix; replaces existing post-cut tasks atomically. Returns 409 Conflict if `cut_point` has moved between GET and PATCH (race with prod execution).

### 4.4 Job-level modifications

Always-allowed (regardless of cut points):
- `workshopExitDate`, `deadlineRelativeWorkingDays`, `batDeadline` — even with task in progress (deadline ≠ sequence).
- `deadlinePriority`, `requiredJobIds` — planning knobs.
- `client`, `referent`, `description`, `quantity` (subject to existing validation).

## 5. Implementation roadmap

### Phase A1 — Wall layer for gates (this chantier)

1. Add `logical_element_id` column on `Element` (nullable for backward compat, then backfilled).
2. Create `ElementWall` entity / table (or columns on a new shared table) keyed by `logical_element_id`. Holds `paperStatus`, `batStatus`, `plateStatus`, `formeStatus`.
3. Migration: backfill `logical_element_id` for existing Elements; copy gate values from Element to ElementWall.
4. Update reality flows (`ConsoleService`, paper/BAT/plate/forme commands) to write to ElementWall.
5. Update read paths (`SnapshotBuilder`, FE serialization) to read gates from ElementWall.
6. Update Element entity: gate columns become deprecated (kept for one cycle for safety), reads delegated to wall.
7. PHPUnit tests for ElementWall + write/read paths.
8. Engine compatibility: SnapshotBuilder must continue to populate the engine snapshot with the same shape; Rust engine is unchanged.

### Phase A2 — Photo mechanism for Prod (this chantier)

1. Replace `PublicationFilter` semantics: instead of gating by `published_at`, Prod scenario context filters by its own `scenario_id` like Préprod does.
2. Refactor publication flow: instead of `UPDATE published_at`, copy Préprod rows to Prod scenario rows atomically.
3. Update existing publication endpoint (`POST /scenarios/preprod/publish` or equivalent).
4. Migration: ensure existing Prod scenario row exists and has its own copy of currently-published data.
5. PHPUnit tests for publication.

### Phase A3 — Engine + FE adjustments (this chantier)

1. Engine snapshot — confirm that `SnapshotBuilder` correctly assembles per-scenario snapshots after the photo refactor.
2. FE — confirm that entity reads through the active scenario context return the right row.
3. Playwright smoke test: modify a deadline in Préprod, confirm Prod view is unaffected; push, confirm Prod view updates.

### Phase B — JCF de modification (livré 2026-05-06)

Pillar B delivered as a follow-on chantier on the same branch (`multi-person-stations-encarteuse-travail-table`). The decisions, validated visually with the user via `playground-jcf-sequence-cell.html`, were:

- Strict visual continuity with the existing JCF (same modal, same table layout — disabled fields, never hidden).
- Single edit verb in the UI: the chef edits the DSL textarea ; the backend computes the diff between the old and new sequence and emits `Keep` / `Create` / `Cancel` ops. No special "replace" UX.
- A "Déjà fait" panel sits above the Sequence textarea (read-only). The textarea is pre-filled with the **remaining** DSL — completed tasks excluded, in-progress task with `runMinutes` reduced by `recordedProgressPct`, setup preserved. The engine is the authority on whether a partial setup carries over (`lastSetupAt` + `lastSetupStationId`), so the JCF doesn't try to bake that decision into the DSL.
- Element add/delete via column header actions ; element delete is `Element.status = Cancelled` (no hard-delete) so the wall preserves history.
- Gate switches (`needsBat / needsPaper / needsForme / needsPlates`) editable on a dedicated Gates row alongside their current status.
- No transmission notes, no blocking warnings — the chef is trusted.

**What ships :**

| Layer | Artefact |
|---|---|
| Backend entity | `Element.status: ElementStatus` (Active / Cancelled), `Element::cancel()`, `Element::isActive()`, `Job::getActiveElements()` |
| Backend audit | `JcfModification` entity + repository + table `jcf_modifications` |
| Backend service | `ElementSequenceDiffService` (matches by station/provider signature, falls back to position) ; `ElementModificationService` (orchestrates parse → diff → apply → audit) |
| Backend API | `PUT /api/v1/elements/{id}/sequence` (DSL + commentaires + needsX), `DELETE /api/v1/elements/{id}` (returns 410 on subsequent edits to a cancelled element) |
| Backend filter | `SnapshotBuilder` and `ScheduleComputeController::buildJobs` use `getActiveElements()` so Cancelled elements never reach the engine |
| Frontend | `JcfModificationModal` (reuses `JcfModal` / `JcfJobHeader` / `JcfElementsTable` with `disabledFields` / `disabledRows` props), `JcfDonePanel` + `computeRemainingDsl` helper |
| Migration | `Version20260509000000` — ALTER `elements` ADD `status` + CREATE `jcf_modifications` |

**Tests :**
- Backend: 10 unit tests on the entity layer + 7 unit tests on the diff service. PHPStan level 8 clean.
- Frontend: 8 vitest tests on `computeRemainingDsl` (orderings, in-progress reduction, cancelled drop, outsourced rendering).
- E2E: `apps/web/playwright/jcf-modification-api.spec.ts` smoke-tests the new endpoints over REST. The two round-trip cases (DELETE idempotency, 410 on cancelled element) skip gracefully when the Préprod fixture lacks a job with ≥2 elements — the no-fixtures-ever rule means the test must tolerate the real DB shape.

**Left for V2 (deliberate cuts) :**
- `POST /jobs/{jobId}/elements` (add element) — UI scaffolding present, endpoint not wired. Use case is rare and the diff service can already represent it.
- 409 conflict resolution when an operator records progress mid-edit. Today the modal will simply 200 over the stale state ; an explicit refresh-and-warn flow is a V2 polish.
- Mercure live-refresh of the "Déjà fait" panel while the modal is open.

## 5. Flux split V1 (livré 2026-05-06)

Pillar A and Pillar B together set the data model and the form. The Flux pilot page (`/flux`) sits on top — it's the surface where the chef negotiates the asymmetry day to day. V1 makes that asymmetry visible through write affordances ; V2 (out of scope here) will add a per-job/per-changeset publish to handle parallel hypotheses cleanly.

### 5.1 Decision

`FluxPage` is asymmetric depending on the active scenario (toggle = `?env=prod` URL param resolved into the `X-Flux-Scenario` header by `realBaseQuery`).

| Scenario | Reads | Writes |
|---|---|---|
| Prod   | Prod + wall | Wall only — gates (paperStatus/batStatus/plateStatus/formeStatus), ST status, Parti, Facturé. Reality-event saisie. |
| Préprod | Préprod + wall | Pillar B JCF modification surface (deadline / batDeadline / priority / sequence DSL / gate `needsX` / element cancel) + new-job creation. Tentative until publish. |

The frontier is wall = non-negotiable observation, scenario-scoped = negotiable hypothesis. Deadlines belong in Préprod because the chef negotiates them with clients ; gates belong in Prod because they reflect material events that already happened.

### 5.2 What ships

| Layer | Artefact |
|---|---|
| Backend | (no new endpoints — Pillar A wall handlers + Pillar B `/elements/{id}/sequence` and `/elements/{id}` already cover the writes ; `JobController::update` continues to gate Parti/Facturé to Prod via the existing `X-Flux-Scenario` header check.) |
| Frontend RTK Query | `getJob` query (`GET /api/v1/jobs/{id}`), `updateElementSequence` mutation (`PUT /elements/{id}/sequence`), `deleteElement` mutation (`DELETE /elements/{id}`) — added in `apps/web/src/store/api/scheduleApi.ts`. |
| Frontend container | `JobModificationContainer` — fetches the job, builds `JobModificationData` (re-grouping flat task list per element via `taskIds`), orchestrates save (sequences → deletions → job-level fields), invalidates Flux + Snapshot caches so auto-replan picks up the new shape. |
| Frontend gating | `canEditJobShape` prop on `FluxTable` (hides row "Modifier" button) and `canCreateJob` on `FluxToolbar` (hides "+ Nouveau job" CTA). Both wired from `FluxPage` based on `mode === 'preprod'`. Alt+N keyboard shortcut also gated with a toast. |
| Tests | Vitest coverage on the Préprod-only show/hide of "Modifier" + "Nouveau job" affordances. The Pillar B endpoints retain their own Playwright API smoke (`jcf-modification-api.spec.ts`). |

### 5.3 What was deliberately cut from V1

- **Per-job / per-changeset publish.** Today `ProdPhotoService::materialize()` is all-or-nothing — when the chef wants to publish a single hypothesis among several open ones, the V1 surface cannot help. Recorded as the only structural blocker in the design verdict ; concrete design deferred until the scenario starts pulling in practice.
- **A "Sync Préprod from Prod" rebase.** Same reason — not yet pulling in practice.
- **Diff visualization.** Auto-replan absorbs each saisie immediately, so any "before / after" overlay would lie (cf. `feedback_auto_replan_no_preview.md`).
- **A header badge for the active mode.** A playground (`playground-flux-mode-badge.html`) explores four variants (toolbar pill / sticky banner / corner ribbon / title-line tag) ; React implementation is held until the chef picks. The viewport-edge halo (`.preprod-shell-glow` / `.prod-shell-glow`) and the bottom-right `EnvFloatingControls` dock card cover identification in the meantime.

## 6. Risk register

- **Backward compat during gate migration**: dual-write phase needed. Production data must not be lost or de-synced.
- **PublicationFilter removal**: many query paths today implicitly rely on the shared row mechanism. Must audit all repositories that scope on Job/Element/Task.
- **Logical_element_id population**: existing rows have no logical_element_id. The migration must generate them deterministically (e.g., reuse the current `id` for the canonical row's logical_id).
- **Engine snapshot shape**: any change to gate location must preserve the JSON shape sent to the Rust engine.
- **Frontend rendering**: gate-status badges (BAT/papier/plaque/forme) on tiles and JDP must continue to display correctly during and after migration.

## 7. Memory anchors (this conversation)

- `feedback_preprod_vs_scenarios.md` — Préprod = experimentation zone; Scénarios HORS scope UX.
- `reference_sur_le_mur_terminology.md` — "Sur le mur" = données canoniques de la réalité.
- `project_gates_on_wall.md` — gates extraits d'Element vers couche partagée.
- `project_progress_seeds_not_pins.md` — avancement = seed, pas pin auto.
- `project_flux_split_design.md` — Flux split decision, V1 livré 2026-05-06.
- `feedback_auto_replan_no_preview.md` — pas de diff/preview UX, le replan absorbe.
