/**
 * E2E test: env-conditional gating.
 *
 * Logistique is hidden in Préprod ; Scénarios is hidden in Prod.
 * Twin redirect: deep-link or env toggle lands on the equivalent
 * screen in the target env (Logistique <-> Scénarios) instead of /.
 */

import { test, expect, request, type Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const TEST_USER_EMAIL = 'claude-test@flux.local';
const TEST_USER_PASSWORD = 'ClaudeAuditPwd!';

async function authenticate(page: Page): Promise<string> {
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
  return token;
}

test.describe('Env-conditional gating', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('Préprod sidebar: Scénarios visible, Logistique hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Scénarios' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logistique' })).toHaveCount(0);
  });

  test('Prod sidebar: Logistique visible, Scénarios hidden', async ({ page }) => {
    await page.goto('/?env=prod');
    await expect(page.getByRole('button', { name: 'Logistique' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scénarios' })).toHaveCount(0);
  });

  test('Logistique deep-link in Préprod jumps to twin /scenarios', async ({ page }) => {
    await page.goto('/logistique');
    await expect(page).toHaveURL(/\/scenarios$/);
  });

  test('Scénarios deep-link in Prod jumps to twin /logistique?env=prod', async ({ page }) => {
    await page.goto('/scenarios?env=prod');
    await expect(page).toHaveURL(/\/logistique\?env=prod$/);
  });

  test('Switch Prod→Préprod from /logistique lands on twin /scenarios', async ({ page }) => {
    await page.goto('/logistique?env=prod');
    await page.getByTestId('env-toggle-preprod').click();
    await expect(page).toHaveURL(/\/scenarios$/);
  });

  test('Switch Préprod→Prod from /scenarios lands on twin /logistique?env=prod', async ({ page }) => {
    await page.goto('/scenarios');
    await page.getByTestId('env-toggle-prod').click();
    await expect(page).toHaveURL(/\/logistique\?env=prod$/);
  });

  test('Non-twin route preserves path on env switch', async ({ page }) => {
    await page.goto('/flux');
    await page.getByTestId('env-toggle-prod').click();
    await expect(page).toHaveURL(/\/flux\?env=prod$/);
  });

  test('Backend rejects POST /logistics-notes in Préprod', async ({ page }) => {
    const token = await authenticate(page);
    const apiContext = await request.newContext();
    const resp = await apiContext.post(`${API_BASE_URL}/logistics-notes`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Flux-Scenario': 'preprod',
        'Content-Type': 'application/json',
      },
      data: { refType: 'job', refId: '00000000-0000-0000-0000-000000000000', note: 'guard-probe' },
    });
    expect(resp.status()).toBe(403);
    await apiContext.dispose();
  });
});
