/**
 * A0b — saisie write path : ProgressCaptureService.reportSaisie() writes
 * the recordedProgressPct + recordedAt anchor on the Task entity.
 *
 * This test exercises the API end-to-end :
 *   1. fetch a snapshot, pick an internal task with an assignment
 *   2. POST /scenarios/prod/saisie/{taskId} with estimatedEnd = start+1h
 *   3. response carries recordedProgressPct + recordedAt
 *   4. re-fetch snapshot, the task's anchor matches the response
 *
 * The headed UI step opens the planning page after the saisie to confirm
 * the new fields don't crash any consumer (visualisation guards the FE
 * regressions even before fond-vert renders the value).
 *
 * Run headed:
 *   pnpm playwright test saisie-writes-recorded-progress --headed --workers=1
 */

import { test, expect, request } from '@playwright/test';
import type { Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const TEST_USER_EMAIL = 'pwtest@flux.local';
const TEST_USER_PASSWORD = 'PwTestPass123!';

async function login(): Promise<{ token: string; ctx: ReturnType<typeof request.newContext> }> {
  const apiContext = await request.newContext();
  const loginRes = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  if (!loginRes.ok()) {
    throw new Error(`Login failed: ${loginRes.status()} ${await loginRes.text()}`);
  }
  const { token } = await loginRes.json();
  return { token, ctx: apiContext as never };
}

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

test('saisie writes the recorded-progress anchor on the task', async ({ page }) => {
  const apiContext = await request.newContext();

  // 1. Login
  const loginRes = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  expect(loginRes.ok(), `login failed: ${loginRes.status()}`).toBeTruthy();
  const { token } = await loginRes.json();
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 2. Find an internal task with an assignment.
  const snapshotRes = await apiContext.get(`${API_BASE_URL}/schedule/snapshot`, {
    headers: authHeaders,
  });
  expect(snapshotRes.ok()).toBeTruthy();
  const snapshot = await snapshotRes.json();

  const assignmentByTaskId = new Map<string, { scheduledStart: string }>();
  for (const a of snapshot.assignments) assignmentByTaskId.set(a.taskId, a);
  const candidate = snapshot.tasks.find(
    (t: { id: string; type: string }) =>
      t.type === 'Internal' && assignmentByTaskId.has(t.id),
  ) as { id: string } | undefined;

  expect(candidate, 'snapshot must include at least one assigned internal task').toBeDefined();
  if (!candidate) return; // type narrowing
  const taskId = candidate.id;
  const assignment = assignmentByTaskId.get(taskId)!;
  const start = new Date(assignment.scheduledStart);

  // 3. Trigger saisie : estimated end = start + 1h.
  const estimatedEnd = new Date(start.getTime() + 60 * 60 * 1000).toISOString();
  const saisieRes = await apiContext.post(
    `${API_BASE_URL}/scenarios/prod/task-progress/${taskId}`,
    { headers: authHeaders, data: { kind: 'endTime', endTime: estimatedEnd } },
  );
  expect(saisieRes.ok(), `saisie failed: ${saisieRes.status()} ${await saisieRes.text()}`).toBeTruthy();
  const saisie = await saisieRes.json();

  // 4. Response carries the new anchor.
  expect(saisie).toHaveProperty('recordedProgressPct');
  expect(saisie).toHaveProperty('recordedAt');
  expect(typeof saisie.recordedProgressPct).toBe('number');
  expect(saisie.recordedProgressPct).toBeGreaterThanOrEqual(0);
  expect(saisie.recordedProgressPct).toBeLessThanOrEqual(100);
  expect(typeof saisie.recordedAt).toBe('string');

  // 5. Re-fetch the snapshot — the task carries the same anchor.
  const reSnap = await apiContext.get(`${API_BASE_URL}/schedule/snapshot`, {
    headers: authHeaders,
  });
  expect(reSnap.ok()).toBeTruthy();
  const reSnapshot = await reSnap.json();
  const refreshedTask = reSnapshot.tasks.find((t: { id: string }) => t.id === taskId);
  expect(refreshedTask, `task ${taskId} present after saisie`).toBeDefined();
  expect(refreshedTask.recordedProgressPct).toBeCloseTo(saisie.recordedProgressPct, 1);
  expect(refreshedTask.recordedAt).toBe(saisie.recordedAt);

  await apiContext.dispose();

  // 6. Headed UI smoke — planning loads cleanly with the freshly-anchored
  //    task in the snapshot. No consumer should crash on the new fields.
  await injectTestAuth(page);
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await page.waitForSelector('[data-testid^="tile-"]', { timeout: 30_000 });

  const fatalErrors = consoleErrors.filter((msg) =>
    /recordedProgressPct|recordedAt/i.test(msg),
  );
  expect(fatalErrors, `unexpected runtime errors: ${fatalErrors.join(' | ')}`).toEqual([]);
});
