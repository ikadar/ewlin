/**
 * E2E test: /flux Désignation column truncation + tooltip on overflow.
 *
 * The ID column was widened (5rem → 7rem) and the Désignation cell now
 * uses TruncatedCell — long labels stay on a single line with ellipsis,
 * a 500ms hover surfaces the full label as a portal-rendered tooltip.
 */

import { test, expect, request, type Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const TEST_USER_EMAIL = 'claude-test@flux.local';
const TEST_USER_PASSWORD = 'ClaudeAuditPwd!';

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

test.describe('/flux Désignation truncation + tooltip', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-designation"]');
  });

  test('Désignation cells render single-line with truncate class', async ({ page }) => {
    const first = page.locator('[data-testid="flux-designation"]').first();
    const inner = first.locator('div.truncate').first();
    await expect(inner).toHaveCount(1);
  });

  test('No tooltip is visible without hover', async ({ page }) => {
    await expect(page.getByTestId('flux-truncate-tooltip')).toHaveCount(0);
  });

  test('Tooltip appears after 500ms hover when content is truncated', async ({ page }) => {
    // Find the first cell whose inner div is actually overflowing.
    const overflowing = await page.evaluateHandle(() => {
      const cells = Array.from(document.querySelectorAll('[data-testid="flux-designation"] div.truncate'));
      return cells.find((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth) ?? null;
    });

    const handle = overflowing.asElement();
    test.skip(handle === null, 'No truncated Désignation in current data — nothing to probe');

    await handle!.hover();
    // Tooltip should NOT appear immediately — guard against accidental
    // 0ms reveal.
    await page.waitForTimeout(200);
    await expect(page.getByTestId('flux-truncate-tooltip')).toHaveCount(0);

    // After the full delay, the tooltip is portal-mounted to body.
    await page.waitForTimeout(500);
    await expect(page.getByTestId('flux-truncate-tooltip')).toBeVisible();

    // Mouse leaves → tooltip disappears.
    await page.mouse.move(0, 0);
    await expect(page.getByTestId('flux-truncate-tooltip')).toHaveCount(0);
  });
});
