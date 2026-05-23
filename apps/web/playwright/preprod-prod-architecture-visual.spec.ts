/**
 * Préprod/Prod architecture — VISUAL audit.
 *
 * Drives a real Chromium against the Flux page to make the four
 * structural invariants visible in the Playwright UI preview pane :
 *
 *   1. Scenario isolation — toggle Préprod/Prod, watch deadlines and
 *      element counts diverge as Préprod is mutated.
 *   2. Wall sharing — flip a gate via REST, watch both views adopt
 *      the new value (gate dot color changes in the row).
 *   3. Publish materialization — click Promouvoir + dwell button to
 *      hold-to-confirm. Prod adopts Préprod state visually.
 *   4. Publish reversibility — click Annuler on the undo toast. Prod
 *      reverts visually.
 *
 * Hybrid approach :
 *   - Bootstrap and individual mutations stay REST-driven (fast and
 *     stable).
 *   - Navigation, scenario toggle, publish, undo are clicked through
 *     the real UI, so the Playwright UI preview pane shows actual
 *     rendered state at each step.
 *   - `page.waitForTimeout(...)` pauses are inserted between key
 *     states so a human spectator can follow.
 *
 * Caveat (same as the REST audit) :
 *   The bootstrap publish materialises *all* of Préprod into Prod, not
 *   just the test_job. Run only when Préprod is clean of unrelated
 *   work, or accept the drag.
 *
 * Run modes :
 *   pnpm playwright test preprod-prod-architecture-visual --headed --workers=1 --slow-mo=300
 *   pnpm playwright test preprod-prod-architecture-visual --ui
 */

import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:8080/api/v1';
// Same user as versioning-promotion.spec — `pwtest@flux.local` is the
// canonical UI/test user with both API and FE permissions in the
// current DB. (The shared helpers/auth.ts uses admin@flux.local with
// stale credentials that no longer authenticate.)
const TEST_EMAIL = 'pwtest@flux.local';
const TEST_PASSWORD = 'PwTestPass123!';
// Gate via env so CI runs at 1.5 s default (fast) and local demo/screencast
// runs can bump to 10 s with `VISUAL_PAUSE_MS=10000 npx playwright test ...`.
const VISUAL_PAUSE_MS = Number.parseInt(process.env.VISUAL_PAUSE_MS ?? '', 10) || 1500;

let api: APIRequestContext;
let token: string;
let testJobRef: string;
let testJobInternalId: string;
let initialDeadline: string;

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

async function fluxJobs(scenario: 'preprod' | 'prod'): Promise<Array<{ id: string; internalId: string; sortieIso?: string | null; elements?: Array<{ id: string; label?: string; papier?: string }> }>> {
  const resp = await call('GET', '/flux/jobs', scenario);
  if (!resp.ok()) throw new Error(`flux/jobs ${scenario} failed: ${resp.status()}`);
  return resp.json();
}

async function injectAuth(page: Page): Promise<void> {
  const ctx = await pwRequest.newContext();
  const r = await ctx.post(`${API}/auth/login`, { data: { email: TEST_EMAIL, password: TEST_PASSWORD } });
  const { token: t, refreshToken, user } = await r.json();
  await ctx.dispose();
  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('flux_auth_token', token);
    localStorage.setItem('flux_refresh_token', refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token: t, refreshToken, user });
}

async function gotoFlux(page: Page, scenario: 'preprod' | 'prod'): Promise<void> {
  const url = scenario === 'prod' ? '/flux?env=prod' : '/flux';
  await page.goto(url);
  await page.waitForSelector('[data-testid="flux-page"]', { timeout: 20_000 });
  await page.waitForSelector('[data-testid="flux-table-row"]', { timeout: 20_000 });
}

async function findRowFor(page: Page, ref: string) {
  // Each flux-table-row contains a flux-designation cell that
  // displays the job reference. Filter rows to the one matching ref.
  return page.getByTestId('flux-table-row').filter({ hasText: ref });
}

test.describe.configure({ mode: 'serial' });

