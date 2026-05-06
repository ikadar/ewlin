/**
 * Setup-inheritance — engine honours / rejects a previously-completed
 * calage when a partially-progressed task is re-planned.
 *
 * E2E COVERAGE STATUS — DEFERRED
 * ==============================
 *
 * The QA matrix locked at 2026-05-05 has 6 cases :
 *   1. calage préservé   (same station, gap < péremption, no foreign action)
 *   2. calage périmé     (gap > péremption)
 *   3. calage volé       (foreign action between anchor and candidate)
 *   4. calage volé puis libéré (planning state at evaluation time)
 *   5. pre-saisie        (no anchor offered)
 *   6. saisie en plein setup (defensive)
 *
 * All 6 are covered by Rust unit tests on
 * `engine::forward_pass::evaluate_setup_inheritance` (cf.
 * `services/scheduling-engine/src/engine/forward_pass.rs` →
 * `mod inheritance_tests`). Those tests pin the same helper that
 * `pre_place_pinned_actions` calls for every user-pinned action ; they
 * exercise the full decision space deterministically with hand-rolled grid
 * state.
 *
 * Why not e2e here :
 *   - `bulkReplaceComputedAssignments` (ScheduleAssignmentWriter:329-340)
 *     KEEPS user-pinned rows verbatim and discards the engine's freshly
 *     computed assignment for them. That is the correct contract —
 *     pins are user-authoritative — but it means the engine-emitted
 *     `setupInherited` flag is never persisted to the pinned row.
 *   - The natural e2e signal would be the assignment row's setupInherited
 *     column after a compute, but that column stays unwritten because
 *     the pinned row is taken straight from pre-compute state.
 *   - Wiring an e2e would require either changing the pin contract
 *     (engine wins on inheritance flags only — extra plumbing) or
 *     reading the engine output directly via a debug endpoint (no such
 *     endpoint exists today).
 *
 * The unit suite is the source of truth until that infra is in place.
 *
 * If you're debugging a regression : seed `tasks.last_setup_at` +
 * `tasks.last_setup_station_id` on a task in Préprod, drag-drop the tile
 * to a new instant in the UI, and inspect the compute-fast HTTP response
 * (var/log/schedule-compute/latest.json) — the engine's
 * `assignments[].setupInherited` field is the unambiguous signal even
 * when persistence drops it.
 */

import { test } from '@playwright/test';

test.describe('setup inheritance — e2e deferred', () => {
  test.skip('case A — calage preserved (covered by Rust inheritance_tests::case_1)', () => {
    // Intentionally skipped — see file header.
  });
  test.skip('case B — calage rejected for peremption (covered by Rust inheritance_tests::case_2)', () => {
    // Intentionally skipped — see file header.
  });
});
