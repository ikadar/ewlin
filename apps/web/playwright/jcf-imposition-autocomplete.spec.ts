/**
 * Playwright JCF Imposition Autocomplete E2E Tests
 *
 * Tests for v0.4.18: Two-step Imposition autocomplete (format -> poses).
 * Verifies DSL <-> pretty conversion, keyboard navigation, and session learning.
 *
 * @see implicit-logic-specification.md §1.2 (Imposition format)
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.18: JCF Imposition Autocomplete', () => {
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
    test('shows format suggestions on focus', async ({ page }) => {
      // Focus the imposition cell (row 8, element 0)
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();

      // Dropdown should appear with sheet formats
      const dropdown = page.locator('[data-testid="cell-0-8-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('50x70');
      await expect(dropdown).toContainText('65x90');
      await expect(dropdown).toContainText('70x100');
    });

    test('selecting format appends paren and shows poses', async ({
      page,
    }) => {
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();

      // Select first format via Enter
      await page.keyboard.press('Enter');

      // Input should now contain "FormatName(" (format + open paren)
      const value = await impositionInput.inputValue();
      expect(value).toContain('(');

      // Dropdown should stay open with poses suggestions
      const dropdown = page.locator('[data-testid="cell-0-8-dropdown"]');
      await expect(dropdown).toBeVisible();
      // Should contain poses values (numbers with closing paren)
      await expect(dropdown).toContainText(')');
    });

    test('typing paren manually switches to poses suggestions', async ({
      page,
    }) => {
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();

      // Type a format name followed by paren
      await impositionInput.fill('50x70(');

      // Dropdown should show poses suggestions for 50x70
      const dropdown = page.locator('[data-testid="cell-0-8-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('8)');
    });

    test('full format-poses selection via keyboard', async ({ page }) => {
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();

      // Type "50x70(" to go to poses step
      await impositionInput.fill('50x70(');

      // Select first poses via Enter
      await page.keyboard.press('Enter');

      // Dropdown should close after poses selection
      const dropdown = page.locator('[data-testid="cell-0-8-dropdown"]');
      await expect(dropdown).not.toBeVisible();

      // Input should contain the full DSL value
      const value = await impositionInput.inputValue();
      expect(value).toMatch(/^50x70\(\d+\)$/);
    });
  });

  test.describe('pretty display', () => {
    test('shows pretty format after blur', async ({ page }) => {
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();

      // Enter a complete DSL value
      await impositionInput.fill('50x70(8)');

      // Blur by clicking elsewhere
      await page.locator('#cell-0-7').click(); // autres field

      // Imposition field should show pretty format
      await expect(impositionInput).toHaveValue('50x70cm 8poses/f');
    });

    test('shows DSL format when refocused', async ({ page }) => {
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');

      // Blur
      await page.locator('#cell-0-7').click();
      await expect(impositionInput).toHaveValue('50x70cm 8poses/f');

      // Refocus — should show DSL
      await impositionInput.click();
      await expect(impositionInput).toHaveValue('50x70(8)');
    });
  });

  test.describe('keyboard navigation', () => {
    test('ArrowDown/ArrowUp navigate suggestions', async ({ page }) => {
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();

      const dropdown = page.locator('[data-testid="cell-0-8-dropdown"]');
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
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();

      const dropdown = page.locator('[data-testid="cell-0-8-dropdown"]');
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
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();

      // Tab should move to next row (qteFeuilles, cell-0-9)
      await page.keyboard.press('Tab');

      const focusedId = await page.evaluate(
        () => document.activeElement?.id,
      );
      expect(focusedId).toBe('cell-0-9');
    });
  });

  test.describe('filtering', () => {
    test('typing filters format suggestions', async ({ page }) => {
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();
      await impositionInput.fill('65');

      const dropdown = page.locator('[data-testid="cell-0-8-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('65x90');
      // Other formats should not appear
      const text = await dropdown.textContent();
      expect(text).not.toContain('50x70');
      expect(text).not.toContain('70x100');
    });

    test('typing filters poses suggestions', async ({ page }) => {
      const impositionInput = page.locator('#cell-0-8');
      await impositionInput.click();
      await impositionInput.fill('50x70(16');

      const dropdown = page.locator('[data-testid="cell-0-8-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('16)');
      // Non-matching poses should not appear
      const text = await dropdown.textContent();
      expect(text).not.toContain('2)');
      expect(text).not.toContain('4)');
    });
  });
});
