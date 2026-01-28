/**
 * E2E tests for JCF Live Format Validation (Level 1)
 *
 * Tests error display for invalid input and lenient typing behavior.
 *
 * @see docs/releases/v0.4.23-jcf-live-format-validation.md
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
