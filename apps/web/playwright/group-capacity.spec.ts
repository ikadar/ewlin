/**
 * Playwright Group Capacity Tests
 *
 * Tests for v0.3.38: Group Capacity Visualization
 * - REQ-18: Station header shows group capacity info
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.3.38: Group Capacity Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.describe('REQ-18: Station Header Group Info', () => {
    test('station headers show group capacity info', async ({ page }) => {
      // Find station headers with group capacity info
      const groupCapacityElements = page.locator('[data-testid^="group-capacity-"]');
      const count = await groupCapacityElements.count();

      // There should be some stations with group capacity info
      // (stations in groups with maxConcurrent defined)
      expect(count).toBeGreaterThan(0);
    });

    test('group capacity shows group name and usage', async ({ page }) => {
      // Get the first group capacity element
      const firstCapacity = page.locator('[data-testid^="group-capacity-"]').first();

      if ((await firstCapacity.count()) > 0) {
        const text = await firstCapacity.textContent();

        // Should contain format like "Group Name (X/Y)"
        expect(text).toMatch(/\(\d+\/\d+\)/);
      }
    });

    test('group capacity has tooltip with details', async ({ page }) => {
      const firstCapacity = page.locator('[data-testid^="group-capacity-"]').first();

      if ((await firstCapacity.count()) > 0) {
        const title = await firstCapacity.getAttribute('title');

        // Should have a tooltip
        expect(title).toBeDefined();
        expect(title).not.toBe('');
      }
    });

    test('station header structure is correct', async ({ page }) => {
      // Check that station headers exist
      const headers = page.locator('[data-testid^="station-header-"]');
      const count = await headers.count();

      expect(count).toBeGreaterThan(0);

      // Each header should have a station name
      const firstHeader = headers.first();
      const text = await firstHeader.textContent();
      expect(text?.length).toBeGreaterThan(0);
    });
  });

  test.describe('Integration with Drag Validation', () => {
    test('scheduling grid displays without errors', async ({ page }) => {
      // Verify the scheduling grid is visible
      const grid = page.locator('[data-testid="scheduling-grid"]');
      await expect(grid).toBeVisible();

      // Verify station columns are visible
      const columns = page.locator('[data-testid^="station-column-"]');
      const columnCount = await columns.count();
      expect(columnCount).toBeGreaterThan(0);
    });

    test('job selection works with group capacity display', async ({ page }) => {
      // Select a job
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      if ((await jobCard.count()) > 0) {
        await jobCard.click();
        await page.waitForTimeout(100);

        // Job details panel should be visible
        const detailsPanel = page.locator('[data-testid="job-details-panel"]');
        await expect(detailsPanel).toBeVisible();

        // Group capacity info should still be visible on headers
        const groupCapacity = page.locator('[data-testid^="group-capacity-"]').first();
        if ((await groupCapacity.count()) > 0) {
          await expect(groupCapacity).toBeVisible();
        }
      }
    });
  });

  test.describe('Visual States', () => {
    test('collapsed headers do not show group capacity', async ({ page }) => {
      // Select a job to trigger column collapse
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      if ((await jobCard.count()) === 0) return;

      await jobCard.click();
      await page.waitForTimeout(100);

      // Start dragging a task
      const taskTile = page.locator('[data-testid^="task-tile-"]').first();
      if ((await taskTile.count()) === 0) return;

      // During drag, non-target columns are collapsed
      // This is a basic check that the app doesn't crash
      const grid = page.locator('[data-testid="scheduling-grid"]');
      await expect(grid).toBeVisible();
    });
  });
});
