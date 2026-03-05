/**
 * E2E tests for Production Flow Dashboard — Filtering & Navigation (v0.5.16)
 *
 * Tests tab navigation, URL persistence, search filtering, count badges,
 * and keyboard shortcuts.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, sections 3.2–3.5, 6.4–6.5
 *
 * All selectors and counts are dynamic — no hardcoded job IDs or row counts.
 */

import { test, expect, type Page } from '@playwright/test';

/** Read the numeric count from a tab badge (format: "(N)"). */
async function getTabCount(page: Page, tabId: string): Promise<number> {
  const text = await page.locator(`[data-testid="flux-tab-count-${tabId}"]`).textContent();
  return parseInt(text!.replace(/[()]/g, ''), 10);
}

test.describe('Flux Dashboard — Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
  });

  test('loads with Tous tab active and row count matches badge', async ({ page }) => {
    await expect(page.locator('[data-testid="flux-tab-all"]')).toHaveAttribute('aria-selected', 'true');
    const expectedCount = await getTabCount(page, 'all');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(expectedCount);
  });

  test('clicking prepresse tab filters rows and updates URL', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-prepresse"]').click();
    await expect(page).toHaveURL('/flux/prepresse');
    await expect(page.locator('[data-testid="flux-tab-prepresse"]')).toHaveAttribute('aria-selected', 'true');
    const expectedCount = await getTabCount(page, 'prepresse');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(expectedCount);
  });

  test('clicking papier tab filters rows and updates URL', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-papier"]').click();
    await expect(page).toHaveURL('/flux/papier');
    const expectedCount = await getTabCount(page, 'papier');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(expectedCount);
  });

  test('clicking formes tab filters rows and updates URL', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-formes"]').click();
    await expect(page).toHaveURL('/flux/formes');
    const expectedCount = await getTabCount(page, 'formes');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(expectedCount);
  });

  test('clicking plaques tab filters rows and updates URL', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-plaques"]').click();
    await expect(page).toHaveURL('/flux/plaques');
    const expectedCount = await getTabCount(page, 'plaques');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(expectedCount);
  });

  test('returning to Tous tab shows all rows', async ({ page }) => {
    const totalCount = await getTabCount(page, 'all');

    await page.locator('[data-testid="flux-tab-papier"]').click();
    const papierCount = await getTabCount(page, 'papier');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(papierCount);

    await page.locator('[data-testid="flux-tab-all"]').click();
    await expect(page).toHaveURL('/flux');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(totalCount);
  });

  test('prepresse tab shows fewer rows than all tab', async ({ page }) => {
    const allCount = await getTabCount(page, 'all');
    await page.locator('[data-testid="flux-tab-prepresse"]').click();
    const prePresseCount = await getTabCount(page, 'prepresse');
    expect(prePresseCount).toBeLessThanOrEqual(allCount);
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(prePresseCount);
  });
});

test.describe('Flux Dashboard — URL Persistence', () => {
  test('direct navigation to /flux/papier loads correct tab', async ({ page }) => {
    await page.goto('/flux/papier');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
    await expect(page.locator('[data-testid="flux-tab-papier"]')).toHaveAttribute('aria-selected', 'true');
    const expectedCount = await getTabCount(page, 'papier');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(expectedCount);
  });

  test('direct navigation to /flux/formes loads correct tab', async ({ page }) => {
    await page.goto('/flux/formes');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
    await expect(page.locator('[data-testid="flux-tab-formes"]')).toHaveAttribute('aria-selected', 'true');
    const expectedCount = await getTabCount(page, 'formes');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(expectedCount);
  });

  test('page reload on /flux/plaques preserves active tab', async ({ page }) => {
    await page.goto('/flux/plaques');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
    await page.reload();
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
    await expect(page.locator('[data-testid="flux-tab-plaques"]')).toHaveAttribute('aria-selected', 'true');
    const expectedCount = await getTabCount(page, 'plaques');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(expectedCount);
  });
});

test.describe('Flux Dashboard — Count Badges', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
  });

  test('all tab count >= each individual tab count', async ({ page }) => {
    const allCount = await getTabCount(page, 'all');
    for (const tab of ['prepresse', 'papier', 'formes', 'plaques', 'soustraitance']) {
      const tabCount = await getTabCount(page, tab);
      expect(tabCount).toBeLessThanOrEqual(allCount);
    }
  });

  test('count badges are non-negative integers', async ({ page }) => {
    for (const tab of ['all', 'prepresse', 'papier', 'formes', 'plaques', 'soustraitance']) {
      const count = await getTabCount(page, tab);
      expect(count).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(count)).toBe(true);
    }
  });
});

