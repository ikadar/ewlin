/**
 * Playwright Swap Button Tests
 *
 * Tests for UC-09: Swap Operations
 * Tiles can be swapped with adjacent tiles using swap buttons.
 */

import { test, expect } from '@playwright/test';
import {
  parseTime,
  toTotalMinutes,
  clickSwapButton,
  getTileScheduledStart,
  waitForAppReady,
} from './helpers/drag';

test.describe('UC-09: Swap Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Use swap fixture for predictable tile positions
    await page.goto('/?fixture=swap');
    await waitForAppReady(page);
  });

  test('AC-09.1: Swap up exchanges position with tile above', async ({ page }) => {
    // ARRANGE: Get the second tile (middle tile) on Komori station
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const tiles = stationColumn.locator('[data-testid^="tile-assign-"]');

    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Get first and second tiles
    const firstTile = tiles.nth(0);
    const secondTile = tiles.nth(1);

    const firstTileTestId = await firstTile.getAttribute('data-testid');
    const secondTileTestId = await secondTile.getAttribute('data-testid');

    const firstOriginalTime = await getTileScheduledStart(page, `[data-testid="${firstTileTestId}"]`);
    const secondOriginalTime = await getTileScheduledStart(page, `[data-testid="${secondTileTestId}"]`);

    expect(firstOriginalTime).toBeTruthy();
    expect(secondOriginalTime).toBeTruthy();

    console.log(`Before swap: first=${firstOriginalTime}, second=${secondOriginalTime}`);

    // ACT: Click swap-up on the second tile
    await clickSwapButton(page, `[data-testid="${secondTileTestId}"]`, 'up');

    // ASSERT: Times should be exchanged
    const firstNewTime = await getTileScheduledStart(page, `[data-testid="${firstTileTestId}"]`);
    const secondNewTime = await getTileScheduledStart(page, `[data-testid="${secondTileTestId}"]`);

    console.log(`After swap: first=${firstNewTime}, second=${secondNewTime}`);

    // Second tile should now have the earlier time (swapped up)
    const secondOriginalMinutes = toTotalMinutes(parseTime(secondOriginalTime!));
    const secondNewMinutes = toTotalMinutes(parseTime(secondNewTime!));

    expect(secondNewMinutes).toBeLessThan(secondOriginalMinutes);
  });

  test('AC-09.2: Swap down exchanges position with tile below', async ({ page }) => {
    // ARRANGE: Get the first tile on Komori station
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const tiles = stationColumn.locator('[data-testid^="tile-assign-"]');

    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Get first and second tiles
    const firstTile = tiles.nth(0);
    const secondTile = tiles.nth(1);

    const firstTileTestId = await firstTile.getAttribute('data-testid');
    const secondTileTestId = await secondTile.getAttribute('data-testid');

    const firstOriginalTime = await getTileScheduledStart(page, `[data-testid="${firstTileTestId}"]`);
    const secondOriginalTime = await getTileScheduledStart(page, `[data-testid="${secondTileTestId}"]`);

    expect(firstOriginalTime).toBeTruthy();
    expect(secondOriginalTime).toBeTruthy();

    console.log(`Before swap: first=${firstOriginalTime}, second=${secondOriginalTime}`);

    // ACT: Click swap-down on the first tile
    await clickSwapButton(page, `[data-testid="${firstTileTestId}"]`, 'down');

    // ASSERT: Times should be exchanged
    const firstNewTime = await getTileScheduledStart(page, `[data-testid="${firstTileTestId}"]`);
    const secondNewTime = await getTileScheduledStart(page, `[data-testid="${secondTileTestId}"]`);

    console.log(`After swap: first=${firstNewTime}, second=${secondNewTime}`);

    // First tile should now have the later time (swapped down)
    const firstOriginalMinutes = toTotalMinutes(parseTime(firstOriginalTime!));
    const firstNewMinutes = toTotalMinutes(parseTime(firstNewTime!));

    expect(firstNewMinutes).toBeGreaterThan(firstOriginalMinutes);
  });

  test('AC-09.3: Top tile has no swap-up button', async ({ page }) => {
    // ARRANGE: Get the first (top) tile on Komori station
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const topTile = stationColumn.locator('[data-testid^="tile-assign-"]').first();

    // Hover to show buttons
    await topTile.hover();
    await page.waitForTimeout(100);

    // ASSERT: Swap-up button should not exist or be hidden
    const swapUpButton = topTile.locator('[data-testid="swap-up-button"]');
    const isVisible = await swapUpButton.isVisible().catch(() => false);

    expect(isVisible).toBe(false);
  });

  test('AC-09.4: Bottom tile has no swap-down button', async ({ page }) => {
    // ARRANGE: Get the last (bottom) tile on Komori station
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const tiles = stationColumn.locator('[data-testid^="tile-assign-"]');
    const count = await tiles.count();
    const bottomTile = tiles.nth(count - 1);

    // Hover to show buttons
    await bottomTile.hover();
    await page.waitForTimeout(100);

    // ASSERT: Swap-down button should not exist or be hidden
    const swapDownButton = bottomTile.locator('[data-testid="swap-down-button"]');
    const isVisible = await swapDownButton.isVisible().catch(() => false);

    expect(isVisible).toBe(false);
  });

  test('AC-09.5: Swap maintains tile durations', async ({ page }) => {
    // ARRANGE: Get tiles and their durations (from height)
    const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
    const tiles = stationColumn.locator('[data-testid^="tile-assign-"]');

    const firstTile = tiles.nth(0);
    const secondTile = tiles.nth(1);

    const firstTileTestId = await firstTile.getAttribute('data-testid');
    const secondTileTestId = await secondTile.getAttribute('data-testid');

    // Get original heights (proxy for duration)
    const firstOriginalBox = await firstTile.boundingBox();
    const secondOriginalBox = await secondTile.boundingBox();

    expect(firstOriginalBox).toBeTruthy();
    expect(secondOriginalBox).toBeTruthy();

    const firstOriginalHeight = firstOriginalBox!.height;
    const secondOriginalHeight = secondOriginalBox!.height;

    console.log(`Before swap: firstHeight=${firstOriginalHeight}, secondHeight=${secondOriginalHeight}`);

    // ACT: Swap tiles
    await clickSwapButton(page, `[data-testid="${secondTileTestId}"]`, 'up');

    // ASSERT: Heights should be preserved (same duration)
    const firstNewBox = await page.locator(`[data-testid="${firstTileTestId}"]`).boundingBox();
    const secondNewBox = await page.locator(`[data-testid="${secondTileTestId}"]`).boundingBox();

    expect(firstNewBox).toBeTruthy();
    expect(secondNewBox).toBeTruthy();

    console.log(`After swap: firstHeight=${firstNewBox!.height}, secondHeight=${secondNewBox!.height}`);

    // Heights should be the same (within small tolerance for rendering)
    expect(Math.abs(firstNewBox!.height - firstOriginalHeight)).toBeLessThan(5);
    expect(Math.abs(secondNewBox!.height - secondOriginalHeight)).toBeLessThan(5);
  });
});
