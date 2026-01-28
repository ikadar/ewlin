/**
 * E2E tests for JCF Required Indicators & Calculated Fields (Level 2)
 *
 * Tests required field indicators and qteFeuilles auto-calculation.
 *
 * @see docs/releases/v0.4.24-jcf-required-indicators-calculated-fields.md
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('JCF Required Indicators & Calculated Fields', () => {
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

  // ── Required Indicators ─────────────────────────────────────────────────────

  test.describe('required indicators', () => {
    test('shows required indicator on sequence when element has content', async ({
      page,
    }) => {
      // Fill papier to trigger "has content"
      const papierCell = page.getByTestId('jcf-cell-0-papier');
      const papierInput = papierCell.locator('input');
      await papierInput.click();
      await papierInput.fill('Couché:135');
      await papierInput.blur();

      // Sequence should show required indicator (amber dot)
      const sequenceIndicator = page.getByTestId('required-indicator-0-sequence');
      await expect(sequenceIndicator).toHaveClass(/opacity-100/);
    });

    test('hides required indicator when field is filled', async ({ page }) => {
      // Fill papier to trigger "has content"
      const papierCell = page.getByTestId('jcf-cell-0-papier');
      const papierInput = papierCell.locator('input');
      await papierInput.click();
      await papierInput.fill('Couché:135');
      await papierInput.blur();

      // Fill sequence
      const sequenceCell = page.getByTestId('jcf-cell-0-sequence');
      const sequenceTextarea = sequenceCell.locator('textarea');
      await sequenceTextarea.fill('G37(20)');

      // Sequence indicator should be hidden
      const sequenceIndicator = page.getByTestId('required-indicator-0-sequence');
      await expect(sequenceIndicator).toHaveClass(/opacity-0/);
    });

    test('shows required indicators for BLOC SUPPORT fields when imposition filled', async ({
      page,
    }) => {
      // Fill imposition to trigger BLOC SUPPORT
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // All BLOC SUPPORT fields should show required indicator
      await expect(
        page.getByTestId('required-indicator-0-papier'),
      ).toHaveClass(/opacity-100/);
      await expect(
        page.getByTestId('required-indicator-0-pagination'),
      ).toHaveClass(/opacity-100/);
      await expect(
        page.getByTestId('required-indicator-0-format'),
      ).toHaveClass(/opacity-100/);

      // imposition is filled, so no indicator
      await expect(
        page.getByTestId('required-indicator-0-imposition'),
      ).toHaveClass(/opacity-0/);
    });

    test('shows required indicator for impression when imposition filled', async ({
      page,
    }) => {
      // Fill imposition to trigger BLOC IMPRESSION
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // impression should show required indicator
      await expect(
        page.getByTestId('required-indicator-0-impression'),
      ).toHaveClass(/opacity-100/);
    });

    test('error indicator takes precedence over required indicator', async ({
      page,
    }) => {
      // Fill imposition (triggers required on papier)
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // Fill papier with invalid value
      const papierCell = page.getByTestId('jcf-cell-0-papier');
      const papierInput = papierCell.locator('input');
      await papierInput.click();
      await papierInput.fill('invalid');
      await papierInput.blur();

      // papier should show error background, not just required indicator
      await expect(papierCell).toHaveClass(/bg-red-900/);

      // required indicator should be hidden (error takes precedence)
      await expect(
        page.getByTestId('required-indicator-0-papier'),
      ).toHaveClass(/opacity-0/);
    });
  });

  // ── qteFeuilles Auto-Calculation ────────────────────────────────────────────

  test.describe('qteFeuilles auto-calculation', () => {
    test('auto-calculates qteFeuilles from job quantity and imposition', async ({
      page,
    }) => {
      // Set job quantity to 1000
      const quantityInput = page.getByTestId('jcf-field-quantite');
      await quantityInput.fill('1000');

      // Set imposition with 8 poses
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // qteFeuilles should be auto-calculated: ceil(1000 / 8) = 125
      const qteInput = page.getByTestId('jcf-input-0-qteFeuilles');
      await expect(qteInput).toHaveValue('125');
    });

    test('shows green text when auto-mode is active', async ({ page }) => {
      // Set job quantity
      const quantityInput = page.getByTestId('jcf-field-quantite');
      await quantityInput.fill('1000');

      // Set imposition
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // qteFeuilles input should have green text
      const qteInput = page.getByTestId('jcf-input-0-qteFeuilles');
      await expect(qteInput).toHaveClass(/text-emerald-500/);
    });

    test('toggles to manual mode when calculator button clicked', async ({
      page,
    }) => {
      // Set job quantity
      const quantityInput = page.getByTestId('jcf-field-quantite');
      await quantityInput.fill('1000');

      // Set imposition
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // Click toggle button
      const toggleButton = page.getByTestId('auto-toggle-0');
      await toggleButton.click();

      // Input should not have green text (manual mode)
      const qteInput = page.getByTestId('jcf-input-0-qteFeuilles');
      await expect(qteInput).not.toHaveClass(/text-emerald-500/);
    });

    test('manual value persists when auto-mode is off', async ({ page }) => {
      // Set job quantity
      const quantityInput = page.getByTestId('jcf-field-quantite');
      await quantityInput.fill('1000');

      // Set imposition
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // Toggle to manual mode
      const toggleButton = page.getByTestId('auto-toggle-0');
      await toggleButton.click();

      // Enter manual value
      const qteInput = page.getByTestId('jcf-input-0-qteFeuilles');
      await qteInput.fill('200');

      // Change job quantity (should not affect manual value)
      await quantityInput.fill('2000');

      // Value should still be 200
      await expect(qteInput).toHaveValue('200');
    });

    test('re-calculates when switched back to auto mode', async ({ page }) => {
      // Set job quantity
      const quantityInput = page.getByTestId('jcf-field-quantite');
      await quantityInput.fill('1000');

      // Set imposition
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // Toggle to manual, enter value
      const toggleButton = page.getByTestId('auto-toggle-0');
      await toggleButton.click();
      const qteInput = page.getByTestId('jcf-input-0-qteFeuilles');
      await qteInput.fill('999');

      // Toggle back to auto
      await toggleButton.click();

      // Should recalculate: ceil(1000 / 8) = 125
      await expect(qteInput).toHaveValue('125');
    });

    test('considers element quantity in calculation', async ({ page }) => {
      // Set job quantity
      const quantityInput = page.getByTestId('jcf-field-quantite');
      await quantityInput.fill('1000');

      // Set element quantity to 2
      const elemQtyCell = page.getByTestId('jcf-cell-0-quantite');
      const elemQtyInput = elemQtyCell.locator('input');
      await elemQtyInput.fill('2');

      // Set imposition with 8 poses
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // qteFeuilles should be: ceil((1000 * 2) / 8) = 250
      const qteInput = page.getByTestId('jcf-input-0-qteFeuilles');
      await expect(qteInput).toHaveValue('250');
    });

    test('updates when job quantity changes', async ({ page }) => {
      // Set job quantity
      const quantityInput = page.getByTestId('jcf-field-quantite');
      await quantityInput.fill('1000');

      // Set imposition
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // Initial value: 125
      const qteInput = page.getByTestId('jcf-input-0-qteFeuilles');
      await expect(qteInput).toHaveValue('125');

      // Change job quantity to 2000
      await quantityInput.fill('2000');

      // Should update: ceil(2000 / 8) = 250
      await expect(qteInput).toHaveValue('250');
    });

    test('handles ceiling correctly for non-exact division', async ({
      page,
    }) => {
      // Set job quantity to 100
      const quantityInput = page.getByTestId('jcf-field-quantite');
      await quantityInput.fill('100');

      // Set imposition with 8 poses
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // qteFeuilles should be: ceil(100 / 8) = 13 (not 12.5)
      const qteInput = page.getByTestId('jcf-input-0-qteFeuilles');
      await expect(qteInput).toHaveValue('13');
    });
  });

  // ── Calculator Toggle Visual ────────────────────────────────────────────────

  test.describe('calculator toggle button', () => {
    test('shows calculator icon', async ({ page }) => {
      // Calculator icon should be visible in qteFeuilles cell
      const toggleButton = page.getByTestId('auto-toggle-0');
      await expect(toggleButton).toBeVisible();
    });

    test('has correct tooltip for auto mode', async ({ page }) => {
      const toggleButton = page.getByTestId('auto-toggle-0');
      await expect(toggleButton).toHaveAttribute(
        'title',
        'Calcul auto actif - cliquer pour désactiver',
      );
    });

    test('has correct tooltip for manual mode', async ({ page }) => {
      const toggleButton = page.getByTestId('auto-toggle-0');
      await toggleButton.click();

      await expect(toggleButton).toHaveAttribute(
        'title',
        'Calcul auto désactivé - cliquer pour réactiver',
      );
    });
  });
});
