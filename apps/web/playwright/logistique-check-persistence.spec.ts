/**
 * E2E test: /logistique — verifying that a checked row stays visible
 * (green) and does not disappear from the column.
 */

import { test, expect, request, type Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const TEST_USER_EMAIL = 'claude-test@flux.local';
const TEST_USER_PASSWORD = 'ClaudeTestPass123!';

async function authenticate(page: Page): Promise<void> {
  const apiContext = await request.newContext();
  const response = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  if (!response.ok()) {
    throw new Error(`login failed ${response.status()} ${await response.text()}`);
  }
  const { token, refreshToken, user } = await response.json();
  await apiContext.dispose();
  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('flux_auth_token', token);
    localStorage.setItem('flux_refresh_token', refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token, refreshToken, user });
}

test.describe('/logistique — check persistence', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
    // /logistique is Prod-only since the env-gating release.
    await page.goto('/logistique?env=prod');
    await page.waitForSelector('h1:has-text("Logistique")');
    await page.waitForTimeout(2500);
    // Switch to "Cette semaine" so we have data regardless of today's date
    await page.locator('button:has-text("Cette semaine")').click();
    await page.waitForTimeout(500);
  });

  test('checking a Departure ST row keeps it visible (green) — no migration', async ({ page }) => {
    // Look for an uncompleted ST departure row
    const candidates = page.locator('[data-testid^="logistics-movement-task-departure-"][data-completed="false"]');
    const count = await candidates.count();
    console.log(`Found ${count} uncompleted Departure ST rows`);
    test.skip(count === 0, 'No uncompleted ST departures available — populate test data first');

    const row = candidates.first();
    const movementId = await row.getAttribute('data-testid');
    if (!movementId) throw new Error('row has no testid');
    const checkSelector = `[data-testid="${movementId.replace('logistics-movement-', 'logistics-check-')}"]`;

    console.log(`Clicking check on ${movementId}`);
    await page.locator(checkSelector).click();
    await page.waitForTimeout(2500);

    // The same row should still exist
    const sameRow = page.locator(`[data-testid="${movementId}"]`);
    const stillVisible = await sameRow.count();
    if (stillVisible === 0) {
      const allRows = await page.locator('[data-testid^="logistics-movement-"]').count();
      const movementIds = await page.locator('[data-testid^="logistics-movement-"]').evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-testid')),
      );
      throw new Error(
        `BUG REPRODUCED: row ${movementId} vanished after check. ` +
        `Total rows now: ${allRows}. IDs: ${movementIds.join(', ')}`,
      );
    }

    const completedAttr = await sameRow.getAttribute('data-completed');
    expect(completedAttr).toBe('true');
  });

  test('ST departure rows show calculated dates (not just provider fallback time)', async ({ page }) => {
    // Wait for outsourced data + snapshot to load.
    await page.waitForTimeout(500);

    const departureRows = page.locator('[data-testid^="logistics-movement-task-departure-"]');
    const count = await departureRows.count();
    test.skip(count === 0, 'No ST departure rows visible — populate outsourced tasks first');

    // Sample up to 5 rows and dump their planned/effective time cells.
    const samples = Math.min(count, 5);
    const observations: string[] = [];
    for (let i = 0; i < samples; i++) {
      const row = departureRows.nth(i);
      const cells = row.locator('div').first(); // first div = "Prévu" cell
      const planned = (await cells.textContent())?.trim() ?? '';
      const title = await row.locator('[class*="text-sm"][class*="font-medium"]').first().textContent();
      observations.push(`${planned} | ${title?.trim()}`);
    }
    console.log('ST departure samples:\n  ' + observations.join('\n  '));

    // Heuristic assertion: at least one row should display a date+time, not
    // just a bare "14:00" fallback. A pure HH:MM string is 5 chars; a real
    // date is "DD/MM HH:MM" or "J-N HH:MM" — both >= 8 chars.
    const hasComputedDate = observations.some((o) => o.split(' | ')[0].length >= 8);
    expect(hasComputedDate, 'expected at least one ST departure with a computed DD/MM HH:MM date').toBe(true);
  });

  test('checking a client expedition row keeps it visible green', async ({ page }) => {
    const candidates = page.locator('[data-testid^="logistics-movement-job-shipped-"][data-completed="false"]');
    const count = await candidates.count();
    console.log(`Found ${count} uncompleted client expeditions`);
    test.skip(count === 0, 'No uncompleted client expeditions available');

    const row = candidates.first();
    const movementId = await row.getAttribute('data-testid');
    if (!movementId) throw new Error('row has no testid');
    const checkSelector = `[data-testid="${movementId.replace('logistics-movement-', 'logistics-check-')}"]`;

    console.log(`Clicking check on ${movementId}`);
    await page.locator(checkSelector).click();
    await page.waitForTimeout(2500);

    const sameRow = page.locator(`[data-testid="${movementId}"]`);
    expect(await sameRow.count()).toBeGreaterThan(0);
    expect(await sameRow.getAttribute('data-completed')).toBe('true');
  });
});
