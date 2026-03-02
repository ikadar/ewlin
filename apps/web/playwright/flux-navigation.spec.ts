/**
 * E2E tests for Production Flow Dashboard — Filtering & Navigation (v0.5.16)
 *
 * Tests tab navigation, URL persistence, search filtering, count badges,
 * and keyboard shortcuts.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, sections 3.2–3.5, 6.4–6.5
 */

import { test, expect } from '@playwright/test';

// Expected visible job IDs per tab (spec 6.5 verification matrix)
const TAB_EXPECTATIONS = {
  all:       ['00042', '00078', '00091', '00103', '00117'],
  prepresse: ['00078', '00091', '00103'],
  papier:    ['00078', '00091'],
  formes:    ['00078'],
  plaques:   ['00078', '00091'],
} as const;

test.describe('Flux Dashboard — Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
  });

  test('loads with Tous tab active and 5 rows visible', async ({ page }) => {
    await expect(page.locator('[data-testid="flux-tab-all"]')).toHaveAttribute('aria-selected', 'true');
    const rows = page.locator('[data-testid="flux-table-row"]');
    await expect(rows).toHaveCount(5);
  });

  test('clicking A faire prepresse tab shows 3 rows and updates URL', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-prepresse"]').click();
    await expect(page).toHaveURL('/flux/prepresse');
    await expect(page.locator('[data-testid="flux-tab-prepresse"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(3);
  });

  test('clicking Cdes papier tab shows 2 rows and updates URL', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-papier"]').click();
    await expect(page).toHaveURL('/flux/papier');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(2);
  });

  test('clicking Cdes formes tab shows 1 row and updates URL', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-formes"]').click();
    await expect(page).toHaveURL('/flux/formes');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="flux-table-row"]')).toContainText('00078');
  });

  test('clicking Plaques a produire tab shows 2 rows and updates URL', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-plaques"]').click();
    await expect(page).toHaveURL('/flux/plaques');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(2);
  });

  test('spec 6.5 — prepresse tab shows exactly 00078, 00091, 00103', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-prepresse"]').click();
    for (const id of TAB_EXPECTATIONS.prepresse) {
      await expect(page.locator(`[data-job-id="${id}"]`)).toBeVisible();
    }
    // 00042 (BAT=OK) and 00117 (BAT=n.a.) should be hidden
    await expect(page.locator('[data-job-id="00042"]')).not.toBeVisible();
    await expect(page.locator('[data-job-id="00117"]')).not.toBeVisible();
  });

  test('spec 6.5 — papier tab shows exactly 00078, 00091', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-papier"]').click();
    for (const id of TAB_EXPECTATIONS.papier) {
      await expect(page.locator(`[data-job-id="${id}"]`)).toBeVisible();
    }
    for (const id of ['00042', '00103', '00117'] as const) {
      await expect(page.locator(`[data-job-id="${id}"]`)).not.toBeVisible();
    }
  });

  test('returning to Tous tab shows all 5 rows', async ({ page }) => {
    await page.locator('[data-testid="flux-tab-papier"]').click();
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(2);

    await page.locator('[data-testid="flux-tab-all"]').click();
    await expect(page).toHaveURL('/flux');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(5);
  });
});

test.describe('Flux Dashboard — URL Persistence', () => {
  test('direct navigation to /flux/papier loads correct tab', async ({ page }) => {
    await page.goto('/flux/papier');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
    await expect(page.locator('[data-testid="flux-tab-papier"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(2);
  });

  test('direct navigation to /flux/formes loads correct tab', async ({ page }) => {
    await page.goto('/flux/formes');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
    await expect(page.locator('[data-testid="flux-tab-formes"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(1);
  });

  test('page reload on /flux/plaques preserves active tab', async ({ page }) => {
    await page.goto('/flux/plaques');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
    await page.reload();
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
    await expect(page.locator('[data-testid="flux-tab-plaques"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(2);
  });
});

test.describe('Flux Dashboard — Count Badges', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
  });

  test('count badges match spec 6.5 verification matrix', async ({ page }) => {
    await expect(page.locator('[data-testid="flux-tab-count-all"]')).toHaveText('5');
    await expect(page.locator('[data-testid="flux-tab-count-prepresse"]')).toHaveText('3');
    await expect(page.locator('[data-testid="flux-tab-count-papier"]')).toHaveText('2');
    await expect(page.locator('[data-testid="flux-tab-count-formes"]')).toHaveText('1');
    await expect(page.locator('[data-testid="flux-tab-count-plaques"]')).toHaveText('2');
  });
});

test.describe('Flux Dashboard — Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-search"]');
  });

  test('search by client name filters rows', async ({ page }) => {
    await page.locator('[data-testid="flux-search"]').fill('Ducros');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(1);
    await expect(page.locator('[data-job-id="00042"]')).toBeVisible();
  });

  test('search is case-insensitive', async ({ page }) => {
    await page.locator('[data-testid="flux-search"]').fill('ducros');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(1);
  });

  test('search by ID filters rows', async ({ page }) => {
    await page.locator('[data-testid="flux-search"]').fill('00103');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(1);
    await expect(page.locator('[data-job-id="00103"]')).toBeVisible();
  });

  test('search by transporteur filters rows', async ({ page }) => {
    await page.locator('[data-testid="flux-search"]').fill('Chronopost');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(1);
    await expect(page.locator('[data-job-id="00042"]')).toBeVisible();
  });

  test('search by prerequisite badge label (case-insensitive)', async ({ page }) => {
    // att.fich matches BAT=Att.fich of 00078 and 00091
    await page.locator('[data-testid="flux-search"]').fill('att.fich');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(2);
  });

  test('clearing search restores all rows', async ({ page }) => {
    await page.locator('[data-testid="flux-search"]').fill('Ducros');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(1);
    await page.locator('[data-testid="flux-search"]').fill('');
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(5);
  });

  test('search + tab filter — both conditions must match', async ({ page }) => {
    // Search "Müller" (matches 00078 only) + tab prepresse
    await page.locator('[data-testid="flux-search"]').fill('Müller');
    await page.locator('[data-testid="flux-tab-prepresse"]').click();
    // 00078 matches both: client=Muller AG and BAT=Att.fich (not OK/n.a.)
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(1);
    await expect(page.locator('[data-job-id="00078"]')).toBeVisible();
  });

  test('search updates count badges (qa.md K4.1)', async ({ page }) => {
    await page.locator('[data-testid="flux-search"]').fill('Ducros');
    // Only 00042 matches; it has BAT=OK so prepresse count = 0
    await expect(page.locator('[data-testid="flux-tab-count-all"]')).toHaveText('1');
    await expect(page.locator('[data-testid="flux-tab-count-prepresse"]')).toHaveText('0');
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
    // Navigate to last tab (plaques)
    await page.goto('/flux/plaques');
    await page.waitForSelector('[data-testid="flux-tab-bar"]');
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page).toHaveURL('/flux');
    await expect(page.locator('[data-testid="flux-tab-all"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('Alt+← cycles to previous tab (all → plaques wrap-around)', async ({ page }) => {
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page).toHaveURL('/flux/plaques');
    await expect(page.locator('[data-testid="flux-tab-plaques"]')).toHaveAttribute('aria-selected', 'true');
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
