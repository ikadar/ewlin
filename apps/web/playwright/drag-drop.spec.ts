/**
 * Playwright Drag-Drop Test for pragmatic-drag-and-drop
 *
 * Uses HTML5 Drag and Drop API with DataTransfer events.
 * This approach achieves 100% test reliability vs dnd-kit's ~80%.
 *
 * Key insight: pragmatic-dnd uses the native HTML5 DnD API which
 * responds to synthetic DragEvents, unlike dnd-kit's pointer capture.
 */

import { test, expect } from '@playwright/test';

/**
 * Helper: Parse ISO date string to extract hours and minutes
 */
function parseTime(isoString: string): { hours: number; minutes: number } {
  const date = new Date(isoString);
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
}

/**
 * Helper: Perform HTML5 drag using DataTransfer events with position
 *
 * Dispatches drag events with clientX/clientY to allow the app to
 * calculate the drop position from the cursor coordinates.
 */
async function performDragToPosition(
  page: import('@playwright/test').Page,
  sourceSelector: string,
  deltaY: number
): Promise<void> {
  await page.evaluate(
    async ({ sourceSelector, deltaY }) => {
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const source = document.querySelector(sourceSelector) as HTMLElement;
      if (!source) {
        throw new Error(`Source element not found: ${sourceSelector}`);
      }

      // Find the station column that contains this tile
      const stationColumn = source.closest('[data-testid^="station-column-"]');
      if (!stationColumn) {
        throw new Error('Tile is not inside a station column');
      }

      // Get source element position
      const sourceRect = source.getBoundingClientRect();
      const sourceX = sourceRect.x + sourceRect.width / 2;
      const sourceY = sourceRect.y + sourceRect.height / 2;

      // Calculate drop position (same X, adjusted Y)
      const dropX = sourceX;
      const dropY = sourceY + deltaY;

      console.log(`Drag: sourceY=${sourceY}, dropY=${dropY}, deltaY=${deltaY}`);

      // Create DataTransfer object
      const dataTransfer = new DataTransfer();

      // Dispatch dragstart on source
      source.dispatchEvent(new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: sourceX,
        clientY: sourceY,
      }));

      await sleep(50);

      // Dispatch dragenter on the station column
      stationColumn.dispatchEvent(new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: dropX,
        clientY: dropY,
      }));

      await sleep(30);

      // Dispatch dragover events to simulate movement and update position
      for (let i = 0; i < 5; i++) {
        stationColumn.dispatchEvent(new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: dropX,
          clientY: dropY,
        }));
        await sleep(20);
      }

      // Dispatch drop on the station column
      stationColumn.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: dropX,
        clientY: dropY,
      }));

      await sleep(50);

      // Dispatch dragend on source
      source.dispatchEvent(new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }));
    },
    { sourceSelector, deltaY }
  );

  // Wait for React state update
  await page.waitForTimeout(300);
}

