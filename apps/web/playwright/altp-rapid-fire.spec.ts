/**
 * Regression: Alt+P → Escape → Alt+P must reopen the compute modal every
 * time on the same selected job.
 *
 * Previously the page's global keydown handler cleared selectedJobId on
 * any Escape, including the one dismissing the ComputeModal — so the next
 * Alt+P fired with selectedJobId=null and silently did nothing, which
 * looked like "la modale est figée" from the user's perspective.
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

test('Alt+P → Escape → Alt+P reopens the modal', async ({ page }) => {
  const streamResponses: number[] = [];
  page.on('response', (resp) => {
    if (resp.url().includes('/compute-stream')) streamResponses.push(resp.status());
  });

  await injectAuth(page);
  await page.goto('/');
  await page.waitForSelector('[data-testid^="job-card-"], [data-testid^="tile-"]', { timeout: 20_000 });
  await page.waitForTimeout(400);

  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForTimeout(200);

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Alt+KeyP');
    const reached = await page
      .waitForSelector('button:has-text("Fermer")', { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    expect(reached, `iter ${i} should reach the done state`).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('div.fixed.inset-0.z-50'),
      undefined,
      { timeout: 3000 },
    ).catch(() => null);
    await page.waitForTimeout(200);
  }

  expect(streamResponses.length).toBe(4);
  for (const s of streamResponses) expect(s).toBe(200);
});
