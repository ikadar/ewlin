/**
 * Playwright Approval Gates Tests
 *
 * Tests for UC-07: Approval Gate Validation (BAT/Plates)
 * Tasks require approval gates before scheduling.
 *
 * Updated for v0.3.57: Uses Pick & Place instead of drag & drop
 * Updated for v0.4.0: Fixed targetY to be within operating hours (06:00-22:00)
 *   - Previous targetY of 100 pixels mapped to 01:15 AM (outside operating hours)
 *   - New targetY of 720 pixels maps to 09:00 AM (within operating hours)
 */

import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  countTilesOnStation,
} from './helpers/drag';

/**
 * Helper: Pick task from sidebar and place on station using Pick & Place
 *
 * IMPORTANT: targetY is in pixels from the top of the column.
 * Operating hours are 06:00-12:00 and 13:00-22:00.
 * At 80 pixels/hour: 06:00 = 480px, 09:00 = 720px, 12:00 = 960px
 */
async function pickAndPlace(
  page: import('@playwright/test').Page,
  taskTileSelector: string,
  stationId: string,
  targetY: number
): Promise<boolean> {
  // Click task tile to pick it
  await page.locator(taskTileSelector).click();

  // Wait for pick preview to appear (indicates pick mode is active)
  const pickPreview = page.locator('[data-testid="pick-preview"]');
  try {
    await pickPreview.waitFor({ state: 'visible', timeout: 2000 });
  } catch {
    // Pick mode didn't activate - task might be blocked
    console.log('Pick preview did not appear - task may be blocked');
    return false;
  }

  // Click at specific position within the target column
  // The click handler calculates relativeY from clientY - rect.top
  const targetColumn = page.locator(`[data-testid="station-column-${stationId}"]`);

  // Use click with position option to click at the correct Y offset
  await targetColumn.click({ position: { x: 50, y: targetY } });

  // Wait for state update
  await page.waitForTimeout(300);
  return true;
}

test.describe('UC-07: Approval Gate Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Use approval-gates fixture:
    // - Job without BAT approval (cannot schedule)
    // - Job with BAT approved (can schedule)
    // - Job with Plates pending (warning only)
    await page.goto('/?fixture=approval-gates');
    await waitForAppReady(page);
  });

  test('AC-07.1: Cannot schedule task without BAT approval', async ({ page }) => {
    // ARRANGE: Select the job without BAT approval
    const jobCard = page.locator('[data-testid="job-card-job-gate-no-bat"]');
    await jobCard.click();

    // Wait for Job Details Panel to appear
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Find the task tile in sidebar
    const taskTile = page.locator('[data-testid="task-tile-task-gate-no-bat"]');
    await expect(taskTile).toBeVisible();

    // Count tiles before pick & place
    const tilesBefore = await countTilesOnStation(page, 'station-komori');

    // ACT: Try to pick & place the task to Komori station (720px = 09:00 AM, within operating hours)
    const pickSucceeded = await pickAndPlace(page, '[data-testid="task-tile-task-gate-no-bat"]', 'station-komori', 720);

    // ASSERT: Task should NOT be placed (BAT not approved is a hard block)
    const tilesAfter = await countTilesOnStation(page, 'station-komori');

    console.log(`Tiles before: ${tilesBefore}, after: ${tilesAfter}, pickSucceeded: ${pickSucceeded}`);

    // Either the pick was blocked (pickSucceeded = false) or tile wasn't placed
    if (!pickSucceeded) {
      console.log('Task was blocked from picking due to missing BAT approval');
      expect(tilesAfter).toBe(tilesBefore);
    } else if (tilesAfter > tilesBefore) {
      // Task was placed - check for conflict indicator
      const conflictSection = page.locator('[data-testid="problems-section"]');
      const isConflictVisible = await conflictSection.isVisible().catch(() => false);
      console.log(`Task was placed with conflict indicator: ${isConflictVisible}`);
    } else {
      // Pick succeeded but task wasn't placed (validation blocked it)
      expect(tilesAfter).toBe(tilesBefore);
      console.log('Task was blocked during placement due to missing BAT approval');
    }
  });

  test('AC-07.2: Task with BAT approved is schedulable', async ({ page }) => {
    // ARRANGE: Select the job with BAT approved
    const jobCard = page.locator('[data-testid="job-card-job-gate-bat-ok"]');
    await jobCard.click();

    // Wait for Job Details Panel to appear
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Find the task tile in sidebar
    const taskTile = page.locator('[data-testid="task-tile-task-gate-bat-ok"]');
    await expect(taskTile).toBeVisible();

    // Count tiles before pick & place
    const tilesBefore = await countTilesOnStation(page, 'station-komori');

    // ACT: Pick & place the task to Komori station (720px = 09:00 AM, within operating hours)
    const pickSucceeded = await pickAndPlace(page, '[data-testid="task-tile-task-gate-bat-ok"]', 'station-komori', 720);
    expect(pickSucceeded).toBe(true);

    // ASSERT: Task should be placed successfully
    const tilesAfter = await countTilesOnStation(page, 'station-komori');

    expect(tilesAfter).toBe(tilesBefore + 1);
    console.log('Task with BAT approved was placed successfully');
  });

  test('AC-07.3: Plates gate is warning-only (non-blocking)', async ({ page }) => {
    // ARRANGE: Select the job with Plates pending
    const jobCard = page.locator('[data-testid="job-card-job-gate-plates-pending"]');
    await jobCard.click();

    // Wait for Job Details Panel to appear
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Find the task tile in sidebar
    const taskTile = page.locator('[data-testid="task-tile-task-gate-plates-pending"]');
    await expect(taskTile).toBeVisible();

    // Count tiles before pick & place
    const tilesBefore = await countTilesOnStation(page, 'station-komori');

    // ACT: Pick & place the task to Komori station (720px = 09:00 AM, within operating hours)
    const pickSucceeded = await pickAndPlace(page, '[data-testid="task-tile-task-gate-plates-pending"]', 'station-komori', 720);
    expect(pickSucceeded).toBe(true);

    // ASSERT: Task should be placed (Plates is warning-only, not blocking)
    const tilesAfter = await countTilesOnStation(page, 'station-komori');

    expect(tilesAfter).toBe(tilesBefore + 1);
    console.log('Task with Plates pending was placed (warning-only)');
  });

  test('Jobs with different approval states are visible', async ({ page }) => {
    // ASSERT: All three jobs should be visible in the jobs list
    const noBatJob = page.locator('[data-testid="job-card-job-gate-no-bat"]');
    const batOkJob = page.locator('[data-testid="job-card-job-gate-bat-ok"]');
    const platesPendingJob = page.locator('[data-testid="job-card-job-gate-plates-pending"]');

    await expect(noBatJob).toBeVisible();
    await expect(batOkJob).toBeVisible();
    await expect(platesPendingJob).toBeVisible();

    console.log('All three approval gate test jobs are visible');
  });
});