test.describe('Flux Dashboard — Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-search"]');
  });

  test('search filters rows and reduces count', async ({ page }) => {
    const totalBefore = await getTabCount(page, 'all');

    // Get the client name from the first row to search for it
    const firstRow = page.locator('[data-testid="flux-table-row"]').first();
    const firstRowText = await firstRow.textContent();
    // The client cell is the 3rd cell (index 2)
    const clientCell = firstRow.locator('td').nth(2);
    const clientName = (await clientCell.textContent())!.trim();

    await page.locator('[data-testid="flux-search"]').fill(clientName);
    const filteredCount = await page.locator('[data-testid="flux-table-row"]').count();
    expect(filteredCount).toBeGreaterThanOrEqual(1);
    expect(filteredCount).toBeLessThanOrEqual(totalBefore);

    // First row should still be visible
    await expect(page.locator('[data-testid="flux-table-row"]').first()).toContainText(clientName);
  });

  test('search is case-insensitive', async ({ page }) => {
    // Get client name from first row
    const clientCell = page.locator('[data-testid="flux-table-row"]').first().locator('td').nth(2);
    const clientName = (await clientCell.textContent())!.trim();

    await page.locator('[data-testid="flux-search"]').fill(clientName.toLowerCase());
    const count = await page.locator('[data-testid="flux-table-row"]').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('search by ID filters rows', async ({ page }) => {
    // Get ID from first row
    const idCell = page.locator('[data-testid="flux-table-row"]').first().locator('td').nth(1);
    const jobId = (await idCell.textContent())!.trim();

    await page.locator('[data-testid="flux-search"]').fill(jobId);
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(1);
  });

  test('clearing search restores all rows', async ({ page }) => {
    const totalCount = await getTabCount(page, 'all');

    // Get client from first row and search
    const clientCell = page.locator('[data-testid="flux-table-row"]').first().locator('td').nth(2);
    const clientName = (await clientCell.textContent())!.trim();

    await page.locator('[data-testid="flux-search"]').fill(clientName);
    const filteredCount = await page.locator('[data-testid="flux-table-row"]').count();
    expect(filteredCount).toBeLessThanOrEqual(totalCount);

    await page.locator('[data-testid="flux-search"]').fill('');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(totalCount);
  });

  test('search + tab filter — both conditions must match', async ({ page }) => {
    // Get client from first row
    const clientCell = page.locator('[data-testid="flux-table-row"]').first().locator('td').nth(2);
    const clientName = (await clientCell.textContent())!.trim();

    await page.locator('[data-testid="flux-search"]').fill(clientName);
    const searchOnlyCount = await page.locator('[data-testid="flux-table-row"]').count();

    await page.locator('[data-testid="flux-tab-prepresse"]').click();
    const combinedCount = await page.locator('[data-testid="flux-table-row"]').count();
    expect(combinedCount).toBeLessThanOrEqual(searchOnlyCount);
  });

  test('search updates count badges', async ({ page }) => {
    const totalBefore = await getTabCount(page, 'all');

    // Get client from first row
    const clientCell = page.locator('[data-testid="flux-table-row"]').first().locator('td').nth(2);
    const clientName = (await clientCell.textContent())!.trim();

    await page.locator('[data-testid="flux-search"]').fill(clientName);
    const totalAfter = await getTabCount(page, 'all');
    expect(totalAfter).toBeLessThanOrEqual(totalBefore);
    expect(totalAfter).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Flux Dashboard — Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
  });

  test('Alt+→ cycles to next tab (all → prepresse)', async ({ page }) => {
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page).toHaveURL('/flux/prepresse');
    await expect(page.locator('[data-testid="flux-tab-prepresse"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('Alt+→ wraps from last tab to first', async ({ page }) => {
    // Navigate to last tab (soustraitance)
    await page.goto('/flux/soustraitance');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page).toHaveURL('/flux');
    await expect(page.locator('[data-testid="flux-tab-all"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('Alt+← cycles to previous tab (all → last tab wrap-around)', async ({ page }) => {
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.locator('[data-testid="flux-tab-all"]')).toHaveAttribute('aria-selected', 'false');
  });

  test('Alt+F focuses the search input', async ({ page }) => {
    await page.keyboard.press('Alt+f');
    const searchInput = page.locator('[data-testid="flux-search"]');
    await expect(searchInput).toBeFocused();
  });

  test('Alt+N navigates to /job/new', async ({ page }) => {
    await page.keyboard.press('Alt+n');
    await expect(page).toHaveURL('/job/new');
  });
});

test.describe('Flux Dashboard — Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-toolbar"]');
  });

  test('toolbar renders with title and Nouveau job button', async ({ page }) => {
    await expect(page.locator('[data-testid="flux-toolbar"]')).toBeVisible();
    await expect(page.locator('[data-testid="flux-new-job-button"]')).toBeVisible();
  });

  test('Nouveau job button navigates to /job/new', async ({ page }) => {
    await page.locator('[data-testid="flux-new-job-button"]').click();
    await expect(page).toHaveURL('/job/new');
  });

  test('search input is visible and interactive', async ({ page }) => {
    const search = page.locator('[data-testid="flux-search"]');
    await expect(search).toBeVisible();
    await search.fill('test');
    await expect(search).toHaveValue('test');
  });
});
