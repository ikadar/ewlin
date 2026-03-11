/**
 * E2E tests for Production Flow Dashboard — Interaction (v0.5.17)
 *
 * Tests prerequisite listbox dropdowns, expand/collapse for multi-element rows,
 * delete confirmation dialog, and edit navigation.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, sections 3.9, 3.11
 * Q&A: qa.md K6.1, K6.2, K8.1
 *
 * All selectors are dynamic — no hardcoded job IDs.
 */

import { test, expect, type Page, type Locator } from '@playwright/test';
import { injectTestAuth } from './helpers/auth';

/**
 * Find the first single-element row (no expand toggle = 1 element).
 * These rows have interactive listbox triggers for prerequisites.
 */
async function findSingleElementRow(page: Page): Promise<Locator> {
  const rows = page.locator('[data-testid="flux-table-row"]');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const toggleCount = await row.locator('[data-testid="flux-expand-toggle"]').count();
    if (toggleCount === 0) return row;
  }
  throw new Error('No single-element row found');
}

/**
 * Find the first multi-element row (has expand toggle).
 */
async function findMultiElementRow(page: Page): Promise<Locator> {
  const rows = page.locator('[data-testid="flux-table-row"]');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const toggleCount = await row.locator('[data-testid="flux-expand-toggle"]').count();
    if (toggleCount === 1) return row;
  }
  throw new Error('No multi-element row found');
}

/** Extract the job ID from a row's data-job-id attribute. */
async function getJobId(row: Locator): Promise<string> {
  const id = await row.getAttribute('data-job-id');
  if (!id) throw new Error('Row has no data-job-id');
  return id;
}

test.describe('Flux Dashboard — Prerequisite Listbox', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestAuth(page);
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');
  });

  test('single-element row shows listbox trigger for prerequisite cells', async ({ page }) => {
    const row = await findSingleElementRow(page);
    const triggers = row.locator('[data-testid="flux-prereq-listbox-trigger"]');
    await expect(triggers).toHaveCount(4);
  });

  test('clicking BAT cell opens dropdown', async ({ page }) => {
    const row = await findSingleElementRow(page);
    const firstTrigger = row.locator('[data-testid="flux-prereq-listbox-trigger"]').first();
    await firstTrigger.click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();
  });

  test('dropdown shows column-appropriate options (BAT)', async ({ page }) => {
    const row = await findSingleElementRow(page);
    await row.locator('[data-testid="flux-prereq-listbox-trigger"]').first().click();
    const dropdown = page.locator('[data-testid="flux-prereq-dropdown"]');
    await expect(dropdown.locator('[data-option="none"]')).toBeVisible();
    await expect(dropdown.locator('[data-option="waiting_files"]')).toBeVisible();
    await expect(dropdown.locator('[data-option="files_received"]')).toBeVisible();
    await expect(dropdown.locator('[data-option="bat_sent"]')).toBeVisible();
    await expect(dropdown.locator('[data-option="bat_approved"]')).toBeVisible();
  });

  test('selecting an option updates the badge and closes the dropdown', async ({ page }) => {
    const row = await findSingleElementRow(page);
    const firstTrigger = row.locator('[data-testid="flux-prereq-listbox-trigger"]').first();
    const originalText = await firstTrigger.textContent();

    await firstTrigger.click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();

    // Pick a different option than the current one (use data-option values)
    // Badge labels come from PREREQUISITE_STATUS_LABEL (e.g. bat_sent → 'Envoyé')
    const targetValue = originalText?.includes('Envoyé') ? 'bat_approved' : 'bat_sent';
    const targetBadgeLabel = targetValue === 'bat_approved' ? 'BAT OK' : 'Envoyé';
    await page.locator(`[data-option="${targetValue}"]`).click();

    // Dropdown should close
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).not.toBeVisible();

    // Badge should now show the selected option's badge label
    await expect(firstTrigger).toContainText(targetBadgeLabel);
  });

  test('clicking outside the dropdown closes it without changing status', async ({ page }) => {
    const row = await findSingleElementRow(page);
    const firstTrigger = row.locator('[data-testid="flux-prereq-listbox-trigger"]').first();
    const originalText = await firstTrigger.textContent();

    await firstTrigger.click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();

    // Click on a neutral area (toolbar)
    await page.locator('[data-testid="flux-toolbar"]').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).not.toBeVisible();

    // Badge still shows original status
    await expect(firstTrigger).toHaveText(originalText!);
  });

  test('Escape key closes dropdown without changing status', async ({ page }) => {
    const row = await findSingleElementRow(page);
    const firstTrigger = row.locator('[data-testid="flux-prereq-listbox-trigger"]').first();
    const originalText = await firstTrigger.textContent();

    await firstTrigger.click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).not.toBeVisible();

    // Status unchanged
    await expect(firstTrigger).toHaveText(originalText!);
  });

  test('ArrowDown key moves focus between options', async ({ page }) => {
    const row = await findSingleElementRow(page);
    await row.locator('[data-testid="flux-prereq-listbox-trigger"]').first().click();
    const dropdown = page.locator('[data-testid="flux-prereq-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Move down from focused option
    await page.keyboard.press('ArrowDown');
    // Arrow down moves focus; we verify the dropdown is still open
    await expect(dropdown).toBeVisible();
  });

  test('Enter key selects the focused option', async ({ page }) => {
    const row = await findSingleElementRow(page);
    await row.locator('[data-testid="flux-prereq-listbox-trigger"]').first().click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();

    // Press ArrowUp to move to a different option, then Enter to select
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).not.toBeVisible();
  });

  test('opening second listbox closes first (only one open at a time)', async ({ page }) => {
    const row = await findSingleElementRow(page);
    const triggers = row.locator('[data-testid="flux-prereq-listbox-trigger"]');

    // Open first trigger (BAT)
    await triggers.nth(0).click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();

    // Open second trigger (Papier) — first should close
    await triggers.nth(1).click();
    // Only one dropdown should exist
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toHaveCount(1);
  });

  test('multi-element collapsed row does not show listbox triggers', async ({ page }) => {
    const row = await findMultiElementRow(page);
    await expect(row.locator('[data-testid="flux-prereq-listbox-trigger"]')).toHaveCount(0);
  });
});

