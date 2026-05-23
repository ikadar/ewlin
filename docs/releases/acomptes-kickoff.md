# Acomptes — Kickoff & Foundations

> **Status:** 🔴 Not Started (kickoff completed 2026-05-23)
>
> **Milestone:** M7
>
> **Target Date:** TBD (P0 sprint to be scheduled)
>
> **Git Tag:** TBD (likely `v0.7.0-acomptes-data-foundations` then successors)

---

## Overview

Introduces the "acompte" feature: partial-delivery / installment mechanic for long print jobs that exceed shop capacity. The shop manager splits a logical Job into N child `Acomptes`, each with its own quantity share and delivery deadline, to relieve a downstream bottleneck or honour a negotiated split delivery.

The defining characteristic — and the design driver — is that **acomptes are triggered when capacity overruns**, not at planning time. They are firefighting, not planning. The UX, data model, and engine integration are all shaped around that fact.

### What ships in V1

- New `Acompte` entity (separate from `Job`) with `parent_job_id`, `quantity_share`, `deadline`, `position_index`.
- `AcompteService` for create / split / validate invariants.
- `acompte_progress_declaration` audit table holding the operator's parent-level progress declarations ("G37 80 %").
- `cascadeFifo()` pure helper that distributes parent-level progress to acomptes by `position_index`.
- Engine fan-out at PHP snapshot-build time: one synthetic `TaskInput` per (acompte × parent.task). Engine sees independent jobs. **No engine changes.**
- UX: `JcfModal` "Acomptes" section, `FluxTable` sub-folder rendering, new `ParentProgressCaptureModal`, `1/3` badge on Tile, read-only acompte view in JobDetailsPanel.

### What does NOT ship in V1

