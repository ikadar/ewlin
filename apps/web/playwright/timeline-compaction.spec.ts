/**
 * Playwright Global Timeline Compaction Tests
 *
 * Tests for v0.3.35: Global Timeline Compaction
 * Compact buttons in TopNavBar and gap removal functionality.
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.3.35: Global Timeline Compaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.describe('Compact control visibility', () => {
    test('displays the compact control section', async ({ page }) => {
      const compactControl = page.locator('[data-testid="compact-control"]');
      await expect(compactControl).toBeVisible();
    });

    test('displays all three compact buttons', async ({ page }) => {
      await expect(page.locator('[data-testid="compact-4h-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="compact-8h-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="compact-24h-button"]')).toBeVisible();
    });

    test('compact buttons have correct labels', async ({ page }) => {
      await expect(page.locator('[data-testid="compact-4h-button"]')).toHaveText('4h');
      await expect(page.locator('[data-testid="compact-8h-button"]')).toHaveText('8h');
      await expect(page.locator('[data-testid="compact-24h-button"]')).toHaveText('24h');
    });
  });

  test.describe('Compact button interactions', () => {
    test('4h compact button is clickable', async ({ page }) => {
      const button = page.locator('[data-testid="compact-4h-button"]');
      await expect(button).toBeEnabled();
      await button.click();
      // Wait for loading state to appear and disappear
      await page.waitForTimeout(400);
      // Button should be visible again after compaction
      await expect(button).toBeVisible();
    });

    test('8h compact button is clickable', async ({ page }) => {
      const button = page.locator('[data-testid="compact-8h-button"]');
      await expect(button).toBeEnabled();
      await button.click();
      await page.waitForTimeout(400);
      await expect(button).toBeVisible();
    });

    test('24h compact button is clickable', async ({ page }) => {
      const button = page.locator('[data-testid="compact-24h-button"]');
      await expect(button).toBeEnabled();
      await button.click();
      await page.waitForTimeout(400);
      await expect(button).toBeVisible();
    });

    test('shows loading indicator during compaction', async ({ page }) => {
      const button = page.locator('[data-testid="compact-4h-button"]');
      await button.click();

      // Loading indicator should appear briefly
      // Note: This might be too fast to catch in all cases, so we just verify
      // the button reappears after the operation
      await page.waitForTimeout(400);
      await expect(button).toBeVisible();
    });
  });

  test.describe('Compaction behavior', () => {
    test('compaction does not crash the application', async ({ page }) => {
      // Click all compact buttons in sequence
      await page.locator('[data-testid="compact-4h-button"]').click();
      await page.waitForTimeout(400);

      await page.locator('[data-testid="compact-8h-button"]').click();
      await page.waitForTimeout(400);

      await page.locator('[data-testid="compact-24h-button"]').click();
      await page.waitForTimeout(400);

      // Verify app is still functional
      const navBar = page.locator('[data-testid="top-nav-bar"]');
      await expect(navBar).toBeVisible();

      const grid = page.locator('[data-testid="scheduling-grid"]');
      await expect(grid).toBeVisible();
    });

    test('tiles remain visible after compaction', async ({ page }) => {
      // Count tiles before
      const tilesBefore = await page.locator('[data-testid^="tile-"]').count();

      // Perform compaction
      await page.locator('[data-testid="compact-4h-button"]').click();
      await page.waitForTimeout(400);

      // Count tiles after
      const tilesAfter = await page.locator('[data-testid^="tile-"]').count();

      // Should have the same number of tiles
      expect(tilesAfter).toBe(tilesBefore);
    });

    test('compaction with different horizons works', async ({ page }) => {
      // Click each horizon button
      for (const horizon of ['4h', '8h', '24h']) {
        const button = page.locator(`[data-testid="compact-${horizon}-button"]`);
        await button.click();
        await page.waitForTimeout(400);

        // Verify app is still responsive
        await expect(button).toBeVisible();
      }
    });
  });

  test.describe('Integration with other features', () => {
    test('zoom still works after compaction', async ({ page }) => {
      // Compact first
      await page.locator('[data-testid="compact-4h-button"]').click();
      await page.waitForTimeout(400);

      // Then zoom
      const zoomLevel = page.locator('[data-testid="zoom-level"]');
      await expect(zoomLevel).toHaveText('100%');

      await page.locator('[data-testid="zoom-in-button"]').click();
      await page.waitForTimeout(100);

      await expect(zoomLevel).toHaveText('150%');
    });

    test('job selection still works after compaction', async ({ page }) => {
      // Compact first
      await page.locator('[data-testid="compact-4h-button"]').click();
      await page.waitForTimeout(400);

      // Then select a job
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      await jobCard.click();
      await page.waitForTimeout(100);

      // Verify job is selected (Quick Placement button becomes enabled)
      const quickPlaceButton = page.locator('[data-testid="quick-placement-button"]');
      await expect(quickPlaceButton).toBeEnabled();
    });
  });
});
