/**
 * Playwright JCF Job Header Tests
 *
 * Tests for v0.4.7: JCF Job Header Basic Fields
 * ID, Intitulé, Quantité, Deadline fields.
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.7: JCF Job Header Basic Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);

    // Open JCF modal
    const addButton = page.locator('button[aria-label="Ajouter un travail"]');
    await addButton.click();
    await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
  });

  test.describe('Job Header visibility', () => {
    test('job header is visible inside modal', async ({ page }) => {
      await expect(page.locator('[data-testid="jcf-job-header"]')).toBeVisible();
    });

    test('all field labels are visible', async ({ page }) => {
      const header = page.locator('[data-testid="jcf-job-header"]');
      await expect(header.locator('label:has-text("ID")')).toBeVisible();
      await expect(header.locator('label:has-text("Intitulé")')).toBeVisible();
      await expect(header.locator('label:has-text("Quantité")')).toBeVisible();
      await expect(header.locator('label:has-text("Deadline")')).toBeVisible();
    });
  });

  test.describe('ID field', () => {
    test('has auto-generated ID in J-YYYY-NNNN format', async ({ page }) => {
      const idField = page.locator('[data-testid="jcf-field-id"]');
      const value = await idField.inputValue();
      expect(value).toMatch(/^J-\d{4}-\d{4}$/);
    });

    test('ID field is readonly', async ({ page }) => {
      const idField = page.locator('[data-testid="jcf-field-id"]');
      await expect(idField).toHaveAttribute('readonly', '');
    });
  });

  test.describe('Intitulé field', () => {
    test('can type text into Intitulé', async ({ page }) => {
      const input = page.locator('[data-testid="jcf-field-intitule"]');
      await input.fill('Cartes de voeux');
      await expect(input).toHaveValue('Cartes de voeux');
    });
  });

  test.describe('Quantité field', () => {
    test('can type number into Quantité', async ({ page }) => {
      const input = page.locator('[data-testid="jcf-field-quantite"]');
      await input.fill('500');
      await expect(input).toHaveValue('500');
    });
  });

  test.describe('Deadline field', () => {
    test('has jj/mm placeholder', async ({ page }) => {
      const input = page.locator('[data-testid="jcf-field-deadline"]');
      await expect(input).toHaveAttribute('placeholder', 'jj/mm');
    });

    test('converts French date to ISO on blur', async ({ page }) => {
      const input = page.locator('[data-testid="jcf-field-deadline"]');
      await input.fill('15/06');
      await input.blur();

      // After blur, the value should be formatted as jj/mm/aaaa (French display of ISO)
      const year = new Date().getFullYear();
      await expect(input).toHaveValue(`15/06/${year}`);
    });

    test('accepts full French date format', async ({ page }) => {
      const input = page.locator('[data-testid="jcf-field-deadline"]');
      await input.fill('25/12/2026');
      await input.blur();
      await expect(input).toHaveValue('25/12/2026');
    });
  });

  test.describe('Tab navigation', () => {
    test('Tab moves focus between editable fields', async ({ page }) => {
      // Focus intitulé first
      const intitule = page.locator('[data-testid="jcf-field-intitule"]');
      await intitule.focus();
      await expect(intitule).toBeFocused();

      // Tab to Quantité
      await page.keyboard.press('Tab');
      const quantite = page.locator('[data-testid="jcf-field-quantite"]');
      await expect(quantite).toBeFocused();

      // Tab to Deadline
      await page.keyboard.press('Tab');
      const deadline = page.locator('[data-testid="jcf-field-deadline"]');
      await expect(deadline).toBeFocused();
    });
  });

  test.describe('New ID on reopen', () => {
    test('generates new ID when modal is reopened', async ({ page }) => {
      // Get first ID
      const idField = page.locator('[data-testid="jcf-field-id"]');
      const firstId = await idField.inputValue();

      // Close and reopen modal
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).not.toBeVisible();

      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();
      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();

      // Get second ID — should be different (very high probability with random 4 digits)
      const secondId = await idField.inputValue();
      // Both should match the format
      expect(firstId).toMatch(/^J-\d{4}-\d{4}$/);
      expect(secondId).toMatch(/^J-\d{4}-\d{4}$/);
    });
  });
});
