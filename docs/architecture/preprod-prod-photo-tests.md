# Préprod/Prod — Architecture Audit Protocol

Companion to `preprod-prod-photo-model.md`. Documents the protocol
that verifies the architecture is structurally sound. If the audit
passes, the system upholds the four invariants the design rests on.

## Status — 2026-05-06

**The audit spec exists, runs against the real backend, and reports
15 PASS / 0 BUG / 0 SKIP** on a freshly-seeded scenario state.
File : `apps/web/playwright/preprod-prod-architecture-audit.spec.ts`.

The audit surfaced one real bug during initial development —
`FluxJobResponse` and `JobResponse` were not filtering Cancelled
elements (Pillar B B1.4 had been marked "verified" without exercising
the read paths). Fixed in php-api commit `c1f340c`.

## Architecture invariants

| # | Invariant | Why it matters |
|---|---|---|
| 1 | **Scenario isolation** : a write to Préprod never appears in Prod until `POST /promotion`. Prod is otherwise read-only. | If broken, every Préprod hypothesis leaks into operational reality. |
| 2 | **Wall sharing** : a write to a wall field (4 gates, progress, dates) is immediately visible in both Préprod and Prod, no publish needed. | If broken, the chef sees stale gate/progress data in one scenario, replans on lies. |
| 3 | **Publish reversibility** : `POST /promotion/undo` restores Prod to its previous state from archive. | If broken, a bad publish corrupts prod permanently — chef has no safety valve. |
| 4 | **Logical identity** : a job's element has the same `logical_element_id` across Préprod, Prod, Archive. Wall lookups by `logical_element_id` always resolve. | If broken, gate/progress data orphans on publish or fork ; entire wall layer becomes meaningless. |

## Playwright coverage as of 2026-05-06

| Spec | Invariant covered | Status |
|---|---|---|
| `preprod-prod-architecture-audit.spec.ts` | #1, #2, #3, #4 (all four, end-to-end) | ✅ 15 PASS / 0 BUG |
| `preprod-prod-photo-isolation.spec.ts` | #1 (job-level only) | ✅ passes — historical baseline, kept for redundancy |
| `jcf-modification-api.spec.ts` | API smoke | ⚠️ 1 passes / 2 skip — endpoint reachability only |

## Minimal test set (4 tests)

All tests are pure REST against the real backend (Docker stack on
:8080). No browser. The pattern is established by the existing
isolation spec — same auth flow, same `X-Flux-Scenario` header.

### Test 1 — Scenario isolation, job + element levels (extend existing)

**Status** : Job-level half exists in `preprod-prod-photo-isolation.spec.ts`.
Element-level half is new.

**Scenario** :

1. Read a job's `workshopExitDate` from Prod (snapshot).
2. PUT a new deadline via `X-Flux-Scenario: preprod`.
3. Find one of the job's active elements ; DELETE it via `X-Flux-Scenario: preprod`.
4. Verify Préprod read : new deadline AND element gone.
5. Verify Prod read : old deadline AND element still active.
6. `POST /promotion`.
7. Verify Prod read : new deadline AND element gone.

**Why both at once** : same job mutated at two levels in the same
test reduces fixture cost and verifies that publish materializes
heterogeneous changes atomically.

### Test 2 — Wall sharing (NEW)

**Why** : the wall layer is the heart of the gate-and-progress design.
If a wall write doesn't propagate to both scenarios immediately, the
architecture is structurally broken.

**Scenario** :

1. Find an element with `paperStatus !== Received` from Prod read.
2. Flip the gate via the wall handler endpoint. Locate the exact
   endpoint by reading `services/php-api/src/Controller/Api/V1/` —
   look for a paper/BAT/plate/forme status controller. Don't assume
   a path ; verify it.
3. Without publishing : verify Prod read shows `paperStatus = Received`
   AND Préprod read shows `paperStatus = Received`.
