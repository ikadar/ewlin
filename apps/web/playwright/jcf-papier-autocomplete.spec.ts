/**
 * Playwright JCF Papier Autocomplete E2E Tests
 *
 * Tests for v0.4.17: Two-step Papier autocomplete (type → grammage).
 * Verifies DSL ↔ pretty conversion, keyboard navigation, and session learning.
 *
 * @see implicit-logic-specification.md §1.1 (Papier Format)
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.17: JCF Papier Autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);

    // Open JCF modal
    const addButton = page.locator('button[aria-label="Ajouter un travail"]');
    await addButton.click();
    await expect(
      page.locator('[data-testid="jcf-modal-backdrop"]'),
    ).toBeVisible();
  });

  test.describe('two-step selection', () => {
    test('shows type suggestions on focus', async ({ page }) => {
      // Focus the papier cell (row 4, element 0)
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();

      // Dropdown should appear with paper types
      const dropdown = page.locator('[data-testid="cell-0-4-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('Couché mat');
      await expect(dropdown).toContainText('Offset');
      await expect(dropdown).toContainText('Laser');
    });

    test('selecting type appends colon and shows grammages', async ({
      page,
    }) => {
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();

      // Select first type via Enter
      await page.keyboard.press('Enter');

      // Input should now contain "TypeName:" (type + colon)
      const value = await papierInput.inputValue();
      expect(value).toContain(':');

      // Dropdown should stay open with grammage suggestions
      const dropdown = page.locator('[data-testid="cell-0-4-dropdown"]');
      await expect(dropdown).toBeVisible();
      // Should contain grammage values (numbers with g suffix)
      await expect(dropdown).toContainText('g');
    });

    test('typing colon manually switches to grammage suggestions', async ({
      page,
    }) => {
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();

      // Type a paper type name followed by colon
      await papierInput.fill('Offset:');

      // Dropdown should show grammage suggestions for Offset
      const dropdown = page.locator('[data-testid="cell-0-4-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('80g');
    });

    test('full type-grammage selection via keyboard', async ({ page }) => {
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();

      // Type "Offset:" to go to grammage step
      await papierInput.fill('Offset:');

      // Select first grammage via Enter
      await page.keyboard.press('Enter');

      // Dropdown should close after grammage selection
      const dropdown = page.locator('[data-testid="cell-0-4-dropdown"]');
      await expect(dropdown).not.toBeVisible();

      // Input should contain the full DSL value
      const value = await papierInput.inputValue();
      expect(value).toMatch(/^Offset:\d+$/);
    });
  });

  test.describe('pretty display', () => {
    test('shows pretty format after blur', async ({ page }) => {
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();

      // Enter a complete DSL value
      await papierInput.fill('Couché mat:135');

      // Blur by clicking elsewhere
      await page.locator('#cell-0-7').click(); // autres field

      // Papier field should show pretty format
      await expect(papierInput).toHaveValue('Couché mat 135g');
    });

    test('shows DSL format when refocused', async ({ page }) => {
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();
      await papierInput.fill('Couché mat:135');

      // Blur
      await page.locator('#cell-0-7').click();
      await expect(papierInput).toHaveValue('Couché mat 135g');

      // Refocus — should show DSL
      await papierInput.click();
      await expect(papierInput).toHaveValue('Couché mat:135');
    });
  });

  test.describe('keyboard navigation', () => {
    test('ArrowDown/ArrowUp navigate suggestions', async ({ page }) => {
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();

      const dropdown = page.locator('[data-testid="cell-0-4-dropdown"]');
      await expect(dropdown).toBeVisible();

      // First item highlighted by default
      const firstItem = dropdown.locator('> div').nth(0);
      await expect(firstItem).toHaveClass(/bg-blue-600/);

      // ArrowDown — second item highlighted
      await page.keyboard.press('ArrowDown');
      const secondItem = dropdown.locator('> div').nth(1);
      await expect(secondItem).toHaveClass(/bg-blue-600/);

      // ArrowUp — first item highlighted again
      await page.keyboard.press('ArrowUp');
      await expect(firstItem).toHaveClass(/bg-blue-600/);
    });

    test('Escape closes dropdown', async ({ page }) => {
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();

      const dropdown = page.locator('[data-testid="cell-0-4-dropdown"]');
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
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();

      // Tab should move to next row (impression, cell-0-5)
      await page.keyboard.press('Tab');

      const focusedId = await page.evaluate(
        () => document.activeElement?.id,
      );
      expect(focusedId).toBe('cell-0-5');
    });
  });

  test.describe('filtering', () => {
    test('typing filters type suggestions', async ({ page }) => {
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();
      await papierInput.fill('Off');

      const dropdown = page.locator('[data-testid="cell-0-4-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('Offset');
      // Other types should not appear
      const text = await dropdown.textContent();
      expect(text).not.toContain('Couché');
      expect(text).not.toContain('Laser');
    });

    test('typing filters grammage suggestions', async ({ page }) => {
      const papierInput = page.locator('#cell-0-4');
      await papierInput.click();
      await papierInput.fill('Couché mat:13');

      const dropdown = page.locator('[data-testid="cell-0-4-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('135g');
      // Non-matching grammages should not appear
      const text = await dropdown.textContent();
      expect(text).not.toContain('90g');
    });
  });
});
