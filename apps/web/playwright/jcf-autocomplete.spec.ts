/**
 * Playwright JCF Autocomplete Tests
 *
 * Tests for v0.4.8: JCF Autocomplete Fields (Client & Template)
 * Client and Template autocomplete fields in Job Header.
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.8: JCF Autocomplete Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);

    // Open JCF modal
    const addButton = page.locator('button[aria-label="Ajouter un travail"]');
    await addButton.click();
    await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
  });

  test.describe('Client field', () => {
    test('Client field is visible in Job Header', async ({ page }) => {
      const header = page.locator('[data-testid="jcf-job-header"]');
      await expect(header.locator('label:has-text("Client")')).toBeVisible();
    });

    test('Client field opens dropdown on focus', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).toBeVisible();
    });

    test('Client field filters suggestions on type', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.fill('Poste');

      const dropdown = page.locator('[data-testid="jcf-client-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown.locator('text=La Poste')).toBeVisible();
      // Other clients should not be visible
      await expect(dropdown.locator('text=Hachette Livre')).not.toBeVisible();
    });

    test('Client field keyboard navigation (ArrowDown, Enter)', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();

      // Navigate down and select
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // Input should have the second client value (first was highlighted by default, ArrowDown moves to second)
      const value = await clientInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    });

    test('Client field closes dropdown on Escape without closing modal', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).toBeVisible();

      // Press Escape — should close dropdown only
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="jcf-client-dropdown"]')).not.toBeVisible();
      // Modal should still be open
      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
    });
  });

  test.describe('Template field', () => {
    test('Template field is visible in Job Header', async ({ page }) => {
      const header = page.locator('[data-testid="jcf-job-header"]');
      await expect(header.locator('label:has-text("Template")')).toBeVisible();
    });

    test('Template field has "Aucun" placeholder', async ({ page }) => {
      const templateInput = page.locator('[data-testid="jcf-field-template"]');
      await expect(templateInput).toHaveAttribute('placeholder', 'Aucun');
    });

    test('Template field shows universal templates when no client selected', async ({ page }) => {
      const templateInput = page.locator('[data-testid="jcf-field-template"]');
      await templateInput.focus();

      const dropdown = page.locator('[data-testid="jcf-template-dropdown"]');
      await expect(dropdown).toBeVisible();
      // Universal templates should have "universel" badge
      await expect(dropdown.locator('text=universel').first()).toBeVisible();
    });

    test('Template field shows client-filtered suggestions after client selection', async ({ page }) => {
      // First select a client
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.fill('La Poste');

      const clientDropdown = page.locator('[data-testid="jcf-client-dropdown"]');
      await expect(clientDropdown).toBeVisible();
      await clientDropdown.locator('text=La Poste').click();

      // Now check template suggestions
      const templateInput = page.locator('[data-testid="jcf-field-template"]');
      await templateInput.focus();

      const templateDropdown = page.locator('[data-testid="jcf-template-dropdown"]');
      await expect(templateDropdown).toBeVisible();
      // Should show "Flyer A5" with "La Poste" category badge
      await expect(templateDropdown.locator('text=Flyer A5')).toBeVisible();
    });
  });

  test.describe('Focus chain', () => {
    test('Client select focuses Template field', async ({ page }) => {
      const clientInput = page.locator('[data-testid="jcf-field-client"]');
      await clientInput.focus();

      // Select first client via Enter
      await page.keyboard.press('Enter');

      // Template field should receive focus (with timeout for setTimeout)
      // v0.5.6: Increased timeout due to async RTK Query operations
      const templateInput = page.locator('[data-testid="jcf-field-template"]');
      await expect(templateInput).toBeFocused({ timeout: 1000 });
    });
  });
});
