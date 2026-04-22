/**
 * Ctrl+Alt+P must surface compute feedback through the ComputeReportToast,
 * not the ComputeModal.
 *
 * Validated visually in playground-compute-info-toast.html.
 */

import { test, request, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const EMAIL = 'playwright-dev@flux.local';
const PASS = 'PlaywrightDevPassword123!';

async function injectAuth(page: import('@playwright/test').Page) {
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

test('Ctrl+Alt+P shows the report toast (not the modal) and runs Phase-1 only', async ({ page }) => {
  const fastStreamHits: number[] = [];
  const lnsStreamHits: number[] = [];
  const fastRequestBodies: string[] = [];
  page.on('request', (req) => {
    if (req.url().endsWith('/compute-stream')) {
      fastRequestBodies.push(req.postData() ?? '');
    }
  });
  page.on('response', (resp) => {
    const url = resp.url();
    if (url.endsWith('/compute-stream')) fastStreamHits.push(resp.status());
    else if (url.endsWith('/compute-lns/stream')) lnsStreamHits.push(resp.status());
  });

  await injectAuth(page);
  await page.goto('/');
  await page.waitForSelector('[data-testid^="job-card-"], [data-testid^="tile-"]', { timeout: 20_000 });
  await page.waitForTimeout(400);

  await page.keyboard.press('Control+Alt+KeyP');

  const toast = page.locator('[data-testid="compute-report-toast"]');
  await expect(toast).toBeVisible({ timeout: 10_000 });

  // Modal overlay must not appear.
  const modalOverlay = page.locator('div.fixed.inset-0.z-50').first();
  await expect(modalOverlay).toHaveCount(0);

  // Phase-1 SSE completes quickly without the LNS section — no "Recherche
  // d'améliorations" step should ever be rendered in the toast body.
  await expect(toast).toHaveAttribute('data-phase', 'done', { timeout: 60_000 });
  await expect(toast.locator('text=Recherche d\'améliorations')).toHaveCount(0);

  // Fast stream fired with skipLns: true.
  expect(fastStreamHits.length).toBeGreaterThanOrEqual(1);
  for (const s of fastStreamHits) expect(s).toBe(200);
  expect(fastRequestBodies[0]).toContain('"skipLns":true');

  // Background LNS fires after Phase-1 done.
  await expect.poll(() => lnsStreamHits.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  for (const s of lnsStreamHits) expect(s).toBe(200);

  await page.screenshot({
    path: 'test-results/ctrl-alt-p-report-toast.png',
    fullPage: false,
  });
});
