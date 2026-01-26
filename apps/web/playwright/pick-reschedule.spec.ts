/**
 * Playwright test: Pick & reschedule a tile to a specific time
 *
 * Picks the TEST-002 tile from the grid and places it at 10:00 AM,
 * then verifies the scheduled start is valid.
 */

import { test, expect } from '@playwright/test';
import { parseTime, isOnSnapBoundary, waitForAppReady } from './helpers/drag';

/** Must match TopNavBar/constants.ts DEFAULT_PIXELS_PER_HOUR */
const PIXELS_PER_HOUR = 80;
/** Must match PickPreview.tsx PICK_CURSOR_OFFSET_Y */
const PICK_CURSOR_OFFSET_Y = 20;

test.describe('Pick & Reschedule', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=test');
    await waitForAppReady(page);
  });

  test('Pick TEST-002 tile and place at 10:00 AM', async ({ page }) => {
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

    // ACT Step 1: Click tile to pick it
    await tile.click();
    await expect(page.locator('[data-testid="pick-preview"]')).toBeVisible();

    // ACT Step 2+3: Place at 10:00 AM using time-based position calculation.
    // NOTE: After entering pick mode, the original tile DOM element is replaced
    // with a placeholder (data-testid="tile-placeholder-..."), so we cannot
    // read the tile's position after pick. Instead, compute the absolute Y
    // for 10:00 AM directly from the grid's coordinate system.
    await page.evaluate(
      async ({ columnSelector, PIXELS_PER_HOUR, PICK_CURSOR_OFFSET_Y }) => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const column = document.querySelector(columnSelector) as HTMLElement;
        if (!column) throw new Error('Column not found');

        // Replicate gridStartDate: today - 6 days, midnight
        const gridStart = new Date();
        gridStart.setDate(gridStart.getDate() - 6);
        gridStart.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysDiff = Math.round(
          (today.getTime() - gridStart.getTime()) / (24 * 60 * 60 * 1000)
        );

        // Absolute Y for 10:00 AM today
        const totalHours = daysDiff * 24 + 10; // 10:00
        const absoluteY = totalHours * PIXELS_PER_HOUR;
        const relativeY = absoluteY + PICK_CURSOR_OFFSET_Y;

        const colRect = column.getBoundingClientRect();
        const clientX = colRect.x + colRect.width / 2;
        const clientY = colRect.y + relativeY;

        // Dispatch mousemove to trigger validation
        column.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true, cancelable: true, clientX, clientY,
        }));
        await sleep(200);

        // Dispatch click to place
        column.dispatchEvent(new MouseEvent('click', {
          bubbles: true, cancelable: true, clientX, clientY,
        }));
      },
      { columnSelector, PIXELS_PER_HOUR, PICK_CURSOR_OFFSET_Y }
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
