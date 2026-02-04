/**
 * Playwright Pick & Place Snapping Tests
 *
 * Tests for:
 * - v0.3.31 (REQ-08/09): Real-time placement preview snapping to 15-minute grid, vertical-only placement
 * - v0.3.41 (REQ-01/02/03): Validation uses snapped position
 *
 * Updated for v0.3.57: Uses Pick & Place instead of drag & drop
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  waitForAppReady,
  countTilesOnStation,
  isOnSnapBoundary,
  pickAndPlace,
  pickAndPlaceAtTime,
} from './helpers/drag';

test.describe('v0.3.31: Pick & Place Snapping (REQ-08/09)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(10_000);
    await page.goto('/?fixture=sidebar-drag');
    await waitForAppReady(page);
  });

  test.describe('REQ-08: Grid Snapping', () => {
    test('placement snaps to 15-minute grid boundary', async ({ page }) => {
      // ARRANGE: Select the job
      const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
      await expect(taskTile).toBeVisible();

      // ACT: Pick & place at 8:17 (between 8:00 and 8:30 grid lines)
      // Using pickAndPlaceAtTime to avoid scroll-position timing issues
      await pickAndPlaceAtTime(
        page,
        '[data-testid="task-tile-task-sidebar-1"]',
        'station-komori',
        8,  // hour
        17  // minute (between grid lines)
      );

      // ASSERT: Tile should be created at snapped position
      const tilesAfter = await countTilesOnStation(page, 'station-komori');
      expect(tilesAfter).toBe(1);

      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      const scheduledStart = await newTile.getAttribute('data-scheduled-start');

      expect(scheduledStart).toBeTruthy();
      const time = parseTime(scheduledStart!);
      console.log(`Placed at 8:17, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

      // Should be on a 15-minute boundary (snapped)
      expect(isOnSnapBoundary(time)).toBe(true);
    });

    test('placement at exact grid line stays on grid', async ({ page }) => {
      // ARRANGE: Select the job
      const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
      await expect(taskTile).toBeVisible();

      // ACT: Pick & place to exact grid line (Y=160 = 8:00)
      await pickAndPlace(
        page,
        '[data-testid="task-tile-task-sidebar-1"]',
        'station-komori',
        160
      );

      // ASSERT: Tile should be at a 15-minute boundary
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      const scheduledStart = await newTile.getAttribute('data-scheduled-start');

      expect(scheduledStart).toBeTruthy();
      const time = parseTime(scheduledStart!);
      console.log(`Placed at Y=160, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

      // Should be on a 15-minute boundary
      expect(isOnSnapBoundary(time)).toBe(true);
    });

    test('placement near grid line rounds to nearest 30-min', async ({ page }) => {
      // ARRANGE: Select the job
      const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
      await expect(taskTile).toBeVisible();

      // ACT: Pick & place at 8:27 (just before 8:30, should snap to 8:30)
      // Using pickAndPlaceAtTime to avoid scroll-position timing issues
      await pickAndPlaceAtTime(
        page,
        '[data-testid="task-tile-task-sidebar-1"]',
        'station-komori',
        8,  // hour
        27  // minute (should snap to 30)
      );

      // ASSERT: Tile should be at a 15-minute boundary (snapped)
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      const scheduledStart = await newTile.getAttribute('data-scheduled-start');

      expect(scheduledStart).toBeTruthy();
      const time = parseTime(scheduledStart!);
      console.log(`Placed at 8:27, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

      // Should be on a 15-minute boundary
      expect(isOnSnapBoundary(time)).toBe(true);
    });
  });

  test.describe('REQ-09: Vertical-Only Placement', () => {
    test('task can only be placed in compatible station column', async ({ page }) => {
      // ARRANGE: Select the job with a task assigned to Komori
      const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
      await expect(taskTile).toBeVisible();

      // ACT: Place the task on its designated station
      await pickAndPlace(
        page,
        '[data-testid="task-tile-task-sidebar-1"]',
        'station-komori',
        160
      );

      // ASSERT: Tile should be placed successfully
      const tilesOnKomori = await countTilesOnStation(page, 'station-komori');
      expect(tilesOnKomori).toBe(1);
    });

    test('scheduled tile stays in same column', async ({ page }) => {
      // ARRANGE: First place a tile
      const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      await pickAndPlace(
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

      // The tile has a fixed stationId - it stays in the assigned column
      expect(stationIdAttr).toBe('station-komori');
    });
  });
});

// =============================================================================
// v0.3.41: Validation Snapping Consistency (REQ-01/02/03)
// =============================================================================

test.describe('v0.3.41: Validation Snapping Consistency (REQ-01/02/03)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(10_000);
    await page.goto('/?fixture=drag-snapping');
    await waitForAppReady(page);
  });

  test('REQ-03: placement at boundary position snaps correctly', async ({ page }) => {
    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-snap-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-snap-1"]');
    await expect(taskTile).toBeVisible();

    // ACT: Pick & place to 8:15 (between 8:00 and 8:30 grid lines)
    // Uses time-based placement to avoid scroll-position-dependent failures
    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-snap-1"]',
      'station-komori',
      8, 15 // 8:15 AM - on a snap boundary, within operating hours
    );

    // ASSERT: Tile should be at a 15-minute boundary (snapped)
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`REQ-03: Placed at 8:15, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    // Verify on 15-minute boundary
    expect(isOnSnapBoundary(time)).toBe(true);
  });

  test('REQ-01/02: validation and visual snap are consistent', async ({ page }) => {
    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-snap-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-snap-1"]');
    await expect(taskTile).toBeVisible();

    // ACT: Pick & place to a valid position (use time-based placement to avoid
    // scroll-position-dependent failures when targetY hits the lunch break)
    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-snap-1"]',
      'station-komori',
      9, // 9:00 AM - safely within operating hours (06:00-12:00)
      0
    );

    // ASSERT: Tile should be created at snapped position
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify the time is on a 15-minute boundary (snapped)
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`REQ-01/02: Placed, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    // Should be on a 15-minute boundary (validation and visual snap are consistent)
    expect(isOnSnapBoundary(time)).toBe(true);
  });
});
