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

## 8. v1.x deferred backlog (FYI)

- **Simulation** — fork préprod into a new scenario row (`type='simulation'`), TTL via `ttl_expires_at`, reaper command, BroadcastChannel for "Convertir en JCF", violet chrome variant, `scenario_id` column added to Job/Task/Element/Schedule.
- **Archive browser** — list past prod blobs (probably stored in a new `prod_history` table populated at each promotion), restore via clone-into-fresh-preprod.
- **Capacity overrides** — `scenario_capacity_override` for chef what-if (overtime, closure) and ADV simulation.
- **Audit hook** — `engine_version` + `algo_params_hash` columns are already in the v1 schema; the audit UI ships with archive browser.
- **Multi-tenant** — `company_id` column is already in v1 schema; partial unique indexes added when needed.

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
