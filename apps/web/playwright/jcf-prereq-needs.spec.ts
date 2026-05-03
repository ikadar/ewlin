/**
 * E2E test: JCF "needs" prerequisite toggles.
 *
 * The chef declares per-element which prerequisites apply (BAT,
 * Papier, Forme, Plaques) directly in JCF — these flags drive the
 * initial xxxStatus on the backend. Plaques is read-only and derived
 * from the sequence (Presse offset detection).
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

test.describe('JCF — per-element prerequisite needs toggles', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
    await page.goto('/stations/job/new');
    // JCF modal renders the elements table — wait for it.
    await page.waitForSelector('[data-testid="jcf-elements-table"]');
  });

  test('renders 4 prereq rows below the sequence row', async ({ page }) => {
    await expect(page.getByTestId('jcf-row-needsBat')).toBeVisible();
    await expect(page.getByTestId('jcf-row-needsPaper')).toBeVisible();
    await expect(page.getByTestId('jcf-row-needsForme')).toBeVisible();
    await expect(page.getByTestId('jcf-row-needsPlates')).toBeVisible();
  });

  test('BAT is checked by default, others unchecked', async ({ page }) => {
    await expect(page.getByTestId('jcf-checkbox-0-needsBat')).toBeChecked();
    await expect(page.getByTestId('jcf-checkbox-0-needsPaper')).not.toBeChecked();
    await expect(page.getByTestId('jcf-checkbox-0-needsForme')).not.toBeChecked();
    await expect(page.getByTestId('jcf-checkbox-0-needsPlates')).not.toBeChecked();
  });

  test('Plates checkbox is disabled (auto-derived from sequence)', async ({ page }) => {
    await expect(page.getByTestId('jcf-checkbox-0-needsPlates')).toBeDisabled();
  });

  test('User can toggle BAT off and Papier/Forme on', async ({ page }) => {
    await page.getByTestId('jcf-checkbox-0-needsBat').click();
    await expect(page.getByTestId('jcf-checkbox-0-needsBat')).not.toBeChecked();

    await page.getByTestId('jcf-checkbox-0-needsPaper').click();
    await expect(page.getByTestId('jcf-checkbox-0-needsPaper')).toBeChecked();

    await page.getByTestId('jcf-checkbox-0-needsForme').click();
    await expect(page.getByTestId('jcf-checkbox-0-needsForme')).toBeChecked();
  });
});
