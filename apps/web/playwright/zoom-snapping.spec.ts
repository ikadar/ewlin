/**
 * Playwright Zoom-Aware Snapping Tests
 *
 * Tests for v0.3.48: Zoom-Aware Tile Snapping Bugfix
 * Verifies that tile snapping works correctly at all zoom levels
 *
 * Updated for v0.3.57: Uses Pick & Place instead of drag & drop
 * Updated for v0.4.9: Uses pickAndPlaceAtTime for deterministic placement
 *   (avoids scroll-position-dependent failures at low zoom levels)
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  waitForAppReady,
  countTilesOnStation,
  isOnSnapBoundary,
  pickAndPlaceAtTime,
} from './helpers/drag';

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

/** Zoom level → pixelsPerHour mapping (v0.4.29: scaled to 80%) */
const ZOOM_PPH: Record<string, number> = {
  '25%': 16,
  '50%': 32,
  '75%': 48,
  '100%': 64,
  '150%': 96,
  '200%': 128,
};

test.describe('v0.3.48: Zoom-Aware Tile Snapping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=zoom-snapping');
    await waitForAppReady(page);
  });

  test('snapping works correctly at 100% zoom (baseline)', async ({ page }) => {
    await setZoomLevel(page, '100%');

    // Select the job
    const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
    await expect(taskTile).toBeVisible();

    // Place at 17:00 (well within operating hours 06:00-22:00)
    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-z1"]',
      'station-komori',
      17, 0, ZOOM_PPH['100%']
    );

    // Verify tile was created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify snapping to 15-minute boundary
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`100% zoom: scheduled at ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    expect(isOnSnapBoundary(time)).toBe(true);
  });

  test('snapping works correctly at 50% zoom', async ({ page }) => {
    await setZoomLevel(page, '50%');

    // Select the job
    const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
    await expect(taskTile).toBeVisible();

    // Place at 17:00 using time-based placement (deterministic)
    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-z1"]',
      'station-komori',
      17, 0, ZOOM_PPH['50%']
    );

    // Verify tile was created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify snapping to 15-minute boundary
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`50% zoom: scheduled at ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    expect(isOnSnapBoundary(time)).toBe(true);
  });

  test('snapping works correctly at 200% zoom', async ({ page }) => {
    await setZoomLevel(page, '200%');

    // Select the job
    const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
    await expect(taskTile).toBeVisible();

    // Place at 17:00 using time-based placement (deterministic)
    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-z1"]',
      'station-komori',
      17, 0, ZOOM_PPH['200%']
    );

    // Verify tile was created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify snapping to 15-minute boundary
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`200% zoom: scheduled at ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    expect(isOnSnapBoundary(time)).toBe(true);
  });

  test('snapping at 50% zoom between grid lines rounds correctly', async ({ page }) => {
    // This test specifically targets the bug: at 50% zoom, dropping between
    // grid lines should still snap to 15-minute boundaries
    await setZoomLevel(page, '50%');

    // Select the job
    const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
    await expect(taskTile).toBeVisible();

    // Place at 17:23 — between 15-min boundaries (17:15 and 17:30)
    // Should snap to either 17:15 or 17:30
    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-z1"]',
      'station-komori',
      17, 23, ZOOM_PPH['50%']
    );

    // Verify tile was created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify snapping to 15-minute boundary
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`50% zoom at 17:23: scheduled at ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    // Must be on a 15-minute boundary
    expect(isOnSnapBoundary(time)).toBe(true);
  });

  test('snapping at 150% zoom between grid lines rounds correctly', async ({ page }) => {
    await setZoomLevel(page, '150%');

    // Select the job
    const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
    await expect(taskTile).toBeVisible();

    // Place at 17:23 — between 15-min boundaries (17:15 and 17:30)
    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-z1"]',
      'station-komori',
      17, 23, ZOOM_PPH['150%']
    );

    // Verify tile was created
    const tilesAfter = await countTilesOnStation(page, 'station-komori');
    expect(tilesAfter).toBe(1);

    // Verify snapping to 15-minute boundary
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const newTile = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
    const scheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(scheduledStart).toBeTruthy();
    const time = parseTime(scheduledStart!);
    console.log(`150% zoom at 17:23: scheduled at ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

    // Must be on a 15-minute boundary
    expect(isOnSnapBoundary(time)).toBe(true);
  });

  test('consistent snapping at multiple zoom levels', { timeout: 60_000 }, async ({ page }) => {
    // Test that snapping to 15-minute boundaries works at different zoom levels
    // Uses time-based placement for deterministic behavior

    for (const { level, hour, minute } of [
      { level: '50%', hour: 16, minute: 0 },
      { level: '100%', hour: 17, minute: 0 },
      { level: '150%', hour: 18, minute: 0 },
    ]) {
      // Navigate fresh for each iteration
      await page.goto('/?fixture=zoom-snapping');
      await waitForAppReady(page);
      await setZoomLevel(page, level);

      // Select the job
      const jobCard = page.locator('[data-testid="job-card-job-zoom-1"]');
      await jobCard.click();
      await page.waitForTimeout(200);

      const taskTile = page.locator('[data-testid="task-tile-task-z1"]');
      await expect(taskTile).toBeVisible();

      await pickAndPlaceAtTime(
        page,
        '[data-testid="task-tile-task-z1"]',
        'station-komori',
        hour, minute, ZOOM_PPH[level]
      );

      // Wait for tile to appear on station (more robust than fixed timeout in pickAndPlaceAtTime)
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const tileLocator = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]').first();
      await expect(tileLocator).toBeVisible({ timeout: 15000 });

      // Verify tile was created
      const tilesAfter = await countTilesOnStation(page, 'station-komori');
      expect(tilesAfter).toBe(1);

      // Verify the time is on a 15-minute boundary
      const scheduledStart = await tileLocator.getAttribute('data-scheduled-start');

      expect(scheduledStart).toBeTruthy();
      const time = parseTime(scheduledStart!);
      console.log(`${level}: ${hour}:${minute.toString().padStart(2, '0')} → ${time.hours}:${time.minutes.toString().padStart(2, '0')}`);

      // Should be on a 15-minute boundary
      expect(isOnSnapBoundary(time)).toBe(true);
    }
  });
});
