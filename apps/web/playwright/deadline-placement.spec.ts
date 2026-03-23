/**
 * Playwright Deadline Placement Tests
 *
 * Tests for DeadlineConflict behavior when placing tiles after job deadline.
 * DeadlineConflict is non-blocking (warning only) — users can always place tiles.
 * Alt key provides universal bypass for ALL blocking conflicts during pick mode.
 */

import { test, expect } from '@playwright/test';
import {
  pickAndPlaceAtTime,
  waitForAppReady,
  countTilesOnStation,
} from './helpers/drag';

test.describe('Deadline Placement Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=deadline-placement');
    await waitForAppReady(page);
  });

  test('placement BEFORE deadline succeeds', async ({ page }) => {
    const jobCard = page.locator('[data-testid="job-card-job-deadline-today"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-deadline-1"]');
    await expect(taskTile).toBeVisible();

    const tilesBefore = await countTilesOnStation(page, 'station-offset');

    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-deadline-1"]',
      'station-offset',
      7, 0
    );
    await page.waitForTimeout(500);

    const tilesAfter = await countTilesOnStation(page, 'station-offset');
    expect(tilesAfter).toBeGreaterThan(tilesBefore);
  });

  test('placement AFTER deadline is allowed (non-blocking warning)', async ({ page }) => {
    const jobCard = page.locator('[data-testid="job-card-job-deadline-today"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-deadline-1"]');
    await expect(taskTile).toBeVisible();

    const tilesBefore = await countTilesOnStation(page, 'station-offset');

    // Place at 15:00 (after 14:00 deadline) — should be allowed now
    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-deadline-1"]',
      'station-offset',
      15, 0
    );
    await page.waitForTimeout(500);

    const tilesAfter = await countTilesOnStation(page, 'station-offset');
    expect(tilesAfter).toBeGreaterThan(tilesBefore);
  });

  test('Alt+click AFTER deadline places tile', async ({ page }) => {
    const jobCard = page.locator('[data-testid="job-card-job-deadline-today"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-deadline-1"]');
    await expect(taskTile).toBeVisible();

    const tilesBefore = await countTilesOnStation(page, 'station-offset');

    await page.keyboard.down('Alt');
    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-deadline-1"]',
      'station-offset',
      15, 0
    );
    await page.keyboard.up('Alt');
    await page.waitForTimeout(500);

    const tilesAfter = await countTilesOnStation(page, 'station-offset');
    expect(tilesAfter).toBeGreaterThan(tilesBefore);
  });

  test('past-deadline job: placement is allowed (non-blocking)', async ({ page }) => {
    const jobCard = page.locator('[data-testid="job-card-job-deadline-past"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    const taskTile = page.locator('[data-testid="task-tile-task-deadline-2"]');
    await expect(taskTile).toBeVisible();

    const tilesBefore = await countTilesOnStation(page, 'station-massicot');

    await pickAndPlaceAtTime(
      page,
      '[data-testid="task-tile-task-deadline-2"]',
      'station-massicot',
      7, 0
    );
    await page.waitForTimeout(500);

    const tilesAfter = await countTilesOnStation(page, 'station-massicot');
    expect(tilesAfter).toBeGreaterThan(tilesBefore);
  });
});
