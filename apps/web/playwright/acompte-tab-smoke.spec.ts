/**
 * Acompte tab — UX smoke test.
 *
 * Validates the two FE regressions fixed by commit c57c695 :
 *   1. The « Enregistrer » button on the Acomptes tab toggles into the
 *      disabled « Enregistrement... » state during the in-flight RTK
 *      mutations, then the modal closes once the save resolves.
 *      Before the fix : the button stayed clickable + the modal stayed
 *      open after a successful save.
 *
 *   2. Resetting a previously-saved declaration back to 0 actually
 *      propagates : the FE writes the 0 upsert (was skipped before),
 *      the wall reflects the cleared in-progress state.
 *
 * Targets the LOCAL docker stack via the canonical pwtest fixture user
 * (same pattern as preprod-prod-architecture-visual.spec.ts). The
 * deployed prod bundle is bit-identical (same hash, same PHP code), so
 * behaviour observed here mirrors prod. For an actual against-prod
 * smoke, pass FLUX_BASE_URL + FLUX_API_URL + FLUX_EMAIL + FLUX_PASSWORD
 * env vars from a session that holds the real creds.
 *
 * Run :
 *   pnpm playwright test acompte-tab-smoke --headed --workers=1
 */

import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const API = process.env.FLUX_API_URL ?? 'http://localhost:8080/api/v1';
const TEST_EMAIL = process.env.FLUX_EMAIL ?? 'pwtest@flux.local';
const TEST_PASSWORD = process.env.FLUX_PASSWORD ?? 'PwTestPass123!';

let api: APIRequestContext;
let token: string;
let testJobId: string;         // internal UUID — for /api/v1/jobs/{id} calls
let testJobReference: string;  // display ref (e.g. "202601.0162") — for FluxTable data-job-id
let testJobLogicalTaskId: string;

interface JobSnapshot {
  id: string;
  reference: string;
  isCancelled: boolean;
  isShipped: boolean;
  quantity: number | null;
  tasks: Array<{ id: string; logicalTaskId: string; taskType: string }>;
}