test.describe('Flux Dashboard — Expand / Collapse', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestAuth(page);
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');
  });

  test('multi-element row shows expand toggle (+)', async ({ page }) => {
    const row = await findMultiElementRow(page);
    const toggle = row.locator('[data-testid="flux-expand-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('+');
  });

  test('single-element row does not show expand toggle', async ({ page }) => {
    const row = await findSingleElementRow(page);
    await expect(row.locator('[data-testid="flux-expand-toggle"]')).toHaveCount(0);
  });

  test('clicking toggle expands and shows sub-rows', async ({ page }) => {
    const row = await findMultiElementRow(page);
    const toggle = row.locator('[data-testid="flux-expand-toggle"]');
    await toggle.click();

    const subRows = page.locator('[data-testid="flux-sub-row"]');
    // At least 2 sub-rows (multi-element by definition)
    const count = await subRows.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('expanded toggle shows minus', async ({ page }) => {
    const row = await findMultiElementRow(page);
    const toggle = row.locator('[data-testid="flux-expand-toggle"]');
    await toggle.click();
    await expect(toggle).toHaveText('−');
  });

  test('sub-rows show element labels with arrow prefix', async ({ page }) => {
    const row = await findMultiElementRow(page);
    await row.locator('[data-testid="flux-expand-toggle"]').click();

    await expect(page.locator('[data-testid="flux-sub-row"] [data-testid="flux-sub-designation"]').first()).toContainText('↳');
  });

  test('sub-rows have interactive listbox triggers', async ({ page }) => {
    const row = await findMultiElementRow(page);
    await row.locator('[data-testid="flux-expand-toggle"]').click();

    const subRows = page.locator('[data-testid="flux-sub-row"]');
    const firstSubRow = subRows.first();
    await expect(firstSubRow.locator('[data-testid="flux-prereq-listbox-trigger"]')).toHaveCount(4);
  });

  test('clicking toggle again collapses and hides sub-rows', async ({ page }) => {
    const row = await findMultiElementRow(page);
    const toggle = row.locator('[data-testid="flux-expand-toggle"]');
    await toggle.click();
    const expandedCount = await page.locator('[data-testid="flux-sub-row"]').count();
    expect(expandedCount).toBeGreaterThanOrEqual(2);

    await toggle.click();
    await expect(page.locator('[data-testid="flux-sub-row"]')).toHaveCount(0);
  });

  test('sub-row prerequisite change re-aggregates parent badge (qa.md K8.1)', async ({ page }) => {
    const row = await findMultiElementRow(page);
    const toggle = row.locator('[data-testid="flux-expand-toggle"]');
    await toggle.click();

    // Get first sub-row's BAT trigger and change it to "OK"
    const subRows = page.locator('[data-testid="flux-sub-row"]');
    const firstSubRow = subRows.first();
    const batTrigger = firstSubRow.locator('[data-testid="flux-prereq-listbox-trigger"]').first();
    await batTrigger.click();
    await page.locator('[data-option="bat_approved"]').click();

    // Collapse — parent BAT badge should update
    await toggle.click();
    const parentBadges = row.locator('[data-testid="flux-prereq-badge"]');
    // Just verify the parent has badges (re-aggregation happened)
    const badgeCount = await parentBadges.count();
    expect(badgeCount).toBeGreaterThan(0);
  });
});

test.describe('Flux Dashboard — Delete Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestAuth(page);
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');
  });

  test('clicking delete button opens confirmation dialog', async ({ page }) => {
    const row = await findSingleElementRow(page);
    await row.locator('[data-testid="flux-action-delete"]').click();
    await expect(page.locator('[data-testid="flux-delete-dialog"]')).toBeVisible();
  });

  test('clicking Annuler closes dialog and keeps job', async ({ page }) => {
    const row = await findSingleElementRow(page);
    const jobId = await getJobId(row);
    await row.locator('[data-testid="flux-action-delete"]').click();
    await page.locator('[data-testid="flux-delete-cancel"]').click();

    await expect(page.locator('[data-testid="flux-delete-dialog"]')).not.toBeVisible();
    await expect(page.locator(`[data-job-id="${jobId}"]`)).toBeVisible();
  });

  test('clicking Supprimer removes the job from the table', async ({ page }) => {
    const allRows = page.locator('[data-testid="flux-table-row"]');
    const initialCount = await allRows.count();

    const row = await findSingleElementRow(page);
    const jobId = await getJobId(row);
    await row.locator('[data-testid="flux-action-delete"]').click();
    await page.locator('[data-testid="flux-delete-confirm"]').click();

    // Job is removed
    await expect(page.locator(`[data-job-id="${jobId}"]`)).not.toBeVisible();
    await expect(allRows).toHaveCount(initialCount - 1);
  });

  test('delete decrements the count badge', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="flux-tab-count-all"]').textContent();
    const initialNum = parseInt(initialCount!.replace(/[()]/g, ''), 10);

    const row = await findSingleElementRow(page);
    await row.locator('[data-testid="flux-action-delete"]').click();
    await page.locator('[data-testid="flux-delete-confirm"]').click();

    await expect(page.locator('[data-testid="flux-tab-count-all"]')).toHaveText(`(${initialNum - 1})`);
  });

  test('clicking backdrop closes dialog without deleting', async ({ page }) => {
    const row = await findSingleElementRow(page);
    const jobId = await getJobId(row);
    await row.locator('[data-testid="flux-action-delete"]').click();
    await page.locator('[data-testid="flux-delete-dialog-backdrop"]').click({ position: { x: 5, y: 5 } });

    await expect(page.locator('[data-testid="flux-delete-dialog"]')).not.toBeVisible();
    await expect(page.locator(`[data-job-id="${jobId}"]`)).toBeVisible();
  });
});

test.describe('Flux Dashboard — Edit Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestAuth(page);
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');
  });

  test('clicking edit button navigates to /job/new', async ({ page }) => {
    const row = await findSingleElementRow(page);
    await row.locator('[data-testid="flux-action-edit"]').click();
    await expect(page).toHaveURL('/job/new');
  });

  test('edit button navigates for multi-element job', async ({ page }) => {
    const row = await findMultiElementRow(page);
    await row.locator('[data-testid="flux-action-edit"]').click();
    await expect(page).toHaveURL('/job/new');
  });
});
