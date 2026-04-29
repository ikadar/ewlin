/**
 * E2E test — V1 versioning promotion flow.
 *
 * Verifies the chef d'atelier's promotion ritual end-to-end:
 *   1. Page renders the PlanningEnvHeader at the top
 *   2. The Préprod | Prod toggle is present and Préprod is active
 *   3. Click Promouvoir → modal opens with the 2-tile KPI strip
 *   4. Hold the dwell button 1.4 s → modal closes, promotion fires
 *   5. The post-promotion undo toast appears top-right
 *   6. Click Undo → the toast disappears
 *
 * The test seeds an initial promotion via the API beforehand so that the
 * promotion exercised by the test rotates a non-null payload into
 * previous_payload (which is what enables the undo toast).
 *
 * Run with:
 *   pnpm playwright test versioning-promotion --headed --workers=1
 */

import { test, expect, request } from '@playwright/test';
import type { Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const TEST_USER_EMAIL = 'pwtest@flux.local';
const TEST_USER_PASSWORD = 'PwTestPass123!';

async function loginAndGetToken(): Promise<string> {
  const apiContext = await request.newContext();
  const response = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  if (!response.ok()) {
    throw new Error(`Test login failed: ${response.status()} ${await response.text()}`);
  }
  const { token } = await response.json();
  await apiContext.dispose();
  return token;
}

/**
 * Inject the test user's auth token into localStorage so the React app
 * boots authenticated. Must be called before page.goto().
 */
async function injectTestAuth(page: Page, token: string): Promise<void> {
  // Build the rest of the auth payload by re-hitting login (cheap, single shot).
  const apiContext = await request.newContext();
  const loginRes = await apiContext.post(`${API_BASE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  const { refreshToken, user } = await loginRes.json();
  await apiContext.dispose();

  await page.addInitScript(
    ({ token, refreshToken, user }) => {
      localStorage.setItem('flux_auth_token', token);
      localStorage.setItem('flux_refresh_token', refreshToken);
      localStorage.setItem('flux_auth_user', JSON.stringify(user));
    },
    { token, refreshToken, user },
  );
}

/**
 * Ensure the prod scenario has a non-null payload before the test runs.
 * Performs a single promotion via the API. Idempotent — if the prod
 * already has a payload this still rotates it (cheap).
 */
async function seedInitialPromotion(token: string): Promise<void> {
  const apiContext = await request.newContext();
  const res = await apiContext.post(`${API_BASE_URL}/promotion`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    throw new Error(`Seed promotion failed: ${res.status()} ${await res.text()}`);
  }
  await apiContext.dispose();
}

test.describe('Versioning v1 — promotion flow', () => {
  test('renders the planning env header with toggle + Promouvoir CTA', async ({ page }) => {
    const token = await loginAndGetToken();
    await injectTestAuth(page, token);
    await page.goto('/');

    const header = page.getByTestId('planning-env-header');
    await expect(header).toBeVisible();

    // Préprod tab is active by default
    const preprodTab = header.getByRole('tab', { name: /^Préprod$/ });
    await expect(preprodTab).toHaveAttribute('aria-selected', 'true');

    // Promouvoir CTA visible in préprod
    await expect(header.getByTestId('promote-cta')).toBeVisible();
  });

  test('Préprod | Prod toggle switches mode and updates URL', async ({ page }) => {
    const token = await loginAndGetToken();
    await injectTestAuth(page, token);
    await page.goto('/');

    const header = page.getByTestId('planning-env-header');
    await header.getByRole('tab', { name: /^Prod$/ }).click();

    // URL gains ?env=prod
    await expect(page).toHaveURL(/[?&]env=prod\b/);

    // Promote CTA disappears in prod
    await expect(header.getByTestId('promote-cta')).toHaveCount(0);

    // Switch back
    await header.getByRole('tab', { name: /^Préprod$/ }).click();
    await expect(page).not.toHaveURL(/[?&]env=prod\b/);
    await expect(header.getByTestId('promote-cta')).toBeVisible();
  });

  test('promotion modal opens and shows KPI tiles', async ({ page }) => {
    const token = await loginAndGetToken();
    await injectTestAuth(page, token);
    await seedInitialPromotion(token);
    await page.goto('/');

    const header = page.getByTestId('planning-env-header');
    await header.getByTestId('promote-cta').click();

    const modal = page.getByTestId('promotion-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Jobs planifiés/i)).toBeVisible();
    await expect(modal.getByText(/Jobs en retard/i)).toBeVisible();
  });

  test('dwell-to-confirm 1.2s fires the promotion and closes the modal', async ({ page }) => {
    const token = await loginAndGetToken();
    await injectTestAuth(page, token);
    await seedInitialPromotion(token); // ensure prod has a payload
    await page.goto('/');

    const header = page.getByTestId('planning-env-header');
    await header.getByTestId('promote-cta').click();

    const dwellBtn = page.getByTestId('promotion-dwell-button');
    await expect(dwellBtn).toBeVisible();
    // Wait for the preview query to settle so the modal layout is stable
    // before we sample the bounding box for the press-and-hold.
    await expect(page.getByTestId('promotion-modal').getByText(/—/)).toHaveCount(0, { timeout: 10_000 });

    // Hover places the mouse on the button center; mouseDown then holds it
    // there. waitForTimeout > 1200ms triggers the dwell timer.
    await dwellBtn.hover();
    await page.mouse.down();
    await page.waitForTimeout(1400);
    await page.mouse.up();

    // Modal closes after confirmation
    await expect(page.getByTestId('promotion-modal')).toHaveCount(0, { timeout: 5_000 });
  });

  test('undo toast appears after a second promotion (rotated payload enables undo)', async ({ page }) => {
    const token = await loginAndGetToken();
    await injectTestAuth(page, token);
    // Two seed promotions so the second installs a non-null previous_payload.
    await seedInitialPromotion(token);
    await seedInitialPromotion(token);
    await page.goto('/');

    const header = page.getByTestId('planning-env-header');
    await header.getByTestId('promote-cta').click();

    const dwellBtn = page.getByTestId('promotion-dwell-button');
    await expect(dwellBtn).toBeVisible();
    await expect(page.getByTestId('promotion-modal').getByText(/—/)).toHaveCount(0, { timeout: 10_000 });

    await dwellBtn.hover();
    await page.mouse.down();
    await page.waitForTimeout(1400);
    await page.mouse.up();

    // Undo toast surfaces top-right
    const undoToast = page.getByTestId('promotion-undo-toast');
    await expect(undoToast).toBeVisible({ timeout: 5_000 });
    await expect(undoToast.getByRole('button', { name: /Annuler/ })).toBeVisible();
  });
});
