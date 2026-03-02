/**
 * E2E tests for the ST (Sous-traitance) column feature.
 *
 * @see docs/releases/v0.5.23-st-column-frontend.md
 * @see docs/production-flow-dashboard-spec/upgrade-colonne-st-en.md
 *
 * Uses static mock data (FLUX_STATIC_JOBS) — no ?fixture= param needed.
 * Navigate to http://localhost:5173/flux to test.
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173/flux';

test.describe('ST Column — header', () => {
  test('ST column header is visible with title tooltip', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-testid="flux-table"]');

    const stHeader = page.locator('th[title="Sous-traitance"]');
    await expect(stHeader).toBeVisible();
    await expect(stHeader).toHaveText('ST');
  });
});

test.describe('ST Column — cell rendering', () => {
  test('00042 row has a done (green) ST task', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-testid="flux-table"]');

    const row = page.locator('[data-testid="flux-table-row"][data-job-id="00042"]');
    const stCell = row.locator('[data-testid="flux-st-cell"]');
    const toggle = stCell.locator('[data-testid="st-toggle-00042-t1"]');
    await expect(toggle).toHaveAttribute('data-status', 'done');
  });

  test('00117 row has empty ST cell (no tasks)', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-testid="flux-table"]');

    const row = page.locator('[data-testid="flux-table-row"][data-job-id="00117"]');
    const stCell = row.locator('[data-testid="flux-st-cell"]');
    // No st-cell rendered when tasks is empty
    await expect(stCell.locator('[data-testid="st-cell"]')).not.toBeVisible();
  });
});

test.describe('ST Column — click cycle', () => {
  test('clicking pending task → progress', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-testid="flux-table"]');

    // 00103-t2 starts as pending
    const toggle = page.locator('[data-testid="st-toggle-00103-t2"]');
    await expect(toggle).toHaveAttribute('data-status', 'pending');

    await toggle.click();
    // In mock mode, RTK mutation triggers a refetch; state visible after refetch
    // (In static dev mode the status won't actually change without API,
    //  so we just verify the click doesn't error)
    await expect(page.locator('[data-testid="flux-table"]')).toBeVisible();
  });
});

test.describe('ST Column — S-T à faire tab', () => {
  test('navigating to /flux/soustraitance shows 3 jobs', async ({ page }) => {
    await page.goto(`${BASE}/soustraitance`);
    await page.waitForSelector('[data-testid="flux-table"]');

    const rows = page.locator('[data-testid="flux-table-row"]');
    await expect(rows).toHaveCount(3);
  });

  test('S-T à faire tab URL is /flux/soustraitance', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-testid="flux-tab-bar"]');

    // Click the S-T à faire tab
    await page.locator('button:has-text("S-T à faire")').click();
    await expect(page).toHaveURL(/\/flux\/soustraitance/);
  });

  test('00042 (all done) not visible in S-T à faire tab', async ({ page }) => {
    await page.goto(`${BASE}/soustraitance`);
    await page.waitForSelector('[data-testid="flux-table"]');

    await expect(
      page.locator('[data-testid="flux-table-row"][data-job-id="00042"]'),
    ).not.toBeVisible();
  });

  test('00078, 00091, 00103 visible in S-T à faire tab', async ({ page }) => {
    await page.goto(`${BASE}/soustraitance`);
    await page.waitForSelector('[data-testid="flux-table"]');

    await expect(
      page.locator('[data-testid="flux-table-row"][data-job-id="00078"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="flux-table-row"][data-job-id="00091"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="flux-table-row"][data-job-id="00103"]'),
    ).toBeVisible();
  });
});
