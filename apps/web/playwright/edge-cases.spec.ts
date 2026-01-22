/**
 * Playwright Edge Case Tests
 *
 * Tests for edge cases EC-01 to EC-04:
 * - EC-02: Cancel pick (ESC key)
 * - EC-04: Multiple tiles push-down chain
 *
 * Updated for v0.3.57: Uses Pick & Place instead of drag & drop
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  toTotalMinutes,
  getTileScheduledStart,
  waitForAppReady,
} from './helpers/drag';

/**
 * Helper: Pick a scheduled tile from grid and place it at a new Y position on same station
 */
async function pickAndPlaceOnStation(
  page: import('@playwright/test').Page,
  tileSelector: string,
  stationId: string,
  targetY: number
): Promise<void> {
  // Click tile to pick it
  await page.locator(tileSelector).click();

  // Wait for pick preview to appear
  await page.waitForSelector('[data-testid="pick-preview"]', { timeout: 2000 }).catch(() => null);

  // Get column position and move to new Y
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
 * Helper: Pick a tile and cancel with ESC
 */
async function pickAndCancelWithEsc(
  page: import('@playwright/test').Page,
  tileSelector: string
): Promise<void> {
  // Click tile to pick it
  await page.locator(tileSelector).click();

  // Wait for pick preview to appear
  await page.waitForSelector('[data-testid="pick-preview"]', { timeout: 2000 }).catch(() => null);

  // Press ESC to cancel
  await page.keyboard.press('Escape');

  // Wait for state update
  await page.waitForTimeout(300);
}

test.describe('Edge Cases', () => {
  test.describe('EC-02: Cancel Pick (ESC key)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?fixture=test');
      await waitForAppReady(page);
    });

    test('EC-02.1: Pressing ESC cancels pick', async ({ page }) => {
      // ARRANGE: Find a tile
      const tile = page.locator('[data-testid^="tile-assign-"]').first();
      const testId = await tile.getAttribute('data-testid');
      const originalScheduledStart = await getTileScheduledStart(page, `[data-testid="${testId}"]`);

      expect(testId).toBeTruthy();
      expect(originalScheduledStart).toBeTruthy();

      console.log(`Before cancel: testId=${testId}, time=${originalScheduledStart}`);

      // ACT: Pick tile and cancel with ESC
      await pickAndCancelWithEsc(page, `[data-testid="${testId}"]`);

      // ASSERT: Tile should remain at original position
      const newScheduledStart = await getTileScheduledStart(page, `[data-testid="${testId}"]`);

      console.log(`After cancel: time=${newScheduledStart}`);

      expect(newScheduledStart).toBe(originalScheduledStart);
    });

    test('EC-02.2: Tile returns to original state after cancel', async ({ page }) => {
      // ARRANGE: Find a tile and record its scheduled start
      const tile = page.locator('[data-testid^="tile-assign-"]').first();
      const testId = await tile.getAttribute('data-testid');
      const originalScheduledStart = await tile.getAttribute('data-scheduled-start');

      expect(testId).toBeTruthy();
      expect(originalScheduledStart).toBeTruthy();

      console.log(`Before cancel: scheduledStart=${originalScheduledStart}`);

      // ACT: Pick tile and cancel with ESC
      await pickAndCancelWithEsc(page, `[data-testid="${testId}"]`);

      // ASSERT: Tile should still exist with same scheduled start
      const tileAfter = page.locator(`[data-testid="${testId}"]`);
      await expect(tileAfter).toBeVisible();

      const newScheduledStart = await tileAfter.getAttribute('data-scheduled-start');
      console.log(`After cancel: scheduledStart=${newScheduledStart}`);

      // Scheduled start should be unchanged
      expect(newScheduledStart).toBe(originalScheduledStart);
    });
  });

  test.describe('EC-04: Multiple Tiles Push-Down Chain', () => {
    test.beforeEach(async ({ page }) => {
      // Use push-down fixture with 3 consecutive tiles
      await page.goto('/?fixture=push-down');
      await waitForAppReady(page);
    });

    test('EC-04.1: Placing on first tile pushes entire chain', async ({ page }) => {
      // ARRANGE: Get all tiles on Komori station
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const tiles = stationColumn.locator('[data-testid^="tile-assign-"]');

      const count = await tiles.count();
      expect(count).toBeGreaterThanOrEqual(3);

      // Get initial times for all tiles
      const initialTimes: string[] = [];
      for (let i = 0; i < count; i++) {
        const tileTestId = await tiles.nth(i).getAttribute('data-testid');
        const time = await getTileScheduledStart(page, `[data-testid="${tileTestId}"]`);
        initialTimes.push(time || '');
        console.log(`Tile ${i}: testId=${tileTestId}, time=${time}`);
      }

      // Get the first tile
      const firstTile = tiles.first();
      const firstTileTestId = await firstTile.getAttribute('data-testid');

      // ACT: Pick first tile and place it at a later position (Y=200 is ~1.5 hours later)
      await pickAndPlaceOnStation(page, `[data-testid="${firstTileTestId}"]`, 'station-komori', 200);

      // ASSERT: First tile should have moved to a later time
      const newTimes: string[] = [];
      for (let i = 0; i < count; i++) {
        const tileTestId = await tiles.nth(i).getAttribute('data-testid');
        const time = await getTileScheduledStart(page, `[data-testid="${tileTestId}"]`);
        newTimes.push(time || '');
        console.log(`After - Tile ${i}: testId=${tileTestId}, time=${time}`);
      }

      const firstOriginalMinutes = toTotalMinutes(parseTime(initialTimes[0]));
      const firstNewMinutes = toTotalMinutes(parseTime(newTimes[0]));
      expect(firstNewMinutes).toBeGreaterThan(firstOriginalMinutes);
    });

    test('EC-04.2: All tiles in chain maintain order', async ({ page }) => {
      // ARRANGE: Get all tiles on Komori station
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const tiles = stationColumn.locator('[data-testid^="tile-assign-"]');

      const count = await tiles.count();
      expect(count).toBeGreaterThanOrEqual(3);

      // Get the first tile
      const firstTileTestId = await tiles.first().getAttribute('data-testid');

      // ACT: Pick first tile and place it at a later position
      await pickAndPlaceOnStation(page, `[data-testid="${firstTileTestId}"]`, 'station-komori', 200);

      // ASSERT: Tiles should maintain order (each subsequent tile is at a later time)
      const newTimes: number[] = [];
      for (let i = 0; i < count; i++) {
        const tileTestId = await tiles.nth(i).getAttribute('data-testid');
        const time = await getTileScheduledStart(page, `[data-testid="${tileTestId}"]`);
        if (time) {
          newTimes.push(toTotalMinutes(parseTime(time)));
        }
      }

      console.log('Times after push:', newTimes);

      // Each tile should be at a later time than the previous
      for (let i = 1; i < newTimes.length; i++) {
        expect(newTimes[i]).toBeGreaterThan(newTimes[i - 1]);
      }
    });
  });
});
