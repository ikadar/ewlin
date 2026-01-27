/**
 * Playwright JCF Autocomplete Table Integration Tests
 *
 * Tests for v0.4.11: JCF Base Autocomplete Component (Table Integration)
 * Verifies onTabOut/onArrowNav delegation props and backward compatibility.
 *
 * Since autocomplete is not yet inside the Elements Table (v0.4.13+),
 * these tests verify backward compatibility in the Job Header context
 * and that Alt+Arrow has no unintended effect without delegation props.
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.11: JCF Autocomplete Table Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);

    // Open JCF modal
    const addButton = page.locator('button[aria-label="Ajouter un travail"]');
    await addButton.click();
    await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
  });

  test.describe('backward compatibility (Job Header)', () => {
    test('Tab still closes dropdown in Job Header autocomplete', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).toBeVisible();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).not.toBeVisible();
    });

    test('Tab in Job Header autocomplete moves focus normally (no onTabOut)', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();

      // Tab should move focus away from client input (native Tab behavior)
      await page.keyboard.press('Tab');

      // Client input should no longer be focused
      await expect(clientInput).not.toBeFocused();
    });

    test('regular ArrowDown still navigates dropdown suggestions', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).toBeVisible();

      // ArrowDown navigates within dropdown
      await page.keyboard.press('ArrowDown');
      const dropdown = page.locator('[data-testid="jcf-client-dropdown"]');
      // Second item should be highlighted (bg-blue-600)
      const secondItem = dropdown.locator('> div').nth(1);
      await expect(secondItem).toHaveClass(/bg-blue-600/);
    });

    test('regular ArrowUp still navigates dropdown suggestions', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).toBeVisible();

      // Navigate down then up
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');
      const dropdown = page.locator('[data-testid="jcf-client-dropdown"]');
      // First item should be highlighted again
      const firstItem = dropdown.locator('> div').nth(0);
      await expect(firstItem).toHaveClass(/bg-blue-600/);
    });
  });

  test.describe('Alt+Arrow in Job Header (no delegation)', () => {
    test('Alt+ArrowDown does not open dropdown when closed', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();
      // Close dropdown first
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).not.toBeVisible();

      // Alt+ArrowDown should NOT reopen dropdown (it delegates, but no handler)
      await page.keyboard.press('Alt+ArrowDown');
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).not.toBeVisible();
    });

    test('Alt+ArrowDown closes dropdown when open', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).toBeVisible();

      // Alt+ArrowDown should close dropdown (delegation path, even without onArrowNav)
      await page.keyboard.press('Alt+ArrowDown');
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).not.toBeVisible();
    });

    test('Alt+Arrow does not interfere with modal', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();

      // Press various Alt+Arrow combinations — modal should stay open
      await page.keyboard.press('Alt+ArrowDown');
      await page.keyboard.press('Alt+ArrowUp');
      await page.keyboard.press('Alt+ArrowLeft');
      await page.keyboard.press('Alt+ArrowRight');

      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
    });
  });

  test.describe('dropdown close on delegation keys', () => {
    test('Shift+Tab closes dropdown in Job Header autocomplete', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).toBeVisible();

      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).not.toBeVisible();
    });

    test('Enter and Escape still work normally with delegation props available', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).toBeVisible();

      // Enter selects item
      await page.keyboard.press('Enter');
      const value = await clientInput.inputValue();
      expect(value.length).toBeGreaterThan(0);

      // Reopen dropdown by clearing and refocusing
      await clientInput.fill('');
      await clientInput.focus();
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).toBeVisible();

      // Escape closes dropdown
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).not.toBeVisible();
      // Modal still open
      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
    });
  });
});