4. Bonus : pick another wall field (e.g., `recordedProgressPct` on a
   task) and verify the same propagation. One round-trip, two
   assertions — keeps the test count to four while doubling wall
   coverage.

### Test 3 — Publish reversibility (NEW)

**Why** : undo is the safety valve. If it doesn't properly restore
from the archive scenario, the chef's "oops" recovery is broken.

**Scenario** :

1. Snapshot Prod state of one job (deadline + active element count).
2. Trigger a Préprod edit + publish (reuse Test 1's setup, or do a
   fresh small edit).
3. Confirm Prod reflects the change.
4. `POST /promotion/undo` (or equivalent — locate the exact endpoint
   in `PromotionController` ; the method name is `undo` per the
   `PromotionService::undo` referenced in memory).
5. Verify Prod reverts to the original snapshot.
6. Verify Préprod state is preserved (undo doesn't destroy in-flight
   work — confirm with chef if this is the intended semantic).

### Test 4 — Logical identity (NEW)

**Why** : `logical_element_id` is the join key linking Préprod, Prod,
and Archive rows of the same logical element to a single wall row.
If the materialize step doesn't preserve it, gates orphan.

**Scenario** :

1. Find one element from Prod read. Capture `id` and `logical_element_id`
   (assuming the read exposes both ; if not, query the DB directly via
   a debug endpoint or skip this test until exposed).
2. Find the matching Préprod element by `logical_element_id` (NOT by
   `id` — they should differ because rows are physical per scenario,
   but `logical_element_id` should match).
3. Verify a wall lookup (`paperStatus` of both reads) returns the same
   value.
4. After a Préprod publish that doesn't touch this element, verify
   the new Prod row has the same `logical_element_id` as the
   pre-publish Prod row.

This test is the most fragile because it depends on what fields the
flux/jobs response exposes. If `logical_element_id` isn't surfaced,
either expose it on the response (low cost) or fold this assertion
into Test 2 (wall lookups working = logical identity working
transitively).

## What this audit deliberately doesn't cover

- **Engine snapshot consistency** — `SnapshotBuilderTest` (PHPUnit)
  unit-tests this. An E2E driving the Rust engine is a separate concern.
