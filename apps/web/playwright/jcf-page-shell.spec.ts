/**
 * Playwright JCF Page Shell Tests
 *
 * Tests for v0.4.6: JCF Modal (Page Shell)
 * Open/close behavior, layout verification, keyboard shortcuts.
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.4.6: JCF Page Shell (Modal)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);
  });

  test.describe('Opening the modal', () => {
    test('"+" button is visible in JobsList header', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await expect(addButton).toBeVisible();
    });

    test('"+" button opens JCF modal', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();

      const modal = page.locator('[data-testid="jcf-modal-backdrop"]');
      await expect(modal).toBeVisible();
    });

    test('modal displays "Nouveau Job" title', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();

      const title = page.locator('[data-testid="jcf-modal-title"]');
      await expect(title).toHaveText('Nouveau Job');
    });
  });

  test.describe('Modal layout', () => {
    test('modal has header, content, and footer', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();

      await expect(page.locator('[data-testid="jcf-modal-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="jcf-modal-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="jcf-modal-footer"]')).toBeVisible();
    });

    test('footer shows keyboard hints', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();

      const footer = page.locator('[data-testid="jcf-modal-footer"]');
      await expect(footer).toContainText('Tab');
      await expect(footer).toContainText('Esc');
    });

    test('placeholder content is visible', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();

      const content = page.locator('[data-testid="jcf-modal-content"]');
      await expect(content).toContainText('Contenu du formulaire job...');
    });
  });

  test.describe('Closing the modal', () => {
    test('X button closes the modal', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();

      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();

      const closeButton = page.locator('[data-testid="jcf-modal-close"]');
      await closeButton.click();

      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).not.toBeVisible();
    });

    test('Escape key closes the modal', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();

      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).not.toBeVisible();
    });

    test('backdrop click closes the modal', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();

      const backdrop = page.locator('[data-testid="jcf-modal-backdrop"]');
      await expect(backdrop).toBeVisible();

      // Click on the backdrop area (outside the dialog)
      // The dialog is centered, so clicking at (10, 10) should hit the backdrop
      await backdrop.click({ position: { x: 10, y: 10 } });

      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).not.toBeVisible();
    });

    test('clicking inside dialog does not close the modal', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();

      const dialog = page.locator('[data-testid="jcf-modal-dialog"]');
      await dialog.click();

      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();
    });
  });

  test.describe('Scheduling grid remains visible', () => {
    test('scheduling grid is still in the DOM when modal is open', async ({ page }) => {
      const addButton = page.locator('button[aria-label="Ajouter un travail"]');
      await addButton.click();

      // Modal is open
      await expect(page.locator('[data-testid="jcf-modal-backdrop"]')).toBeVisible();

      // Grid is still in the DOM (behind the modal backdrop)
      const grid = page.locator('[data-testid="scheduling-grid"]');
      await expect(grid).toBeAttached();
    });
  });
});
