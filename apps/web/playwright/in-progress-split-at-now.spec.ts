/**
 * D — Engine split-at-NOW end-to-end (Q1 of 2026-05-04 mindmap).
 *
 * The engine treats in-progress pins (scheduledStart < now < scheduledEnd
 * && !isCompleted) by splitting at NOW : the past portion stays anchored
 * verbatim while the future portion is freed for replan. PHP emits the
 * `isInProgress: true` flag and `taskElapsedTicks` so the engine takes
 * the right branch.
 *
 * The test exercises the full chain :
 *   1. Pick an internal task with a past-started assignment.
 *   2. Force an in-progress state via saisie (estimatedEnd in the future).
 *   3. Re-fetch snapshot, verify the assignment is still placed.
 *   4. Verify the FE doesn't crash on the in-progress payload (no
 *      console errors mentioning the new fields).
 *
 * Algo + tests covered by `feedback_in_progress_committed.md` IMPLEMENTED
 * 2026-05-05 — 183 Rust tests green.
 *
 * Run headed:
 *   pnpm playwright test in-progress-split-at-now --headed --workers=1
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

test('engine accepts in-progress split-at-NOW assignments without crashing', async ({ page }) => {
  const apiContext = await request.newContext();

  const loginRes = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { token } = await loginRes.json();
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Find any internal task with an assignment that started in the past.
  const snap = await apiContext.get(`${API_BASE_URL}/schedule/snapshot`, {
    headers: authHeaders,
  }).then((r) => r.json());

  const nowMs = Date.now();
  const assByTask = new Map<string, { scheduledStart: string; scheduledEnd: string }>();
  for (const a of snap.assignments) assByTask.set(a.taskId, a);
  const candidate = snap.tasks.find(
    (t: { id: string; type: string }) => {
      if (t.type !== 'Internal') return false;
      const a = assByTask.get(t.id);
      return !!a && new Date(a.scheduledStart).getTime() < nowMs;
    },
  ) as { id: string } | undefined;
  expect(candidate, 'snapshot must include a past-started internal task').toBeDefined();
  if (!candidate) return;
  const taskId = candidate.id;

  // Force an in-progress state : estimatedEnd lies in the future, so
  // post-saisie the assignment satisfies start<now<end => the engine
  // takes the split-at-NOW branch on the next replan.
  const futureEnd = new Date(nowMs + 30 * 60 * 1000).toISOString();
  const saisieRes = await apiContext.post(
    `${API_BASE_URL}/scenarios/prod/saisie/${taskId}`,
    { headers: authHeaders, data: { estimatedEndTime: futureEnd } },
  );
  expect(saisieRes.ok(), `saisie failed: ${saisieRes.status()}`).toBeTruthy();

  // Re-fetch the snapshot — engine emitted assignments after the
  // implicit replan triggered by saisie. The targeted task should still
  // be placed (engine didn't drop it on the in-progress branch).
  const snap2 = await apiContext.get(`${API_BASE_URL}/schedule/snapshot`, {
    headers: authHeaders,
  }).then((r) => r.json());
  const refreshedAssignment = snap2.assignments.find(
    (a: { taskId: string }) => a.taskId === taskId,
  );
  expect(refreshedAssignment, 'in-progress task stays placed post-replan').toBeDefined();
  expect(typeof refreshedAssignment.scheduledStart).toBe('string');
  expect(typeof refreshedAssignment.scheduledEnd).toBe('string');

  await apiContext.dispose();

  // Headed UI smoke — planning loads with the in-progress payload.
  await injectTestAuth(page);
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await page.waitForSelector('[data-testid^="tile-"]', { timeout: 30_000 });

  const fatalErrors = consoleErrors.filter((msg) =>
    /isInProgress|taskElapsedTicks|forced_start_tick|already_eaten/i.test(msg),
  );
  expect(fatalErrors).toEqual([]);
});
