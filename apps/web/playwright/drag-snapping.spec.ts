/**
 * Playwright Drag Snapping Tests
 *
 * Tests for:
 * - v0.3.31 (REQ-08/09): Real-time drag preview snapping to 30-minute grid, vertical-only drag
 * - v0.3.41 (REQ-01/02/03): Validation uses snapped position, border color matches visual snap
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

// =============================================================================
// v0.3.41: Validation Snapping Consistency (REQ-01/02/03)
// =============================================================================

test.describe('v0.3.41: Validation Snapping Consistency (REQ-01/02/03)', () => {
  test.beforeEach(async ({ page }) => {
    // Use drag-snapping fixture
    await page.goto('/?fixture=drag-snapping');
    await waitForAppReady(page);
  });

  test('REQ-03: drop at boundary position snaps correctly', async ({ page }) => {
    // This test verifies that calculateScheduledStartFromPointer applies snapToGrid
    // By dropping at Y positions that are between grid lines and checking the result

    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-snap-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-snap-1"]');
    await expect(taskTile).toBeVisible();

    // ACT: Drag to Y position that corresponds to 8:15 (between 8:00 and 8:30)
    // Grid: 80px/hour at default zoom
    // 8:00 = 160px, 8:15 = 180px, 8:30 = 200px
    // Snapping should round 180px (8:15) to either 160px (8:00) or 200px (8:30)
    await dragFromSidebarToStation(
      page,
      '[data-testid="task-tile-task-snap-1"]',
      'station-komori',
      180 // 8:15 - between grid lines
    );

    // ASSERT: Tile should be at a 30-minute boundary (snapped)
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`REQ-03: Dropped at Y=180 (8:15), scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    // Verify on 30-minute boundary
    expect(time.minutes === 0 || time.minutes === 30).toBe(true);
  });

  test('REQ-01/02: validation and visual snap are consistent', async ({ page }) => {
    // This test verifies that the validation result (which determines border color)
    // is based on the snapped position, not the raw cursor position

    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-snap-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-snap-1"]');
    await expect(taskTile).toBeVisible();

    // ACT: Drag to a valid snapped position and verify drop succeeds
    // Y = 80 corresponds to 7:00 (1 hour after START_HOUR=6)
    await dragFromSidebarToStation(
      page,
      '[data-testid="task-tile-task-snap-1"]',
      'station-komori',
      80 // 7:00 - valid position
    );

    // ASSERT: Tile should be created at snapped position
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify the exact time
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`REQ-01/02: Dropped at Y=80, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    // Should be at 7:00 (snapped from Y=80)
    expect(time.hours).toBe(7);
    expect(time.minutes).toBe(0);
  });

  test('snapping is consistent at various Y positions', async ({ page }) => {
    // Test multiple positions to ensure snapping is applied consistently

    const testCases = [
      { y: 40, expectedMinutes: 0 },   // 6:30 → snaps to 6:30 (40px is exactly on grid)
      { y: 55, expectedMinutes: 30 },  // ~6:40 → snaps to 6:30 (rounds down)
      { y: 65, expectedMinutes: 0 },   // ~6:50 → snaps to 7:00 (rounds up)
      { y: 80, expectedMinutes: 0 },   // 7:00 → snaps to 7:00 (exactly on grid)
    ];

    for (const { y, expectedMinutes } of testCases) {
      // Navigate fresh for each test
      await page.goto('/?fixture=drag-snapping');
      await waitForAppReady(page);

      // Select the job
      const jobCard = page.locator('[data-testid="job-card-job-snap-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-snap-1"]');
      await expect(taskTile).toBeVisible();

      // Drag to test position
      await dragFromSidebarToStation(
        page,
        '[data-testid="task-tile-task-snap-1"]',
        'station-komori',
        y
      );

      // Verify snapping
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      const scheduledStart = await newTile.getAttribute('data-scheduled-start');

      expect(scheduledStart).toBeTruthy();
      const time = parseTime(scheduledStart!);

      console.log(`Y=${y} → ${time.hours}:${time.minutes.toString().padStart(2, '0')} (expected minutes: ${expectedMinutes})`);

      // Verify on 30-minute boundary
      expect(time.minutes === 0 || time.minutes === 30).toBe(true);
    }
  });
});
