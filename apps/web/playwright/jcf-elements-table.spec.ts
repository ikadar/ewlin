/**
 * Playwright JCF Elements Table Tests
 *
 * Tests for v0.4.9: JCF Elements Table Grid Layout
 * Row-based CSS Grid with element headers, add/remove, name editing.
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.9: JCF Elements Table Grid Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);

    // Open JCF modal
    const addButton = page.locator(
      'button[aria-label="Ajouter un travail"]',
    );
    await addButton.click();
    await expect(
      page.locator('[data-testid="jcf-modal-backdrop"]'),
    ).toBeVisible();
  });

  test('Elements table is visible in JCF modal', async ({ page }) => {
    await expect(
      page.locator('[data-testid="jcf-elements-table"]'),
    ).toBeVisible();
  });

  test('Default element "ELT" is shown with all field rows', async ({
    page,
  }) => {
    // Check element name
    await expect(
      page.locator('[data-testid="jcf-element-name-0"]'),
    ).toHaveText('ELT');

    // Check all row labels
    const labels = [
      'Precedences',
      'Quantité',
      'Pagination',
      'Format',
      'Papier',
      'Impression',
      'Surfacage',
      'Autres',
      'Imposition',
      'Qté feuilles',
      'Commentaires',
      'Sequence',
    ];
    for (const label of labels) {
      await expect(
        page.locator('[data-testid="jcf-elements-table"]').getByText(label),
      ).toBeVisible();
    }
  });

  test('Add element creates new ELEM2 column', async ({ page }) => {
    await page.locator('[data-testid="jcf-element-add-0"]').click();
    await expect(
      page.locator('[data-testid="jcf-element-name-1"]'),
    ).toHaveText('ELEM2');
  });

  test('Remove element removes the column', async ({ page }) => {
    // First add a second element
    await page.locator('[data-testid="jcf-element-add-0"]').click();
    await expect(
      page.locator('[data-testid="jcf-element-name-1"]'),
    ).toBeVisible();

    // Remove the first element
    await page.locator('[data-testid="jcf-element-remove-0"]').click();
    // Now only ELEM2 should remain
    await expect(
      page.locator('[data-testid="jcf-element-name-0"]'),
    ).toHaveText('ELEM2');
    await expect(
      page.locator('[data-testid="jcf-element-name-1"]'),
    ).not.toBeVisible();
  });

  test('Element name editing: type new name and press Enter', async ({
    page,
  }) => {
    // Click element name to start editing
    await page.locator('[data-testid="jcf-element-name-0"]').click();
    const input = page.locator('[data-testid="jcf-element-name-input-0"]');
    await expect(input).toBeVisible();

    // Type new name and press Enter
    await input.fill('COUV');
    await input.press('Enter');

    // Wait for input to disappear (edit mode ends)
    await expect(input).not.toBeVisible();

    // Verify name changed
    await expect(
      page.locator('[data-testid="jcf-element-name-0"]'),
    ).toHaveText('COUV');
  });

  test('Element name editing: Escape restores original name', async ({
    page,
  }) => {
    await page.locator('[data-testid="jcf-element-name-0"]').click();
    const input = page.locator('[data-testid="jcf-element-name-input-0"]');
    await expect(input).toBeVisible();
    await input.fill('NEWNAME');
    await input.press('Escape');

    // Wait for input to disappear (edit mode ends)
    await expect(input).not.toBeVisible();

    // Name should be restored to ELT
    await expect(
      page.locator('[data-testid="jcf-element-name-0"]'),
    ).toHaveText('ELT');
  });

  test('Type in field persists the value', async ({ page }) => {
    const autresInput = page.locator('[data-testid="jcf-input-0-autres"]');
    await autresInput.fill('Test value');
    await expect(autresInput).toHaveValue('Test value');
  });

  test('Commentaires auto-expands on multi-line input', async ({ page }) => {
    const textarea = page.locator(
      '[data-testid="jcf-input-0-commentaires"]',
    );

    // Get initial height
    const initialHeight = await textarea.evaluate(
      (el) => el.getBoundingClientRect().height,
    );

    // Type multi-line content
    await textarea.fill('Line 1\nLine 2\nLine 3\nLine 4');

    // Height should have increased
    const newHeight = await textarea.evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    expect(newHeight).toBeGreaterThan(initialHeight);
  });
});
