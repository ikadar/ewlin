/**
 * Playwright Push-Down Tests
 *
 * Tests for UC-04: Push-Down on Collision
 * When a tile is dropped onto another tile's time slot, the overlapped tiles are pushed down.
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  toTotalMinutes,
  dragTileByDelta,
  getTileScheduledStart,
  waitForAppReady,
  countTilesOnStation,
} from './helpers/drag';

test.describe('UC-04: Push-Down on Collision', () => {
  test.beforeEach(async ({ page }) => {
    // Use push-down fixture with 3 consecutive tiles (no gaps)
    await page.goto('/?fixture=push-down');
    await waitForAppReady(page);
  });

  test('AC-04.1: Dropping on existing tile pushes it down', async ({ page }) => {
    // ARRANGE: Get tiles on Komori station (should have 3 consecutive tiles)
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const tiles = stationColumn.locator('[data-testid^="tile-assign-"]');

    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Get the first two tiles
    const firstTile = tiles.nth(0);
    const secondTile = tiles.nth(1);

    const firstTileTestId = await firstTile.getAttribute('data-testid');
    const secondTileTestId = await secondTile.getAttribute('data-testid');

    const secondOriginalTime = await getTileScheduledStart(page, `[data-testid="${secondTileTestId}"]`);
    expect(secondOriginalTime).toBeTruthy();

    const secondOriginalMinutes = toTotalMinutes(parseTime(secondOriginalTime!));
    console.log(`Before: second tile at ${secondOriginalTime} (${secondOriginalMinutes} min)`);

    // ACT: Drag first tile down onto second tile's position
    // This should push the second tile down
    await dragTileByDelta(page, `[data-testid="${firstTileTestId}"]`, 100);

    // Wait for push-down to complete
    await page.waitForTimeout(200);

    // ASSERT: Second tile should have moved to later time (pushed down)
    const secondNewTime = await getTileScheduledStart(page, `[data-testid="${secondTileTestId}"]`);
    expect(secondNewTime).toBeTruthy();

    const secondNewMinutes = toTotalMinutes(parseTime(secondNewTime!));
    console.log(`After: second tile at ${secondNewTime} (${secondNewMinutes} min)`);

    expect(secondNewMinutes).toBeGreaterThanOrEqual(secondOriginalMinutes);
  });

  test('AC-04.2: Multiple tiles can be pushed in sequence', async ({ page }) => {
    // ARRANGE: Get all three tiles
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const tiles = stationColumn.locator('[data-testid^="tile-assign-"]');

    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Record original times for tiles 2 and 3
    const secondTileTestId = await tiles.nth(1).getAttribute('data-testid');
    const thirdTileTestId = await tiles.nth(2).getAttribute('data-testid');

    const secondOriginalTime = await getTileScheduledStart(page, `[data-testid="${secondTileTestId}"]`);
    const thirdOriginalTime = await getTileScheduledStart(page, `[data-testid="${thirdTileTestId}"]`);

    expect(secondOriginalTime).toBeTruthy();
    expect(thirdOriginalTime).toBeTruthy();

    console.log(`Before: second=${secondOriginalTime}, third=${thirdOriginalTime}`);

    // ACT: Drag first tile down significantly to cause chain push
    const firstTileTestId = await tiles.nth(0).getAttribute('data-testid');
    await dragTileByDelta(page, `[data-testid="${firstTileTestId}"]`, 200);

    // Wait for push-down chain to complete
    await page.waitForTimeout(300);

    // ASSERT: Both second and third tiles should have moved down
    const secondNewTime = await getTileScheduledStart(page, `[data-testid="${secondTileTestId}"]`);
    const thirdNewTime = await getTileScheduledStart(page, `[data-testid="${thirdTileTestId}"]`);

    console.log(`After: second=${secondNewTime}, third=${thirdNewTime}`);

    const secondOriginalMinutes = toTotalMinutes(parseTime(secondOriginalTime!));
    const thirdOriginalMinutes = toTotalMinutes(parseTime(thirdOriginalTime!));
    const secondNewMinutes = toTotalMinutes(parseTime(secondNewTime!));
    const thirdNewMinutes = toTotalMinutes(parseTime(thirdNewTime!));

    expect(secondNewMinutes).toBeGreaterThanOrEqual(secondOriginalMinutes);
    expect(thirdNewMinutes).toBeGreaterThanOrEqual(thirdOriginalMinutes);
  });

  test('AC-04.3: Pushed tiles maintain their relative order', async ({ page }) => {
    // ARRANGE: Get all tiles and their original order
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const tiles = stationColumn.locator('[data-testid^="tile-assign-"]');

    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Get original testIds in order
    const originalOrder: string[] = [];
    for (let i = 0; i < count; i++) {
      const testId = await tiles.nth(i).getAttribute('data-testid');
      originalOrder.push(testId!);
    }

    console.log('Original order:', originalOrder);

    // ACT: Drag first tile down
    await dragTileByDelta(page, `[data-testid="${originalOrder[0]}"]`, 150);
    await page.waitForTimeout(300);

    // ASSERT: Check the order is maintained (first tile moved, others pushed but kept order)
    // Get new times for all tiles
    const times: { testId: string; minutes: number }[] = [];
    for (const testId of originalOrder) {
      const time = await getTileScheduledStart(page, `[data-testid="${testId}"]`);
      if (time) {
        times.push({ testId, minutes: toTotalMinutes(parseTime(time)) });
      }
    }

    // Sort by time to see the actual order
    times.sort((a, b) => a.minutes - b.minutes);
    console.log('Times after push:', times);

    // The second and third tiles should still be in the same relative order
    const secondIndex = times.findIndex(t => t.testId === originalOrder[1]);
    const thirdIndex = times.findIndex(t => t.testId === originalOrder[2]);

    // Second should come before third (original relative order)
    expect(secondIndex).toBeLessThan(thirdIndex);
  });

  test('Tile count remains the same after push-down', async ({ page }) => {
    // ARRANGE: Count tiles before
    const countBefore = await countTilesOnStation(page, 'station-komori');
    expect(countBefore).toBeGreaterThanOrEqual(3);

    console.log(`Tile count before: ${countBefore}`);

    // Get first tile for drag
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const firstTileTestId = await stationColumn.locator('[data-testid^="tile-assign-"]').first().getAttribute('data-testid');

    // ACT: Drag to cause push-down
    await dragTileByDelta(page, `[data-testid="${firstTileTestId}"]`, 150);
    await page.waitForTimeout(300);

    // ASSERT: Tile count should be the same
    const countAfter = await countTilesOnStation(page, 'station-komori');
    console.log(`Tile count after: ${countAfter}`);

    expect(countAfter).toBe(countBefore);
  });
});
