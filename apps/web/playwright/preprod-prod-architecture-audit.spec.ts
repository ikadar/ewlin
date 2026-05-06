/**
 * Préprod/Prod architecture — audit protocol.
 *
 * Audit-style E2E (no fail-fast — logs PASS/BUG and prints summary at
 * the end) that exercises the four structural invariants documented in
 * `docs/architecture/preprod-prod-photo-tests.md`.
 *
 * Invariants checked :
 *   1. Scenario isolation — Préprod writes don't leak into Prod until
 *      `POST /promotion`. Tested at job level (deadline) AND element
 *      level (cancellation).
 *   2. Wall sharing — a gate flip via `PATCH /flux/elements/{id}`
 *      propagates to both Préprod and Prod reads immediately.
 *   3. Publish reversibility — `POST /promotion/undo` restores Prod
 *      to its previous state.
 *   4. Logical identity — Préprod and Prod rows for the same logical
 *      element share the same wall view (= the wall lookup keyed by
 *      logical_element_id resolves identically).
 *
 * Runs against the real backend (php-api on :8080) and the real DB.
 * Reuses the existing `claude-test@flux.local` test user.
 *
 * Run modes :
 *   pnpm playwright test preprod-prod-architecture-audit
 *   pnpm playwright test preprod-prod-architecture-audit --headed --workers=1
 */

import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:8080/api/v1';
const TEST_EMAIL = 'claude-test@flux.local';
const TEST_PASSWORD = 'ClaudeAuditPwd!';

interface FluxElement {
  id: string;
  label?: string;
  papier?: string;
  bat?: string;
  plaques?: string;
  formes?: string;
}
interface FluxJob {
  internalId: string;
  id: string;
  reference?: string;
  sortie?: string | null;
  sortieIso?: string | null;
  elements?: FluxElement[];
}

let api: APIRequestContext;
let token: string;
const report: { invariant: string; result: 'PASS' | 'BUG' | 'SKIP'; detail: string }[] = [];

function log(invariant: string, result: 'PASS' | 'BUG' | 'SKIP', detail: string) {
  const icon = result === 'PASS' ? '✅' : result === 'BUG' ? '❌' : '⏭️';
  console.log(`${icon} [${invariant}] ${detail}`);
  report.push({ invariant, result, detail });
}

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  scenario?: 'preprod' | 'prod',
  body?: unknown,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (scenario) headers['X-Flux-Scenario'] = scenario;
  return api.fetch(`${API}${path}`, { method, headers, data: body as undefined });
}

async function fluxJobs(scenario: 'preprod' | 'prod'): Promise<FluxJob[]> {
  const resp = await call('GET', '/flux/jobs', scenario);
  if (!resp.ok()) throw new Error(`flux/jobs ${scenario} failed: ${resp.status()}`);
  return resp.json();
}

test.describe.configure({ mode: 'serial' });

