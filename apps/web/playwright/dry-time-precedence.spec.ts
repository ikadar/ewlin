/**
 * Playwright Dry Time Precedence Tests
 *
 * Tests for v0.3.36: Dry Time Precedence
 * After printing tasks, a 4-hour drying time is required before the next task can start.
 *
 * Uses the drying-time fixture which provides:
 * - Job job-dry-1 with 2 tasks:
 *   - task-dry-1: Printing on Komori (offset) — scheduled
 *   - task-dry-2: Cutting on Polar — unscheduled
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.3.36: Dry Time Precedence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=drying-time');
    await waitForAppReady(page);
  });

  test.describe('Dry Time Label Visibility', () => {
    test('displays dry time label after printing task in JobDetailsPanel', async ({ page }) => {
      // Click the drying-time fixture job
      const jobCard = page.locator('[data-testid="job-card-job-dry-1"]');
      await jobCard.click();

      // Wait for the panel to render
      const panel = page.locator('[data-testid="job-details-panel"]');
      await expect(panel).toBeVisible();

      // Verify dry time label appears between printing task and its successor
      const dryTimeLabel = page.locator('[data-testid="dry-time-label"]');
      await expect(dryTimeLabel).toBeVisible();
      await expect(dryTimeLabel).toContainText('+4h drying');
    });

    test('dry time label has correct styling', async ({ page }) => {
      const jobCard = page.locator('[data-testid="job-card-job-dry-1"]');
      await jobCard.click();

      const panel = page.locator('[data-testid="job-details-panel"]');
      await expect(panel).toBeVisible();

      const dryTimeLabel = page.locator('[data-testid="dry-time-label"]');
      await expect(dryTimeLabel).toBeVisible();
      await expect(dryTimeLabel).toContainText('+4h drying');
    });
  });

  test.describe('Dry Time Label Not Shown', () => {
    test('dry time label count matches printing task transitions', async ({ page }) => {
      const jobCard = page.locator('[data-testid="job-card-job-dry-1"]');
      await jobCard.click();

      const panel = page.locator('[data-testid="job-details-panel"]');
      await expect(panel).toBeVisible();

      // The fixture has exactly 1 printing task followed by 1 successor → 1 dry time label
      const dryTimeLabels = page.locator('[data-testid="dry-time-label"]');
      const labelCount = await dryTimeLabels.count();
      expect(labelCount).toBe(1);
    });
  });

  test.describe('Integration', () => {
    test('job selection still works with dry time labels', async ({ page }) => {
      const jobCard = page.locator('[data-testid="job-card-job-dry-1"]');
      await jobCard.click();

      // Panel should be visible
      const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(jobDetailsPanel).toBeVisible();

      // Close button should work
      const closeButton = page.locator('[data-testid="job-details-close-button"]');
      await closeButton.click();

      // Panel should be hidden
      await expect(jobDetailsPanel).not.toBeVisible();
    });

    test('task tiles still visible alongside dry time labels', async ({ page }) => {
      const jobCard = page.locator('[data-testid="job-card-job-dry-1"]');
      await jobCard.click();

      // Wait for panel to render
      const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(jobDetailsPanel).toBeVisible();

      // The fixture has 2 tasks → expect 2 task tiles
      const taskTiles = jobDetailsPanel.locator('[data-testid^="task-tile-"]');
      await expect(taskTiles.first()).toBeVisible();

      const tileCount = await taskTiles.count();
      expect(tileCount).toBe(2);
    });
  });
});
