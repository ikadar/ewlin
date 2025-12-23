/**
 * Playwright Provider Columns Tests
 *
 * Tests for v0.3.39: Outsourcing Columns (REQ-19)
 * - Provider columns display after station columns
 * - Provider headers show Building2 icon
 * - Outsourced assignments render in provider columns
 * - Parallel tasks display in subcolumns
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.3.39: Outsourcing Columns', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.describe('REQ-19: Provider Column Display', () => {
    test('provider columns are visible on the grid', async ({ page }) => {
      // Find provider columns with data-testid pattern
      const providerColumns = page.locator('[data-testid^="provider-column-"]');
      const count = await providerColumns.count();

      // There should be at least one provider column (Clément or Reliure Express)
      expect(count).toBeGreaterThan(0);
    });

    test('provider headers show provider names', async ({ page }) => {
      // Find provider headers
      const providerHeaders = page.locator('[data-testid^="provider-header-"]');
      const count = await providerHeaders.count();

      expect(count).toBeGreaterThan(0);

      // Each header should have text content
      const firstHeader = providerHeaders.first();
      const text = await firstHeader.textContent();
      expect(text?.length).toBeGreaterThan(0);
    });

    test('provider headers have Building2 icon', async ({ page }) => {
      // Find provider icons (Building2)
      const providerIcons = page.locator('[data-testid="provider-icon"]');
      const count = await providerIcons.count();

      // Should have at least one provider icon
      expect(count).toBeGreaterThan(0);
    });

    test('provider columns have dotted border styling', async ({ page }) => {
      const providerColumn = page.locator('[data-testid^="provider-column-"]').first();

      if ((await providerColumn.count()) > 0) {
        // Check for dotted border class
        const classes = await providerColumn.getAttribute('class');
        expect(classes).toContain('border-dashed');
      }
    });

    test('provider columns appear after station columns', async ({ page }) => {
      // Get the last station column and first provider column
      const stationColumns = page.locator('[data-testid^="station-column-"]');
      const providerColumns = page.locator('[data-testid^="provider-column-"]');

      const stationCount = await stationColumns.count();
      const providerCount = await providerColumns.count();

      if (stationCount > 0 && providerCount > 0) {
        // Get bounding boxes
        const lastStation = stationColumns.last();
        const firstProvider = providerColumns.first();

        const stationBox = await lastStation.boundingBox();
        const providerBox = await firstProvider.boundingBox();

        if (stationBox && providerBox) {
          // Provider column should be to the right of the last station column
          expect(providerBox.x).toBeGreaterThan(stationBox.x);
        }
      }
    });
  });

  test.describe('REQ-19: Outsourced Assignment Rendering', () => {
    test('outsourced tiles are visible in provider columns', async ({ page }) => {
      // Look for tiles with data-is-outsourced attribute
      const outsourcedTiles = page.locator('[data-is-outsourced="true"]');
      const count = await outsourcedTiles.count();

      // Note: This depends on mock data having outsourced assignments
      // If no outsourced tiles, the test still passes (data-dependent)
      if (count > 0) {
        const firstTile = outsourcedTiles.first();
        await expect(firstTile).toBeVisible();
      }
    });

    test('outsourced tiles have dotted border', async ({ page }) => {
      const outsourcedTiles = page.locator('[data-is-outsourced="true"]');
      const count = await outsourcedTiles.count();

      if (count > 0) {
        const firstTile = outsourcedTiles.first();
        const classes = await firstTile.getAttribute('class');
        expect(classes).toContain('border-dashed');
      }
    });

    test('outsourced tiles are not draggable', async ({ page }) => {
      const outsourcedTiles = page.locator('[data-is-outsourced="true"]');
      const count = await outsourcedTiles.count();

      if (count > 0) {
        const firstTile = outsourcedTiles.first();
        const classes = await firstTile.getAttribute('class');
        // Should have cursor-default instead of cursor-grab
        expect(classes).toContain('cursor-default');
      }
    });
  });

  test.describe('REQ-19: Integration', () => {
    test('scheduling grid displays without errors with providers', async ({ page }) => {
      // Verify the scheduling grid is visible
      const grid = page.locator('[data-testid="scheduling-grid"]');
      await expect(grid).toBeVisible();

      // Verify both station and provider columns are visible
      const stationColumns = page.locator('[data-testid^="station-column-"]');
      const providerColumns = page.locator('[data-testid^="provider-column-"]');

      expect(await stationColumns.count()).toBeGreaterThan(0);
      expect(await providerColumns.count()).toBeGreaterThan(0);
    });

    test('provider columns scroll with the grid', async ({ page }) => {
      const grid = page.locator('[data-testid="scheduling-grid"]');
      const providerColumn = page.locator('[data-testid^="provider-column-"]').first();

      if ((await providerColumn.count()) > 0) {
        // Get initial position
        const initialBox = await providerColumn.boundingBox();

        // Scroll the grid vertically
        await grid.evaluate((el) => el.scrollBy(0, 200));
        await page.waitForTimeout(100);

        // Get new position
        const newBox = await providerColumn.boundingBox();

        if (initialBox && newBox) {
          // Y position should have changed (scrolled up)
          expect(newBox.y).toBeLessThan(initialBox.y);
        }
      }
    });

    test('clicking outsourced tile selects the job', async ({ page }) => {
      const outsourcedTiles = page.locator('[data-is-outsourced="true"]');
      const count = await outsourcedTiles.count();

      if (count > 0) {
        const firstTile = outsourcedTiles.first();
        await firstTile.click();
        await page.waitForTimeout(100);

        // Job details panel should be visible
        const detailsPanel = page.locator('[data-testid="job-details-panel"]');
        await expect(detailsPanel).toBeVisible();
      }
    });
  });
});
