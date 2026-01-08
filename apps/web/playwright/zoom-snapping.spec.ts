/**
 * Playwright Zoom-Aware Snapping Tests
 *
 * Tests for v0.3.48: Zoom-Aware Tile Snapping Bugfix
 * Verifies that tile snapping works correctly at all zoom levels
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  dragFromSidebarToStation,
  waitForAppReady,
  countTilesOnStation,
} from './helpers/drag';

// Zoom levels and their corresponding pixels per hour
// Base is 80px/hour at 100% zoom
// Note: These values are used in test calculations:
// 25%: 20px/hour, 50%: 40px/hour, 100%: 80px/hour, 150%: 120px/hour, 200%: 160px/hour

/**
 * Set zoom level by clicking zoom buttons
 */
async function setZoomLevel(page: Parameters<typeof test>[0]['page'], targetLevel: string): Promise<void> {
  const zoomOutButton = page.locator('[data-testid="zoom-out-button"]');
  const zoomInButton = page.locator('[data-testid="zoom-in-button"]');
  const zoomLevel = page.locator('[data-testid="zoom-level"]');

  // First zoom all the way out
  while (!(await zoomOutButton.isDisabled())) {
    await zoomOutButton.click();
    await page.waitForTimeout(100);
  }

  // Now zoom in until we reach the target level
  let currentLevel = await zoomLevel.textContent();
  while (currentLevel !== targetLevel && !(await zoomInButton.isDisabled())) {
    await zoomInButton.click();
    await page.waitForTimeout(100);
    currentLevel = await zoomLevel.textContent();
  }

  // Verify we reached the target
  await expect(zoomLevel).toHaveText(targetLevel);
}

test.describe('v0.3.48: Zoom-Aware Tile Snapping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=zoom-snapping');
    await waitForAppReady(page);
  });

  test('snapping works correctly at 100% zoom (baseline)', async ({ page }) => {
    // This is the baseline test - should always work
    await setZoomLevel(page, '100%');

    // Select the job
    const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
    await expect(taskTile).toBeVisible();

    // At 100% zoom: 80px/hour, 40px/30min
    // Y = 120 corresponds to 7:30 (1.5 hours after 6:00 = 1.5 * 80 = 120)
    await dragFromSidebarToStation(
      page,
      '[data-testid="task-tile-task-z1"]',
      'station-komori',
      120
    );

    // Verify tile was created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify snapping to 30-minute boundary
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`100% zoom: scheduled at ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    expect(time.minutes === 0 || time.minutes === 30).toBe(true);
  });

  test('snapping works correctly at 50% zoom', async ({ page }) => {
    await setZoomLevel(page, '50%');

    // Select the job
    const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
    await expect(taskTile).toBeVisible();

    // At 50% zoom: 40px/hour, 20px/30min
    // Y = 60 corresponds to 7:30 (1.5 hours after 6:00 = 1.5 * 40 = 60)
    await dragFromSidebarToStation(
      page,
      '[data-testid="task-tile-task-z1"]',
      'station-komori',
      60
    );

    // Verify tile was created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify snapping to 30-minute boundary
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`50% zoom: scheduled at ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    expect(time.minutes === 0 || time.minutes === 30).toBe(true);
  });

  test('snapping works correctly at 200% zoom', async ({ page }) => {
    await setZoomLevel(page, '200%');

    // Select the job
    const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
    await expect(taskTile).toBeVisible();

    // At 200% zoom: 160px/hour, 80px/30min
    // Y = 240 corresponds to 7:30 (1.5 hours after 6:00 = 1.5 * 160 = 240)
    await dragFromSidebarToStation(
      page,
      '[data-testid="task-tile-task-z1"]',
      'station-komori',
      240
    );

    // Verify tile was created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify snapping to 30-minute boundary
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`200% zoom: scheduled at ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    expect(time.minutes === 0 || time.minutes === 30).toBe(true);
  });

  test('snapping at 50% zoom between grid lines rounds correctly', async ({ page }) => {
    // This test specifically targets the bug: at 50% zoom, dropping between
    // grid lines should still snap to 30-minute boundaries
    await setZoomLevel(page, '50%');

    // Select the job
    const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
    await expect(taskTile).toBeVisible();

    // At 50% zoom: 40px/hour, 20px/30min
    // Y = 55 is between 7:00 (40px) and 7:30 (60px)
    // Should snap to either 7:00 or 7:30
    await dragFromSidebarToStation(
      page,
      '[data-testid="task-tile-task-z1"]',
      'station-komori',
      55 // Between grid lines
    );

    // Verify tile was created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify snapping to 30-minute boundary
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`50% zoom at Y=55: scheduled at ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    // Must be on a 30-minute boundary
    expect(time.minutes === 0 || time.minutes === 30).toBe(true);
  });

  test('snapping at 150% zoom between grid lines rounds correctly', async ({ page }) => {
    await setZoomLevel(page, '150%');

    // Select the job
    const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
    await expect(taskTile).toBeVisible();

    // At 150% zoom: 120px/hour, 60px/30min
    // Y = 150 is between 7:00 (120px) and 7:30 (180px)
    // Should snap to either 7:00 or 7:30
    await dragFromSidebarToStation(
      page,
      '[data-testid="task-tile-task-z1"]',
      'station-komori',
      150 // Between grid lines
    );

    // Verify tile was created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify snapping to 30-minute boundary
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`150% zoom at Y=150: scheduled at ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    // Must be on a 30-minute boundary
    expect(time.minutes === 0 || time.minutes === 30).toBe(true);
  });

  test('consistent snapping at multiple zoom levels', async ({ page }) => {
    // Test that the same logical time (7:00) is correctly calculated
    // at different zoom levels
    const targetHour = 7;

    for (const { level, pixelsPerHour } of [
      { level: '50%', pixelsPerHour: 40 },
      { level: '100%', pixelsPerHour: 80 },
      { level: '150%', pixelsPerHour: 120 },
    ]) {
      // Navigate fresh for each test
      await page.goto('/?fixture=zoom-snapping');
      await waitForAppReady(page);
      await setZoomLevel(page, level);

      // Select the job
      const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
      await expect(taskTile).toBeVisible();

      // Calculate Y for 7:00: (7 - 6) * pixelsPerHour = 1 * pixelsPerHour
      const targetY = (targetHour - 6) * pixelsPerHour;

      await dragFromSidebarToStation(
        page,
        '[data-testid="task-tile-task-z1"]',
        'station-komori',
        targetY
      );

      // Verify tile was created
      const tilesAfter = await countTilesOnStation(page, 'station-komori');
      expect(tilesAfter).toBe(1);

      // Verify the time
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      const scheduledStart = await newTile.getAttribute('data-scheduled-start');

      expect(scheduledStart).toBeTruthy();
      const time = parseTime(scheduledStart!);
      console.log(`${level}: Y=${targetY} → ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

      // Should be at 7:00
      expect(time.hours).toBe(7);
      expect(time.minutes).toBe(0);
    }
  });
});
