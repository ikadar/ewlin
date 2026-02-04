/**
 * Playwright Link Propagation Tests
 *
 * Tests for v0.4.35 - JCF: Link Propagation & Dual-Mode Editor
 *
 * Tests cover:
 * - Link toggle copies value from previous element
 * - Value propagation to linked elements
 * - Unlink preserves current value
 * - Dual-mode editor tab switching
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.35: JCF Link Propagation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);

    // Open JCF modal
    const addButton = page.locator('button[aria-label="Ajouter un travail"]');
    await addButton.click();
    await expect(
      page.locator('[data-testid="jcf-modal-backdrop"]')
    ).toBeVisible();
  });

  // ============================================================================
  // Link Toggle Visibility
  // ============================================================================

  test.describe('Link Toggle Visibility', () => {
    test('Link toggle is visible on second element for linkable fields', async ({
      page,
    }) => {
      // Add second element
      await page.locator('[data-testid="jcf-element-add-0"]').click();
      await expect(
        page.locator('[data-testid="jcf-element-name-1"]')
      ).toBeVisible();

      // Link toggle should be visible for format field on element 2
      await expect(
        page.locator('[data-testid="link-toggle-1-format"]')
      ).toBeVisible();
    });

    test('Link toggle is NOT visible on first element', async ({ page }) => {
      // Add second element (so we have 2 elements)
      await page.locator('[data-testid="jcf-element-add-0"]').click();

      // Link toggle should NOT exist for element 0
      await expect(
        page.locator('[data-testid="link-toggle-0-format"]')
      ).not.toBeVisible();
    });

    test('Link toggles exist for all linkable fields', async ({ page }) => {
      // Add second element
      await page.locator('[data-testid="jcf-element-add-0"]').click();

      // All 5 linkable fields should have toggles
      const linkableFields = [
        'format',
        'papier',
        'imposition',
        'impression',
        'surfacage',
      ];

      for (const field of linkableFields) {
        await expect(
          page.locator(`[data-testid="link-toggle-1-${field}"]`)
        ).toBeVisible();
      }
    });
  });

  // ============================================================================
  // Link Activation
  // ============================================================================

  test.describe('Link Activation', () => {
    test('Clicking link toggle copies value from previous element', async ({
      page,
    }) => {
      // Set format on first element
      const formatInput = page.locator('[data-testid="jcf-cell-0-format"] input');
      await formatInput.fill('A4');
      await formatInput.press('Enter');

      // Add second element
      await page.locator('[data-testid="jcf-element-add-0"]').click();

      // Click link toggle for format
      await page.locator('[data-testid="link-toggle-1-format"]').click();

      // Second element should now have same value
      await expect(
        page.locator('[data-testid="jcf-input-1-format"]')
      ).toHaveValue('A4');
    });

    test('Linked field shows read-only state', async ({ page }) => {
      // Set format on first element
      const formatInput = page.locator('[data-testid="jcf-cell-0-format"] input');
      await formatInput.fill('A4');
      await formatInput.press('Enter');

      // Add second element and link
      await page.locator('[data-testid="jcf-element-add-0"]').click();
      await page.locator('[data-testid="link-toggle-1-format"]').click();

      // Linked field should be read-only
      await expect(
        page.locator('[data-testid="jcf-input-1-format"]')
      ).toHaveAttribute('readonly', '');
    });

    test('Linked cell has blue background', async ({ page }) => {
      // Set format on first element
      const formatInput = page.locator('[data-testid="jcf-cell-0-format"] input');
      await formatInput.fill('A4');
      await formatInput.press('Enter');

      // Add second element and link
      await page.locator('[data-testid="jcf-element-add-0"]').click();
      await page.locator('[data-testid="link-toggle-1-format"]').click();

      // Cell should have blue background class
      await expect(
        page.locator('[data-testid="jcf-cell-1-format"]')
      ).toHaveClass(/bg-blue-900/);
    });
  });

  // ============================================================================
  // Value Propagation
  // ============================================================================

  test.describe('Value Propagation', () => {
    test('Changing source value propagates to linked element', async ({
      page,
    }) => {
      // Set initial format (use a value that won't be autocompleted)
      const formatInput = page.locator('[data-testid="jcf-cell-0-format"] input');
      await formatInput.fill('Custom1');
      await formatInput.blur(); // Trigger blur to commit value

      // Add second element and link
      await page.locator('[data-testid="jcf-element-add-0"]').click();
      await page.locator('[data-testid="link-toggle-1-format"]').click();

      // Verify linked - value should contain 'Custom1'
      await expect(
        page.locator('[data-testid="jcf-input-1-format"]')
      ).toHaveValue('Custom1');

      // Change first element's format - need to blur to trigger onChange
      await formatInput.click();
      await formatInput.fill('Custom2');
      await formatInput.blur(); // Trigger blur to commit value and propagate

      // Second element should be updated
      await expect(
        page.locator('[data-testid="jcf-input-1-format"]')
      ).toHaveValue('Custom2');
    });
  });

  // ============================================================================
  // Unlink
  // ============================================================================

  test.describe('Unlink', () => {
    test('Clicking linked field unlinks and preserves value', async ({
      page,
    }) => {
      // Set format on first element (use custom value to avoid autocomplete transformation)
      const formatInput = page.locator('[data-testid="jcf-cell-0-format"] input');
      await formatInput.fill('CustomFormat');
      await formatInput.press('Escape');

      // Add second element and link
      await page.locator('[data-testid="jcf-element-add-0"]').click();
      await page.locator('[data-testid="link-toggle-1-format"]').click();

      // Verify linked
      await expect(
        page.locator('[data-testid="jcf-input-1-format"]')
      ).toHaveValue('CustomFormat');

      // Click linked field to unlink
      await page.locator('[data-testid="jcf-input-1-format"]').click();

      // Value should be preserved
      await expect(
        page.locator('[data-testid="jcf-cell-1-format"] input')
      ).toHaveValue('CustomFormat');

      // Field should no longer be read-only
      await expect(
        page.locator('[data-testid="jcf-cell-1-format"] input')
      ).not.toHaveAttribute('readonly');
    });
  });

  // ============================================================================
  // Multiple Fields
  // ============================================================================

  test.describe('Multiple Linkable Fields', () => {
    test('Can link multiple fields independently', async ({ page }) => {
      // Set values on first element
      const formatInput = page.locator('[data-testid="jcf-cell-0-format"] input');
      await formatInput.fill('A4');
      await formatInput.press('Enter');

      const papierInput = page.locator('[data-testid="jcf-cell-0-papier"] input');
      await papierInput.fill('Couché mat 135g');
      await papierInput.press('Escape');

      // Add second element
      await page.locator('[data-testid="jcf-element-add-0"]').click();

      // Link only format, not papier
      await page.locator('[data-testid="link-toggle-1-format"]').click();

      // Format should be linked
      await expect(
        page.locator('[data-testid="jcf-input-1-format"]')
      ).toHaveValue('A4');

      // Papier should NOT be linked (empty)
      await expect(
        page.locator('[data-testid="jcf-cell-1-papier"] input')
      ).toHaveValue('');
    });
  });
});

test.describe('v0.4.35: JCF Dual-Mode Template Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);

    // Open JCF modal
    const addButton = page.locator('button[aria-label="Ajouter un travail"]');
    await addButton.click();
    await expect(
      page.locator('[data-testid="jcf-modal-backdrop"]')
    ).toBeVisible();

    // Open template editor
    await page.locator('[data-testid="jcf-save-as-template"]').click();
    await expect(
      page.locator('[data-testid="template-editor-backdrop"]')
    ).toBeVisible();
  });

  test('Shows Form and JSON tabs', async ({ page }) => {
    await expect(
      page.locator('[data-testid="template-editor-tab-form"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="template-editor-tab-json"]')
    ).toBeVisible();
  });

  test('Switches to JSON tab and shows JSON editor', async ({ page }) => {
    // Click JSON tab
    await page.locator('[data-testid="template-editor-tab-json"]').click();

    // JSON editor should be visible
    await expect(
      page.locator('[data-testid="template-editor-json"]')
    ).toBeVisible();
  });

  test('Switches back to Form from JSON', async ({ page }) => {
    // Switch to JSON
    await page.locator('[data-testid="template-editor-tab-json"]').click();
    await expect(
      page.locator('[data-testid="template-editor-json"]')
    ).toBeVisible();

    // Switch back to Form
    await page.locator('[data-testid="template-editor-tab-form"]').click();

    // Elements table inside template editor should be visible
    await expect(
      page.locator('[data-testid="template-editor-content"] [data-testid="jcf-elements-table"]')
    ).toBeVisible();
  });

  test('Closes template editor with Escape key', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(
      page.locator('[data-testid="template-editor-backdrop"]')
    ).not.toBeVisible();
  });

  test('Saves template with valid name', async ({ page }) => {
    // Fill in template name (correct testid)
    await page.locator('[data-testid="template-field-name"]').fill('Test Template');

    // Click save
    await page.locator('[data-testid="template-editor-save"]').click();

    // Template editor should close
    await expect(
      page.locator('[data-testid="template-editor-backdrop"]')
    ).not.toBeVisible();
  });
});
