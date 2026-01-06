/**
 * E2E Tests for v0.3.42 - UI Bug Fixes
 * Tests for REQ-04, REQ-05, REQ-06
 */

import { test, expect } from '@playwright/test';

test.describe('v0.3.42 - UI Bug Fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=ui-bug-fixes');
    // Wait for the grid to be visible
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test.describe('REQ-06: Non-selected tiles should be clickable', () => {
    test('clicking muted tile selects its job', async ({ page }) => {
      // First, select job-a by clicking its tile
      const tileA = page.locator('[data-testid="tile-assign-a"]');
      await tileA.click();

      // Verify job-a is selected (has glow effect) - rgba format with blue color
      await expect(tileA).toHaveCSS('box-shadow', /rgba?\(59,\s*130,\s*246/); // Blue glow

      // Now tile-b should be muted (desaturated) but still clickable
      const tileB = page.locator('[data-testid="tile-assign-b"]');

      // Verify tile-b is muted
      await expect(tileB).toHaveCSS('filter', /saturate/);
      await expect(tileB).toHaveCSS('opacity', '0.6');

      // Click the muted tile
      await tileB.click();

      // Verify job-b is now selected (has glow effect) - rgba format with green color
      await expect(tileB).toHaveCSS('box-shadow', /rgba?\(34,\s*197,\s*94/); // Green glow

      // Verify tile-a is now muted
      await expect(tileA).toHaveCSS('filter', /saturate/);
      await expect(tileA).toHaveCSS('opacity', '0.6');
    });

    test('muted tile shows pointer cursor (clickable)', async ({ page }) => {
      // Select job-a
      const tileA = page.locator('[data-testid="tile-assign-a"]');
      await tileA.click();

      // Verify muted tile-b has grab cursor (not none/default)
      const tileB = page.locator('[data-testid="tile-assign-b"]');
      await expect(tileB).toHaveCSS('cursor', 'grab');
    });
  });

  test.describe('REQ-05: Job card overflow fix', () => {
    test('job card with long text does not overflow', async ({ page }) => {
      // Find the job card with long text
      const jobCard = page.locator('[data-testid="job-card-job-long-text"]');
      await expect(jobCard).toBeVisible();

      // Verify the job card is contained within the sidebar
      const cardBox = await jobCard.boundingBox();
      expect(cardBox).not.toBeNull();

      // The card should have reasonable width (not overflowing)
      // Sidebar is typically w-72 (288px) minus padding
      if (cardBox) {
        expect(cardBox.width).toBeLessThanOrEqual(300);
      }
    });

    test('job card client name is truncated', async ({ page }) => {
      // Find the job card with long text
      const jobCard = page.locator('[data-testid="job-card-job-long-text"]');

      // The client name span should have text-overflow: ellipsis via truncate class
      const clientSpan = jobCard.locator('span.truncate').first();
      await expect(clientSpan).toHaveCSS('text-overflow', 'ellipsis');
      await expect(clientSpan).toHaveCSS('overflow', 'hidden');
    });
  });

  test.describe('REQ-04: Multi-day unavailability overlay', () => {
    test('unavailability overlay renders on multiple days', async ({ page }) => {
      // The grid should have multiple unavailability overlays (one per day)
      // With the ui-bug-fixes fixture, we have a 21-day grid
      const overlays = page.locator('[data-testid="unavailability-overlay"]');

      // Should have multiple overlays (at least more than 1 for multi-day)
      const count = await overlays.count();
      expect(count).toBeGreaterThan(1);
    });

    test('unavailability overlays appear at correct positions', async ({ page }) => {
      // Get the first station column
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      await expect(stationColumn).toBeVisible();

      // Get all overlays within the station column
      const overlays = stationColumn.locator('[data-testid="unavailability-overlay"]');

      // Should have multiple overlays
      const count = await overlays.count();
      expect(count).toBeGreaterThan(1);

      // Check that overlays are positioned at different Y offsets (different days)
      const positions = new Set<number>();
      for (let i = 0; i < Math.min(count, 5); i++) {
        const overlay = overlays.nth(i);
        const style = await overlay.getAttribute('style');
        // Extract top value from style
        const topMatch = style?.match(/top:\s*(\d+)/);
        if (topMatch) {
          positions.add(Math.floor(parseInt(topMatch[1]) / 1920)); // Day index (24h * 80px/h = 1920px)
        }
      }

      // Should have overlays at multiple different day positions
      expect(positions.size).toBeGreaterThan(1);
    });
  });
});
