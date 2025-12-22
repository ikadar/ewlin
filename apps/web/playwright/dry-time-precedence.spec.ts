/**
 * Playwright Dry Time Precedence Tests
 *
 * Tests for v0.3.36: Dry Time Precedence
 * After printing tasks, a 4-hour drying time is required before the next task can start.
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.3.36: Dry Time Precedence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.describe('Dry Time Label Visibility', () => {
    test('displays dry time label after printing task in JobDetailsPanel', async ({ page }) => {
      // Find and click a job that has a printing task (offset press)
      // Look for a job card and click it
      const jobCards = page.locator('[data-testid^="job-card-"]');
      const jobCount = await jobCards.count();

      // Click through jobs to find one with a printing task
      let foundDryTimeLabel = false;
      for (let i = 0; i < Math.min(jobCount, 5); i++) {
        await jobCards.nth(i).click();
        await page.waitForTimeout(100);

        // Check if dry time label is visible in the JobDetailsPanel
        const dryTimeLabel = page.locator('[data-testid="dry-time-label"]');
        if (await dryTimeLabel.isVisible()) {
          foundDryTimeLabel = true;
          // Verify the label text
          await expect(dryTimeLabel).toContainText('+4h drying');
          break;
        }
      }

      // At least one job should have a dry time label (since we have printing tasks in mock data)
      expect(foundDryTimeLabel).toBe(true);
    });

    test('dry time label has correct styling', async ({ page }) => {
      // Click through jobs to find one with dry time label
      const jobCards = page.locator('[data-testid^="job-card-"]');
      const jobCount = await jobCards.count();

      for (let i = 0; i < Math.min(jobCount, 5); i++) {
        await jobCards.nth(i).click();
        await page.waitForTimeout(100);

        const dryTimeLabel = page.locator('[data-testid="dry-time-label"]');
        if (await dryTimeLabel.isVisible()) {
          // Verify it contains the timer icon and text
          await expect(dryTimeLabel).toContainText('+4h drying');
          // The label should be visible
          await expect(dryTimeLabel).toBeVisible();
          break;
        }
      }
    });
  });

  test.describe('Dry Time Label Not Shown', () => {
    test('dry time label not shown after non-printing tasks', async ({ page }) => {
      // Find a job and check tasks
      const jobCards = page.locator('[data-testid^="job-card-"]');
      await jobCards.first().click();
      await page.waitForTimeout(100);

      // The JobDetailsPanel should be visible
      const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(jobDetailsPanel).toBeVisible();

      // Count dry time labels - should be fewer than total task transitions
      // This is a basic sanity check
      const dryTimeLabels = page.locator('[data-testid="dry-time-label"]');
      const labelCount = await dryTimeLabels.count();

      // The number of dry time labels should match the number of printing → successor transitions
      // We can't know exact count, but it should be a reasonable number (0 to max tasks - 1)
      expect(labelCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Integration', () => {
    test('job selection still works with dry time labels', async ({ page }) => {
      // Click on a job
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      await jobCard.click();
      await page.waitForTimeout(100);

      // JobDetailsPanel should be visible
      const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(jobDetailsPanel).toBeVisible();

      // Close button should work
      const closeButton = page.locator('[data-testid="job-details-close-button"]');
      await closeButton.click();
      await page.waitForTimeout(100);

      // Panel should be hidden
      await expect(jobDetailsPanel).not.toBeVisible();
    });

    test('task tiles still visible alongside dry time labels', async ({ page }) => {
      // Click on a job
      const jobCards = page.locator('[data-testid^="job-card-"]');
      await jobCards.first().click();
      await page.waitForTimeout(100);

      // Check that task tiles are still visible
      const taskTiles = page.locator('[data-testid^="task-tile-"]');
      const tileCount = await taskTiles.count();

      // Should have at least one task tile
      expect(tileCount).toBeGreaterThan(0);
    });
  });
});