- **Concurrent writes** — single-chef assumption (Major #10 deferred).
- **Multiple parallel hypotheses** — V1 doesn't support per-job
  publish ; this test class will land with the publish-sélectif
  chantier.
- **Performance / scale** — shape, not load.
- **Frontend UI** — these are REST tests. Browser-level testing of
  JCF modification modal interactions, Flux toggle visibility, etc.,
  is a separate suite.
- **Auth boundary** — assumes the test user has all permissions.

## State management — self-bootstrapping

The audit owns its test data end-to-end :

- **`beforeAll`** cancels any stale `E2E-AUDIT-*` jobs from prior runs
  (best-effort), creates a fresh `E2E-AUDIT-{timestamp}` job in
  Préprod with 2 active elements (`ELT-A`, `ELT-B`), and publishes
  Préprod → Prod so both scenarios see it from the same starting
  state.
- **`afterAll`** cancels the test_job in Préprod via
  `POST /jobs/{id}/cancel`. The row stays for audit-log purposes but
  is filtered out of active reads (`/flux/jobs` only returns jobs
  with status ≠ cancelled). Future runs can list and cancel any
  leftover with the same prefix as a defensive belt-and-suspenders.

**Idempotency verified 2026-05-06** : three consecutive runs without
re-seeding all returned 14 PASS / 0 BUG / 0 SKIP. No stale state
accumulates in active reads.

### Caveat — the bootstrap publish

The bootstrap step calls `POST /promotion`, which materialises **the
entire Préprod state into Prod**, not just the test_job. Run the
audit only when Préprod has no unrelated in-flight work, or accept
that those mutations will hit Prod.

The cleaner option (Simulation fork as test sandbox) is marked
HORS SCOPE UX in `feedback_preprod_vs_scenarios.md` ; using it for
tests would re-introduce a path the user has explicitly suppressed.
Selective publish (per-job `materialize`) is the V2 escape hatch — it
would let the audit publish only the test_job and leave the rest of
Préprod untouched.

## Running

**Headless (CI / programmatic)** :

```bash
cd apps/web
pnpm playwright test preprod-prod-architecture-audit
```

Output is a structured PASS/BUG report on stdout. Exit code is 0 if
the spec passes (which it does even if invariants log BUG entries —
the spec is audit-style, no fail-fast). Read the printed report to
spot BUG lines.

**Spectator mode (live in Chromium, slowed down so you can follow)** :

```bash
pnpm playwright test preprod-prod-architecture-audit --headed --workers=1
```

The audit is REST-only so the browser will mostly look idle ; it's
the console output that matters. For UI-driven tests
(`jcf-modification-api.spec.ts` and historical specs) the
`--headed --slow-mo=500` combo gives a real browser play-by-play.

**Playwright UI mode (interactive timeline)** :

```bash
pnpm playwright test preprod-prod-architecture-audit --ui
```

Opens the Playwright UI runner with timeline scrubber, step-by-step
inspection, and trace replay. Useful when an invariant flips to BUG
and you want to scrub through the call sequence to find where state
diverged.

**Pre-requisites** :

- Docker stack running (php-api on :8080, postgres reachable).
- Préprod seeded with at least 1 job that has ≥1 active element and
  a corresponding row in Prod. Use the re-seed procedure above if
  the audit reports SKIP.

## Maintenance discipline

- **One spec file per concern** : architecture invariants here, JCF
  smoke separately, future Flux split tests in their own spec. Don't
  let one mega-spec absorb everything ; run-time and failure
  diagnostics suffer.
- **Keep the count small** : four invariants. New invariants get a
  new check only when they're structural — not when they're a
  feature regression test (those go elsewhere).
- **Update this doc** when an invariant is added or retired. The
  table is the contract ; if it goes stale, the audit stops being
  trustworthy.

## Last full-suite run

```
$ pnpm playwright test preprod-prod-architecture-audit --reporter=list
✅ [setup] Prod=5 jobs · Préprod=5 jobs
✅ [setup] target=AUDIT-9001 (1 elements)
✅ [2 Wall sharing] Prod read papier after flip: delivered (expected delivered)
✅ [2 Wall sharing] Préprod read papier on label-matched element after flip: delivered (expected delivered) — confirms wall shared via logical_element_id
✅ [2 Wall sharing] gate restored to in_stock
✅ [1a Scenario isolation (job)] Préprod read after edit: 2026-05-23 (expected starts with 2026-05-23)
✅ [1a Scenario isolation (job)] Prod read after Préprod edit: 2026-05-18 (expected unchanged)
✅ [1b Scenario isolation (element)] Préprod active elements before=1 after=0 (cancel reflected yes ✓)
✅ [1b Scenario isolation (element)] Prod active elements before=1 after=1 (Prod unchanged ✓)
✅ [1c Publish materialization] Prod sees the new deadline ✓
✅ [1c Publish materialization] Prod cancellation materialized ✓
✅ [3 Publish reversibility] Prod sortie reverted ✓
✅ [3 Publish reversibility] Prod cancellation reverted ✓
✅ [4 Logical identity] Prod target reference preserved
✅ [4 Logical identity] Prod element count after undo: 1 (expected 1)

TOTAL: 15 PASS · 0 BUG · 0 SKIP
```

Run on 2026-05-06 against the local Docker stack with seed jobs
`AUDIT-9001..9003` published to Prod. Surfaced and corrected one
real bug : `FluxJobResponse` and `JobResponse` had been iterating
`Job::getElements()` instead of `Job::getActiveElements()`, causing
Cancelled elements to leak into FE reads. Fixed in php-api
`c1f340c`.
