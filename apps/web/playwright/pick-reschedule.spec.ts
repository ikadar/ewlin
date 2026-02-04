/**
 * Playwright test: Pick & reschedule a tile to a specific time
 *
 * Picks the TEST-002 tile from the grid and places it at 10:00 AM,
 * then verifies the scheduled start moved from 09:00 to 10:00.
 *
 * The key insight: we need to calculate the target Y position in the
 * column's coordinate system, not viewport coordinates.
 *
 * The tile's current position (tileTop in column) corresponds to 09:00.
 * Adding PIXELS_PER_HOUR (64px) gives us 10:00.
 */

import { test, expect } from '@playwright/test';
import { parseTime, isOnSnapBoundary, waitForAppReady } from './helpers/drag';

/** Must match TopNavBar/constants.ts DEFAULT_PIXELS_PER_HOUR (v0.4.29: 64) */
const PIXELS_PER_HOUR = 64;

/** Must match App.tsx PICK_CURSOR_OFFSET_Y */
const PICK_CURSOR_OFFSET_Y = 20;

test.describe('Pick & Reschedule', () => {
  test.beforeEach(async ({ page }) => {
    // Use pick-reschedule fixture with 7-day operating schedule
    // to avoid flaky tests when running on weekends
    await page.goto('/?fixture=pick-reschedule');
    await waitForAppReady(page);
  });

  test('Pick TEST-002 tile and place at 10:00 AM', async ({ page }) => {
    // Listen to console messages from browser
    page.on('console', (msg) => {
      if (msg.type() === 'log') {
        console.log('BROWSER:', msg.text());
      }
    });

    const tileSelector = '[data-testid="tile-assign-test-2-print"]';
    const columnSelector = '[data-testid="station-column-station-komori"]';

    // ARRANGE: Verify the tile exists and starts at 09:00
    const tile = page.locator(tileSelector);
    await expect(tile).toBeVisible();

    const originalStart = await tile.getAttribute('data-scheduled-start');
    expect(originalStart).toBeTruthy();
    const originalTime = parseTime(originalStart!);
    expect(originalTime.hours).toBe(9);
    expect(originalTime.minutes).toBe(0);

    // Get tile's viewport bounding box BEFORE picking
    const tileBox = await tile.boundingBox();
    expect(tileBox).toBeTruthy();

    // DEBUG: Check tile's actual CSS top position before picking
    const tileStyle = await tile.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { top: style.top, height: style.height };
    });
    const column = page.locator(columnSelector);
    const columnRect = await column.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    });
    const tileTopInColumn = parseFloat(tileStyle.top);
    console.log('DEBUG - Tile CSS position:', {
      tileStyleTop: tileStyle.top,
      tileTopParsed: tileTopInColumn,
      expectedHoursFromTop: tileTopInColumn / PIXELS_PER_HOUR,
      columnHeight: columnRect.height,
    });

    // ACT Step 1: Click tile to pick it
    await tile.click();
    await expect(page.locator('[data-testid="pick-preview"]')).toBeVisible();

    // ACT Step 2: Calculate target position and dispatch events
    //
    // IMPORTANT: We use the tile's CSS `top` value (9792px for 09:00) rather than
    // bounding box because after picking, the tile becomes a placeholder and
    // the bounding box reference becomes stale.
    //
    // The handleClick calculates: relativeY = clientY - rect.top
    // The handlePickClick then does: tileTopY = relativeY - PICK_CURSOR_OFFSET_Y
    //
    // To place at 10:00 (1 hour below 09:00), we need:
    //   targetTileTop (CSS top) = currentCssTop + PIXELS_PER_HOUR
    //
    // Then: relativeY = targetTileTop + PICK_CURSOR_OFFSET_Y
    // And: clientY = relativeY + columnRect.top
    await page.evaluate(
      async ({ columnSelector, tileCssTop, tileBoxX, tileBoxWidth, PIXELS_PER_HOUR, PICK_CURSOR_OFFSET_Y }) => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const column = document.querySelector(columnSelector) as HTMLElement;
        if (!column) throw new Error('Column not found');

        const columnRect = column.getBoundingClientRect();

        // Current tile position from CSS (not bounding box - that becomes stale after pick)
        const currentTileTopInColumn = tileCssTop;

        // Target position: 1 hour below current position
        const targetTileTopInColumn = currentTileTopInColumn + PIXELS_PER_HOUR;

        // Calculate clientY that will result in correct relativeY
        // relativeY = targetTileTopInColumn + PICK_CURSOR_OFFSET_Y
        // clientY = relativeY + columnRect.top
        const relativeY = targetTileTopInColumn + PICK_CURSOR_OFFSET_Y;
        const clientY = relativeY + columnRect.top;
        const clientX = tileBoxX + tileBoxWidth / 2;

        console.log('Pick placement debug:', {
          currentTileTopInColumn,
          targetTileTopInColumn,
          relativeY,
          clientY,
          columnRectTop: columnRect.top,
        });

        // Dispatch mousemove to trigger validation preview
        column.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          view: window,
        }));
        await sleep(200);

        // Dispatch click to place the tile
        column.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          view: window,
        }));
      },
      {
        columnSelector,
        tileCssTop: tileTopInColumn,
        tileBoxX: tileBox!.x,
        tileBoxWidth: tileBox!.width,
        PIXELS_PER_HOUR,
        PICK_CURSOR_OFFSET_Y,
      }
    );
    await page.waitForTimeout(500);

    // ASSERT: Pick mode should be finished (no more ghost)
    await expect(page.locator('[data-testid="pick-preview"]')).not.toBeVisible();

    // ASSERT: Tile should now be at 10:00 AM
    const updatedTile = page.locator(tileSelector);
    await expect(updatedTile).toBeVisible();

    const newStart = await updatedTile.getAttribute('data-scheduled-start');
    expect(newStart).toBeTruthy();

    const newTime = parseTime(newStart!);
    expect(newTime.hours).toBe(10);
    expect(newTime.minutes).toBe(0);
    expect(isOnSnapBoundary(newTime)).toBe(true);
  });
});
