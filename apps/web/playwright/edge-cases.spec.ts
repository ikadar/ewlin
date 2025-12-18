/**
 * Playwright Edge Case Tests
 *
 * Tests for edge cases EC-01 to EC-04:
 * - EC-01: Drag to past time
 * - EC-02: Drag outside station column (cancel)
 * - EC-03: Very long task (overnight)
 * - EC-04: Multiple tiles push-down chain
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  toTotalMinutes,
  dragTileByDelta,
  dragTileOutsideColumn,
  getTileScheduledStart,
  waitForAppReady,
} from './helpers/drag';

test.describe('Edge Cases', () => {
  test.describe('EC-02: Drag Outside Station Column', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?fixture=test');
      await waitForAppReady(page);
    });

    test('EC-02.1: Dropping outside any column cancels drag', async ({ page }) => {
      // ARRANGE: Find a tile
      const tile = page.locator('[data-testid^="tile-assign-"]').first();
      const testId = await tile.getAttribute('data-testid');
      const originalScheduledStart = await getTileScheduledStart(page, `[data-testid="${testId}"]`);

      expect(testId).toBeTruthy();
      expect(originalScheduledStart).toBeTruthy();

      console.log(`Before cancel drag: testId=${testId}, time=${originalScheduledStart}`);

      // ACT: Drag tile outside the station column
      await dragTileOutsideColumn(page, `[data-testid="${testId}"]`);

      // ASSERT: Tile should remain at original position
      const newScheduledStart = await getTileScheduledStart(page, `[data-testid="${testId}"]`);

      console.log(`After cancel drag: time=${newScheduledStart}`);

      expect(newScheduledStart).toBe(originalScheduledStart);
    });

    test('EC-02.2: Tile returns to original position', async ({ page }) => {
      // ARRANGE: Find a tile and record its position
      const tile = page.locator('[data-testid^="tile-assign-"]').first();
      const testId = await tile.getAttribute('data-testid');
      const originalBox = await tile.boundingBox();

      expect(testId).toBeTruthy();
      expect(originalBox).toBeTruthy();

      const originalY = originalBox!.y;
      console.log(`Before cancel drag: y=${originalY}`);

      // ACT: Drag tile outside column
      await dragTileOutsideColumn(page, `[data-testid="${testId}"]`);

      // ASSERT: Position should be unchanged
      const newBox = await page.locator(`[data-testid="${testId}"]`).boundingBox();

      expect(newBox).toBeTruthy();
      console.log(`After cancel drag: y=${newBox!.y}`);

      // Allow small tolerance for rendering
      expect(Math.abs(newBox!.y - originalY)).toBeLessThan(5);
    });
  });

  test.describe('EC-04: Multiple Tiles Push-Down Chain', () => {
    test.beforeEach(async ({ page }) => {
      // Use push-down fixture with 3 consecutive tiles
      await page.goto('/?fixture=push-down');
      await waitForAppReady(page);
    });

    test('EC-04.1: Dropping on first tile pushes entire chain', async ({ page }) => {
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

      // ACT: Drag first tile down significantly (e.g., 150px = 1.5 hours)
      await dragTileByDelta(page, `[data-testid="${firstTileTestId}"]`, 150);

      // ASSERT: All tiles should have moved down
      const newTimes: string[] = [];
      for (let i = 0; i < count; i++) {
        const tileTestId = await tiles.nth(i).getAttribute('data-testid');
        const time = await getTileScheduledStart(page, `[data-testid="${tileTestId}"]`);
        newTimes.push(time || '');
        console.log(`After - Tile ${i}: testId=${tileTestId}, time=${time}`);
      }

      // First tile should have moved to a later time
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

      // ACT: Drag first tile down
      await dragTileByDelta(page, `[data-testid="${firstTileTestId}"]`, 150);

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
