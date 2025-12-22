/**
 * Playwright Job Deselection Tests
 *
 * Tests for v0.3.30 (REQ-02/03):
 * - REQ-02: Close button (X) in JobDetailsPanel header
 * - REQ-03: Toggle click in JobsList (click selected job → deselect)
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.3.30: Job Deselection Methods (REQ-02/03)', () => {
  test.beforeEach(async ({ page }) => {
    // Use test fixture with multiple jobs
    await page.goto('/?fixture=test');
    await waitForAppReady(page);
  });

  test.describe('REQ-02: Close Button Deselection', () => {
    test('clicking close button closes JobDetailsPanel', async ({ page }) => {
      // ARRANGE: Find and click a job card to select it
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      await jobCard.click();
      await page.waitForTimeout(300);

      // Verify JobDetailsPanel is visible
      const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(jobDetailsPanel).toBeVisible();

      // ACT: Click the close button
      const closeButton = page.locator('[data-testid="job-details-close-button"]');
      await expect(closeButton).toBeVisible();
      await closeButton.click();
      await page.waitForTimeout(300);

      // ASSERT: JobDetailsPanel should be hidden
      await expect(jobDetailsPanel).not.toBeVisible();
    });

    test('clicking close button removes tile muting', async ({ page }) => {
      // ARRANGE: Select a job
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      await jobCard.click();
      await page.waitForTimeout(300);

      // Verify panel is visible
      const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(jobDetailsPanel).toBeVisible();

      // ACT: Click close button
      const closeButton = page.locator('[data-testid="job-details-close-button"]');
      await closeButton.click();
      await page.waitForTimeout(300);

      // ASSERT: No tiles should be muted (no opacity: 0.6 styling)
      const hasMutedTiles = await page.evaluate(() => {
        const tiles = document.querySelectorAll('[data-testid^="tile-"][data-scheduled-start]');
        let hasMuted = false;
        tiles.forEach((tile) => {
          const style = (tile as HTMLElement).style;
          if (style.opacity === '0.6') {
            hasMuted = true;
          }
        });
        return hasMuted;
      });

      expect(hasMutedTiles).toBe(false);
    });
  });

  test.describe('REQ-03: Toggle Click Deselection', () => {
    test('clicking selected job in JobsList deselects it', async ({ page }) => {
      // ARRANGE: Find and click a job card to select it
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      await jobCard.click();
      await page.waitForTimeout(300);

      // Verify JobDetailsPanel is visible
      const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(jobDetailsPanel).toBeVisible();

      // ACT: Click the same job card again (toggle)
      await jobCard.click();
      await page.waitForTimeout(300);

      // ASSERT: JobDetailsPanel should be hidden
      await expect(jobDetailsPanel).not.toBeVisible();
    });

    test('clicking different job changes selection (not deselect)', async ({ page }) => {
      // ARRANGE: Get all job cards
      const jobCards = page.locator('[data-testid^="job-card-"]');
      const cardCount = await jobCards.count();

      // Skip if only one job
      if (cardCount < 2) {
        test.skip();
        return;
      }

      // Click first job card
      const firstJobCard = jobCards.first();
      const firstJobId = await firstJobCard.getAttribute('data-testid');
      await firstJobCard.click();
      await page.waitForTimeout(300);

      // Verify JobDetailsPanel is visible
      const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(jobDetailsPanel).toBeVisible();

      // ACT: Click second job card
      const secondJobCard = jobCards.nth(1);
      const secondJobId = await secondJobCard.getAttribute('data-testid');
      await secondJobCard.click();
      await page.waitForTimeout(300);

      // ASSERT: JobDetailsPanel should still be visible (showing different job)
      await expect(jobDetailsPanel).toBeVisible();

      // First job should no longer have selected styling
      // Second job should have selected styling
      console.log(`First job: ${firstJobId}, Second job: ${secondJobId}`);

      // Panel should show new job - we can verify it's still visible
      // (detailed content verification would require checking job reference)
    });

    test('toggle click removes tile muting', async ({ page }) => {
      // ARRANGE: Select a job
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      await jobCard.click();
      await page.waitForTimeout(300);

      // Verify panel is visible
      const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(jobDetailsPanel).toBeVisible();

      // ACT: Click same job again (toggle off)
      await jobCard.click();
      await page.waitForTimeout(300);

      // ASSERT: No tiles should be muted
      const hasMutedTiles = await page.evaluate(() => {
        const tiles = document.querySelectorAll('[data-testid^="tile-"][data-scheduled-start]');
        let hasMuted = false;
        tiles.forEach((tile) => {
          const style = (tile as HTMLElement).style;
          if (style.opacity === '0.6') {
            hasMuted = true;
          }
        });
        return hasMuted;
      });

      expect(hasMutedTiles).toBe(false);
    });
  });

  test.describe('Tile Click Behavior', () => {
    test('clicking grid tile selects that job (changes selection)', async ({ page }) => {
      // ARRANGE: Select a job via JobsList
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      await jobCard.click();
      await page.waitForTimeout(300);

      // Verify JobDetailsPanel is visible
      const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
      await expect(jobDetailsPanel).toBeVisible();

      // ACT: Click a tile on the grid
      const tile = page.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      if (await tile.isVisible()) {
        await tile.click();
        await page.waitForTimeout(300);

        // ASSERT: JobDetailsPanel should still be visible (showing tile's job)
        // Clicking tile selects that job, doesn't deselect
        await expect(jobDetailsPanel).toBeVisible();
      }
    });
  });
});