test.describe('Grid Tile Drag-Drop with pragmatic-drag-and-drop', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for browser console messages
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'log') {
        console.log(`Browser ${msg.type()}: ${msg.text()}`);
      }
    });

    // Use test fixture for deterministic data
    await page.goto('/?fixture=test');
    // Wait for app to be ready - look for tiles with assignment IDs
    await page.waitForSelector('[data-testid^="tile-assign-"]');
    // Extra wait for stability
    await page.waitForTimeout(300);
  });

  test('should reschedule tile to later time when dragged down', async ({ page }) => {
    // ARRANGE: Find a tile that can be moved down
    // Tile needs to be:
    // 1. In a visible position
    // 2. Has room below within the station column
    const tiles = page.locator('[data-testid^="tile-assign-"]');
    const count = await tiles.count();
    console.log(`Found ${count} tiles`);

    let selectedTile = null;
    let selectedBox = null;

    // Find a tile that's in the middle of the visible area
    // Prefer tiles with scheduled time between 7:00-10:00 (have room to move)
    for (let i = 0; i < count; i++) {
      const t = tiles.nth(i);
      const box = await t.boundingBox();
      const scheduledStart = await t.getAttribute('data-scheduled-start');

      if (box && scheduledStart) {
        const time = parseTime(scheduledStart);
        // Find tile scheduled between 7:00 and 10:00 (has room to move down)
        if (time.hours >= 7 && time.hours <= 10 && box.y > 100) {
          selectedTile = t;
          selectedBox = box;
          console.log(`Selected tile at index ${i}, time=${time.hours}:${time.minutes}, y=${box.y}`);
          break;
        }
      }
    }

    if (!selectedTile || !selectedBox) {
      test.skip(true, 'No suitable tile found for drag down test');
      return;
    }

    // Get initial attributes
    const testId = await selectedTile.getAttribute('data-testid');
    const originalScheduledStart = await selectedTile.getAttribute('data-scheduled-start');

    expect(testId).toBeTruthy();
    expect(originalScheduledStart).toBeTruthy();

    const originalTime = parseTime(originalScheduledStart!);
    const originalTop = selectedBox.y;

    console.log(`BEFORE: testId=${testId}, scheduledStart=${originalScheduledStart}, top=${originalTop}px`);

    // ACT: Drag tile down by 100px (= 1 hour)
    await performDragToPosition(page, `[data-testid="${testId}"]`, 100);

    // ASSERT: Tile position changed
    const newTile = page.locator(`[data-testid="${testId}"]`);
    const newScheduledStart = await newTile.getAttribute('data-scheduled-start');
    const newBoundingBox = await newTile.boundingBox();

    expect(newScheduledStart).toBeTruthy();
    expect(newBoundingBox).toBeTruthy();

    const newTime = parseTime(newScheduledStart!);
    const newTop = newBoundingBox!.y;

    console.log(`AFTER: scheduledStart=${newScheduledStart}, top=${newTop}px`);

    // Position should have increased (moved down)
    expect(newTop, 'Tile should move down').toBeGreaterThan(originalTop);

    // Scheduled time should be later
    const originalMinutes = originalTime.hours * 60 + originalTime.minutes;
    const newMinutes = newTime.hours * 60 + newTime.minutes;
    expect(newMinutes, 'Scheduled time should be later').toBeGreaterThan(originalMinutes);
  });

  test('should reschedule tile to earlier time when dragged up', async ({ page }) => {
    // ARRANGE: Find a tile that can be moved up
    // Tile needs to have scheduled time >= 8:00 (room to move to 7:00)
    const tiles = page.locator('[data-testid^="tile-assign-"]');
    const count = await tiles.count();
    console.log(`Found ${count} tiles for drag-up test`);

    let selectedTile = null;
    let originalBoundingBox = null;

    // Find a tile scheduled at 9:00 or later (has room to move up to 8:00)
    for (let i = 0; i < count; i++) {
      const tile = tiles.nth(i);
      const box = await tile.boundingBox();
      const scheduledStart = await tile.getAttribute('data-scheduled-start');

      if (box && scheduledStart) {
        const time = parseTime(scheduledStart);
        // Find tile scheduled between 9:00 and 14:00 (has room to move up)
        if (time.hours >= 9 && time.hours <= 14 && box.y > 100) {
          selectedTile = tile;
          originalBoundingBox = box;
          console.log(`Selected tile at index ${i}, time=${time.hours}:${time.minutes}, y=${box.y}`);
          break;
        }
      }
    }

    if (!selectedTile || !originalBoundingBox) {
      test.skip(true, 'No tile found with enough room to move up');
      return;
    }

    const testId = await selectedTile.getAttribute('data-testid');
    const originalScheduledStart = await selectedTile.getAttribute('data-scheduled-start');

    expect(testId).toBeTruthy();
    expect(originalScheduledStart).toBeTruthy();

    const originalTime = parseTime(originalScheduledStart!);
    const originalTop = originalBoundingBox.y;

    console.log(`BEFORE: testId=${testId}, scheduledStart=${originalScheduledStart}, top=${originalTop}px`);

    // ACT: Drag tile up by 100px (= 1 hour earlier)
    await performDragToPosition(page, `[data-testid="${testId}"]`, -100);

    // ASSERT: Tile position changed
    const newTile = page.locator(`[data-testid="${testId}"]`);
    const newScheduledStart = await newTile.getAttribute('data-scheduled-start');
    const newBoundingBox = await newTile.boundingBox();

    expect(newScheduledStart).toBeTruthy();
    expect(newBoundingBox).toBeTruthy();

    const newTime = parseTime(newScheduledStart!);
    const newTop = newBoundingBox!.y;

    console.log(`AFTER: scheduledStart=${newScheduledStart}, top=${newTop}px`);

    // Position should have decreased (moved up)
    expect(newTop, 'Tile should move up').toBeLessThan(originalTop);

    // Scheduled time should be earlier
    const originalMinutes = originalTime.hours * 60 + originalTime.minutes;
    const newMinutes = newTime.hours * 60 + newTime.minutes;
    expect(newMinutes, 'Scheduled time should be earlier').toBeLessThan(originalMinutes);
  });

  test('dragged tile should snap to 30-minute grid', async ({ page }) => {
    // ARRANGE: Find a tile with assignment ID
    const tile = page.locator('[data-testid^="tile-assign-"]').first();
    const testId = await tile.getAttribute('data-testid');
    const originalBoundingBox = await tile.boundingBox();

    expect(testId).toBeTruthy();
    expect(originalBoundingBox).toBeTruthy();

    console.log(`BEFORE: testId=${testId}`);

    // ACT: Drag tile down by an odd amount (75px - not aligned to 50px grid)
    await performDragToPosition(page, `[data-testid="${testId}"]`, 75);

    // ASSERT: Time is on 30-minute boundary
    const newTile = page.locator(`[data-testid="${testId}"]`);
    const newScheduledStart = await newTile.getAttribute('data-scheduled-start');

    expect(newScheduledStart).toBeTruthy();

    const { minutes } = parseTime(newScheduledStart!);
    console.log(`AFTER: scheduledStart=${newScheduledStart}, minutes=${minutes}`);

    expect(
      minutes === 0 || minutes === 30,
      `Minutes should be 0 or 30, got ${minutes}`
    ).toBe(true);
  });
});
