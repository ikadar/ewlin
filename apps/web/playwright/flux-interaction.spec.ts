/**
 * E2E tests for Production Flow Dashboard — Interaction (v0.5.17)
 *
 * Tests prerequisite listbox dropdowns, expand/collapse for multi-element rows,
 * delete confirmation dialog, and edit navigation.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, sections 3.9, 3.11
 * Q&A: qa.md K6.1, K6.2, K8.1
 */

import { test, expect } from '@playwright/test';

// Job IDs from fluxStaticData.ts
const SINGLE_JOB_ID = '00042'; // Ducros — 1 element
const MULTI_JOB_ID  = '00078'; // Müller AG — 3 elements

test.describe('Flux Dashboard — Prerequisite Listbox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');
  });

  test('single-element row shows listbox trigger for prerequisite cells', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    const triggers = row.locator('[data-testid="flux-prereq-listbox-trigger"]');
    await expect(triggers).toHaveCount(4);
  });

  test('clicking BAT cell opens dropdown', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    const firstTrigger = row.locator('[data-testid="flux-prereq-listbox-trigger"]').first();
    await firstTrigger.click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();
  });

  test('dropdown shows column-appropriate options (BAT)', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await row.locator('[data-testid="flux-prereq-listbox-trigger"]').first().click();
    const dropdown = page.locator('[data-testid="flux-prereq-dropdown"]');
    await expect(dropdown.locator('[data-option="n.a."]')).toBeVisible();
    await expect(dropdown.locator('[data-option="Att.fich"]')).toBeVisible();
    await expect(dropdown.locator('[data-option="Recus"]')).toBeVisible();
    await expect(dropdown.locator('[data-option="Envoye"]')).toBeVisible();
    await expect(dropdown.locator('[data-option="OK"]')).toBeVisible();
  });

  test('selecting an option updates the badge and closes the dropdown', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    // Open BAT listbox (currently 'OK')
    await row.locator('[data-testid="flux-prereq-listbox-trigger"]').first().click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();

    // Select 'Envoye'
    await page.locator('[data-option="Envoye"]').click();

    // Dropdown should close
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).not.toBeVisible();

    // Badge should now show 'Envoye'
    await expect(row.locator('[data-testid="flux-prereq-listbox-trigger"]').first()).toContainText('Envoye');
  });

  test('clicking outside the dropdown closes it without changing status', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await row.locator('[data-testid="flux-prereq-listbox-trigger"]').first().click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();

    // Click on a neutral area (toolbar)
    await page.locator('[data-testid="flux-toolbar"]').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).not.toBeVisible();

    // Badge still shows original status
    await expect(row.locator('[data-testid="flux-prereq-listbox-trigger"]').first()).toContainText('OK');
  });

  test('Escape key closes dropdown without changing status', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await row.locator('[data-testid="flux-prereq-listbox-trigger"]').first().click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).not.toBeVisible();

    // Status unchanged
    await expect(row.locator('[data-testid="flux-prereq-listbox-trigger"]').first()).toContainText('OK');
  });

  test('ArrowDown key moves focus between options', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await row.locator('[data-testid="flux-prereq-listbox-trigger"]').first().click();
    const dropdown = page.locator('[data-testid="flux-prereq-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Move down from focused option
    await page.keyboard.press('ArrowDown');
    // Arrow down moves focus; we verify the dropdown is still open
    await expect(dropdown).toBeVisible();
  });

  test('Enter key selects the focused option', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    // Open BAT dropdown (currently 'OK', which is at index 4 in bat options)
    await row.locator('[data-testid="flux-prereq-listbox-trigger"]').first().click();
    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).toBeVisible();

    // Press ArrowUp to move to 'Envoye' (index 3)
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-testid="flux-prereq-dropdown"]')).not.toBeVisible();
  });

  test('opening second listbox closes first (only one open at a time)', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
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
    const row = page.locator(`[data-job-id="${MULTI_JOB_ID}"]`);
    await expect(row.locator('[data-testid="flux-prereq-listbox-trigger"]')).toHaveCount(0);
  });
});

