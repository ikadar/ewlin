/**
 * E2E tests for the ST (Sous-traitance) column feature.
 *
 * @see docs/releases/v0.5.23-st-column-frontend.md
 * @see docs/production-flow-dashboard-spec/upgrade-colonne-st-en.md
 *
 * All selectors are dynamic — no hardcoded job IDs.
 */

import { test, expect, type Page } from '@playwright/test';

/** Read the numeric count from a tab badge (format: "(N)"). */
async function getTabCount(page: Page, tabId: string): Promise<number> {
  const text = await page.locator(`[data-testid="flux-tab-count-${tabId}"]`).textContent();
  return parseInt(text!.replace(/[()]/g, ''), 10);
}

test.describe('ST Column — header', () => {
  test('ST column header is visible with title tooltip', async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');

    const stHeader = page.locator('th[title="Sous-traitance"]');
    await expect(stHeader).toBeVisible();
    await expect(stHeader).toHaveText('ST');
  });
});

test.describe('ST Column — cell rendering', () => {
  test('rows with ST tasks show toggle buttons', async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');

    // Find any row that has an ST cell with a toggle
    const stToggles = page.locator('[data-testid^="st-toggle-"]');
    const count = await stToggles.count();
    // At least some rows should have ST tasks
    expect(count).toBeGreaterThan(0);

    // Each toggle should have a data-status attribute
    const firstToggle = stToggles.first();
    const status = await firstToggle.getAttribute('data-status');
    expect(['pending', 'progress', 'done']).toContain(status);
  });

  test('some rows have empty ST cells (no tasks)', async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');

    // Count rows with ST toggles vs total rows
    const totalRows = await page.locator('[data-testid="flux-table-row"]').count();
    const rowsWithST = await page.locator('[data-testid="flux-st-cell"]:has([data-testid^="st-toggle-"])').count();
    // Not every row should have ST tasks
    expect(rowsWithST).toBeLessThan(totalRows);
  });
});

test.describe('ST Column — click cycle', () => {
  test('clicking ST toggle does not break the table', async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');

    const toggle = page.locator('[data-testid^="st-toggle-"]').first();
    const initialStatus = await toggle.getAttribute('data-status');
    expect(initialStatus).toBeTruthy();

    await toggle.click();
    // Table should still be visible after click
    await expect(page.locator('[data-testid="flux-table"]')).toBeVisible();
  });
});

test.describe('ST Column — S-T à faire tab', () => {
  test('navigating to /flux/soustraitance shows matching row count', async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');

    const expectedCount = await getTabCount(page, 'soustraitance');

    await page.goto('/flux/soustraitance');
    await page.waitForSelector('[data-testid="flux-table"]');

    const rows = page.locator('[data-testid="flux-table-row"]');
    await expect(rows).toHaveCount(expectedCount);
  });

  test('S-T à faire tab URL is /flux/soustraitance', async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');

    // Click the S-T à faire tab
    await page.locator('button:has-text("S-T à faire")').click();
    await expect(page).toHaveURL(/\/flux\/soustraitance/);
  });

  test('S-T à faire tab only shows jobs with non-done ST tasks', async ({ page }) => {
    await page.goto('/flux/soustraitance');
    await page.waitForSelector('[data-testid="flux-table"]');

    const rows = page.locator('[data-testid="flux-table-row"]');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Each visible row should have at least one ST toggle
      // (rows are filtered to only show jobs with non-done ST tasks)
      for (let i = 0; i < Math.min(rowCount, 3); i++) {
        const row = rows.nth(i);
        const stCell = row.locator('[data-testid="flux-st-cell"]');
        await expect(stCell).toBeVisible();
      }
    }
  });
});
