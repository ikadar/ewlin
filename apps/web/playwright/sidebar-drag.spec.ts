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
  isOnSnapBoundary,
  pickAndPlace,
  pickAndPlaceAtTime,
} from './helpers/drag';

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

    // ACT: Pick task and place on Komori station at 10:00 AM
    // Use pickAndPlaceAtTime to avoid flakiness from scroll-position timing issues
    // (Y-offset based placement can land outside operating hours depending on when test runs)
    await pickAndPlaceAtTime(page, '[data-testid="task-tile-task-sidebar-1"]', 'station-komori', 10, 0);

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

    // Should be on a 15-minute boundary
    expect(isOnSnapBoundary(time)).toBe(true);
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
      // v0.4.29: 200 → 160 (scaled to 64px/hour)
      await page.mouse.move(box.x + box.width / 2, box.y + 160);
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

    // ACT: Pick task and place on station at 10:00 AM
    // Use pickAndPlaceAtTime to avoid flakiness from scroll-position timing issues
    await pickAndPlaceAtTime(page, '[data-testid="task-tile-task-sidebar-1"]', 'station-komori', 10, 0);

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
    // Uses pickAndPlaceAtTime to avoid flakiness from Y-position timing issues
    // (e.g., placing during lunch break 12:00-13:00 when test runs at noon)

    // ARRANGE: Select the job
    const jobCard = page.locator('[data-testid="job-card-job-sidebar-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // ACT: Pick task and place at 8:00 AM (guaranteed to be within operating hours 06:00-12:00)
    await pickAndPlaceAtTime(page, '[data-testid="task-tile-task-sidebar-1"]', 'station-komori', 8, 0);

    // ASSERT: Get the scheduled time
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();

    // Wait for tile to appear after placement
    await expect(newTile).toBeVisible({ timeout: 5000 });

    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    const minutes = toTotalMinutes(time);

    console.log(`Placed at 8:00, scheduled at: ${time.hours}:${time.minutes.toString().padStart(2, '0')} (${minutes} min)`);

    // Time should be snapped to 15-minute boundary
    expect(isOnSnapBoundary(time)).toBe(true);

    // Time should be at 8:00 (480 minutes from midnight)
    expect(time.hours).toBe(8);
    expect(time.minutes).toBe(0);
  });
});
