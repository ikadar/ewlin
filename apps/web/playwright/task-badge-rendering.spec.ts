/**
 * Task badge rendering — bottom-right `[X%]` indicator showing what
 * share of the parent task each tile represents (Q10 of 2026-05-04
 * mindmap, FE side).
 *
 * Layer-1 contract :
 *   - Unsplit task : badge = 100% on every tile (forceShow).
 *   - Chunk-split task : engine emits `taskSlotVolumePct = 100` per
 *     assignment ; per-window FE breakdown is a follow-up. For now,
 *     all tiles read 100 from the wire format.
 *
 * The headed test asserts :
 *   1. At least one task-badge element is mounted in the planning DOM.
 *   2. Its data-pct attribute is a number in [0, 100].
 *   3. The displayed text matches `${pct}%` (rounded).
 *
 * Run headed:
 *   pnpm playwright test task-badge-rendering --headed --workers=1
 */

import { test, expect, request } from '@playwright/test';
import type { Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const TEST_USER_EMAIL = 'pwtest@flux.local';
const TEST_USER_PASSWORD = 'PwTestPass123!';

async function injectTestAuth(page: Page): Promise<void> {
  const apiContext = await request.newContext();
  const response = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  const { token, refreshToken, user } = await response.json();
  await apiContext.dispose();
  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('flux_auth_token', token);
    localStorage.setItem('flux_refresh_token', refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token, refreshToken, user });
}

test('task badge renders on planning tiles', async ({ page }) => {
  await injectTestAuth(page);
  await page.goto('/');
  await page.waitForSelector('[data-testid^="tile-"]', { timeout: 30_000 });

  const badges = page.locator('[data-testid="task-badge"]');
  await expect(badges.first()).toBeAttached({ timeout: 10_000 });

  // Pull the first badge's pct + text and validate the contract.
  const first = badges.first();
  const pctAttr = await first.getAttribute('data-pct');
  expect(pctAttr).not.toBeNull();
  const pct = Number(pctAttr);
  expect(pct).toBeGreaterThanOrEqual(0);
  expect(pct).toBeLessThanOrEqual(100);

  const text = (await first.textContent())?.trim();
  expect(text).toBe(`${pct}%`);

  // Layer-1 invariant : the engine emits taskSlotVolumePct = 100 on
  // every assignment, so every visible badge should read 100 in the
  // current state of the implementation.
  const allPcts = await badges.evaluateAll((els) =>
    els.map((e) => Number(e.getAttribute('data-pct'))),
  );
  expect(allPcts.length).toBeGreaterThan(0);
  for (const p of allPcts) {
    expect(p).toBe(100);
  }
});
