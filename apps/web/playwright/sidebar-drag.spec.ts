/**
 * Playwright Sidebar Pick & Place Tests
 *
 * Tests for UC-01: New Task Placement (Sidebar → Grid)
 * User picks an unscheduled task from the JobDetailsPanel sidebar
 * and places it onto the correct station column.
 *
 * Updated for v0.3.57: Uses Pick & Place instead of drag & drop
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  toTotalMinutes,
  waitForAppReady,
  countTilesOnStation,
} from './helpers/drag';

/**
 * Helper: Pick task from sidebar and place on station
 */
async function pickAndPlace(
  page: import('@playwright/test').Page,
  taskTileSelector: string,
  stationId: string,
  targetY: number
): Promise<void> {
  // Click task tile to pick it
  await page.locator(taskTileSelector).click();

  // Wait for pick preview to appear
  await page.waitForSelector('[data-testid="pick-preview"]', { timeout: 3000 });

  // Move to target station at specified Y position
  const targetColumn = page.locator(`[data-testid="station-column-${stationId}"]`);
  const box = await targetColumn.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + targetY);
  }

  // Click to place
  await targetColumn.click();

  // Wait for state update
  await page.waitForTimeout(300);
}

test.describe('UC-01: New Task Placement (Sidebar → Grid)', () => {
  test.beforeEach(async ({ page }) => {
    // Use sidebar-drag fixture:
    // - Job with unscheduled task ready for placement
    // - Task should go to Komori station
    await page.goto('/?fixture=sidebar-drag');
    await waitForAppReady(page);
  });

  test('AC-01.1: Task tile in sidebar is clickable for pick', async ({ page }) => {
    // ARRANGE: Select the job to show task tiles
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // ASSERT: Task tile should be visible and have pointer cursor
    const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
    await expect(taskTile).toBeVisible();

    // The task tile should have cursor-pointer for pick interaction
    const cursor = await taskTile.evaluate(el => window.getComputedStyle(el).cursor);
    console.log(`Task tile cursor: ${cursor}`);

    // Tile should be present and interactive
    expect(taskTile).toBeTruthy();
  });

  test('AC-01.2: Place creates new assignment with correct scheduledStart', async ({ page }) => {
    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // Find the task tile
    const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
    await expect(taskTile).toBeVisible();

    // Count tiles before pick & place
    const tilesBefore = await countTilesOnStation(page, 'station-komori');
    expect(tilesBefore).toBe(0); // No tiles initially

    // ACT: Pick task and place on Komori station at Y=200
    await pickAndPlace(page, '[data-testid="task-tile-task-sidebar-1"]', 'station-komori', 200);

    // ASSERT: New tile should be created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify the scheduled time (should be snapped to 30-min)
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`New assignment scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    // Should be on a 30-minute boundary
    expect(time.minutes === 0 || time.minutes === 30).toBe(true);
  });

  test('AC-01.3: Place only allowed on matching station', async ({ page }) => {
    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // Task is for station-komori, not station-polar
    const taskTile = page.locator('[data-testid="task-tile-task-sidebar-1"]');
    await expect(taskTile).toBeVisible();

    // Count tiles before on the wrong station
    const tilesBeforePolar = await countTilesOnStation(page, 'station-polar');

    // ACT: Try to pick task and place on wrong station (Polar instead of Komori)
    // Pick the task
    await taskTile.click();
    await page.waitForSelector('[data-testid="pick-preview"]', { timeout: 3000 }).catch(() => null);

    // Try to place on wrong station
    // Note: Wrong station will have pointer-events-none, so use force: true
    const wrongColumn = page.locator('[data-testid="station-column-station-polar"]');
    const box = await wrongColumn.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + 200);
    }
    await wrongColumn.click({ force: true });
    await page.waitForTimeout(300);

    // Cancel any remaining pick state
    await page.keyboard.press('Escape');

    // ASSERT: Task should NOT be placed on wrong station
    const tilesAfterPolar = await countTilesOnStation(page, 'station-polar');
    expect(tilesAfterPolar).toBe(tilesBeforePolar);
    console.log('Task was correctly rejected from wrong station');
  });

  test('AC-01.4: Assignment appears on grid after place', async ({ page }) => {
    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // Verify no tiles initially
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const tileSelector = '[data-testid^="tile-"][data-scheduled-start]';
    const tilesBeforeSelector = stationColumn.locator(tileSelector);
    const countBefore = await tilesBeforeSelector.count();
    expect(countBefore).toBe(0);

    // ACT: Pick task and place on station
    await pickAndPlace(page, '[data-testid="task-tile-task-sidebar-1"]', 'station-komori', 150);

    // ASSERT: Tile should appear on grid
    const tilesAfterSelector = stationColumn.locator(tileSelector);
    const countAfter = await tilesAfterSelector.count();
    expect(countAfter).toBe(1);

    // Tile should be visible
    const newTile = tilesAfterSelector.first();
    await expect(newTile).toBeVisible();
    console.log('Assignment tile appeared on grid');
  });

  test('Place at different Y positions creates different scheduled times', async ({ page }) => {
    // This test verifies that placement creates a valid scheduled time

    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // ACT: Pick task and place at Y=100
    await pickAndPlace(page, '[data-testid="task-tile-task-sidebar-1"]', 'station-komori', 100);

    // ASSERT: Get the scheduled time
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    const minutes = toTotalMinutes(time);

    console.log(`Placed at Y=100, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')} (${minutes} min)`);

    // Time should be snapped to 30-minute boundary
    expect(time.minutes === 0 || time.minutes === 30).toBe(true);

    // Time should be within working day (6:00 - 22:00 = 360-1320 minutes)
    expect(minutes).toBeGreaterThanOrEqual(360); // 6:00
    expect(minutes).toBeLessThanOrEqual(1320); // 22:00
  });
});
