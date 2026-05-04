/**
 * C — `TaskAssignment.taskSlotVolumePct` badge % wire format.
 *
 * Each TaskAssignment represents the whole task, so taskSlotVolumePct is
 * a constant 100 at the assignment layer (Q10 of 2026-05-04 mindmap).
 * Chunk-split rendering (one tile per activeWindow) derives per-tile
 * values FE-side ; this test guards the layer-1 contract :
 *
 * 1. Every assignment carries `taskSlotVolumePct: number`.
 * 2. The value is exactly 100 (sum invariant degenerate to a single chunk).
 * 3. Planning UI loads cleanly with the new field in the payload.
 *
 * Run headed:
 *   pnpm playwright test snapshot-task-slot-volume-pct --headed --workers=1
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

test('snapshot assignments expose taskSlotVolumePct = 100', async ({ page }) => {
  const apiContext = await request.newContext();
  const loginRes = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { token } = await loginRes.json();

  const snapshotRes = await apiContext.get(`${API_BASE_URL}/schedule/snapshot`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(snapshotRes.ok()).toBeTruthy();
  const snapshot = await snapshotRes.json();

  expect(Array.isArray(snapshot.assignments)).toBe(true);
  expect(snapshot.assignments.length, 'snapshot must have assignments').toBeGreaterThan(0);

  for (const a of snapshot.assignments) {
    expect(a, `assignment ${a.id} : taskSlotVolumePct`).toHaveProperty('taskSlotVolumePct');
    expect(typeof a.taskSlotVolumePct).toBe('number');
    // Layer-1 contract : whole-task assignment ⇒ exactly 100.
    expect(a.taskSlotVolumePct).toBe(100);
  }

  await apiContext.dispose();

  // Headed UI smoke — planning loads with the new field. Should produce
  // no console errors related to the badge wire shape.
  await injectTestAuth(page);
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await page.waitForSelector('[data-testid^="tile-"]', { timeout: 30_000 });

  const fatalErrors = consoleErrors.filter((msg) => /taskSlotVolumePct/i.test(msg));
  expect(fatalErrors).toEqual([]);
});
