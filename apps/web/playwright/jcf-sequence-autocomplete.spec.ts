/**
 * Playwright JCF Sequence Autocomplete E2E Tests
 *
 * Tests for v0.4.20: Multi-line sequence editor with poste mode.
 * Verifies poste selection, duration input, multi-line editing,
 * and keyboard navigation.
 *
 * Sequence is row index 11 (last row) in the elements table.
 *
 * @see docs/releases/v0.4.20-jcf-sequence-poste-mode.md
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.20: JCF Sequence Autocomplete', () => {
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

  test.describe('poste name selection', () => {
    test('shows poste name suggestions on focus', async ({ page }) => {
      // Focus the sequence cell (row 11, element 0)
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Dropdown should appear with poste names (portal-based)
      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('G37');
      await expect(dropdown).toContainText('Stahl');
    });

    test('shows category descriptions in dropdown', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('Presse offset');
      await expect(dropdown).toContainText('Plieuse');
    });

    test('shows ST: option in poste suggestions', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('ST:');
      await expect(dropdown).toContainText('Sous-traitant');
    });

    test('selecting poste inserts name with open paren', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Select first poste via Enter
      await page.keyboard.press('Enter');

      // Textarea should contain poste name + open paren
      const value = await sequenceTextarea.inputValue();
      expect(value).toContain('(');
    });
  });

  test.describe('duration input', () => {
    test('shows duration suggestions after poste selection', async ({
      page,
    }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Type a poste name with open paren
      await sequenceTextarea.fill('G37(');

      // Dropdown should show duration suggestions
      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('20)');
      await expect(dropdown).toContainText('30)');
      await expect(dropdown).toContainText('20+30)');
    });

    test('selecting duration completes the line', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();
      await sequenceTextarea.fill('G37(');

      // Select first duration via Enter
      await page.keyboard.press('Enter');

      // Textarea should contain complete line: G37(20)
      const value = await sequenceTextarea.inputValue();
      expect(value).toMatch(/^G37\(\d+(\+\d+)?\)$/);
    });
  });

  test.describe('multi-line editing', () => {
    test('supports multiple lines with independent autocomplete', async ({
      page,
    }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Type first complete line
      await sequenceTextarea.fill('G37(20)');

      // Press Enter to add new line
      await page.keyboard.press('Enter');

      // Type on new line — should show poste suggestions
      await page.keyboard.type('St');
      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('Stahl');
    });
  });

  test.describe('keyboard navigation', () => {
    test('Escape closes dropdown', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dropdown).not.toBeVisible();

      // Modal should still be open
      await expect(
        page.locator('[data-testid="jcf-modal-backdrop"]'),
      ).toBeVisible();
    });

    test('Tab delegates to table navigation', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();

      // Sequence is last row (index 11). Tab should NOT move within table
      // (no more rows below). Tab behavior at boundary depends on element count.
      // With single element, Tab at last cell should allow native Tab out.
      // We just verify Tab doesn't break.
      await page.keyboard.press('Tab');

      // Focus should have moved away from sequence cell
      const focusedId = await page.evaluate(
        () => document.activeElement?.id,
      );
      // Not asserting specific target since it depends on boundary behavior
      expect(focusedId).not.toBe('cell-0-11');
    });
  });

  test.describe('filtering', () => {
    test('typing filters poste suggestions', async ({ page }) => {
      const sequenceTextarea = page.locator('#cell-0-11');
      await sequenceTextarea.click();
      await sequenceTextarea.fill('G');

      const dropdown = page.locator('[data-testid="cell-0-11-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('G37');
      await expect(dropdown).toContainText('GTO');
      // Non-matching should not appear
      const text = await dropdown.textContent();
      expect(text).not.toContain('Stahl');
    });
  });
});
