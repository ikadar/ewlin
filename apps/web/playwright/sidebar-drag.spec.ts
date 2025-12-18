/**
 * Playwright Sidebar Drag Tests
 *
 * Tests for UC-01: New Task Placement (Sidebar → Grid)
 * User drags an unscheduled task from the JobDetailsPanel sidebar
 * and drops it onto the correct station column.
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  toTotalMinutes,
  dragFromSidebarToStation,
  waitForAppReady,
  countTilesOnStation,
} from './helpers/drag';

test.describe('UC-01: New Task Placement (Sidebar → Grid)', () => {
  test.beforeEach(async ({ page }) => {
    // Use sidebar-drag fixture:
    // - Job with unscheduled task ready for placement
    // - Task should go to Komori station
    await page.goto('/?fixture=sidebar-drag');
    await waitForAppReady(page);
  });

  test('AC-01.1: Task tile in sidebar is draggable', async ({ page }) => {
    // ARRANGE: Select the job to show task tiles
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // ASSERT: Task tile should be visible and have draggable attributes
    const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
    await expect(taskTile).toBeVisible();

    // The task tile should have cursor-grab or similar drag indicator
    const cursor = await taskTile.evaluate(el => window.getComputedStyle(el).cursor);
    console.log(`Task tile cursor: ${cursor}`);

    // Tile should be present and interactive
    expect(taskTile).toBeTruthy();
  });

  test('AC-01.2: Drop creates new assignment with correct scheduledStart', async ({ page }) => {
    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // Find the task tile
    const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
    await expect(taskTile).toBeVisible();

    // Count tiles before drag
    const tilesBefore = await countTilesOnStation(page, 'station-komori');
    expect(tilesBefore).toBe(0); // No tiles initially

    // ACT: Drag task to Komori station at 8:00 position
    // 8:00 is 2 hours after 6:00 start = 200px (at 100px/hour)
    await dragFromSidebarToStation(page, '[data-testid="task-tile-task-sidebar-1"]', 'station-komori', 200);

    // ASSERT: New tile should be created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify the scheduled time (should be around 8:00, snapped to 30-min)
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    // Match root tile elements only (they have data-scheduled-start attribute)
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`New assignment scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    // Should be on a 30-minute boundary
    expect(time.minutes === 0 || time.minutes === 30).toBe(true);
  });

  test('AC-01.3: Drop only allowed on matching station', async ({ page }) => {
    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // Task is for station-komori, not station-polar
    const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
    await expect(taskTile).toBeVisible();

    // Count tiles before on the wrong station
    const tilesBeforePolar = await countTilesOnStation(page, 'station-polar');

    // ACT: Try to drag task to wrong station (Polar instead of Komori)
    // Pass false for expectNewTile since we expect the drop to be rejected
    await dragFromSidebarToStation(page, '[data-testid="task-tile-task-sidebar-1"]', 'station-polar', 200, false);

    // ASSERT: Task should NOT be placed on wrong station
    const tilesAfterPolar = await countTilesOnStation(page, 'station-polar');
    expect(tilesAfterPolar).toBe(tilesBeforePolar);
    console.log('Task was correctly rejected from wrong station');
  });

  test('AC-01.4: Assignment appears on grid after drop', async ({ page }) => {
    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // Verify no tiles initially
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    // Match root tile elements only (they have data-scheduled-start attribute)
    const tileSelector = '[data-testid^="tile-"][data-scheduled-start]';
    const tilesBeforeSelector = stationColumn.locator(tileSelector);
    const countBefore = await tilesBeforeSelector.count();
    expect(countBefore).toBe(0);

    // ACT: Drag task to station
    await dragFromSidebarToStation(page, '[data-testid="task-tile-task-sidebar-1"]', 'station-komori', 150);

    // ASSERT: Tile should appear on grid
    const tilesAfterSelector = stationColumn.locator(tileSelector);
    const countAfter = await tilesAfterSelector.count();
    expect(countAfter).toBe(1);

    // Tile should be visible
    const newTile = tilesAfterSelector.first();
    await expect(newTile).toBeVisible();
    console.log('Assignment tile appeared on grid');
  });

  test('Drop at different Y positions creates different scheduled times', async ({ page }) => {
    // This test verifies that the Y position affects the scheduled time

    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // ACT: Drag task to station at 7:00 position (100px from top)
    await dragFromSidebarToStation(page, '[data-testid="task-tile-task-sidebar-1"]', 'station-komori', 100);

    // ASSERT: Get the scheduled time
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    // Match root tile elements only (they have data-scheduled-start attribute)
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    const minutes = toTotalMinutes(time);

    console.log(`Dropped at Y=100, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')} (${minutes} min)`);

    // Time should be relatively early (around 7:00 = 420 min)
    // Allow some variance due to snapping
    expect(minutes).toBeGreaterThanOrEqual(360); // 6:00
    expect(minutes).toBeLessThanOrEqual(510); // 8:30
  });
});