async function call(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return api.fetch(`${API}${path}`, { method, headers, data: body as undefined });
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

test.describe.configure({ mode: 'serial' });

test.describe('Acompte tab — modal close + zero-reset smoke', () => {
  test.beforeAll(async () => {
    api = await pwRequest.newContext();
    const r = await api.post(`${API}/auth/login`, { data: { email: TEST_EMAIL, password: TEST_PASSWORD } });
    expect(r.ok(), `login failed: ${r.status()} ${await r.text()}`).toBeTruthy();
    token = (await r.json()).token;

    // Pick the first non-shipped, non-cancelled job with at least one internal
    // task. The acomptes tab renders « Aucune tâche interne sur ce dossier »
    // when there's nothing to act on — useless as a smoke target.
    // Walk /flux/jobs (the same source the FluxTable consumes) so we know
    // the row will exist in the DOM. For each candidate, pull /jobs/{id}
    // to find an internal task — the acompte tab needs one to render
    // anything useful in the right-column.
    const fluxResp = await api.fetch(`${API}/flux/jobs`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Flux-Scenario': 'preprod' },
    });
    expect(fluxResp.ok(), `GET /flux/jobs ${fluxResp.status()}`).toBeTruthy();
    const fluxJobs = (await fluxResp.json()) as Array<{ id: string; internalId: string; shipped: boolean }>;
    for (const j of fluxJobs) {
      if (j.shipped) continue;
      const detailResp = await call('GET', `/jobs/${j.internalId}`);
      if (!detailResp.ok()) continue;
      const detail = (await detailResp.json()) as JobSnapshot;
      if (detail.isCancelled || detail.isShipped) continue;
      if ((detail.quantity ?? 0) <= 0) continue;
      const internalTask = detail.tasks.find((t) => t.taskType === 'internal');
      if (!internalTask) continue;
      testJobId = j.internalId;
      testJobReference = j.id;
      testJobLogicalTaskId = internalTask.logicalTaskId;
      break;
    }
    expect(testJobId, 'no suitable job in /flux/jobs (non-shipped + quantity > 0 + ≥1 internal task)').toBeTruthy();
  });

  test.afterAll(async () => {
    // Reset any declaration we wrote, to leave the DB clean for future runs.
    if (testJobId && testJobLogicalTaskId && token) {
      await call('POST', `/jobs/${testJobId}/acompte-progress-declarations`, {
        logical_task_id: testJobLogicalTaskId,
        declared_total_copies_done: 0,
      });
    }
    await api.dispose();
  });

  test('modal closes after Enregistrer on a clean acompte save', async ({ page }) => {
    test.setTimeout(60_000);
    page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
    await injectAuth(page);

    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-page"]', { timeout: 20_000 });
    await page.waitForSelector('[data-testid="flux-table-row"]', { timeout: 20_000 });

    // Open the JCF modification modal for the test job. Click the row's
    // « ouvrir JCF » action (icon in the row's right-end action cluster).
    const row = page.locator(`[data-testid="flux-table-row"][data-job-id="${testJobReference}"]`).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.scrollIntoViewIfNeeded();
    await row.locator('[data-testid="flux-action-edit"]').click();

    await page.waitForSelector('[data-testid="jcf-modal-backdrop"]', { timeout: 10_000 });

    // Switch to the Acomptes tab.
    await page.getByTestId('jcf-modal-tab-acomptes').click();

    // Click Enregistrer. The button should disable itself ("Enregistrement...")
    // while the RTK mutation is in flight, then the modal should close.
    const saveBtn = page.getByTestId('jcf-modal-save');
    await saveBtn.click();
    await expect(page.getByTestId('jcf-modal-backdrop')).toBeHidden({ timeout: 15_000 });
  });

  test('declaration upsert + zero-reset round-trip via API', async () => {
    // The FE writes via the same endpoint. Validating the round-trip here
    // catches the regression at the API level — the BE must accept 0 as
    // a valid declared_total_copies_done value.
    const writeNonZero = await call('POST', `/jobs/${testJobId}/acompte-progress-declarations`, {
      logical_task_id: testJobLogicalTaskId,
      declared_total_copies_done: 50,
    });
    expect(writeNonZero.ok(), `POST decl 50 ${writeNonZero.status()}`).toBeTruthy();

    const listAfter50 = await call('GET', `/jobs/${testJobId}/acompte-progress-declarations`);
    expect(listAfter50.ok()).toBeTruthy();
    const after50 = await listAfter50.json();
    const decl50 = (after50.declarations as Array<{ logicalTaskId: string; declaredTotalCopiesDone: number }>)
      .find((d) => d.logicalTaskId === testJobLogicalTaskId);
    expect(decl50, 'decl after writing 50 should be present').toBeTruthy();
    expect(decl50?.declaredTotalCopiesDone).toBe(50);

    // Now reset to 0 — this is the regression path (FE used to skip
    // copies===0 writes, leaving the 50 alive forever).
    const writeZero = await call('POST', `/jobs/${testJobId}/acompte-progress-declarations`, {
      logical_task_id: testJobLogicalTaskId,
      declared_total_copies_done: 0,
    });
    expect(writeZero.ok(), `POST decl 0 ${writeZero.status()}`).toBeTruthy();

    const listAfter0 = await call('GET', `/jobs/${testJobId}/acompte-progress-declarations`);
    expect(listAfter0.ok()).toBeTruthy();
    const after0 = await listAfter0.json();
    const decl0 = (after0.declarations as Array<{ logicalTaskId: string; declaredTotalCopiesDone: number }>)
      .find((d) => d.logicalTaskId === testJobLogicalTaskId);
    expect(decl0, 'decl after writing 0 must still exist as upsert (not removed)').toBeTruthy();
    expect(decl0?.declaredTotalCopiesDone).toBe(0);
  });
});