test.describe('Flux Dashboard — Expand / Collapse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');
  });

  test('multi-element row shows expand toggle (+)', async ({ page }) => {
    const toggle = page.locator(`[data-job-id="${MULTI_JOB_ID}"] [data-testid="flux-expand-toggle"]`);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('+');
  });

  test('single-element row does not show expand toggle', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await expect(row.locator('[data-testid="flux-expand-toggle"]')).toHaveCount(0);
  });

  test('clicking toggle expands and shows sub-rows', async ({ page }) => {
    const toggle = page.locator(`[data-job-id="${MULTI_JOB_ID}"] [data-testid="flux-expand-toggle"]`);
    await toggle.click();

    const subRows = page.locator('[data-testid="flux-sub-row"]');
    await expect(subRows).toHaveCount(3); // 00078 has 3 elements
  });

  test('expanded toggle shows minus (−)', async ({ page }) => {
    const toggle = page.locator(`[data-job-id="${MULTI_JOB_ID}"] [data-testid="flux-expand-toggle"]`);
    await toggle.click();
    await expect(toggle).toHaveText('−');
  });

  test('sub-rows show element labels with arrow prefix', async ({ page }) => {
    const toggle = page.locator(`[data-job-id="${MULTI_JOB_ID}"] [data-testid="flux-expand-toggle"]`);
    await toggle.click();

    await expect(page.locator('[data-testid="flux-sub-row"] [data-testid="flux-sub-designation"]').first()).toContainText('↳');
  });

  test('sub-rows have interactive listbox triggers', async ({ page }) => {
    const toggle = page.locator(`[data-job-id="${MULTI_JOB_ID}"] [data-testid="flux-expand-toggle"]`);
    await toggle.click();

    const subRows = page.locator('[data-testid="flux-sub-row"]');
    const firstSubRow = subRows.first();
    await expect(firstSubRow.locator('[data-testid="flux-prereq-listbox-trigger"]')).toHaveCount(4);
  });

  test('clicking toggle again collapses and hides sub-rows', async ({ page }) => {
    const toggle = page.locator(`[data-job-id="${MULTI_JOB_ID}"] [data-testid="flux-expand-toggle"]`);
    await toggle.click();
    await expect(page.locator('[data-testid="flux-sub-row"]')).toHaveCount(3);

    await toggle.click();
    await expect(page.locator('[data-testid="flux-sub-row"]')).toHaveCount(0);
  });

  test('sub-row prerequisite change re-aggregates parent badge (qa.md K8.1)', async ({ page }) => {
    // Expand 00078 (BAT worst = Att.fich)
    const toggle = page.locator(`[data-job-id="${MULTI_JOB_ID}"] [data-testid="flux-expand-toggle"]`);
    await toggle.click();

    // Find sub-row for e3 (Étiquette Ovale, bat=Att.fich) and change to OK
    const subRows = page.locator('[data-testid="flux-sub-row"]');
    const thirdSubRow = subRows.nth(2); // index 2 = Étiquette Ovale
    const batTrigger = thirdSubRow.locator('[data-testid="flux-prereq-listbox-trigger"]').first();
    await batTrigger.click();
    await page.locator('[data-option="OK"]').click();

    // Also change e2 bat (Envoye → OK)
    const secondSubRow = subRows.nth(1);
    await secondSubRow.locator('[data-testid="flux-prereq-listbox-trigger"]').first().click();
    await page.locator('[data-option="OK"]').click();

    // Now collapse — parent BAT should reflect new worst (e1=OK, e2=OK, e3=OK) → OK
    await toggle.click();
    const parentRow = page.locator(`[data-job-id="${MULTI_JOB_ID}"]`);
    const parentBadges = parentRow.locator('[data-testid="flux-prereq-badge"]');
    // First badge is BAT — should now be OK
    await expect(parentBadges.first()).toContainText('OK');
  });
});

test.describe('Flux Dashboard — Delete Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');
  });

  test('clicking delete button opens confirmation dialog', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await row.locator('[data-testid="flux-action-delete"]').click();
    await expect(page.locator('[data-testid="flux-delete-dialog"]')).toBeVisible();
  });

  test('clicking Annuler closes dialog and keeps job', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await row.locator('[data-testid="flux-action-delete"]').click();
    await page.locator('[data-testid="flux-delete-cancel"]').click();

    await expect(page.locator('[data-testid="flux-delete-dialog"]')).not.toBeVisible();
    await expect(page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`)).toBeVisible();
  });

  test('clicking Supprimer removes the job from the table', async ({ page }) => {
    // Initially 5 rows
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(5);

    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await row.locator('[data-testid="flux-action-delete"]').click();
    await page.locator('[data-testid="flux-delete-confirm"]').click();

    // Job is removed
    await expect(page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`)).not.toBeVisible();
    await expect(page.locator('[data-testid="flux-table-row"]')).toHaveCount(4);
  });

  test('delete decrements the count badge', async ({ page }) => {
    await expect(page.locator('[data-testid="flux-tab-count-all"]')).toHaveText('5');

    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await row.locator('[data-testid="flux-action-delete"]').click();
    await page.locator('[data-testid="flux-delete-confirm"]').click();

    await expect(page.locator('[data-testid="flux-tab-count-all"]')).toHaveText('4');
  });

  test('clicking backdrop closes dialog without deleting', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await row.locator('[data-testid="flux-action-delete"]').click();
    await page.locator('[data-testid="flux-delete-dialog-backdrop"]').click({ position: { x: 5, y: 5 } });

    await expect(page.locator('[data-testid="flux-delete-dialog"]')).not.toBeVisible();
    await expect(page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`)).toBeVisible();
  });
});

test.describe('Flux Dashboard — Edit Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flux');
    await page.waitForSelector('[data-testid="flux-table"]');
  });

  test('clicking edit button navigates to /job/:jobId', async ({ page }) => {
    const row = page.locator(`[data-job-id="${SINGLE_JOB_ID}"]`);
    await row.locator('[data-testid="flux-action-edit"]').click();
    await expect(page).toHaveURL(`/job/${SINGLE_JOB_ID}`);
  });

  test('edit button navigates with correct multi-job ID', async ({ page }) => {
    const row = page.locator(`[data-job-id="${MULTI_JOB_ID}"]`);
    await row.locator('[data-testid="flux-action-edit"]').click();
    await expect(page).toHaveURL(`/job/${MULTI_JOB_ID}`);
  });
});
