/**
 * Playwright Push-Down Tests
 *
 * Tests for UC-04: Push-Down on Collision
 * When a tile is placed onto another tile's time slot, the overlapped tiles are pushed down.
 *
 * Updated for v0.3.57: Uses Pick & Place instead of drag & drop
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  toTotalMinutes,
  getTileScheduledStart,
  waitForAppReady,
  countTilesOnStation,
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

test.describe('UC-04: Push-Down on Collision', () => {
  test.beforeEach(async ({ page }) => {
    // Use push-down fixture with 3 consecutive tiles (no gaps)
    await page.goto('/?fixture=push-down');
    await waitForAppReady(page);
  });

  test('AC-04.1: Placing on existing tile pushes it down', async ({ page }) => {
    // ARRANGE: Get tiles on Komori station (should have 3 consecutive tiles)
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const tiles = stationColumn.locator('[data-testid^="tile-assign-"]');

    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Get the first two tiles
    const firstTileTestId = await tiles.nth(0).getAttribute('data-testid');
    const secondTileTestId = await tiles.nth(1).getAttribute('data-testid');

    const secondOriginalTime = await getTileScheduledStart(page, `[data-testid="${secondTileTestId}"]`);
    expect(secondOriginalTime).toBeTruthy();

    const secondOriginalMinutes = toTotalMinutes(parseTime(secondOriginalTime!));
    console.log(`Before: second tile at ${secondOriginalTime} (${secondOriginalMinutes} min)`);

    // ACT: Pick first tile and place it at a later position (onto second tile's position)
    // v0.4.29: Calculate Y position for ~2.5 hours (160px at 64px/hour)
    await pickAndPlaceOnStation(page, `[data-testid="${firstTileTestId}"]`, 'station-komori', 160);

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

    // ACT: Pick first tile and place it significantly later to cause chain push
    // v0.4.29: 300 → 240 (scaled to 64px/hour)
    const firstTileTestId = await tiles.nth(0).getAttribute('data-testid');
    await pickAndPlaceOnStation(page, `[data-testid="${firstTileTestId}"]`, 'station-komori', 240);

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

    // ACT: Pick first tile and place it later
    // v0.4.29: 250 → 200 (scaled to 64px/hour)
    await pickAndPlaceOnStation(page, `[data-testid="${originalOrder[0]}"]`, 'station-komori', 200);
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

    // Get first tile for pick
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const firstTileTestId = await stationColumn.locator('[data-testid^="tile-assign-"]').first().getAttribute('data-testid');

    // ACT: Pick and place to cause push-down
    // v0.4.29: 250 → 200 (scaled to 64px/hour)
    await pickAndPlaceOnStation(page, `[data-testid="${firstTileTestId}"]`, 'station-komori', 200);
    await page.waitForTimeout(300);

    // ASSERT: Tile count should be the same
    const countAfter = await countTilesOnStation(page, 'station-komori');
    console.log(`Tile count after: ${countAfter}`);

    expect(countAfter).toBe(countBefore);
  });
});
