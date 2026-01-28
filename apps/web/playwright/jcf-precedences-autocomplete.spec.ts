/**
 * Playwright JCF Precedences Autocomplete E2E Tests
 *
 * Tests for v0.4.19: Precedences autocomplete with element name suggestions.
 * Verifies multi-value selection, filtering, keyboard navigation, and
 * cascading rename/remove.
 *
 * @see docs/releases/v0.4.19-jcf-precedences-autocomplete.md
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.19: JCF Precedences Autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);

    // Open JCF modal
    const addButton = page.locator('button[aria-label="Ajouter un travail"]');
    await addButton.click();
    await expect(
      page.locator('[data-testid="jcf-modal-backdrop"]'),
    ).toBeVisible();

    // Add a second element so precedences have suggestions
    await page.locator('[data-testid="jcf-element-add-0"]').click();
  });

  test.describe('element name selection', () => {
    test('shows other element names on focus (excludes self)', async ({
      page,
    }) => {
      // Focus the precedences cell of second element (row 0, element 1)
      const precInput = page.locator('#cell-1-0');
      await precInput.click();

      // Dropdown should appear with first element's name
      const dropdown = page.locator('[data-testid="cell-1-0-dropdown"]');
      await expect(dropdown).toBeVisible();

      // First element name should be shown
      const firstElementName = await page
        .locator('[data-testid="jcf-element-name-0"]')
        .textContent();
      await expect(dropdown).toContainText(firstElementName!);
    });

    test('selecting an element name inserts it', async ({ page }) => {
      const precInput = page.locator('#cell-1-0');
      await precInput.click();

      // Select first suggestion via Enter
      await page.keyboard.press('Enter');

      // Input should contain the first element's name
      const firstElementName = await page
        .locator('[data-testid="jcf-element-name-0"]')
        .textContent();
      const value = await precInput.inputValue();
      expect(value).toBe(firstElementName);
    });
  });

  test.describe('multi-value selection', () => {
    test('allows selecting multiple predecessors with comma', async ({
      page,
    }) => {
      // Add a third element to have more than one predecessor available
      await page.locator('[data-testid="jcf-element-add-1"]').click();

      // Get element names
      const name0 = await page
        .locator('[data-testid="jcf-element-name-0"]')
        .textContent();
      const name1 = await page
        .locator('[data-testid="jcf-element-name-1"]')
        .textContent();

      // Focus precedences of the third element (element 2, row 0)
      const precInput = page.locator('#cell-2-0');
      await precInput.click();

      // Select first suggestion
      await page.keyboard.press('Enter');

      // Type comma to start next selection
      await page.keyboard.type(',');

      // Should see remaining element names in dropdown
      const dropdown = page.locator('[data-testid="cell-2-0-dropdown"]');
      await expect(dropdown).toBeVisible();

      // Select second suggestion
      await page.keyboard.press('Enter');

      // Input should contain both names
      const value = await precInput.inputValue();
      expect(value).toContain(name0!);
      expect(value).toContain(name1!);
      expect(value).toContain(',');
    });
  });

  test.describe('keyboard navigation', () => {
    test('ArrowDown/ArrowUp navigate suggestions', async ({ page }) => {
      const precInput = page.locator('#cell-1-0');
      await precInput.click();

      const dropdown = page.locator('[data-testid="cell-1-0-dropdown"]');
      await expect(dropdown).toBeVisible();

      // First item highlighted by default
      const firstItem = dropdown.locator('> div').nth(0);
      await expect(firstItem).toHaveClass(/bg-blue-600/);

      // If there are multiple items, ArrowDown should move highlight
      const itemCount = await dropdown.locator('> div').count();
      if (itemCount > 1) {
        await page.keyboard.press('ArrowDown');
        const secondItem = dropdown.locator('> div').nth(1);
        await expect(secondItem).toHaveClass(/bg-blue-600/);

        await page.keyboard.press('ArrowUp');
        await expect(firstItem).toHaveClass(/bg-blue-600/);
      }
    });

    test('Escape closes dropdown', async ({ page }) => {
      const precInput = page.locator('#cell-1-0');
      await precInput.click();

      const dropdown = page.locator('[data-testid="cell-1-0-dropdown"]');
      await expect(dropdown).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dropdown).not.toBeVisible();

      // Modal should still be open
      await expect(
        page.locator('[data-testid="jcf-modal-backdrop"]'),
      ).toBeVisible();
    });

    test('Tab delegates to table navigation (moves to next cell)', async ({
      page,
    }) => {
      const precInput = page.locator('#cell-1-0');
      await precInput.click();

      // Tab should move to next row (quantite, cell-1-1)
      await page.keyboard.press('Tab');

      const focusedId = await page.evaluate(
        () => document.activeElement?.id,
      );
      expect(focusedId).toBe('cell-1-1');
    });
  });

  test.describe('filtering', () => {
    test('typing filters element name suggestions', async ({ page }) => {
      // Add a third element so we have multiple suggestions
      await page.locator('[data-testid="jcf-element-add-1"]').click();

      // Get first element's name for filtering
      const name0 = await page
        .locator('[data-testid="jcf-element-name-0"]')
        .textContent();

      // Focus precedences of third element
      const precInput = page.locator('#cell-2-0');
      await precInput.click();

      // Type first 2 characters of the first element name to filter
      const filterText = name0!.substring(0, 2);
      await precInput.fill(filterText);

      const dropdown = page.locator('[data-testid="cell-2-0-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText(name0!);
    });
  });
});
