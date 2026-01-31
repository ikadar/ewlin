/**
 * E2E tests for JCF Validation
 *
 * - Level 1: Live Format Validation during typing
 * - Level 3: Submit Validation (strict errors + required fields)
 *
 * @see docs/releases/v0.4.23-jcf-live-format-validation.md
 * @see docs/releases/v0.4.30-jcf-submit-validation.md
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('JCF Live Format Validation', () => {
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

  // ── Pagination Validation ─────────────────────────────────────────────────

  test.describe('pagination validation', () => {
    test('shows error for invalid pagination value', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-pagination');
      const input = cell.locator('input');

      // Clear and type invalid value
      await input.fill('3');

      // Should show red background
      await expect(cell).toHaveClass(/bg-red-900/);

      // Should show error badge
      await expect(cell.getByTestId('error-badge')).toBeVisible();
    });

    test('no error for valid pagination (feuillet)', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-pagination');
      const input = cell.locator('input');

      await input.fill('2');

      // Should not show red background
      await expect(cell).not.toHaveClass(/bg-red-900/);
    });

    test('no error for valid pagination (cahier)', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-pagination');
      const input = cell.locator('input');

      await input.fill('8');

      // Should not show red background
      await expect(cell).not.toHaveClass(/bg-red-900/);
    });
  });

  // ── Papier Validation ─────────────────────────────────────────────────────

  test.describe('papier validation', () => {
    test('shows error for papier without colon', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-papier');
      const input = cell.locator('input');

      // Type value that doesn't match any suggestion and has no colon
      await input.click();
      await input.fill('xyz123');
      await input.blur(); // Blur triggers onChange in autocomplete components

      // Should show red background
      await expect(cell).toHaveClass(/bg-red-900/);
    });

    test('no error for valid papier DSL', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-papier');
      const input = cell.locator('input');

      await input.click();
      await input.fill('Couché:135');
      await input.blur();

      // Should not show red background
      await expect(cell).not.toHaveClass(/bg-red-900/);
    });
  });

  // ── Imposition Validation ─────────────────────────────────────────────────

  test.describe('imposition validation', () => {
    test('shows error for imposition without poses', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-imposition');
      const input = cell.locator('input');

      // Type value without poses pattern (N) or (Np)
      await input.click();
      await input.fill('xyz123');
      await input.blur();

      // Should show red background
      await expect(cell).toHaveClass(/bg-red-900/);
    });

    test('no error for valid imposition DSL', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-imposition');
      const input = cell.locator('input');

      await input.click();
      await input.fill('50x70(8)');
      await input.blur();

      // Should not show red background
      await expect(cell).not.toHaveClass(/bg-red-900/);
    });
  });

  // ── Impression Validation ─────────────────────────────────────────────────

  test.describe('impression validation', () => {
    test('shows error for impression without slash', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-impression');
      const input = cell.locator('input');

      // Type value without slash
      await input.click();
      await input.fill('xyz');
      await input.blur();

      // Should show red background
      await expect(cell).toHaveClass(/bg-red-900/);
    });

    test('no error for valid impression DSL', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-impression');
      const input = cell.locator('input');

      await input.click();
      await input.fill('Q/Q');
      await input.blur();

      // Should not show red background
      await expect(cell).not.toHaveClass(/bg-red-900/);
    });
  });

  // ── Surfacage Validation ──────────────────────────────────────────────────

  test.describe('surfacage validation', () => {
    test('shows error for surfacage without slash', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-surfacage');
      const input = cell.locator('input');

      // Type value without slash
      await input.click();
      await input.fill('xyz');
      await input.blur();

      // Should show red background
      await expect(cell).toHaveClass(/bg-red-900/);
    });

    test('no error for valid surfacage DSL', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-surfacage');
      const input = cell.locator('input');

      await input.click();
      await input.fill('mat/mat');
      await input.blur();

      // Should not show red background
      await expect(cell).not.toHaveClass(/bg-red-900/);
    });
  });

  // ── Format Validation ─────────────────────────────────────────────────────

  test.describe('format validation', () => {
    test('shows error for invalid format', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-format');
      const input = cell.locator('input');

      // Type value that doesn't match ISO or LxH pattern
      await input.click();
      await input.fill('xyz');
      await input.blur();

      // Should show red background
      await expect(cell).toHaveClass(/bg-red-900/);
    });

    test('no error for valid ISO format', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-format');
      const input = cell.locator('input');

      await input.click();
      await input.fill('A4');
      await input.blur();

      // Should not show red background
      await expect(cell).not.toHaveClass(/bg-red-900/);
    });

    test('no error for valid custom format', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-format');
      const input = cell.locator('input');

      await input.click();
      await input.fill('210x297');
      await input.blur();

      // Should not show red background
      await expect(cell).not.toHaveClass(/bg-red-900/);
    });
  });

  // ── Sequence Validation (Lenient) ─────────────────────────────────────────

  test.describe('sequence validation (lenient typing)', () => {
    test('no error for incomplete sequence (in progress)', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-sequence');
      const textarea = cell.locator('textarea');

      // Type incomplete sequence (no closing paren)
      await textarea.fill('G37(');

      // Should NOT show red background (lenient mode)
      await expect(cell).not.toHaveClass(/bg-red-900/);
    });

    test('shows error for complete but invalid sequence', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-sequence');
      const textarea = cell.locator('textarea');

      // Type invalid sequence (empty parens)
      await textarea.fill('G37()');

      // Should show red background
      await expect(cell).toHaveClass(/bg-red-900/);
    });

    test('no error for valid sequence', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-sequence');
      const textarea = cell.locator('textarea');

      await textarea.fill('G37(20)');

      // Should not show red background
      await expect(cell).not.toHaveClass(/bg-red-900/);
    });
  });

  // ── Error Tooltip ─────────────────────────────────────────────────────────

  test.describe('error tooltip', () => {
    test('shows tooltip on badge hover', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-pagination');
      const input = cell.locator('input');

      // Create error
      await input.fill('3');

      const badge = cell.getByTestId('error-badge');
      await badge.hover();

      // Tooltip should appear
      await expect(page.getByTestId('error-tooltip')).toBeVisible();
    });

    test('shows tooltip when input is focused', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-pagination');
      const input = cell.locator('input');

      // Create error
      await input.fill('3');

      // Focus the input
      await input.focus();

      // Tooltip should appear
      await expect(page.getByTestId('error-tooltip')).toBeVisible();
    });

    test('tooltip contains formatted message', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-pagination');
      const input = cell.locator('input');

      // Create error
      await input.fill('3');

      const badge = cell.getByTestId('error-badge');
      await badge.hover();

      const tooltip = page.getByTestId('error-tooltip');
      await expect(tooltip).toContainText('Pagination invalide');
    });
  });

  // ── Visual Feedback ───────────────────────────────────────────────────────

  test.describe('visual feedback', () => {
    test('error badge displays exclamation mark', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-pagination');
      const input = cell.locator('input');

      await input.fill('3');

      const badge = cell.getByTestId('error-badge');
      await expect(badge).toHaveText('!');
    });

    test('red background has transition', async ({ page }) => {
      const cell = page.getByTestId('jcf-cell-0-pagination');
      const input = cell.locator('input');

      await input.fill('3');

      // Should have transition class
      await expect(cell).toHaveClass(/transition-colors/);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Level 3: Submit Validation Tests
// ────────────────────────────────────────────────────────────────────────────

test.describe('JCF Submit Validation (Level 3)', () => {
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

  test.describe('save button', () => {
    test('save button is visible in modal footer', async ({ page }) => {
      const saveButton = page.getByTestId('jcf-modal-save');
      await expect(saveButton).toBeVisible();
      await expect(saveButton).toContainText('Enregistrer');
    });

    test('clicking save with empty required fields shows errors', async ({
      page,
    }) => {
      // Add content to trigger required field checks
      const papierCell = page.getByTestId('jcf-cell-0-papier');
      const papierInput = papierCell.locator('input');
      await papierInput.click();
      await papierInput.fill('Couché:135');
      await papierInput.blur();

      // Verify sequence field doesn't have error yet (amber indicator only)
      const sequenceCell = page.getByTestId('jcf-cell-0-sequence');
      await expect(sequenceCell).not.toHaveClass(/bg-red-900/);

      // Click save
      const saveButton = page.getByTestId('jcf-modal-save');
      await saveButton.click();

      // Now sequence field should show error (required field converted to error)
      await expect(sequenceCell).toHaveClass(/bg-red-900/);
    });

    test('clicking save with invalid DSL shows strict errors', async ({
      page,
    }) => {
      const sequenceCell = page.getByTestId('jcf-cell-0-sequence');
      const textarea = sequenceCell.locator('textarea');

      // Type incomplete sequence (lenient mode would not show error)
      await textarea.fill('G37(');

      // Verify no error before save (lenient mode)
      await expect(sequenceCell).not.toHaveClass(/bg-red-900/);

      // Click save
      const saveButton = page.getByTestId('jcf-modal-save');
      await saveButton.click();

      // Now strict mode shows error for incomplete sequence
      await expect(sequenceCell).toHaveClass(/bg-red-900/);
    });
  });

  test.describe('required field errors', () => {
    test('BLOC SUPPORT triggers required fields on save', async ({ page }) => {
      // Fill imposition to trigger BLOC SUPPORT
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      const impositionInput = impositionCell.locator('input');
      await impositionInput.click();
      await impositionInput.fill('50x70(8)');
      await impositionInput.blur();

      // Click save
      const saveButton = page.getByTestId('jcf-modal-save');
      await saveButton.click();

      // Required BLOC SUPPORT fields should show errors
      const papierCell = page.getByTestId('jcf-cell-0-papier');
      const paginationCell = page.getByTestId('jcf-cell-0-pagination');
      const formatCell = page.getByTestId('jcf-cell-0-format');
      const qteFeuilles = page.getByTestId('jcf-cell-0-qteFeuilles');
      const sequenceCell = page.getByTestId('jcf-cell-0-sequence');

      await expect(papierCell).toHaveClass(/bg-red-900/);
      await expect(paginationCell).toHaveClass(/bg-red-900/);
      await expect(formatCell).toHaveClass(/bg-red-900/);
      await expect(qteFeuilles).toHaveClass(/bg-red-900/);
      await expect(sequenceCell).toHaveClass(/bg-red-900/);
    });

    test('error tooltip shows French message for required field', async ({
      page,
    }) => {
      // Add content to trigger required checks
      const papierCell = page.getByTestId('jcf-cell-0-papier');
      const papierInput = papierCell.locator('input');
      await papierInput.click();
      await papierInput.fill('Couché:135');
      await papierInput.blur();

      // Click save
      const saveButton = page.getByTestId('jcf-modal-save');
      await saveButton.click();

      // Hover over sequence error badge
      const sequenceCell = page.getByTestId('jcf-cell-0-sequence');
      const badge = sequenceCell.getByTestId('error-badge');
      await badge.hover();

      // Tooltip should show French required message
      const tooltip = page.getByTestId('error-tooltip');
      await expect(tooltip).toContainText('Séquence requise');
    });
  });

  test.describe('fix errors and save', () => {
    test('fixing all errors allows save to succeed', async ({ page }) => {
      // Add content to trigger BLOC SUPPORT
      const impositionCell = page.getByTestId('jcf-cell-0-imposition');
      await impositionCell.locator('input').click();
      await impositionCell.locator('input').fill('50x70(8)');
      await impositionCell.locator('input').blur();

      // Click save to trigger errors
      const saveButton = page.getByTestId('jcf-modal-save');
      await saveButton.click();

      // Fill all required fields
      const sequenceCell = page.getByTestId('jcf-cell-0-sequence');
      await sequenceCell.locator('textarea').fill('G37(20)');

      const papierCell = page.getByTestId('jcf-cell-0-papier');
      await papierCell.locator('input').click();
      await papierCell.locator('input').fill('Couché:135');
      await papierCell.locator('input').blur();

      const paginationCell = page.getByTestId('jcf-cell-0-pagination');
      await paginationCell.locator('input').fill('8');

      const formatCell = page.getByTestId('jcf-cell-0-format');
      await formatCell.locator('input').click();
      await formatCell.locator('input').fill('A4');
      await formatCell.locator('input').blur();

      const qteFeuilles = page.getByTestId('jcf-cell-0-qteFeuilles');
      await qteFeuilles.locator('input').fill('1000');

      const impressionCell = page.getByTestId('jcf-cell-0-impression');
      await impressionCell.locator('input').click();
      await impressionCell.locator('input').fill('Q/Q');
      await impressionCell.locator('input').blur();

      // Click save again
      await saveButton.click();

      // Modal should close (save succeeded)
      await expect(
        page.locator('[data-testid="jcf-modal-backdrop"]'),
      ).not.toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('keyboard shortcut', () => {
    test('Cmd+S triggers save', async ({ page }) => {
      // Add content to trigger required checks
      const papierCell = page.getByTestId('jcf-cell-0-papier');
      const papierInput = papierCell.locator('input');
      await papierInput.click();
      await papierInput.fill('Couché:135');
      await papierInput.blur();

      // Verify no error before save
      const sequenceCell = page.getByTestId('jcf-cell-0-sequence');
      await expect(sequenceCell).not.toHaveClass(/bg-red-900/);

      // Press Cmd+S (or Ctrl+S on Linux/Windows)
      await page.keyboard.press('Meta+s');

      // Now sequence field should show error
      await expect(sequenceCell).toHaveClass(/bg-red-900/);
    });
  });
});