test.describe('Préprod/Prod architecture — VISUAL audit', () => {
  test.beforeAll(async () => {
    api = await pwRequest.newContext();
    const r = await api.post(`${API}/auth/login`, { data: { email: TEST_EMAIL, password: TEST_PASSWORD } });
    expect(r.ok(), `login failed: ${r.status()}`).toBeTruthy();
    token = (await r.json()).token;

    // Cleanup stale visual-audit jobs.
    const preprodJobs = await fluxJobs('preprod');
    const stale = preprodJobs.filter((j) => j.id?.startsWith('E2E-VISUAL-'));
    for (const j of stale) {
      await call('POST', `/jobs/${j.internalId}/cancel`, 'preprod');
    }

    // Create test_job in Préprod with 2 elements.
    testJobRef = `E2E-VISUAL-${Date.now()}`;
    initialDeadline = '2027-02-15T16:00';
    const createResp = await call('POST', '/jobs', 'preprod', {
      reference: testJobRef,
      client: 'E2E Visual',
      description: 'Visual architecture audit fixture',
      workshopExitDate: initialDeadline,
      quantity: 100,
      deadlinePriority: 2,
      status: 'planned',
      elements: [
        { name: 'V-A', label: 'V-A', sequence: '' },
        { name: 'V-B', label: 'V-B', sequence: '' },
      ],
    });
    expect(createResp.ok(), `bootstrap POST /jobs failed: ${createResp.status()} ${await createResp.text()}`).toBeTruthy();
    testJobInternalId = (await createResp.json()).id;

    // Publish to Prod so both scenarios see the test_job.
    const promoteResp = await call('POST', '/promotion', undefined, { engineVersion: 'visual-audit-bootstrap' });
    expect(promoteResp.ok()).toBeTruthy();
  });

  test.afterAll(async () => {
    if (testJobInternalId) {
      await call('POST', `/jobs/${testJobInternalId}/cancel`, 'preprod');
    }
    await api.dispose();
  });

  test('visual walkthrough of all four invariants', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
    await injectAuth(page);

    // -------------------------------------------------------------
    // Scene 1 — Show Préprod with the test_job (2 elements).
    // -------------------------------------------------------------
    await gotoFlux(page, 'preprod');
    const preprodRow1 = await findRowFor(page, testJobRef);
    await expect(preprodRow1).toBeVisible();
    await preprodRow1.scrollIntoViewIfNeeded();
    console.log(`[scene 1] Préprod shows ${testJobRef} with initial deadline ${initialDeadline}`);
    await page.waitForTimeout(VISUAL_PAUSE_MS);

    // -------------------------------------------------------------
    // Scene 2 — Toggle to Prod, same test_job visible (just published).
    // -------------------------------------------------------------
    const header = page.getByTestId('env-floating-controls');
    await header.getByRole('tab', { name: /^Prod$/ }).click();
    await page.waitForURL(/[?&]env=prod\b/);
    await page.waitForSelector('[data-testid="flux-table-row"]');
    const prodRow1 = await findRowFor(page, testJobRef);
    await expect(prodRow1).toBeVisible();
    await prodRow1.scrollIntoViewIfNeeded();
    console.log(`[scene 2] Prod also shows ${testJobRef} (post-bootstrap publish)`);
    await page.waitForTimeout(VISUAL_PAUSE_MS);

    // -------------------------------------------------------------
    // Scene 3 — Wall sharing. Flip a gate via REST, both scenarios
    //   pick up the new value on reload.
    // -------------------------------------------------------------
    const prodJobs = await fluxJobs('prod');
    const prodTarget = prodJobs.find((j) => j.id === testJobRef)!;
    const elt = prodTarget.elements?.find((e) => e.label === 'V-A')!;
    expect(elt, 'V-A not found in Prod').toBeTruthy();

    const flipResp = await call('PATCH', `/flux/elements/${elt.id}`, 'prod', {
      column: 'papier', value: 'delivered',
    });
    expect(flipResp.ok()).toBeTruthy();
    console.log(`[scene 3] gate flipped to delivered on Prod element ${elt.id}`);

    await page.reload();
    await page.waitForSelector('[data-testid="flux-table-row"]');
    const prodRowAfterFlip = await findRowFor(page, testJobRef);
    await prodRowAfterFlip.scrollIntoViewIfNeeded();
    await page.waitForTimeout(VISUAL_PAUSE_MS);

    // Toggle to Préprod, gate should also be delivered (wall shared).
    await header.getByRole('tab', { name: /^Préprod$/ }).click();
    await page.waitForURL((u) => !/[?&]env=prod\b/.test(u.toString()));
    await page.waitForSelector('[data-testid="flux-table-row"]');
    const preprodRowGate = await findRowFor(page, testJobRef);
    await preprodRowGate.scrollIntoViewIfNeeded();
    console.log('[scene 3] Préprod row also reflects the gate flip — wall sharing visible');
    await page.waitForTimeout(VISUAL_PAUSE_MS);

    // Restore the gate.
    await call('PATCH', `/flux/elements/${elt.id}`, 'prod', { column: 'papier', value: 'none' });

    // -------------------------------------------------------------
    // Scene 4 — Scenario isolation : mutate Préprod deadline + cancel
    //   one element, refresh views. Préprod diverges, Prod stays.
    // -------------------------------------------------------------
    const newDeadline = '2027-02-25T16:00';
    const updateResp = await call('PUT', `/jobs/${testJobInternalId}`, 'preprod', {
      workshopExitDate: newDeadline,
    });
    expect(updateResp.ok(), `deadline update failed: ${updateResp.status()}`).toBeTruthy();

    const preprodJobs2 = await fluxJobs('preprod');
    const preprodTarget2 = preprodJobs2.find((j) => j.id === testJobRef)!;
    const eltToCancel = preprodTarget2.elements?.find((e) => e.label === 'V-B')!;
    const delResp = await call('DELETE', `/elements/${eltToCancel.id}`, 'preprod');
    expect(delResp.ok()).toBeTruthy();
    console.log(`[scene 4] Préprod mutations: deadline ${initialDeadline} → ${newDeadline}, cancelled element ${eltToCancel.label}`);

    await page.reload();
    await page.waitForSelector('[data-testid="flux-table-row"]');
    const preprodRowMutated = await findRowFor(page, testJobRef);
    await preprodRowMutated.scrollIntoViewIfNeeded();
    console.log('[scene 4] Préprod shows new deadline + 1 fewer element');
    await page.waitForTimeout(VISUAL_PAUSE_MS);

    await header.getByRole('tab', { name: /^Prod$/ }).click();
    await page.waitForURL(/[?&]env=prod\b/);
    await page.waitForSelector('[data-testid="flux-table-row"]');
    const prodRowUnchanged = await findRowFor(page, testJobRef);
    await prodRowUnchanged.scrollIntoViewIfNeeded();
    console.log('[scene 4] Prod still shows ORIGINAL deadline + 2 elements — isolation visible');
    await page.waitForTimeout(VISUAL_PAUSE_MS);

    // -------------------------------------------------------------
    // Scene 5 — Publish materialization via UI : Promouvoir + dwell.
    // -------------------------------------------------------------
    await header.getByRole('tab', { name: /^Préprod$/ }).click();
    await page.waitForURL((u) => !/[?&]env=prod\b/.test(u.toString()));
    await page.waitForSelector('[data-testid="flux-table-row"]');

    await header.getByTestId('promote-cta').click();
    const modal = page.getByTestId('promotion-modal');
    await expect(modal).toBeVisible();
    console.log('[scene 5] Promotion modal open. KPI tiles loading...');
    await page.waitForTimeout(VISUAL_PAUSE_MS);

    // Wait for the KPI preview to settle (no "—" placeholders).
    await expect(modal.getByText(/—/)).toHaveCount(0, { timeout: 15_000 });
    console.log('[scene 5] KPIs settled. Holding the dwell button 1.4s...');

    const dwellBtn = page.getByTestId('promotion-dwell-button');
    await dwellBtn.hover();
    await page.mouse.down();
    await page.waitForTimeout(1400);
    await page.mouse.up();

    await expect(modal).toHaveCount(0, { timeout: 5_000 });
    console.log('[scene 5] Modal closed — promotion fired');

    await header.getByRole('tab', { name: /^Prod$/ }).click();
    await page.waitForURL(/[?&]env=prod\b/);
    await page.waitForSelector('[data-testid="flux-table-row"]');
    const prodRowAfterPublish = await findRowFor(page, testJobRef);
    await prodRowAfterPublish.scrollIntoViewIfNeeded();
    console.log('[scene 5] Prod now shows the new deadline + 1 element — materialization visible');
    await page.waitForTimeout(VISUAL_PAUSE_MS);

    // -------------------------------------------------------------
    // Scene 6 — Publish reversibility via UI : click Annuler on toast.
    // -------------------------------------------------------------
    const undoToast = page.getByTestId('promotion-undo-toast');
    await expect(undoToast).toBeVisible({ timeout: 5_000 });
    console.log('[scene 6] Undo toast visible — clicking Annuler');
    await undoToast.getByRole('button', { name: /Annuler/ }).click();
    await page.waitForTimeout(VISUAL_PAUSE_MS);

    await page.reload();
    await page.waitForSelector('[data-testid="flux-table-row"]');
    const prodRowAfterUndo = await findRowFor(page, testJobRef);
    await prodRowAfterUndo.scrollIntoViewIfNeeded();
    console.log('[scene 6] Prod reverted to original deadline + 2 elements — reversibility visible');
    await page.waitForTimeout(VISUAL_PAUSE_MS);

    // -------------------------------------------------------------
    // DOM assertions to make the test fail loudly if something breaks.
    // The visual narrative is for human inspection ; these assertions
    // protect the suite from silent regressions.
    // -------------------------------------------------------------
    const finalProdJobs = await fluxJobs('prod');
    const finalProdTarget = finalProdJobs.find((j) => j.id === testJobRef);
    expect(finalProdTarget, 'Prod target lost during audit').toBeTruthy();
    expect(finalProdTarget?.sortieIso?.startsWith('2027-02-15'), `Prod deadline not reverted: ${finalProdTarget?.sortieIso}`).toBeTruthy();
    expect(finalProdTarget?.elements?.length, `Prod element count not reverted: ${finalProdTarget?.elements?.length}`).toBe(2);

    console.log('\n✅ VISUAL AUDIT COMPLETE — all four invariants observed in Chromium.');
  });
});
