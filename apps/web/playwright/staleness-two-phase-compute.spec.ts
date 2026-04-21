/**
 * Playwright end-to-end: two-phase compute + unified toaster.
 *
 * Flow exercised:
 *   1. Log in against the real PHP API.
 *   2. Open a job and its JCF edit modal.
 *   3. Save without changes → triggers useAutoRecompute:
 *        Phase 1 → POST /schedule/compute (proxied to Rust /compute-fast)
 *        Phase 2 → POST /schedule/compute-lns/stream (SSE, up to 60 s)
 *   4. Observe the toaster chain:
 *        - progress "Recalcul du planning" appears
 *        - in-place update to success "Planning à jour"
 *        - optional waze "Optimisation auto appliquée" when LNS improves
 *
 * Memory rule: this test must use the real DB + real API — no fixture
 * mode. Pre-reqs: PHP API on :8080, Rust engine on :3003 (rebuild
 * after engine changes), dev server reusable on :5173.
 */

import { test, request, expect, type Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const EMAIL = 'playwright-dev@flux.local';
const PASS = 'PlaywrightDevPassword123!';

async function injectAuth(page: Page) {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_BASE_URL}/auth/login`, {
    data: { email: EMAIL, password: PASS },
  });
  if (!res.ok()) throw new Error(`Login failed ${res.status()}`);
  const { token, refreshToken, user } = await res.json();
  await ctx.dispose();
  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('flux_auth_token', token);
    localStorage.setItem('flux_refresh_token', refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token, refreshToken, user });
}

test('JCF save triggers fast compute + LNS stream with unified toaster', async ({ page }) => {
  const computeCalls: string[] = [];
  const lnsStreamCalls: string[] = [];
  const relevantResponses: Array<{ url: string; status: number; method: string }> = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.endsWith('/schedule/compute') && req.method() === 'POST') {
      computeCalls.push(url);
    } else if (url.endsWith('/schedule/compute-lns/stream') && req.method() === 'POST') {
      lnsStreamCalls.push(url);
    }
  });
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('/api/v1/jobs/') || url.includes('/schedule/compute')) {
      relevantResponses.push({ url, status: resp.status(), method: resp.request().method() });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser ${msg.type()}]`, msg.text());
    }
  });

  await injectAuth(page);
  // App.tsx (with auto-recompute + toaster) lives under /stations.
  // Root / routes to OperatorSchedulePage, which does not wire the hook.
  await page.goto('/stations');

  // Wait for the planning shell to show jobs.
  await page.waitForSelector('[data-testid^="tile-"]', { timeout: 30_000 });
  // Let the planning stabilise — scroll/collapse computations happen async.
  await page.waitForTimeout(500);

  // Select any job by clicking its first visible tile, scrolling into
  // view to ensure the click lands on the right element.
  const firstTile = page.locator('[data-testid^="tile-"]').first();
  await firstTile.scrollIntoViewIfNeeded();
  await firstTile.click();

  await page.screenshot({ path: 'test-results/step-01-after-tile-click.png', fullPage: false });

  // The JobDetailsPanel should now expose the Edit button.
  const editButton = page.getByTestId('job-details-edit-button');
  try {
    await editButton.waitFor({ state: 'visible', timeout: 10_000 });
  } catch (err) {
    await page.screenshot({ path: 'test-results/step-02-no-edit-button.png', fullPage: true });
    throw err;
  }
  await editButton.click();
  await page.screenshot({ path: 'test-results/step-03-after-edit-click.png' });

  // JCF modal opens — save without modifying anything.
  const saveButton = page.getByTestId('jcf-modal-save');
  try {
    await saveButton.waitFor({ state: 'visible', timeout: 10_000 });
  } catch (err) {
    await page.screenshot({ path: 'test-results/step-04-no-save-button.png', fullPage: true });
    throw err;
  }
  await saveButton.click();
  await page.screenshot({ path: 'test-results/step-05-after-save-click.png' });

  // --- Phase 1: progress → success ---------------------------------
  // Progress toast pins "Recalcul du planning".
  try {
    await expect(page.getByText(/Recalcul du planning/)).toBeVisible({ timeout: 10_000 });
  } catch (err) {
    await page.screenshot({ path: 'test-results/step-06-no-progress-toast.png', fullPage: true });
    console.log('Compute calls:', computeCalls.length, computeCalls);
    console.log('LNS stream calls:', lnsStreamCalls.length, lnsStreamCalls);
    console.log('Relevant responses:', relevantResponses);
    throw err;
  }

  // In-place swap to success "Planning à jour".
  await expect(page.getByText(/Planning à jour/)).toBeVisible({ timeout: 30_000 });

  // --- Phase 2: LNS stream call was initiated ----------------------
  // We don't assert the waze toast because LNS only fires it if it
  // finds a strictly-better solution — data-dependent. The network
  // request itself being issued is the reliable signal that the
  // hook wires Phase 1 → Phase 2 correctly.
  await expect.poll(() => lnsStreamCalls.length, { timeout: 15_000 }).toBeGreaterThan(0);

  expect(computeCalls.length).toBeGreaterThan(0);
});
