/**
 * Smoke test for B0 — `Operator.concurrentGroups` typing.
 *
 * The PHP `SnapshotBuilder.buildOperators()` emits `concurrentGroups` on every
 * operator entry. The `@flux/types` `Operator` interface declares the field
 * (added 2026-05-04 — closes a typing trou where the payload arrived but
 * TypeScript could not see it). This test guards both contracts together :
 *
 * 1. Data layer — snapshot endpoint returns operators[] with `concurrentGroups`.
 * 2. UI consumption — Operators page renders without runtime errors that
 *    would surface if the typed field disappeared from the payload.
 *
 * Run headed:
 *   pnpm playwright test snapshot-operator-concurrent-groups --headed --workers=1
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
  if (!response.ok()) {
    throw new Error(`Test login failed: ${response.status()} ${await response.text()}`);
  }
  const { token, refreshToken, user } = await response.json();
  await apiContext.dispose();

  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('flux_auth_token', token);
    localStorage.setItem('flux_refresh_token', refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token, refreshToken, user });
}

test('snapshot operators expose concurrentGroups field (data + UI)', async ({ page }) => {
  // 1. Data-layer assertion — the snapshot wire format carries the field.
  const apiContext = await request.newContext();
  const loginRes = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  expect(loginRes.ok(), `login failed: ${loginRes.status()}`).toBeTruthy();
  const { token } = await loginRes.json();

  const snapshotRes = await apiContext.get(`${API_BASE_URL}/schedule/snapshot`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(snapshotRes.ok(), `snapshot fetch failed: ${snapshotRes.status()}`).toBeTruthy();
  const snapshot = await snapshotRes.json();

  expect(Array.isArray(snapshot.operators)).toBe(true);
  // Guard against trivially-passing iteration on an empty payload — if the
  // DB had no operators the for-of below would assert nothing.
  expect(snapshot.operators.length, 'snapshot must have operators to test').toBeGreaterThan(0);

  for (const op of snapshot.operators) {
    expect(op.concurrentGroups, `operator ${op.id} concurrentGroups`).toBeDefined();
    expect(Array.isArray(op.concurrentGroups)).toBe(true);
    for (const g of op.concurrentGroups) {
      expect(typeof g.id).toBe('string');
      expect(Array.isArray(g.stationIds)).toBe(true);
      expect(g.stationIds).toHaveLength(2);
      expect(typeof g.effectiveProductivity).toBe('object');
      for (const stationId of g.stationIds) {
        const prod = g.effectiveProductivity[stationId];
        expect(typeof prod).toBe('number');
        expect(prod).toBeGreaterThanOrEqual(0);
        expect(prod).toBeLessThanOrEqual(1.5);
      }
    }
  }
  await apiContext.dispose();

  // 2. UI assertion — Operators page renders without crashing. The page
  //    consumes `Operator.concurrentGroups` through the typed snapshot ;
  //    if the field had disappeared from the payload (or its shape drifted),
  //    React would either show empty rows or throw on `.map`.
  await injectTestAuth(page);
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/settings/operators');
  await expect(page.getByRole('heading', { name: 'Opérateurs', exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // The operators table renders one data row per operator with a
  // cursor-pointer class (distinct from the empty-state row). Wait until
  // at least one data row appears so the snapshot has been consumed.
  await page.waitForSelector('tr.cursor-pointer', { timeout: 15_000 });

  // No runtime errors that mention the concurrent-groups consumption path.
  // The regex stays specific to the field name to avoid masking unrelated
  // test failures behind a paranoid filter.
  const fatalErrors = consoleErrors.filter((msg) =>
    /concurrentGroups|concurrent_groups/i.test(msg),
  );
  expect(fatalErrors, `unexpected runtime errors: ${fatalErrors.join(' | ')}`).toEqual([]);
});
