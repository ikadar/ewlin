/**
 * Smoke test for A0 — `Task.recordedProgressPct` + `Task.recordedAt` storage.
 *
 * The PHP `Task` entity now persists an optimistic progress anchor
 * (Q4 of 2026-05-04 mindmap, task-level). `SnapshotBuilder.buildTask()`
 * exposes both fields on every Internal task ; this test guards :
 *
 * 1. Data layer — snapshot tasks emit recordedProgressPct + recordedAt
 *    (both nullable, both null until first saisie).
 * 2. Pair invariant — if one is set the other is too. NULL/NULL pair is
 *    the only valid "absent" representation.
 * 3. Wire shape — pct is a number in [0, 100] when present, recordedAt
 *    is an ISO 8601 timestamp string.
 * 4. UI consumption — the planning grid renders without runtime errors
 *    that would surface if the typed fields had drifted. (Headed.)
 *
 * Run headed:
 *   pnpm playwright test snapshot-task-recorded-progress --headed --workers=1
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

test('snapshot internal tasks expose recordedProgressPct + recordedAt', async ({ page }) => {
  // 1. Data-layer assertions on the wire format.
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

  expect(Array.isArray(snapshot.tasks)).toBe(true);
  // Guard against a trivial pass on an empty payload.
  expect(snapshot.tasks.length, 'snapshot must have tasks').toBeGreaterThan(0);

  const internalTasks = snapshot.tasks.filter((t: { type: string }) => t.type === 'Internal');
  expect(internalTasks.length, 'snapshot must have at least one internal task').toBeGreaterThan(0);

  for (const task of internalTasks) {
    // Field presence — `undefined` would mean the SnapshotBuilder regressed.
    expect(task, `task ${task.id} keys`).toHaveProperty('recordedProgressPct');
    expect(task, `task ${task.id} keys`).toHaveProperty('recordedAt');

    const pct = task.recordedProgressPct;
    const at = task.recordedAt;

    // Pair invariant : both NULL or both present.
    if (pct === null) {
      expect(at, `task ${task.id} : pct=null requires at=null`).toBeNull();
    } else {
      expect(at, `task ${task.id} : pct=${pct} requires at`).not.toBeNull();
      expect(typeof pct).toBe('number');
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
      expect(typeof at).toBe('string');
      // ISO 8601 — accept both basic datetime forms (with or without ms).
      expect(at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
  }
  await apiContext.dispose();

  // 2. UI consumption — planning loads without runtime errors that would
  //    surface if a downstream consumer mis-parsed the new fields.
  await injectTestAuth(page);
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  // The grid uses a custom virtualisation layer ; a tile testid is the
  // most stable signal that the snapshot has been rendered.
  await page.waitForSelector('[data-testid^="tile-"]', { timeout: 30_000 });

  const fatalErrors = consoleErrors.filter((msg) =>
    /recordedProgressPct|recordedAt|cannot read prop/i.test(msg),
  );
  expect(fatalErrors, `unexpected runtime errors: ${fatalErrors.join(' | ')}`).toEqual([]);
});
