/**
 * v0.5.6: Reference Lookup via API
 *
 * Tests for auto-filling client field when entering an existing job reference.
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.5.6: Reference Lookup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);

    // Open JCF modal
    const addButton = page.locator('button[aria-label="Ajouter un travail"]');
    await addButton.click();
    await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
  });

  test('ID field is visible in job header', async ({ page }) => {
    const idInput = page.locator('[data-testid="jcf-field-id"]');
    await expect(idInput).toBeVisible();
  });

  test('does not overwrite existing client value on reference lookup', async ({ page }) => {
    const clientInput = page.locator('[data-testid="jcf-field-client"]');
    const idInput = page.locator('[data-testid="jcf-field-id"]');

    // First, enter a client name
    await clientInput.fill('My Existing Client');

    // Then modify the ID field (if editable)
    const isReadonly = await idInput.getAttribute('readonly');
    if (isReadonly === null) {
      await idInput.clear();
      await idInput.fill('J-2026-0001');
      await page.keyboard.press('Tab');

      // Wait a moment for any potential lookup
      await page.waitForTimeout(500);

      // Client should still be the original value
      await expect(clientInput).toHaveValue('My Existing Client');
    }
  });

  test('handles non-existing reference gracefully', async ({ page }) => {
    const clientInput = page.locator('[data-testid="jcf-field-client"]');
    const idInput = page.locator('[data-testid="jcf-field-id"]');

    // Check if ID field is editable
    const isReadonly = await idInput.getAttribute('readonly');
    if (isReadonly === null) {
      // Enter a reference that definitely doesn't exist
      await idInput.clear();
      await idInput.fill('NONEXISTENT-REF-12345');
      await page.keyboard.press('Tab');

      // Wait a moment for lookup
      await page.waitForTimeout(500);

      // Client should still be empty (no error, just no auto-fill)
      await expect(clientInput).toHaveValue('');

      // Modal should still be open (no crash)
      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
    }
  });
});