- Per-acompte override of the FIFO cascade (the cascade IS the model).
- Mid-flight split via context menu (V1 ships JCF-time creation only).
- "Force re-calage" toggle (engine's `InheritedSetup` decides automatically from physical contiguity).
- Multi-element jobs combined with acomptes (V1 invariant: one or the other).
- Per-task per-acompte deadlines (single deadline per acompte covers 95 % of cases).

---

## Locked decisions

### Domain semantics

- **DOM-AC-001** Acompte = firefighting protocol. Mid-flight reactive split is the dominant trigger; JCF-time creation is the secondary path. The UX must be < 60 seconds end-to-end.
- **DOM-AC-002** Authority = shop manager only. Operators do not split.
- **DOM-AC-003** Acomptes are usually invisible to the customer (single contractual delivery, internal batching). Customer-visible split delivery exists but reuses the same data model.
- **DOM-AC-004** Resources (paper lot, BAT signature, plate/forme) are PARENT-LEVEL units. All acomptes share. One BAT clearance unlocks every child.
- **DOM-AC-005** Each acompte holds its OWN distinct deadline. This is the raison d'être of splitting — collapse them to the parent deadline and the feature loses its point.
- **DOM-AC-006** No precedence between acomptes at the engine level. Acomptes advance in parallel naturally; the operator interleaves work across them.
- **DOM-AC-007** Setup is repeated per acompte at the data layer (`setupMinutes` carried whole into each fan-out `TaskInput`). The engine's existing `InheritedSetup` mechanism collapses repeats when contiguous on the same station — no acompte-specific code path.

### Data model

- **DATA-AC-001** New entity `Acompte` (not a subtype of `Job`):
  - `id: GUID`
  - `parent_job_id: GUID NOT NULL` (FK to `jobs`, `ON DELETE CASCADE` to align with the existing `elements`/`tasks` convention and let scenario forks work without surgery; "no accidental delete" is enforced at the `AcompteService` layer instead)
  - `position_index: int NOT NULL` (1, 2, 3 — drives FIFO cascade order)
  - `quantity_share: int NOT NULL` (number of copies)
  - `deadline: timestamp NOT NULL` (per-acompte delivery date)
  - `created_at`, `created_by`
- **DATA-AC-002** Parent Job retains all current fields and child entities (Element, Task, JCF reference, wall-layer linkage). Tasks live on the parent — children do not duplicate them.
- **DATA-AC-003** New audit table `acompte_progress_declaration`:
  - `id`
  - `parent_job_id: GUID NOT NULL` (ManyToOne to Job, `ON DELETE CASCADE`)
  - `logical_task_id: GUID NOT NULL` (stable cross-scenario, same keying as TaskWall)
  - `declared_total_copies_done: int NOT NULL` (in exemplaires, not minutes — matches operator mental model)
  - `declared_at: timestamp NOT NULL`
  - `declared_by: GUID NULL`
  - Unique on `(parent_job_id, logical_task_id)`; a new saisie updates the row.
  - Rationale: declarations are per **task** (G37/P137/Duplo are independent stages with independent declarations), not per element — even within a single logical element.
- **DATA-AC-004** Per-acompte per-task progress is **derived on read** via `cascadeFifo()`. Zero denormalised storage at task level.
- **DATA-AC-005** Invariants enforced by `AcompteService`:
  - `sum(acomptes.quantity_share) == parent.totalQuantity`
  - Job has no `parent_job_id` (Jobs are never recursive).
  - `>= 2` acomptes per parent (single-acompte is just a normal Job).
  - `deadline` per acompte is mandatory and explicit (no implicit fallback to parent deadline).
  - Position indices are dense `[1..N]`.
- **DATA-AC-006** Multi-element + acomptes is **allowed from V1** (decision 2026-05-23, reversing the initial single-element invariant). Real long jobs (booklets, brochures) are multi-element; restricting would make the feature inapplicable to the bulk of acompte candidates. The progress cascade lives at the **task** level (one `cascadeFifo` per `element.task`), so a multi-element job simply renders element groups, each with its task rows. `FluxTable` resolves the "two axes" worry by making the acompte the sub-row and rendering elements as multiple tiles *within* it — no double chevron, no element-expand-inside-acompte-expand.
- **DATA-AC-007** Scenario-fork: add `acomptes` and `acompte_progress_declaration` to `ScenarioForkService::SCOPED_TABLES` with `parent_job_id → jobs` remap. Never store the parent FK inside a JSON column (see memory `feedback_no_uuid_in_json`).

### Engine integration

- **ENG-AC-001** Engine receives no new fields and no new rules. PHP fans out at snapshot-build time. For each `(acompte × parent.task)`, synthesise one `TaskInput`:
  - `setupMinutes` = `parent.task.setupMinutes` (full; repeated for each acompte)
  - `runMinutes` = `parent.task.runMinutes × (acompte.quantity_share / parent.totalQuantity)`
  - `deadline` = `acompte.deadline` (not parent's)
  - `recordedProgressPct` = derived from `cascadeFifo()`
  - `jobId` = synthetic identifier `{parent.id}#{acompte.id}`
  - `requiredJobIds` = empty between siblings (acomptes are not chained); preserved for any cross-job precedence inherited from the parent.
- **ENG-AC-002** `isCompleted` computed on the PHP side before snapshot. Acomptes saturated to 100 % via cascade are dropped from the snapshot — they must not pollute `pre_place` with zero-duration emits.
- **ENG-AC-003** `InheritedSetup` propagated PHP-side between physically-contiguous acomptes (same station, no foreign setup in between). PHP populates the `inheritedSetup` field on the second-and-later acomptes; engine collapses setup to 0 via its existing path.
- **ENG-AC-004** Score impact: snapshot grows ~N× per acompte-parent. **Soak test mandatory** before any UI ships: target ≥ 4 000–6 000 actions stable, latency ≤ 1.5× current baseline. Profiling gate in P0.
- **ENG-AC-005** Lateness counts per synthetic acompte job. UI re-aggregates for display.

### UX direction

- **UX-AC-001** `FluxTable`: acomptes render as **flat top-level rows**, identical in shape and styling to any other job row — no parent row, no sub-row hierarchy, no chip, no special marker. Linkage to the logical dossier is conveyed by exactly two text-level conventions: composed ID `parent.N` (point separator: `12347.1`, `12347.2`, `12347.3`) and designation suffix `(acompte N/total)` mirroring the existing `(2)` multi-element convention. The end-of-row icons (open job, suppr) operate as for any job; on an acompte, "open" opens `JcfModal` on the parent dossier, "suppr" deletes this acompte. Multi-element tile rendering inside acompte rows reuses the existing FluxTable conventions unchanged. Rationale: at the engine + data level, acomptes ARE synthetic jobs; rendering them as ordinary rows means zero `FluxTable` surgery beyond the ID/designation strings.
- **UX-AC-002** Tiles: `1/3` badge top-right (9 px, neutral). **No connector line between siblings** (would falsely imply precedence).
- **UX-AC-003** Acomptes do **not** get a standalone modal. Instead, a new **tab inside `JcfModal`** named "Acomptes & avancement" merges acompte *creation*, *deadline edition* and *progress reporting* into a single surface, alongside the existing "Dossier" tab. Rationale: the découpage is a *dimension of the dossier* (like paper, BAT, forme, total quantity), not a separate operation. Keeping it inside `JcfModal` respects the principle "one entity = one place to edit it". Tab content: dossier-level total reference (read-only, edited in Dossier tab) → editable acomptes (add/remove, quantity, distinct date+time deadline, live sum validator) → per-element progress with copies-first numerical input + live FIFO cascade as mini-segments (width ∝ quantity_share). Vocabulary is **exemplaires** (copies), not feuilles. Distinct from the per-tile `ProgressCaptureModal` which remains the operator's end-of-shift capture surface.
- **UX-AC-004** No per-acompte override of the cascade in V1. The cascade IS the model.
- **UX-AC-005** Entry point = the existing **JCF icon at end of Flux row** opens `JcfModal`; tab "Acomptes & avancement" is the surface for splitting + saisie. The empty state (job has no acomptes yet) shows a "[+ Découper en acomptes]" CTA. Single save = canonical JCF fields + acompte definition + progress seed + replan, atomically. No new bottom-of-row affordance; the existing 2-icon convention (suppr + JCF) is preserved.
- **UX-AC-006** JobDetailsPanel for an acompte sub-row shows the parent's task list in read-only mode and exposes only acompte-specific fields (deadline, quantity_share, derived progress).
- **UX-AC-007** Worst-child rollup is **dropped** along with the parent row. Each acompte row carries its own status independently (red border if late, etc.); no aggregate to surface because the aggregate has no row.
- **UX-AC-008** Playgrounds are mandatory before any React work:
  - `playground-parent-progress-saturation.html` (priority 1 — the unified create+report modal; chaos UX is won or lost here) ✅ built
  - `playground-flux-acompte-rows.html` (sub-folder rendering in FluxTable)

---

## Phasing

### P0 — Data foundations

- [x] Doctrine migration: `acomptes` table + `acompte_progress_declaration` table, with FK constraints (Version20260523180000).
- [x] `Acompte` Doctrine entity + `AcompteRepository` (scenario-scoped via `ScenarioScopedTrait`).
- [x] `AcompteProgressDeclaration` entity + repository (parent + logical_task keyed, copies-based storage).
- [x] `Job` entity gains `acomptes: Collection<Acompte>` (OneToMany, cascade=persist+remove, ordered by positionIndex).
- [x] `AcompteService`: `create()`, `replace()` (atomic swap in transaction), `deleteAll()` (un-split), `validateInvariants()`, `recomputeIfTotalChanged()` (proportional reallocation, last absorbs remainder). 23 unit tests / 53 assertions, mock-based.
- [x] `AcompteProgressCascadeService::cascadeFifo(declaration, parent.tasks, acomptes)` pure function + PHPUnit (10 tests, 58 assertions — brainstorm example G37 80% / P137 50% / Duplo 30% exact + edge cases).
- [x] `AcompteSnapshotFanOutService::expand()` — fan-out parent snapshot payload into N synthetic JobInputs (id `parent#acompte`, per-acompte deadline, scaled runMinutes, synthesized task ids for response disambiguation). 9 unit tests / 22 assertions.
- [x] `ScheduleComputeController::buildJobs` wires the fan-out service.
- [x] `ScenarioForkService::SCOPED_TABLES` extended with `acomptes` + `acompte_progress_declaration` (both remapping `parent_job_id → jobs`).
- [x] Cross-job precedence guard: `AcompteService::create()` refuses to split a job that other jobs reference via `requiredJobIds` (V1 conservative fence; V1.1 will remap to the latest synthetic acompte instead of refusing).
- [ ] **Deferred (P0.4 follow-ups)**: cascade integration (recordedProgressPct from declarations — awaiting saisie write endpoint), response handler (split synthetic taskId on `#` before persisting assignments), V1.1 requiredJobIds remap (lift the guard), soak test 4 000–6 000 actions.
- [ ] `ScheduleComputeController::buildJobs` fan-out per (acompte × task).
- [ ] `isCompleted=true` for 100 %-saturated acomptes, dropped from snapshot.
- [ ] `InheritedSetup` propagation between contiguous acomptes.
- [ ] `ScenarioForkService::SCOPED_TABLES` extension; round-trip test.
- [ ] **Soak test**: 50 parents × 2–3 acomptes ≈ 4 000–6 000 actions. Decision gate.

### P1 — JcfModal "Acomptes & avancement" tab (create + report)

- [x] `playground-parent-progress-saturation.html` — JcfModal with 2 tabs (Dossier + Acomptes & avancement). Tab content = total-job ref read-only, editable acomptes (add/remove, quantity, deadline, sum validator), per-element copies-first progress with live FIFO cascade, cross-machine ordering warnings, fan-out debug panel. Empty state on the Acomptes tab when the job has no acomptes yet (CTA "+ Découper en acomptes").
- [ ] Extend `JcfModal` with the new "Acomptes & avancement" tab. Tab badge displays acompte count. Tab is always present; empty state surfaces the CTA when no acomptes yet.
- [ ] Entry point: existing JCF icon at end of Flux row (no new affordance). Both creation and saisie reuse this single entry.
- [ ] Multi-element supported: cascade computed per `element.task`; cross-machine ordering warning scoped within each element's task chain.
- [ ] Wiring: single save → `AcompteService::createAndSeed()` (create acomptes + write `acompte_progress_declaration`) → existing auto-recompute middleware fires replan.

### P2 — FluxTable flat rows for acomptes

- No dedicated playground. Decision verrouillée 2026-05-23 (Julien): rows are ordinary FluxTable rows, no visual reinvention. Conventions: composed ID `parent.N` (point separator), designation suffix `(acompte N/total)`.
- [ ] `FluxTable` rendering: synthetic acompte jobs surface as independent rows. ID column shows `12347.1`. Designation column appends `(acompte 1/3)`. Suppression operates on the acompte; "open job" opens `JcfModal` on `parent_job_id`.

### P3 — Tiles + JDP polish

- [ ] `1/3` badge on `Tile`.
- [ ] `JobDetailsPanel` acompte view: parent task list read-only + acompte-specific editable fields.

### Deferred to V1.1+

- [ ] Per-acompte override of cascade (if real-world demand surfaces).
- [ ] Mid-flight split via context menu on a planned job.
- [ ] Force re-calage toggle (if `InheritedSetup` edge cases create surprise).
- [ ] Multi-element + acomptes coexistence.

---

## Open risks

| Risk | Mitigation |
|------|-----------|
| Snapshot performance with 3 000–6 000 actions | Mandatory soak test in P0 before any UI work begins. |
| Operator mental model on saturation cascade | Playground validation by Julien (and ideally a real operator) before React code. |
| Quantity change on parent → cascade must replay | Single recompute path in `AcompteService::recomputeIfTotalChanged()` called by every quantity write. |
| Scenario fork remaps Acompte (new entity) | Explicit round-trip test in P0 covering fork → mutate → unfork. |
| Customer-visible split-delivery vs internal batching ambiguity | Default = internal; UI never surfaces "split delivery" terminology unless the user explicitly tags it. |
| Wall-layer keying with shared `logicalElementId` across one parent and its children | Confirm `ElementWall` is keyed by `logicalElementId` and parent's element is the seed; acomptes inherit no Element rows of their own (parent owns them). |

---

## Out of V1 (explicit non-goals)

- **Per-task per-acompte deadlines** — single deadline per acompte.
- **Operator-initiated split** — shop manager only.
- **3-level hierarchy** — flat parent-children only.
- **Custom acompte naming** — `1/N` numbering is canonical.
- **Cross-acompte cost/margin analytics** — belongs in commercial tooling, not scheduling.

---

## Files expected to be touched

PHP API:
- `services/php-api/src/Entity/Job.php` (add `acomptes` OneToMany)
- `services/php-api/src/Entity/Acompte.php` (new)
- `services/php-api/src/Entity/AcompteProgressDeclaration.php` (new)
- `services/php-api/src/Repository/AcompteRepository.php` (new)
- `services/php-api/src/Service/AcompteService.php` (new)
- `services/php-api/src/Service/AcompteProgressCascadeService.php` (new — `cascadeFifo`)
- `services/php-api/src/Controller/ScheduleComputeController.php` (fan-out in `buildJobs`)
- `services/php-api/src/Service/ScenarioForkService.php` (`SCOPED_TABLES` extension)

TypeScript types:
- `packages/types/src/acompte.ts` (new)
- `packages/types/src/job.ts` (add `acomptes` field)

Frontend:
- `apps/web/src/components/JcfModal/` (Acomptes section)
- `apps/web/src/components/FluxTable/` (sub-row grouping + worst-child rollup)
- `apps/web/src/components/ParentProgressCaptureModal/` (new)
- `apps/web/src/components/Tile/Tile.tsx` (`1/3` badge)
- `apps/web/src/components/JobDetailsPanel/` (acompte read-only view)

Engine:
- No changes expected. Soak test only.

---

## Definition of Done (V1)

- [ ] All P0/P1/P2/P3 items completed.
- [ ] Soak test passes within 1.5× baseline latency at 4 000–6 000 actions.
- [ ] Three playgrounds validated visually by Julien.
- [ ] PHPStan level 8 clean on all new PHP code.
- [ ] PHPUnit covers `AcompteService`, `cascadeFifo`, and all listed invariants.
- [ ] Manual QA: create parent + 3 acomptes via `JcfModal`; saisir progress at parent level; verify cascade in planning view, tiles, sub-folder rows.
- [ ] Manual QA: scenario fork creates correctly-linked acomptes; mutations stay scoped.
