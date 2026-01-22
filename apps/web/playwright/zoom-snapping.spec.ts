/**
 * Playwright Zoom-Aware Snapping Tests
 *
 * Tests for v0.3.48: Zoom-Aware Tile Snapping Bugfix
 * Verifies that tile snapping works correctly at all zoom levels
 *
 * Updated for v0.3.57: Uses Pick & Place instead of drag & drop
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  waitForAppReady,
  countTilesOnStation,
} from './helpers/drag';

// Zoom levels and their corresponding pixels per hour
// Base is 80px/hour at 100% zoom
// Note: These values are used in test calculations:
// 25%: 20px/hour, 50%: 40px/hour, 100%: 80px/hour, 150%: 120px/hour, 200%: 160px/hour

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
    await pickAndPlace(
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
    await pickAndPlace(
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
    await pickAndPlace(
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
    await pickAndPlace(
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
    await pickAndPlace(
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
    // Test that snapping to 30-minute boundaries works at different zoom levels
    // Note: Y position to time mapping depends on scroll position, so we just
    // verify snapping works correctly (time is on 30-minute boundary)

    for (const { level, targetY } of [
      { level: '50%', targetY: 100 },
      { level: '100%', targetY: 200 },
      { level: '150%', targetY: 300 },
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

      await pickAndPlace(
        page,
        '[data-testid="task-tile-task-z1"]',
        'station-komori',
        targetY
      );

      // Verify tile was created
      const tilesAfter = await countTilesOnStation(page, 'station-komori');
      expect(tilesAfter).toBe(1);

      // Verify the time is on a 30-minute boundary
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      const scheduledStart = await newTile.getAttribute('data-scheduled-start');

      expect(scheduledStart).toBeTruthy();
      const time = parseTime(scheduledStart!);
      console.log(`${level}: Y=${targetY} → ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

      // Should be on a 30-minute boundary
      expect(time.minutes === 0 || time.minutes === 30).toBe(true);
    }
  });
});