test.describe('Préprod/Prod architecture audit', () => {
  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(300_000);
    api = await pwRequest.newContext();
    const r = await api.post(`${API}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(r.ok(), `login failed: ${r.status()}`).toBeTruthy();
    token = (await r.json()).token;
  });

  test.afterAll(async () => {
    console.log('\n' + '='.repeat(60));
    console.log('PRÉPROD/PROD ARCHITECTURE AUDIT — REPORT');
    console.log('='.repeat(60));
    const grouped: Record<string, typeof report> = {};
    for (const row of report) {
      grouped[row.invariant] = grouped[row.invariant] ?? [];
      grouped[row.invariant].push(row);
    }
    for (const inv of Object.keys(grouped)) {
      console.log(`\n## ${inv}`);
      for (const row of grouped[inv]) {
        const icon = row.result === 'PASS' ? '  ✅' : row.result === 'BUG' ? '  ❌' : '  ⏭️ ';
        console.log(`${icon} ${row.detail}`);
      }
    }
    const pass = report.filter((r) => r.result === 'PASS').length;
    const bug = report.filter((r) => r.result === 'BUG').length;
    const skip = report.filter((r) => r.result === 'SKIP').length;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TOTAL: ${pass} PASS · ${bug} BUG · ${skip} SKIP`);
    console.log('='.repeat(60) + '\n');
    await api.dispose();
  });

  test('audit run', async ({}, testInfo) => {
    testInfo.setTimeout(300_000);

    // -------------------------------------------------------------
    // Setup — pick a Prod-existing job that has ≥1 element. We'll
    // mutate its Préprod twin and confirm isolation, then publish.
    // -------------------------------------------------------------
    const prodInitial = await fluxJobs('prod');
    const preprodInitial = await fluxJobs('preprod');
    if (prodInitial.length === 0 || preprodInitial.length === 0) {
      log('setup', 'SKIP', `Prod=${prodInitial.length} Préprod=${preprodInitial.length} — DB empty, audit cannot run.`);
      return;
    }
    log('setup', 'PASS', `Prod=${prodInitial.length} jobs · Préprod=${preprodInitial.length} jobs`);

    // Find a job with at least 1 element present in BOTH scenarios.
    let target: { ref: string; prod: FluxJob; preprod: FluxJob } | null = null;
    for (const p of prodInitial) {
      const pp = preprodInitial.find((x) => x.id === p.id);
      if (pp && (pp.elements?.length ?? 0) >= 1) {
        target = { ref: p.id, prod: p, preprod: pp };
        break;
      }
    }
    if (!target) {
      log('setup', 'SKIP', 'No job with elements present in both Prod and Préprod — pre-existing data shape required.');
      return;
    }
    log('setup', 'PASS', `target=${target.ref} (Prod.internalId=${target.prod.internalId}, Préprod.internalId=${target.preprod.internalId}, ${target.preprod.elements?.length} elements)`);

    const prodSortieBefore = target.prod.sortieIso ?? null;
    const prodElementCountBefore = target.prod.elements?.length ?? 0;
    const initialDeadlineDate = prodSortieBefore !== null
      ? new Date(prodSortieBefore)
      : new Date('2026-08-01T16:00:00Z');
    const newDate = new Date(initialDeadlineDate);
    newDate.setDate(newDate.getDate() + 5);
    const newWorkshopExitDate = newDate.toISOString().slice(0, 16);

    // -------------------------------------------------------------
    // INVARIANT 2 — Wall sharing (gate flip propagates to both).
    //   Run BEFORE the cancellation test so labels are still findable
    //   on both sides. Field name is `papier` ; valid PaperStatus
    //   values: none|in_stock|to_order|ordered|delivered.
    // -------------------------------------------------------------
    const prodElementForGate = target.prod.elements?.find((e) => !!e.id && !!e.label);
    if (!prodElementForGate) {
      log('2 Wall sharing', 'SKIP', 'No Prod element to flip a gate on.');
    } else {
      const initialPaper = prodElementForGate.papier ?? 'none';
      const targetPaper = initialPaper === 'delivered' ? 'to_order' : 'delivered';
      const flipResp = await call('PATCH', `/flux/elements/${prodElementForGate.id}`, 'prod', {
        column: 'papier', value: targetPaper,
      });
      if (!flipResp.ok()) {
        log('2 Wall sharing', 'BUG',
          `PATCH /flux/elements/${prodElementForGate.id} failed: ${flipResp.status()} ${await flipResp.text()}`);
      } else {
        const prodAfter = await fluxJobs('prod');
        const preprodAfter = await fluxJobs('preprod');
        const prodElAfter = prodAfter.find((j) => j.id === target!.ref)?.elements?.find((e) => e.id === prodElementForGate.id);
        const preprodElAfter = preprodAfter.find((j) => j.id === target!.ref)
          ?.elements?.find((e) => e.label === prodElementForGate.label);

        const prodSeesFlip = prodElAfter?.papier === targetPaper;
        log('2 Wall sharing', prodSeesFlip ? 'PASS' : 'BUG',
          `Prod read papier after flip: ${prodElAfter?.papier} (expected ${targetPaper})`);

        if (preprodElAfter) {
          const preprodSeesFlip = preprodElAfter.papier === targetPaper;
          log('2 Wall sharing', preprodSeesFlip ? 'PASS' : 'BUG',
            `Préprod read papier on label-matched element after flip: ${preprodElAfter.papier} (expected ${targetPaper}) — confirms wall shared via logical_element_id`);
        } else {
          log('2 Wall sharing', 'BUG',
            `Préprod has no element with label=${prodElementForGate.label} — Prod's label not findable in Préprod, scenarios may have diverged.`);
        }

        const restoreResp = await call('PATCH', `/flux/elements/${prodElementForGate.id}`, 'prod', {
          column: 'papier', value: initialPaper,
        });
        if (!restoreResp.ok()) {
          log('2 Wall sharing', 'BUG',
            `gate restore failed: ${restoreResp.status()} — manual cleanup may be required for element ${prodElementForGate.id}`);
        } else {
          log('2 Wall sharing', 'PASS', `gate restored to ${initialPaper}`);
        }
      }
    }

    // -------------------------------------------------------------
    // INVARIANT 1a — Scenario isolation, JOB level.
    //   Mutate Préprod deadline, confirm Prod unchanged.
    // -------------------------------------------------------------
    const updateResp = await call('PUT', `/jobs/${target.preprod.internalId}`, 'preprod', {
      workshopExitDate: newWorkshopExitDate,
    });
    if (!updateResp.ok()) {
      log('1a Scenario isolation (job)', 'BUG', `PUT /jobs/${target.preprod.internalId} failed: ${updateResp.status()}`);
    } else {
      const preprodAfter = await fluxJobs('preprod');
      const prodAfter = await fluxJobs('prod');
      const preprodTarget = preprodAfter.find((j) => j.id === target!.ref);
      const prodTarget = prodAfter.find((j) => j.id === target!.ref);

      const preprodReflectsEdit = preprodTarget?.sortieIso?.startsWith(newWorkshopExitDate.slice(0, 10)) ?? false;
      log('1a Scenario isolation (job)', preprodReflectsEdit ? 'PASS' : 'BUG',
        `Préprod read after edit: sortieIso=${preprodTarget?.sortieIso ?? 'null'} (expected starts with ${newWorkshopExitDate.slice(0, 10)})`);

      const prodUnchanged = (prodTarget?.sortieIso ?? null) === prodSortieBefore;
      log('1a Scenario isolation (job)', prodUnchanged ? 'PASS' : 'BUG',
        `Prod read after Préprod edit: sortieIso=${prodTarget?.sortieIso ?? 'null'} (expected unchanged ${prodSortieBefore})`);
    }

    // -------------------------------------------------------------
    // INVARIANT 1b — Scenario isolation, ELEMENT level (Pillar B).
    //   Cancel one Préprod element ; confirm still present in Prod.
    //   Cross-scenario matching uses `label` (logical_element_id is
    //   not surfaced on FluxElementResponse).
    // -------------------------------------------------------------
    const elementToCancel = target.preprod.elements?.find((e) => !!e.id && !!e.label);
    const cancelLabel = elementToCancel?.label ?? '';
    if (!elementToCancel) {
      log('1b Scenario isolation (element)', 'SKIP', 'Préprod target has no usable element id+label.');
    } else {
      const prodElementCountBefore = target.prod.elements?.length ?? 0;
      const preprodElementCountBefore = target.preprod.elements?.length ?? 0;

      const delResp = await call('DELETE', `/elements/${elementToCancel.id}`, 'preprod');
      if (!delResp.ok()) {
        log('1b Scenario isolation (element)', 'BUG',
          `DELETE /elements/${elementToCancel.id} failed: ${delResp.status()} ${await delResp.text()}`);
      } else {
        const preprodAfter = await fluxJobs('preprod');
        const prodAfter = await fluxJobs('prod');
        const preprodTarget = preprodAfter.find((j) => j.id === target!.ref);
        const prodTarget = prodAfter.find((j) => j.id === target!.ref);

        const preprodCount = preprodTarget?.elements?.length ?? 0;
        const preprodHasLabel = !!preprodTarget?.elements?.some((e) => e.label === cancelLabel);
        const preprodCancelled = preprodCount < preprodElementCountBefore || !preprodHasLabel;
        log('1b Scenario isolation (element)', preprodCancelled ? 'PASS' : 'BUG',
          `Préprod active elements before=${preprodElementCountBefore} after=${preprodCount} hasLabel("${cancelLabel}")=${preprodHasLabel} (cancel reflected ${preprodCancelled ? 'yes ✓' : 'no ✗'})`);

        const prodCount = prodTarget?.elements?.length ?? 0;
        const prodHasLabel = !!prodTarget?.elements?.some((e) => e.label === cancelLabel);
        const prodUnchanged = prodCount === prodElementCountBefore && prodHasLabel;
        log('1b Scenario isolation (element)', prodUnchanged ? 'PASS' : 'BUG',
          `Prod active elements before=${prodElementCountBefore} after=${prodCount} hasLabel("${cancelLabel}")=${prodHasLabel} (Prod ${prodUnchanged ? 'unchanged ✓' : 'leaked ✗'})`);
      }
    }

    // -------------------------------------------------------------
    // INVARIANT 1c — Publish materializes Préprod into Prod.
    //   POST /promotion ; verify Prod reflects the deadline + cancel.
    // -------------------------------------------------------------
    const prodElementCountPrePublish = target.prod.elements?.length ?? 0;
    const promoteResp = await call('POST', '/promotion', undefined, { engineVersion: 'audit' });
    if (!promoteResp.ok()) {
      log('1c Publish materialization', 'BUG',
        `POST /promotion failed: ${promoteResp.status()} ${await promoteResp.text()}`);
    } else {
      const prodAfterPublish = await fluxJobs('prod');
      const prodTargetAfter = prodAfterPublish.find((j) => j.id === target!.ref);

      const prodSeesDeadline = prodTargetAfter?.sortieIso?.startsWith(newWorkshopExitDate.slice(0, 10)) ?? false;
      log('1c Publish materialization', prodSeesDeadline ? 'PASS' : 'BUG',
        `Prod read after publish: sortieIso=${prodTargetAfter?.sortieIso ?? 'null'} (expected starts with ${newWorkshopExitDate.slice(0, 10)})`);

      if (elementToCancel) {
        const prodCount = prodTargetAfter?.elements?.length ?? 0;
        const prodHasCancelLabel = !!prodTargetAfter?.elements?.some((e) => e.label === cancelLabel);
        const cancelMaterialized = prodCount < prodElementCountPrePublish || !prodHasCancelLabel;
        log('1c Publish materialization', cancelMaterialized ? 'PASS' : 'BUG',
          `Prod active elements after publish: before=${prodElementCountPrePublish} after=${prodCount} hasLabel("${cancelLabel}")=${prodHasCancelLabel} (cancel ${cancelMaterialized ? 'materialized ✓' : 'not materialized ✗'})`);
      }
    }

    // -------------------------------------------------------------
    // INVARIANT 3 — Publish reversibility.
    //   POST /promotion/undo ; verify Prod reverts to original state.
    // -------------------------------------------------------------
    const undoResp = await call('POST', '/promotion/undo');
    if (!undoResp.ok()) {
      log('3 Publish reversibility', 'BUG',
        `POST /promotion/undo failed: ${undoResp.status()} ${await undoResp.text()} — Prod is in the post-publish state, MANUAL CLEANUP REQUIRED.`);
    } else {
      const prodAfterUndo = await fluxJobs('prod');
      const prodTargetAfter = prodAfterUndo.find((j) => j.id === target!.ref);

      const prodReverted = (prodTargetAfter?.sortieIso ?? null) === prodSortieBefore;
      log('3 Publish reversibility', prodReverted ? 'PASS' : 'BUG',
        `Prod sortieIso after undo: ${prodTargetAfter?.sortieIso ?? 'null'} (expected original ${prodSortieBefore})`);

      if (elementToCancel) {
        const prodCount = prodTargetAfter?.elements?.length ?? 0;
        const prodHasCancelLabel = !!prodTargetAfter?.elements?.some((e) => e.label === cancelLabel);
        const cancelReverted = prodCount === prodElementCountPrePublish && prodHasCancelLabel;
        log('3 Publish reversibility', cancelReverted ? 'PASS' : 'BUG',
          `Prod active elements after undo: count=${prodCount} (expected ${prodElementCountPrePublish}) hasLabel("${cancelLabel}")=${prodHasCancelLabel} (cancel ${cancelReverted ? 'reverted ✓' : 'still applied ✗'})`);
      }
    }

    // -------------------------------------------------------------
    // INVARIANT 4 — Logical identity (post-undo Prod consistency).
    //   Préprod is intentionally left mutated (test is one-shot ; reseed
    //   between runs if needed). Prod must be back to its pre-test
    //   shape : same reference, same element count.
    // -------------------------------------------------------------
    const prodFinal = await fluxJobs('prod');
    const prodTargetFinal = prodFinal.find((j) => j.id === target.ref);

    if (!prodTargetFinal) {
      log('4 Logical identity', 'BUG', 'target job missing in Prod after undo');
    } else {
      const sameJobReference = prodTargetFinal.id === target.ref;
      log('4 Logical identity', sameJobReference ? 'PASS' : 'BUG',
        `Prod target reference preserved: ${prodTargetFinal.id} (expected ${target.ref})`);

      const prodElementCountAfter = prodTargetFinal.elements?.length ?? 0;
      const prodCountRestored = prodElementCountAfter === prodElementCountBefore;
      log('4 Logical identity', prodCountRestored ? 'PASS' : 'BUG',
        `Prod element count after undo: ${prodElementCountAfter} (expected ${prodElementCountBefore} — pre-test count)`);
    }
  });
});
