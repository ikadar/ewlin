/**
 * JDP unplaced-task progress rendering — for préprod / fork scenarios where
 * an unplaced task carries the progress anchor inherited from prod at fork
 * time. The rendering reuses the gradient strategy used on placed tiles :
 * the unplaced task tile's body bg becomes a horizontal `linear-gradient`
 * (green → default) and the left border flips to the completed colour.
 *
 * The test :
 *   1. Picks an internal task without an assignment.
 *   2. Forces `recordedProgressPct = 50` via the record-progress-direct
 *      endpoint (IA palette path — does not require an assignment).
 *   3. Selects the task's job, opens the JDP.
 *   4. Asserts the unplaced task tile mounts a `progress-fill` marker with
 *      the expected pct.
 *
 * Run headed:
 *   pnpm playwright test jdp-unplaced-task-progress --headed --workers=1
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

test('unplaced task in JDP renders progress fill from recordedProgressPct', async ({ page }) => {
  const apiContext = await request.newContext();

  const loginRes = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { token } = await loginRes.json();
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Reset to clean state then snapshot.
  await apiContext.post(`${API_BASE_URL}/scenarios/prod/clear-recorded-progress`, {
    headers: authHeaders,
  });
  const snap = await apiContext.get(`${API_BASE_URL}/schedule/snapshot`, {
    headers: authHeaders,
  }).then((r) => r.json());

  // Build the assignment map + element index, but defer the unplaced-task
  // pick until we know which job is currently visible in the JobsList
  // (the list virtualises, so picking a job at random often lands on an
  // off-viewport row that the test can't click without scrolling).
  const assignedTaskIds = new Set<string>(
    snap.assignments.map((a: { taskId: string }) => a.taskId),
  );
  const elementById = new Map<string, { jobId: string }>(
    snap.elements.map((e: { id: string; jobId: string }) => [e.id, e]),
  );
  // Group internal-unplaced tasks per job for quick lookup.
  const unplacedByJob = new Map<string, string[]>();
  for (const t of snap.tasks) {
    if (t.type !== 'Internal' || assignedTaskIds.has(t.id)) continue;
    const jobId = elementById.get(t.elementId)?.jobId;
    if (!jobId) continue;
    const arr = unplacedByJob.get(jobId) ?? [];
    arr.push(t.id);
    unplacedByJob.set(jobId, arr);
  }
  expect(unplacedByJob.size).toBeGreaterThan(0);

  await apiContext.dispose();

  // Open the planning, then pick the FIRST visible job card and use its
  // jobId for the rest of the test — guarantees the card is clickable.
  await injectTestAuth(page);
  await page.goto('/');
  await page.waitForSelector('[data-testid="jobs-list"]', { timeout: 30_000 });
  // The default tab is "Planifiées" which is empty when no internal tasks
  // are placed. Switch to "Non planifiées" so cards surface.
  await page.getByText(/Non planifiées/i).first().click();
  await page.waitForSelector('[data-testid^="job-card-"]', { timeout: 10_000 });

  // Pick the first visible job card and its first unplaced task ; set
  // progress via API ; reload so the FE picks up the fresh snapshot ;
  // re-select the same job and verify the rendering.
  const firstCardSel = '[data-testid^="job-card-"]';
  const cardTestId = await page.locator(firstCardSel).first().getAttribute('data-testid');
  expect(cardTestId).not.toBeNull();
  const jobId = cardTestId!.replace(/^job-card-/, '');
  const taskIds = unplacedByJob.get(jobId);
  expect(taskIds && taskIds.length > 0, `job ${jobId} (first visible) must have unplaced tasks`).toBeTruthy();
  if (!taskIds || taskIds.length === 0) return;
  const taskId = taskIds[0];

  const apiCtx2 = await request.newContext();
  const recordRes = await apiCtx2.post(
    `${API_BASE_URL}/scenarios/prod/task-progress/${taskId}`,
    { headers: authHeaders, data: { kind: 'pct', pct: 50 } },
  );
  expect(recordRes.ok()).toBeTruthy();
  await apiCtx2.dispose();

  // Reload so the FE re-fetches the snapshot post-write, then re-open
  // the same job card.
  await page.reload();
  await page.waitForSelector('[data-testid="jobs-list"]', { timeout: 30_000 });
  await page.getByText(/Non planifiées/i).first().click();
  await page.waitForSelector(`[data-testid="job-card-${jobId}"]`, { timeout: 15_000 });
  await page.locator(`[data-testid="job-card-${jobId}"]`).click();
  await page.waitForSelector(`[data-testid="task-tile-${taskId}"]`, { timeout: 15_000 });

  const tile = page.locator(`[data-testid="task-tile-${taskId}"]`);
  await expect(tile).toBeVisible();

  // The progress marker is mounted inside the unplaced tile when
  // recordedProgressPct > 0.
  const fill = tile.locator('[data-testid="progress-fill"]').first();
  await expect(fill).toBeAttached({ timeout: 5_000 });
  await expect(fill).toHaveAttribute('data-direction', 'horizontal');

  const pctAttr = await fill.getAttribute('data-pct');
  expect(pctAttr).not.toBeNull();
  const pct = Number(pctAttr);
  expect(pct).toBeCloseTo(50, 0);
});
