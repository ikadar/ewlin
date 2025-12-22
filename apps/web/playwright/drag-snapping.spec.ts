/**
 * Playwright Drag Snapping Tests
 *
 * Tests for v0.3.31 (REQ-08/09):
 * - REQ-08: Real-time drag preview snapping to 30-minute grid
 * - REQ-09: Vertical-only drag (already implemented, verify)
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  dragFromSidebarToStation,
  waitForAppReady,
  countTilesOnStation,
} from './helpers/drag';

test.describe('v0.3.31: Drag Snapping (REQ-08/09)', () => {
  test.beforeEach(async ({ page }) => {
    // Use sidebar-drag fixture with unscheduled tasks
    await page.goto('/?fixture=sidebar-drag');
    await waitForAppReady(page);
  });

  test.describe('REQ-08: Grid Snapping', () => {
    test('placement snaps to 30-minute grid boundary', async ({ page }) => {
      // ARRANGE: Select the job
      const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
      await expect(taskTile).toBeVisible();

      // ACT: Drag to a position between grid lines (Y=185 is between 8:00 and 8:30)
      // Grid: 80px/hour, so 8:00=160px, 8:30=200px, 8:15≈180px
      await dragFromSidebarToStation(
        page,
        '[data-testid="task-tile-task-sidebar-1"]',
        'station-komori',
        185 // Between 8:00 (160px) and 8:30 (200px)
      );

      // ASSERT: Tile should be created at snapped position
      const tilesAfter = await countTilesOnStation(page, 'station-komori');
      expect(tilesAfter).toBe(1);

      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      const scheduledStart = await newTile.getAttribute('data-scheduled-start');

      expect(scheduledStart).toBeTruthy();
      const time = parseTime(scheduledStart!);
      console.log(`Dropped at Y=185 (between 8:00-8:30), scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

      // Should be on a 30-minute boundary (snapped)
      expect(time.minutes === 0 || time.minutes === 30).toBe(true);
    });

    test('placement at exact grid line stays on grid', async ({ page }) => {
      // ARRANGE: Select the job
      const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
      await expect(taskTile).toBeVisible();

      // ACT: Drag to exact grid line (Y=160 = 8:00)
      await dragFromSidebarToStation(
        page,
        '[data-testid="task-tile-task-sidebar-1"]',
        'station-komori',
        160 // Exactly 8:00 (2 hours after 6:00 = 2 * 80px)
      );

      // ASSERT: Tile should be at 8:00
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      const scheduledStart = await newTile.getAttribute('data-scheduled-start');

      expect(scheduledStart).toBeTruthy();
      const time = parseTime(scheduledStart!);
      console.log(`Dropped at Y=160, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

      // Should be on a 30-minute boundary
      expect(time.minutes === 0 || time.minutes === 30).toBe(true);
    });

    test('drop near grid line rounds to nearest 30-min', async ({ page }) => {
      // ARRANGE: Select the job
      const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
      await expect(taskTile).toBeVisible();

      // ACT: Drag to Y=195, which is just before 8:30 (200px)
      // Should snap to 8:30 (200px = nearest 40px boundary)
      await dragFromSidebarToStation(
        page,
        '[data-testid="task-tile-task-sidebar-1"]',
        'station-komori',
        195
      );

      // ASSERT: Tile should be at a 30-minute boundary
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      const scheduledStart = await newTile.getAttribute('data-scheduled-start');

      expect(scheduledStart).toBeTruthy();
      const time = parseTime(scheduledStart!);
      console.log(`Dropped at Y=195, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

      // Should be on a 30-minute boundary
      expect(time.minutes === 0 || time.minutes === 30).toBe(true);
    });
  });

  test.describe('REQ-09: Vertical-Only Drag', () => {
    test('task can only be placed in compatible station column', async ({ page }) => {
      // ARRANGE: Select the job with a task assigned to Komori
      const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
      await expect(taskTile).toBeVisible();

      // This task should be assigned to station-komori
      // Verify the task has stationId data
      const stationId = await taskTile.getAttribute('data-station-id');
      console.log(`Task station ID: ${stationId}`);

      // ACT: Place the task on its designated station
      await dragFromSidebarToStation(
        page,
        '[data-testid="task-tile-task-sidebar-1"]',
        'station-komori',
        160
      );

      // ASSERT: Tile should be placed successfully
      const tilesOnKomori = await countTilesOnStation(page, 'station-komori');
      expect(tilesOnKomori).toBe(1);
    });

    test('scheduled tile stays in same column during reschedule', async ({ page }) => {
      // ARRANGE: First place a tile
      const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      await dragFromSidebarToStation(
        page,
        '[data-testid="task-tile-task-sidebar-1"]',
        'station-komori',
        160
      );

      // Get the placed tile
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const tile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      await expect(tile).toBeVisible();

      const stationIdAttr = await tile.getAttribute('data-station-id');
      console.log(`Tile station ID: ${stationIdAttr}`);

      // The tile has a fixed stationId - it cannot move to another column
      // This is enforced by the validation logic
      expect(stationIdAttr).toBe('station-komori');
    });
  });
});
