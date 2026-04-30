# Versioning System — V1 Implementation Plan

**Date:** 2026-04-29
**Status:** V1 minimal (Préprod + Prod only). Sim and Archive deferred to v1.x.
**Source design:** [`intuitions-versioning.md`](./intuitions-versioning.md)
**Playground (validated):** [`playgrounds/versioning-ui.html`](./playgrounds/versioning-ui.html)

---

## 1. V1 scope

V1 introduces only what the chef d'atelier and the operators need to run the *préprod-then-promote* loop:

- **Préprod** — the live planning workspace. Same behaviour as today. Every write goes here: planner edits, operator completion feedback (via dual-write from prod), unforeseen delays, BAT updates.
- **Prod** — a frozen JSON snapshot of the plan as it was promoted, plus a small live completion overlay. Read-only at the data layer except for the completion overlay. The operators consult prod (or a Focus view derived from prod) and report completion ticks.
- **Promotion ritual** — manual, by the chef, several times per day. Confirmation modal with a 2-tile KPI (jobs planifiés delta, jobs en retard delta) + diff list + 1.2 s dwell-to-confirm. 5-minute undo via a `previous_payload` column on the prod scenario row.

V1 does NOT ship:
- **Simulation** — deferred. No `type='simulation'` scenarios, no TTL, no new-tab flow, no convertir-en-JCF, no `BroadcastChannel`, no capacity overrides, no violet chrome.
- **Archive browser** — deferred. The 5-min undo is enough safety net for v1; older snapshots are not exposed in UI.
- **Per-entity `scenario_id` columns on Job/Task/Element/Schedule** — deferred. In v1 there is exactly one source of live planning data (préprod), no need to discriminate. v1.x sim adds the column when needed.

## 2. The model

### 2.1 The `scenarios` table

A new table holds the two scenario rows (one prod, one préprod per company) and the prod's payload:

```sql
CREATE TABLE scenarios (
  id                        CHAR(36)     PRIMARY KEY,
  company_id                CHAR(36)     NOT NULL,
  type                      VARCHAR(16)  NOT NULL,
    -- 'prod' | 'preprod'   (sim/archive deferred)
  payload                   LONGTEXT     NULL,
    -- JSON-encoded plan blob. NULL for preprod (live), set for prod.
  previous_payload          LONGTEXT     NULL,
    -- Last prod blob, kept for the undo window. NULL when no undo available.
  undo_expires_at           DATETIME     NULL,
    -- 5 min after promotion. NULL once the window has elapsed.
  promoted_at               DATETIME     NULL,
  promoted_by_user_id       CHAR(36)     NULL,
  engine_version            VARCHAR(32)  NULL,
  created_at                DATETIME     NOT NULL,
  updated_at                DATETIME     NOT NULL,
  CONSTRAINT scenarios_type_chk CHECK (type IN ('prod','preprod')),
  CONSTRAINT uq_scenario_company_type UNIQUE (company_id, type)
);
```

