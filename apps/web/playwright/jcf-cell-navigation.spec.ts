/**
 * Playwright JCF Cell Navigation Tests
 *
 * Tests for v0.4.10: JCF Cell Navigation
 * Verifies Tab/Shift+Tab, Alt+Arrow, Enter, Escape keyboard navigation
 * within the Elements Table grid.
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

/** Open the JCF modal and wait for the elements table to be visible */
async function openJcfModal(page: Parameters<typeof test>[0]['page']) {
  const addButton = page.locator('button[aria-label="Ajouter un travail"]');
  await addButton.click();
  await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
  await expect(page.locator('[data-testid="jcf-elements-table"]')).toBeVisible();
}

/** Get the id of the currently focused element */
async function getFocusedId(page: Parameters<typeof test>[0]['page']): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.id ?? null);
}

/** Focus a specific cell by clicking on it */
async function focusCell(
  page: Parameters<typeof test>[0]['page'],
  elementIndex: number,
  rowIndex: number,
) {
  const cellId = `cell-${elementIndex}-${rowIndex}`;
  await page.locator(`#${cellId}`).click();
  // Verify focus landed
  await expect.poll(() => getFocusedId(page)).toBe(cellId);
}

// Row indices:
// 0=precedences, 1=quantite, 2=pagination, 3=format, 4=papier,
// 5=impression, 6=surfacage, 7=autres, 8=imposition, 9=qteFeuilles,
// 10=commentaires, 11=sequence

test.describe('v0.4.10: JCF Cell Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);
    await openJcfModal(page);
  });

  test.describe('Tab navigation', () => {
    test('Tab moves focus to next row in same column', async ({ page }) => {
      await focusCell(page, 0, 0); // precedences
      await page.keyboard.press('Tab');
      expect(await getFocusedId(page)).toBe('cell-0-1'); // quantite
    });

    test('Tab moves through multiple rows sequentially', async ({ page }) => {
      await focusCell(page, 0, 3); // format
      await page.keyboard.press('Tab');
      expect(await getFocusedId(page)).toBe('cell-0-4'); // papier
      await page.keyboard.press('Tab');
      expect(await getFocusedId(page)).toBe('cell-0-5'); // impression
    });

    test('Tab at column end moves to next column first row', async ({ page }) => {
      // Add a second element first
      await page.locator('[data-testid="jcf-element-add-0"]').click();
      await expect(page.locator('[data-testid="jcf-element-name-1"]')).toBeVisible();

      await focusCell(page, 0, 11); // last row of first element (sequence)
      await page.keyboard.press('Tab');
      expect(await getFocusedId(page)).toBe('cell-1-0'); // first row of second element
    });
  });

  test.describe('Shift+Tab navigation', () => {
    test('Shift+Tab moves focus to previous row', async ({ page }) => {
      await focusCell(page, 0, 3); // format
      await page.keyboard.press('Shift+Tab');
      expect(await getFocusedId(page)).toBe('cell-0-2'); // pagination
    });

    test('Shift+Tab at column start moves to previous column last row', async ({ page }) => {
      // Add a second element first
      await page.locator('[data-testid="jcf-element-add-0"]').click();
      await expect(page.locator('[data-testid="jcf-element-name-1"]')).toBeVisible();

      await focusCell(page, 1, 0); // first row of second element
      await page.keyboard.press('Shift+Tab');
      expect(await getFocusedId(page)).toBe('cell-0-11'); // last row of first element
    });
  });

  test.describe('Alt+Arrow navigation', () => {
    test('Alt+ArrowDown wraps from last row to first row', async ({ page }) => {
      await focusCell(page, 0, 11); // sequence (last row)
      await page.keyboard.press('Alt+ArrowDown');
      expect(await getFocusedId(page)).toBe('cell-0-0'); // precedences (first row)
    });

    test('Alt+ArrowUp wraps from first row to last row', async ({ page }) => {
      await focusCell(page, 0, 0); // precedences (first row)
      await page.keyboard.press('Alt+ArrowUp');
      expect(await getFocusedId(page)).toBe('cell-0-11'); // sequence (last row)
    });

    test('Alt+ArrowRight moves to next column same row', async ({ page }) => {
      // Add a second element
      await page.locator('[data-testid="jcf-element-add-0"]').click();
      await expect(page.locator('[data-testid="jcf-element-name-1"]')).toBeVisible();

      await focusCell(page, 0, 3); // format, first element
      await page.keyboard.press('Alt+ArrowRight');
      expect(await getFocusedId(page)).toBe('cell-1-3'); // format, second element
    });

    test('Alt+ArrowRight wraps from last column to first', async ({ page }) => {
      // Add a second element
      await page.locator('[data-testid="jcf-element-add-0"]').click();

      await focusCell(page, 1, 3); // format, second (last) element
      await page.keyboard.press('Alt+ArrowRight');
      expect(await getFocusedId(page)).toBe('cell-0-3'); // format, first element (wrap)
    });

    test('Alt+ArrowLeft wraps from first column to last', async ({ page }) => {
      // Add a second element
      await page.locator('[data-testid="jcf-element-add-0"]').click();

      await focusCell(page, 0, 3); // format, first element
      await page.keyboard.press('Alt+ArrowLeft');
      expect(await getFocusedId(page)).toBe('cell-1-3'); // format, second (last) element (wrap)
    });
  });

  test.describe('Enter key', () => {
    test('Enter in text input moves to next cell', async ({ page }) => {
      await focusCell(page, 0, 3); // format (text input)
      await page.keyboard.press('Enter');
      expect(await getFocusedId(page)).toBe('cell-0-4'); // papier
    });

    test('Enter in textarea allows newline (does not navigate)', async ({ page }) => {
      await focusCell(page, 0, 10); // commentaires (textarea)
      await page.keyboard.press('Enter');
      // Should stay on same cell — Enter inserts newline in textarea
      expect(await getFocusedId(page)).toBe('cell-0-10');
    });
  });

  test.describe('Escape key', () => {
    test('Escape removes focus from current cell', async ({ page }) => {
      await focusCell(page, 0, 3); // format
      expect(await getFocusedId(page)).toBe('cell-0-3');
      await page.keyboard.press('Escape');
      // Focus should no longer be on the cell
      expect(await getFocusedId(page)).not.toBe('cell-0-3');
    });

    test('Escape in cell does not close modal', async ({ page }) => {
      await focusCell(page, 0, 3);
      await page.keyboard.press('Escape');
      // Modal should still be visible (Escape only blurred the cell)
      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
    });

    test('Escape when no cell focused closes modal', async ({ page }) => {
      // Click somewhere that's not a cell input to ensure no cell is focused
      await page.locator('[data-testid="jcf-modal-title"]').click();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).not.toBeVisible();
    });
  });
});