The unique constraint enforces "one prod and one préprod per company" without partial indexes (MariaDB doesn't support those). When v1.x re-introduces sim/archive, this constraint is dropped and replaced.

### 2.2 The `prod_completion_overlay` table

Captures live operator completion ticks against the running prod. Reset at each promotion (the new payload absorbs them).

```sql
CREATE TABLE prod_completion_overlay (
  prod_scenario_id     CHAR(36)  NOT NULL,
  task_id              CHAR(36)  NOT NULL,
  is_completed         TINYINT(1) NOT NULL DEFAULT 0,
  completed_at         DATETIME  NULL,
  completed_by_user_id CHAR(36)  NULL,
  created_at           DATETIME  NOT NULL,
  updated_at           DATETIME  NOT NULL,
  PRIMARY KEY (prod_scenario_id, task_id),
  CONSTRAINT fk_pco_scenario FOREIGN KEY (prod_scenario_id)
    REFERENCES scenarios(id) ON DELETE CASCADE
);
```

Reading prod = deserialize `scenarios.payload` then merge `prod_completion_overlay` rows by task_id. The blob is immutable until next promotion; the overlay is the live update channel.

### 2.3 What does NOT change

Job, Element, Task, Schedule, Operator, Station, etc. — schema unchanged. All planning data continues to live in those tables, implicitly representing the préprod state. No `scenario_id` column added in v1.

### 2.4 Promotion mechanics

```
T1. POST /api/v1/scenarios/promote
T2. Service:
    a. Compute current préprod plan blob (using SnapshotBuilder serialised to JSON)
    b. Read current prod row
    c. UPDATE scenarios SET
         previous_payload = payload,
         payload          = :new_blob,
         promoted_at      = NOW(),
         undo_expires_at  = NOW() + INTERVAL 5 MINUTE,
         promoted_by_user_id = :current_user
       WHERE company_id = :c AND type = 'prod'
    d. DELETE FROM prod_completion_overlay WHERE prod_scenario_id = :prod_id
       (the previous overlay is now embedded in the previous_payload's plan)
    e. Dispatch PromotionUndoExpireMessage with delay = 5 min
T3. Return new scenario state + diff summary
```

Undo within 5 min: swap `payload` ← `previous_payload`, clear undo. After 5 min the handler sets `previous_payload = NULL` and `undo_expires_at = NULL`.

### 2.5 Dual-write completion (prod → préprod)

Operator clicks "marquer terminé" on a prod-view tile:

```
POST /api/v1/scenarios/prod/completion/{taskId}
Service:
  1. UPSERT prod_completion_overlay (prod_scenario_id, task_id) SET is_completed=true, completed_at=NOW()
  2. CALL Schedule::toggleTaskCompletion(taskId) on préprod's Schedule (existing path)
  3. Dispatch domain event for Mercure broadcast
```

Both tables now reflect completion. Préprod's chef sees the completion in its planning view. Prod's view shows the overlay merged with the blob.

### 2.6 Engine integration

**No engine changes in v1.** The engine is stateless and only computes against préprod's live data (the existing `/compute*` endpoints). Prod is frozen, so it doesn't need compute.

## 3. UX (validated via playground)

- Mini-header `h-9` local to OperatorSchedulePage and (later) the stations view, NOT in the global Sidebar.
- Préprod | Prod segmented toggle (left), pending-changes hint (amber dot + "changements non promus") in préprod when there are unpromoted edits, "plan engagé · seul l'avancement est éditable" label in prod.
- Promouvoir CTA on the right (preprod only, disabled when nothing to promote). Shortcut `Alt+Shift+P`.
- Top hairline 2 px zinc-300/70 in prod, none in préprod (silence = default).
- Promotion modal: KPI strip = 2 tuiles (`Jobs planifiés` + delta, `Jobs en retard` + delta), diff list grouped by job (top 5 expanded), dwell-to-confirm 1.2 s, undo toast 5-min countdown.
- Tile in prod: pin and snowflake hidden via `.env-readonly` CSS class. Completion icon (lucide `circle` / `check-circle-2`) is the leftmost icon in EVERY tile in BOTH envs; in préprod it's a frozen mirror (cursor default, click no-op), in prod it's interactive (cursor pointer, hover scale, dual-write).
- Sync toast (blue, top-right) when the operator clicks completion in prod: "JOB-X marqué terminé · prod → préprod".

## 4. Phases

### Phase 1 — Scenario entity, table, bootstrap

**Goal.** Create the `scenarios` and `prod_completion_overlay` tables, seed one `prod` + one `preprod` row per company. No behaviour change for existing code.

**Files.**

| File | Action |
|---|---|
| `services/php-api/src/Entity/Scenario.php` | add — Doctrine entity |
| `services/php-api/src/Entity/ScenarioType.php` | add — PHP 8.3 backed string enum (`prod`, `preprod`) |
| `services/php-api/src/Entity/ProdCompletionOverlay.php` | add — Doctrine entity |
| `services/php-api/src/Repository/ScenarioRepository.php` | add — `findOneByType(ScenarioType)`, `findProd()`, `findPreprod()` |
| `services/php-api/src/Repository/ProdCompletionOverlayRepository.php` | add — `findByProdScenarioId(string)`, `upsert(...)` |
| `services/php-api/migrations/Version20260430000000.php` | add — create both tables |
| `services/php-api/src/Command/BootstrapScenariosCommand.php` | add — `flux:scenarios:bootstrap` |
| `services/php-api/tests/Util/ScenarioFixture.php` | add — helper for tests |
| `services/php-api/tests/Integration/ScenarioBootstrapTest.php` | add |
| `services/php-api/tests/Integration/Repository/ScenarioRepositoryTest.php` | add |

**Verification.**
- `bin/console doctrine:schema:validate` clean.
- `bin/console flux:scenarios:bootstrap` creates exactly 2 rows; second run is no-op.
- PHPStan level 8 clean (zero new baseline entries).
- PHPUnit green.

### Phase 2 — Promotion flow

**Goal.** A chef can `POST /api/v1/scenarios/promote`, get a diff, dwell-confirm, and undo within 5 min.

**Files.**

| File | Action |
|---|---|
| `services/php-api/src/Service/PromotionService.php` | add — orchestrates serialise + write + undo timer dispatch |
| `services/php-api/src/Service/PromotionDiffService.php` | add — counts `Jobs planifiés` and `Jobs en retard` in préprod vs current prod blob |
| `services/php-api/src/Controller/Api/V1/PromotionController.php` | add — `GET /preview`, `POST /promote`, `POST /undo` |
| `services/php-api/src/Message/PromotionUndoExpireMessage.php` | add |
| `services/php-api/src/MessageHandler/PromotionUndoExpireHandler.php` | add — clears `previous_payload` + `undo_expires_at` |
| `services/php-api/src/DTO/Promotion/PromotionPreviewResponse.php` | add |
| `services/php-api/src/DTO/Promotion/PromotionResultResponse.php` | add |
| `services/php-api/tests/Integration/Controller/PromotionControllerTest.php` | add |
| `services/php-api/tests/Integration/Service/PromotionServiceTest.php` | add |
| `services/php-api/tests/Unit/Service/PromotionDiffServiceTest.php` | add |

**Verification.**
- Promote → blob populated, previous_payload populated, undo_expires_at set 5 min ahead.
- Undo within 5 min → blob swapped back; another undo within window → 410 Gone.
- After 5 min the message handler clears undo; subsequent undo → 410.
- Diff service returns expected counts under fixture data.

### Phase 3 — Prod read & dual-write completion

**Goal.** Operator clicks completion on prod tile → updates both prod overlay and préprod's Schedule.

**Files.**

| File | Action |
|---|---|
| `services/php-api/src/Service/ProdSnapshotService.php` | add — deserialise `prod.payload` + merge overlay → ScheduleSnapshot |
| `services/php-api/src/Service/CompletionOverlayService.php` | add — dual-write |
| `services/php-api/src/Controller/Api/V1/ProdSnapshotController.php` | add — `GET /api/v1/scenarios/prod/snapshot` |
| `services/php-api/src/Controller/Api/V1/ProdCompletionController.php` | add — `POST /api/v1/scenarios/prod/completion/{taskId}` |
| `services/php-api/tests/Integration/Service/CompletionOverlayServiceTest.php` | add |
| `services/php-api/tests/Integration/Controller/ProdCompletionControllerTest.php` | add |
| `services/php-api/tests/Integration/Service/ProdSnapshotServiceTest.php` | add |

**Verification.**
- After promotion + completion click on prod → both `prod_completion_overlay` and `Schedule.assignments[taskId].isCompleted` reflect true.
- Unmark works the same way.
- Completing a task that doesn't exist in préprod (impossible in normal flow but test edge) → 404 from préprod side, overlay still updates? Or rollback both. Decide: rollback both via transaction.

### Phase 4 — Frontend

**Goal.** Add the env toggle, prod read-only mode, promotion modal, undo toast, completion icon on tiles.

**Files.**

| File | Action |
|---|---|
| `apps/web/src/contexts/ScenarioContext.tsx` | add — `'preprod' | 'prod'` state, persisted in URL via `?env=` query param |
| `apps/web/src/hooks/useScenarioMode.ts` | add — `{ mode, setMode, isReadOnly }` |
| `apps/web/src/components/ScenarioToggle/ScenarioToggle.tsx` | add — segmented pill |
| `apps/web/src/components/ScenarioRibbon/ScenarioRibbon.tsx` | add — top hairline |
| `apps/web/src/components/PlanningEnvHeader/PlanningEnvHeader.tsx` | add — the h-9 mini-header |
| `apps/web/src/components/PromotionModal/PromotionModal.tsx` | add |
| `apps/web/src/components/PromotionModal/PromotionDwellButton.tsx` | add |
| `apps/web/src/components/PromotionUndoToast/PromotionUndoToast.tsx` | add |
| `apps/web/src/components/SyncToast/SyncToast.tsx` | add — completion dual-write feedback |
| `apps/web/src/store/api/promotionApi.ts` | add — RTK endpoints `getPromotionPreview`, `promote`, `undo` |
| `apps/web/src/store/api/prodCompletionApi.ts` | add — RTK endpoint `toggleProdCompletion` |
| `apps/web/src/pages/OperatorSchedulePage.tsx` | modify — mount PlanningEnvHeader; in prod mode, fetch `/scenarios/prod/snapshot`; `isReadOnly` gates pin/drag/recompute |
| `apps/web/src/components/Tile/Tile.tsx` | modify — add completion icon as leftmost element; freeze in préprod / interactive in prod |
| `apps/web/src/components/RootLayout.tsx` | modify — mount ScenarioRibbon + ScenarioContextProvider |
| `apps/web/src/routes.tsx` | modify — `/?env=prod` reads ScenarioContext from URL |

**Verification.**
- Vitest for ScenarioContext, ScenarioToggle, PromotionDwellButton, PromotionUndoToast.
- Manual: dev server, navigate, switch env via the toggle and via Alt+E, click promote, see modal, dwell, see undo toast, click completion in prod, see sync toast.
- (Optional) Playwright smoke test if reachable.

## 5. Cross-cutting

- **PHPStan level 8 mandatory** — no new baseline entries.
- **PHPUnit mandatory** — every new service has a test.
- **Real DB only** — tests run against the dockerised MariaDB.
- **Submodule discipline** — `services/php-api` commits land in the submodule first, then the monorepo bumps the SHA.
- **Lucide-react** — every icon in the frontend uses lucide. No custom SVGs except the existing snowflake (kept as-is from `Tile.tsx`).
- **Three-builders rule (memory)** — N/A in v1 because we don't add fields to Operator/Job/etc.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Breaking existing endpoints | Phase 1-3 are purely additive (new tables, new controllers, new services). Existing API surface unchanged. Frontend defaults to préprod = today's behaviour. |
| Promotion fails partway | All multi-step writes wrapped in Doctrine transactions. PromotionUndoExpireHandler is idempotent. |
| Operator marks completion on a task not in préprod | Service uses transaction; if préprod side throws, overlay rollbacks. |
| Blob payload grows large (10k tasks → ~5 MB JSON) | LONGTEXT supports up to 4 GB. Serve gzipped. |
| 5-min undo race with operator completion | Operator completion writes to overlay only. Undo restores blob but does NOT reset overlay (operator's tick survives). Review UX: when undo flips blob back, the overlay still has the new tick — that's acceptable, the tick reflects real-world execution. |

## 7. Effort estimate

- Phase 1: ~1 day
- Phase 2: ~2 days
- Phase 3: ~2 days
- Phase 4: ~3-4 days
- Tests + integration: ~1 day
- **Total v1: ~9-10 days solo, ~5-6 days with FE+BE in parallel.**

## 8. v1.x and v2 — what's left from the original design

V1 has shipped phases 1, 2, 4, 5 of the original `intuitions-versioning.md` §1.8 list (data model, scenario-aware API, promotion flow, read-only prod view) plus a partial phase 3 (completion sync via dual-write). Five things from the original design remain. They're sequenced below by user-visible value, with concrete phase plans, file lists, dependencies, and verification steps.

### Phase 5 — Reservoir → Préprod sync worker (v1.x)

**Goal.** When a job becomes planifiable (BAT received, deadline set, ADV validated), it's added to préprod automatically without manual intervention. Today the JCF flow already creates jobs in the live planning data; this phase wires the *transition* event so future workflows (Mercure broadcasts, Slack notifications, KPI dashboards) hook into a single domain event.

**Backend files**
| File | Action |
|---|---|
| `services/php-api/src/Event/Job/JobBecamePlannable.php` | add — domain event dispatched when a job's prerequisites flip to ready |
| `services/php-api/src/MessageHandler/JobWorkshopExitDateAutoFiller.php` | modify — emit JobBecamePlannable on the transition |
| `services/php-api/src/Message/PushJobToPreprodMessage.php` | add — Symfony Messenger message |
| `services/php-api/src/MessageHandler/PushJobToPreprodHandler.php` | add — idempotent upsert; today this is mostly a no-op because the JCF flow already writes the job, but the handler is the single hook for future enrichment (default planning fields, priority computation, Slack notification) |
| `services/php-api/src/Service/ScenarioCloneService.php` | add — reusable deep-clone, used by Phase 6 (simulation) too |

**Frontend**
| File | Action |
|---|---|
| `apps/web/src/hooks/useMercureSubscription.ts` | modify — listen to `reservoir-pushed` topic, surface a "+1 nouveau job ajouté" toast in préprod |

**Tests**
- `tests/Integration/MessageHandler/PushJobToPreprodHandlerTest.php` — dispatching message with same job twice keeps a single row.
- `tests/Integration/Event/JobBecamePlannableTest.php` — emits exactly once when the gate flips.

**Verification**
- BAT validation in JCF triggers the event; Mercure topic publishes; UI toast appears in real time.
- Double-event firing (race) doesn't duplicate the job in préprod.

**Effort.** ~1 day. Smallest piece, but unblocks the cleaner sync architecture for v1.x.

---

### Phase 6 — Simulation (v1.x)

**Goal.** ADV (sales assistant) takes a phone call, clicks "Simuler la faisabilité" from the JCF modal, a new browser tab opens with a forked scenario containing the prospective job. Mutating tasks in the bubble doesn't affect préprod. When the ADV decides "yes, fits", they click "Convertir en JCF" and the job materialises in the real flow.

**Schema migration**
```sql
ALTER TABLE scenarios
  ADD COLUMN parent_scenario_id CHAR(36) NULL REFERENCES scenarios(id) ON DELETE SET NULL,
  ADD COLUMN ttl_expires_at DATETIME NULL,
  ADD COLUMN last_touched_at DATETIME NULL,
  ADD COLUMN parent_version_at_fork INTEGER NULL,
  DROP INDEX uq_scenario_type,
  ADD UNIQUE INDEX uq_scenario_company_type_active (company_id, type) WHERE status = 'active';
```

(MariaDB doesn't have partial unique indexes — emulate via a generated column or trigger.)

**Per-entity scoping decision (the open question from the v1 model)**

V1 sidesteps the question because there's only one `preprod` row and the prod is a frozen blob. Sim breaks the assumption — jobs/tasks/elements/schedules forked into the sim must be *isolated* from préprod's live data. Two approaches:

**Option A — Add `scenario_id` to Job/Task/Element/Schedule.** A copy of every preprod row is duplicated under sim's id; queries must always filter by `scenario_id`. Doctrine SQL filter handles this transparently. Cost: every existing query loses its implicit "show me all jobs" semantic — must be `findByScenario($scenarioId)`. Massive surface to retrofit.

**Option B — Keep préprod's planning data untagged; sim stores its delta as a JSON blob (like prod).** Reads are merge: "all preprod rows + sim's blob overlay". Writes go to the blob. No DB schema disruption, no Doctrine filter needed. Trade-off: sim can't be queried via existing repos — every UI hook needs a "snapshot from blob+overlay" path.

**Recommendation: B.** Mirrors the V1 prod-as-blob pattern, keeps the architecture coherent, avoids the multi-day Doctrine refactor of A. The cost is a bit of duplication in `ProdSnapshotService` / `SimSnapshotService` (both deserialise a blob and merge), which can be factored into a shared `BlobSnapshotService` helper.

**Backend files**
| File | Action |
|---|---|
| `services/php-api/src/Controller/Api/V1/SimulationController.php` | add — POST `/scenarios/simulations`, DELETE `/:id`, POST `/:id/touch` |
| `services/php-api/src/Service/SimulationService.php` | add — clones préprod via `ScenarioCloneService`, sets `ttl_expires_at = now() + 15 min`, stamps `parent_version_at_fork` |
| `services/php-api/src/Service/SimSnapshotService.php` | add — read merged snapshot for a sim id (preprod base + sim blob overlay) |
| `services/php-api/src/Service/ScenarioMutationService.php` | add — sim-side write API: edits to jobs/tasks/assignments inside the sim go here, written to the sim's blob |
| `services/php-api/src/Command/ReapExpiredScenariosCommand.php` | add — `flux:scenarios:reap`; soft-delete sim rows where `(ttl_expires_at < now AND last_touched_at + 30 min < now)` |
| `services/php-api/config/cron/scenario-reaper.cron` | add — runs every 5 min |
| `services/php-api/src/EventSubscriber/ScenarioContextListener.php` | modify — bump `last_touched_at` on every authenticated read against a sim |
| `services/php-api/src/EventSubscriber/ProdReadOnlyGuardSubscriber.php` | modify — extend allow-list to sim-write routes when `X-Flux-Scenario` is the sim's id |

**Frontend files**
| File | Action |
|---|---|
| `apps/web/src/components/SimulationLauncher/SimulationLauncher.tsx` | add — "Simuler la faisabilité" button mounted in JCF modal + JobDetailsPanel |
| `apps/web/src/hooks/useOpenSimulation.ts` | add — calls API, opens new tab with the sim's `?env=sim&simId=…` |
| `apps/web/src/components/SimulationToolbar/SimulationToolbar.tsx` | add — TTL chip, "Convertir en JCF" button |
| `apps/web/src/components/SimulationToolbar/SimulationConvertButton.tsx` | add — `BroadcastChannel.postMessage('sim:convert', ...)` |
| `apps/web/src/contexts/JcfBroadcastListener.tsx` | add — original tab listens for `sim:convert`, opens JCF modal pre-filled |
| `apps/web/src/contexts/ScenarioContext.tsx` | modify — extend `ScenarioMode` to include `simulation` |
| `apps/web/src/components/EnvFloatingControls/EnvFloatingControls.tsx` | modify — when mode is sim, show a violet pill + TTL chip in the cluster |
| `apps/web/src/store/api/simulationApi.ts` | add — RTK slice for sim CRUD + sim snapshot read |
| `apps/web/src/routes.tsx` | modify — `/sim/:scenarioId/...` route prefix |
| `apps/web/src/store/api/realBaseQuery.ts` | modify — when URL has `simId`, send `X-Flux-Scenario: <simId>` (not just `prod`) |

**Tests**
- `tests/Integration/Controller/SimulationControllerTest.php` — creating a sim doesn't touch preprod's Schedule; mutating sim's blob doesn't leak.
- `tests/Integration/Command/ReapExpiredScenariosCommandTest.php` — past TTL gets reaped; sliding TTL respected (recently touched is spared).
- `tests/Integration/Service/SimSnapshotServiceTest.php` — overlay merge correctness on jobs/tasks/assignments.
- Vitest: `SimulationLauncher.test.tsx`, `SimulationConvertButton.test.tsx`, `JcfBroadcastListener.test.tsx`.
- Playwright: end-to-end ADV flow (open JCF, click Simuler, edit in new tab, click Convertir, check JCF modal in original tab is pre-filled).

**Feature flag.** `FLUX_SIMULATIONS_ENABLED=false` initially; flip after reap cron is wired and Playwright e2e is green.

**Verification checklist**
- New tab opens at `/sim/<id>/`; closing it leaves the row in DB but reaper claims it within ~15-30 min if unused.
- Mutating a tile in the sim does NOT show up in the original tab's préprod.
- "Convertir en JCF" pre-fills the JCF in the original tab and closes the sim tab.
- A sim's `parent_version_at_fork` is captured and exposed in the UI as a "stale" warning when préprod has advanced significantly.

**Effort.** ~3-4 days. Largest deferred piece by far. Most of the work is the **blob+overlay** plumbing for sim writes, which doesn't exist yet.

**Open question for product**: should the chef d'atelier be able to spawn a sim too (for "what-if overtime" analysis), or is sim ADV-only? The capacity-override hook in Phase 8 covers the chef's what-if more directly; recommend sim stays ADV-only.

---

### Phase 7 — Archive browser (v1.x)

**Goal.** Browse historic prod snapshots beyond the 5-min undo. Useful for ISO audits ("show me what we committed on day X"), and for the chef to recover from a regrettable promotion past the undo window.

**Schema migration**
```sql
-- Archives are stored as scenarios with type='archive' (one row per
-- promotion). The blob is a copy of the prod payload at the moment of
-- the promotion that displaced it. archived_from_id links back to the
-- prod row whose previous_payload became this archive.
ALTER TABLE scenarios
  ADD COLUMN archived_from_id CHAR(36) NULL REFERENCES scenarios(id) ON DELETE SET NULL,
  ADD COLUMN promoted_from_id CHAR(36) NULL REFERENCES scenarios(id) ON DELETE SET NULL,
  ADD COLUMN engine_version VARCHAR(32) NULL,    -- already in V1 schema
  ADD COLUMN algo_params_hash VARCHAR(64) NULL;  -- already in V1 schema
```

`engine_version` and `algo_params_hash` already exist in the V1 schema; this phase **uses** them rather than adding them. They're stamped at promotion time by `PromotionService` (which currently passes `null` — Phase 7 starts populating them).

**Backend files**
| File | Action |
|---|---|
| `services/php-api/src/Service/PromotionService.php` | modify — at every promotion, persist a new `archive` row with `payload = prod.previous_payload`, `archived_from_id = prod.id`, `promoted_from_id = preprod.id`, `engine_version`, `algo_params_hash`. (Today the previous_payload is just held inline on the prod row for undo and cleared after 5 min.) |
| `services/php-api/src/Controller/Api/V1/ArchiveController.php` | add — `GET /api/v1/scenarios/archives` (paginated), `GET /:id`, `POST /:id/restore` |
| `services/php-api/src/Service/ArchiveRestoreService.php` | add — clones an archive's payload into préprod (replacing préprod's current state), after archiving the **current** préprod into a new "rescue" archive so nothing is lost |
| `services/php-api/src/Repository/ScenarioRepository.php` | modify — `findArchives(?int $limit, ?\DateTimeImmutable $before)` paginated finder |
| `services/php-api/src/EventSubscriber/ProdReadOnlyGuardSubscriber.php` | modify — extend allow-list to `api_v1_scenarios_archives_restore` |

**Frontend files**
| File | Action |
|---|---|
| `apps/web/src/pages/ArchivesPage.tsx` | add — `/archives` route, paginated list view |
| `apps/web/src/components/ArchiveBrowser/ArchiveBrowser.tsx` | add — date-sorted table, columns: promoted_at, promoted_by, engine_version, jobs_planifiés, jobs_late |
| `apps/web/src/components/ArchiveBrowser/ArchiveDetail.tsx` | add — opens an archive in read-only mode (renders the SchedulingGrid backed by the archive's blob) |
| `apps/web/src/components/ArchiveBrowser/RestoreDialog.tsx` | add — dwell-confirm dialog (same friction as promotion) |
| `apps/web/src/store/api/archiveApi.ts` | add — RTK endpoints |
| `apps/web/src/routes.tsx` | modify — `/archives`, `/archives/:id` |
| `apps/web/src/components/Sidebar/Sidebar.tsx` | modify — add `History` icon entry (admin-gated) |

**Tests**
- `tests/Integration/Controller/ArchiveControllerTest.php` — pagination, RBAC, restore flow.
- `tests/Integration/Service/ArchiveRestoreServiceTest.php` — restore archives the current préprod first (no data loss).
- Vitest: `ArchiveBrowser.test.tsx`, `RestoreDialog.test.tsx`.

**Verification**
- 10 promotions produce 10 archive rows; each carries `engine_version` + `algo_params_hash`.
- Restore puts a chosen archive's content into préprod; user can review before promoting again.
- Archive browser respects RBAC (admin/chef only).

**Effort.** ~1-2 days. Mostly UI work; the schema is already in place.

---

### Phase 8 — Capacity overrides (chef's what-if) (v2)

> **Status: REVERTED 2026-04-30.** A V1 ("intent-only", with CRUD UI but no
> engine consumption) shipped in commit `08c6b80` and was removed today.
> The original use cases — overtime, station closure, vacation absences —
> are now expressed via the **operator-centric** capacity model: working
> hours, operator absences, and shop-wide closures projected as absences
> on every operator. The per-station signed-integer delta abstraction
> never matched that model, the engine never read these rows, and Sim
> scenarios (the originally-intended consumer) remain deferred. If a
> what-if affordance is needed in the future, build it on top of the
> operator-availability surface, not as a separate scoped table.
>
> See: `feedback_no_station_schedule`, `project_shop_closure_model`.

**Goal.** The chef wants to model "what if I add overtime Wednesday night" or "what if station X is closed Friday morning" without touching the live operator/station availability. Today this requires editing the master data which propagates immediately to compute.

**Schema migration**
```sql
CREATE TABLE scenario_capacity_override (
  scenario_id    CHAR(36)    NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  target_type    VARCHAR(16) NOT NULL,  -- 'station' | 'operator'
  target_id      CHAR(36)    NOT NULL,
  effective_from DATETIME    NOT NULL,
  effective_to   DATETIME    NOT NULL,
  override_type  VARCHAR(24) NOT NULL,  -- 'closure' | 'overtime' | 'absence' | 'extra_shift'
  payload        LONGTEXT    NOT NULL,
  created_at     DATETIME    NOT NULL,
  PRIMARY KEY (scenario_id, target_type, target_id, effective_from, override_type)
);
```

**Backend files**
| File | Action |
|---|---|
| `services/php-api/src/Entity/ScenarioCapacityOverride.php` | add |
| `services/php-api/src/Repository/ScenarioCapacityOverrideRepository.php` | add |
| `services/php-api/src/Service/SnapshotBuilder.php` | modify — when building snapshot for a scenario with overrides, layer them on top of operator/station availability before serialisation |
| `services/php-api/src/Controller/Api/V1/ScenarioOverrideController.php` | add — POST/DELETE `/scenarios/:id/overrides` |

**Frontend files**
| File | Action |
|---|---|
| `apps/web/src/components/CapacityOverridePanel/CapacityOverridePanel.tsx` | add — modal for the chef to add/remove an override (calendar picker + override type) |
| `apps/web/src/components/PlanningEnvHeader/`... | the FAB cluster gets an "What-if" button when in préprod (or in a chef sim, if Phase 6 is loose) |
| `apps/web/src/store/api/scenarioOverrideApi.ts` | add |

**Tests**
- `tests/Integration/Service/SnapshotBuilderCapacityOverrideTest.php` — overrides correctly layer on the operator/station availability in the engine input.
- Vitest: `CapacityOverridePanel.test.tsx`.

**Verification**
- Adding an "overtime Wednesday 18h-22h" override on a station, recomputing, sees the engine schedule extra tasks in that window.
- Removing the override returns capacity to default.
- Overrides are scoped to the scenario — a chef's preprod override doesn't bleed into ADV sims.

**Effort.** ~2 days. Thin layer on top of the snapshot builder.

**Open question for product**: this lives on **préprod** (chef's habitat) — confirm. ADV sims rarely need capacity edits; if they do, the same table works under sim's scenario id.

---

### Phase 9 — Audit & multi-tenant readiness (v2)

**Goal.** Ship the audit affordances so an ISO 9001 / 12647 reviewer can answer "what algorithm produced the plan committed on day X" without spelunking through engine binaries. Plus harden the multi-tenant assumption baked into the V1 schema.

**Backend files**
| File | Action |
|---|---|
| `services/scheduling-engine/Cargo.toml` | modify — add `version` field to the engine's response |
| `services/scheduling-engine/src/main.rs` | modify — emit `engine_version` and `algo_params_hash` (sha256 of the ComputeOptions payload) on every compute response |
| `services/php-api/src/Service/PromotionService.php` | modify — read engine response's `engine_version` + `algo_params_hash` and stamp on the prod row at promotion time |
| `services/php-api/src/Controller/Api/V1/AuditController.php` | add — `GET /api/v1/audit/promotions?from=&to=` returns chronological list with engine versions + KPIs |
| `services/php-api/src/Service/MultiTenantContext.php` | add — placeholder for v2.x multi-tenancy (resolves company_id from authenticated user; today single-company) |
| `services/php-api/src/Entity/User.php` | modify — add `company_id` column (nullable until multi-tenant ships) |

**Schema migration** — add `company_id` to `users`, backfill all existing users with the singleton company_id, then make NOT NULL. The `scenarios` table already has `company_id`.

**Frontend files**
| File | Action |
|---|---|
| `apps/web/src/pages/AuditPage.tsx` | add — admin-only page, table of promotions with `engine_version`, `algo_params_hash`, KPI deltas |
| `apps/web/src/store/api/auditApi.ts` | add |

**Tests**
- `tests/Integration/Controller/AuditControllerTest.php` — chronological filter + RBAC.
- Rust: `tests/audit_stamping_test.rs` — every compute response carries a non-empty `engine_version`.

**Verification**
- Promote → archive carries the engine version that produced the plan.
- Audit page surfaces the same data sortable by date.
- Multi-tenant readiness: a second seeded company's data is invisible to the first user (via the `MultiTenantContext` voter).

**Effort.** ~2-3 days, mostly Rust + a small new frontend page.

**Open question for product**: do we ever go multi-tenant? If never, the `company_id` columns can stay forward-compat without UI exposure (no harm). If yes, the unique-index reshape and tenant-resolution wiring deserve their own focused phase.

---

## 9. Phase dependencies & sequencing

```
Phase 5 (Reservoir → Préprod sync)
   │
   ├── Phase 6 (Simulation) ─── needs ScenarioCloneService from Phase 5
   │      │
   │      └── Phase 8 (Capacity overrides) ─── consumes sim's scenario_id
   │
   └── Phase 7 (Archive browser) ─── independent of Phase 6
          │
          └── Phase 9 (Audit) ─── reads archive rows + engine version stamps
```

- **Recommended order**: 5 → 7 → 9 → 6 → 8.
- Phase 5 is small and unblocks future Mercure/Slack hooks; ship it first.
- Phase 7 is small and gives the chef the safety net (recover from any promotion); ship before Phase 6 because it's lower risk.
- Phase 9 piggybacks Phase 7 (uses archive rows) — natural to follow.
- Phase 6 is the biggest piece; ship after Phase 7 so the archive-restore safety net is in place if a sim feature regresses.
- Phase 8 needs Phase 6's blob+overlay plumbing (or an analogous extension on préprod) — ship last.

## 10. Risks for v1.x and v2

| Risk | Phase | Mitigation |
|---|---|---|
| Sim blob diverges from préprod schema if a master-data migration lands in between | 6 | Sim's overlay only carries deltas; reads merge with current preprod base. A schema migration that adds a new column to Job propagates naturally — old sim blobs just don't have the new field, treated as null. |
| Archive table grows unboundedly | 7 | Each archive ~1 MB JSON; at 4 promotions/day → ~1.5 GB/year. Acceptable for v1.x; Phase 9.x can add a retention policy (delete archives > N years old) if storage matters. |
| Engine version stamping requires Rust release discipline | 9 | Hardcode `env!("CARGO_PKG_VERSION")` in the engine; works as long as Cargo.toml is bumped per release. Combine with `algo_params_hash` (sha256 of input options) so two computes with same engine but different params are distinguishable. |
| Capacity overrides confuse the engine when overlapping operator absences exist | 8 | Snapshot layering is **last-write-wins** on `(target_id, effective_from)` — overrides supersede master data within their window, master data resumes outside. Add an integration test that exercises overlap. |
| Multi-tenant data leak between companies | 9 | `MultiTenantContext` gate on every Doctrine repository. Custom PHPStan rule flags raw SQL accessing scoped tables without a `company_id` filter (similar to the V1 plan's deferred rule). |
| ADV sim TTL closes mid-call | 6 | Sliding TTL: every authenticated read bumps `last_touched_at`; reaper requires both `ttl_expires_at < now` AND `last_touched_at + 30 min < now`. ADV idle < 15 min keeps sim alive indefinitely. |

## 11. Total v1.x + v2 effort estimate

| Phase | Effort | Cumulative |
|---|---|---|
| 5 — Reservoir sync | 1 day | 1 day |
| 7 — Archive browser | 1-2 days | 2-3 days |
| 9 — Audit & multi-tenant | 2-3 days | 4-6 days |
| 6 — Simulation | 3-4 days | 7-10 days |
| 8 — Capacity overrides | 2 days | 9-12 days |

**Total: ~9-12 calendar days solo**, ~6-8 days with two engineers in parallel (Phase 6 splits well: backend simulation service vs frontend new-tab flow).

## 12. Open questions for product

These should be decided before each phase ships:

1. **Sim entry-point scope** (Phase 6) — only ADV from JCF, or also chef from préprod for what-if? Recommend ADV-only; chef uses Phase 8 for what-if.
2. **Sim → JCF conversion fidelity** (Phase 6) — does the sim job's chosen station/operator pre-fill in the JCF, or only the metadata (reference, client, due date)? Recommend metadata only; planning decisions are re-made in préprod.
3. **Archive retention** (Phase 7) — keep forever, or auto-purge after N years? Recommend forever for now; revisit at 6-12 months when storage data is real.
4. **Audit access** (Phase 9) — only admins, or also chef? Recommend chef-readable, admin-deletable.
5. **Multi-tenant timeline** (Phase 9) — ship the schema/wiring now or wait for a real customer? Recommend wiring now (cheap insurance), expose UI when needed.
6. **Restore vs. replay** (Phase 7) — does archive restore ALSO replay completion ticks accumulated since the archived promotion? Recommend no: restore is "go back to that exact state". If the chef wants the live completions on top, they undo→redo via the standard promotion ritual.

---

## Appendix A — Authoritative file list (v1)

**PHP API — new (~14 files)**
- `Entity/Scenario.php`, `Entity/ScenarioType.php`, `Entity/ProdCompletionOverlay.php`
- `Repository/ScenarioRepository.php`, `Repository/ProdCompletionOverlayRepository.php`
- `Service/PromotionService.php`, `Service/PromotionDiffService.php`, `Service/ProdSnapshotService.php`, `Service/CompletionOverlayService.php`
- `Controller/Api/V1/PromotionController.php`, `Controller/Api/V1/ProdSnapshotController.php`, `Controller/Api/V1/ProdCompletionController.php`
- `Message/PromotionUndoExpireMessage.php`, `MessageHandler/PromotionUndoExpireHandler.php`
- `Command/BootstrapScenariosCommand.php`
- 2 DTOs

**PHP API — migrations (1 file)**
- `migrations/Version20260430000000.php` (creates both tables)

**PHP API — modified (~0 files)** — additive only

**PHP API — tests (~7 files)**
- Bootstrap test, Repository test, PromotionService test, PromotionController test, PromotionDiff test, CompletionOverlay test, ProdSnapshot test

**Frontend — new (~9 files)**
- ScenarioContext, useScenarioMode hook, ScenarioToggle, ScenarioRibbon, PlanningEnvHeader, PromotionModal+DwellButton, PromotionUndoToast, SyncToast, promotionApi, prodCompletionApi

**Frontend — modified (~4 files)**
- OperatorSchedulePage, Tile, RootLayout, routes

**Frontend — tests**
- 4-5 vitest specs

**Total surface ≈ 35 new + 4 modified files. Compare to original ~88/114 plan: ~6× smaller.**
