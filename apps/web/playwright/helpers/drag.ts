/**
 * Playwright Drag Helpers
 *
 * Reusable helper functions for drag-and-drop testing with pragmatic-drag-and-drop.
 * Uses HTML5 DragEvent API with DataTransfer for 100% reliability.
 */

import type { Page } from '@playwright/test';

/**
 * Snap interval in minutes - must match SNAP_INTERVAL_MINUTES in app code
 * @see apps/web/src/components/DragPreview/snapUtils.ts
 */
export const SNAP_INTERVAL_MINUTES = 15;

/**
 * Parse ISO date string to extract hours and minutes
 */
export function parseTime(isoString: string): { hours: number; minutes: number } {
  const date = new Date(isoString);
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
}

/**
 * Calculate total minutes from hours and minutes
 */
export function toTotalMinutes(time: { hours: number; minutes: number }): number {
  return time.hours * 60 + time.minutes;
}

/**
 * Check if time is on a snap boundary (divisible by SNAP_INTERVAL_MINUTES)
 */
export function isOnSnapBoundary(time: { hours: number; minutes: number }): boolean {
  return time.minutes % SNAP_INTERVAL_MINUTES === 0;
}

/**
 * Perform HTML5 drag from tile to new Y position (deltaY relative movement)
 */
export async function dragTileByDelta(
  page: Page,
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

      // Dispatch dragover events to simulate movement
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

/**
 * Perform HTML5 drag from sidebar task tile to station column at specific Y position
 * @param expectNewTile - If true, waits for a new tile to appear on the station (default: true)
 */
export async function dragFromSidebarToStation(
  page: Page,
  taskTileSelector: string,
  stationId: string,
  targetY: number,
  expectNewTile: boolean = true
): Promise<void> {
  // Count tiles before drag (match root tile elements only via data-scheduled-start)
  const tilesBefore = expectNewTile
    ? await page.locator(`[data-testid="station-column-${stationId}"]`).locator('[data-testid^="tile-"][data-scheduled-start]').count()
    : 0;

  await page.evaluate(
    async ({ taskTileSelector, stationId, targetY }) => {
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const source = document.querySelector(taskTileSelector) as HTMLElement;
      if (!source) {
        throw new Error(`Source element not found: ${taskTileSelector}`);
      }

      const stationColumn = document.querySelector(`[data-testid="station-column-${stationId}"]`) as HTMLElement;
      if (!stationColumn) {
        throw new Error(`Station column not found: ${stationId}`);
      }

      // Get source position
      const sourceRect = source.getBoundingClientRect();
      const sourceX = sourceRect.x + sourceRect.width / 2;
      const sourceY = sourceRect.y + sourceRect.height / 2;

      // Get station column position
      const stationRect = stationColumn.getBoundingClientRect();
      const dropX = stationRect.x + stationRect.width / 2;
      const dropY = stationRect.y + targetY; // targetY is relative to station column top

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

      // Dispatch dragover events
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

      // Dispatch drop
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
    { taskTileSelector, stationId, targetY }
  );

  // Wait for React state update
  if (expectNewTile) {
    // Wait for new tile to appear (more reliable than fixed timeout)
    try {
      await page.waitForFunction(
        ({ stationId, expectedCount }) => {
          const column = document.querySelector(`[data-testid="station-column-${stationId}"]`);
          if (!column) return false;
          // Match root tile elements only (they have data-scheduled-start attribute)
          const tiles = column.querySelectorAll('[data-testid^="tile-"][data-scheduled-start]');
          return tiles.length > expectedCount;
        },
        { stationId, expectedCount: tilesBefore },
        { timeout: 2000 }
      );
    } catch {
      // Fallback to timeout if tile doesn't appear (e.g., validation blocked it)
      await page.waitForTimeout(300);
    }
  } else {
    await page.waitForTimeout(300);
  }
}

/**
 * Pick a task tile and place it on a station column at a specific Y position.
 *
 * targetY is relative to the VISIBLE top of the grid (i.e., offset from
 * the current scroll position), not from the absolute top of the column.
 * This is critical because the grid can be 700,000+ px tall (365-day view)
 * and the visible portion is a tiny window scrolled to "today".
 *
 * Uses dispatchEvent with bubbles:true to reach React 18's event delegation,
 * matching the pattern used by the passing drag-and-drop tests.
 */
export async function pickAndPlace(
  page: Page,
  taskTileSelector: string,
  stationId: string,
  targetY: number
): Promise<void> {
  // Step 1: Click task tile to enter pick mode
  await page.locator(taskTileSelector).click();

  // Wait for pick preview to appear
  await page.waitForSelector('[data-testid="pick-preview"]', { timeout: 3000 });

  // Step 2: Dispatch mousemove + click via evaluate
  // targetY is offset from the visible top, so we add scrollTop to get
  // the absolute column position that the handler needs for time calculation.
  await page.evaluate(
    async ({ stationId, targetY }) => {
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const stationColumn = document.querySelector(
        `[data-testid="station-column-${stationId}"]`
      ) as HTMLElement;
      if (!stationColumn) throw new Error(`Station column not found: ${stationId}`);

      // Get scroll position of the grid container
      const grid = document.querySelector('[data-testid="scheduling-grid"]') as HTMLElement;
      const scrollTop = grid ? grid.scrollTop : 0;

      // absoluteY = position in column coordinates (scrollTop + visible offset)
      const absoluteY = scrollTop + targetY;

      const rect = stationColumn.getBoundingClientRect();
      const clientX = rect.x + rect.width / 2;
      const clientY = rect.y + absoluteY;

      // Dispatch mousemove to trigger validation
      stationColumn.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true, cancelable: true, clientX, clientY,
      }));
      await sleep(200);

      // Dispatch click to place
      stationColumn.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, clientX, clientY,
      }));
    },
    { stationId, targetY }
  );

  // Wait for React state update
  await page.waitForTimeout(300);
}

/**
 * Pick a task tile and place it at a specific TIME on a station column.
 *
 * Unlike pickAndPlace (which uses a viewport-relative pixel offset),
 * this function computes the absolute Y position from the desired hour/minute,
 * making it immune to scroll-position variations caused by different test run times.
 *
 * This is important because the grid auto-scrolls to center the current time,
 * so the same pixel offset can map to different times (and potentially hit
 * the lunch break 12:00-13:00) depending on when the test runs.
 *
 * @param hour - Desired placement hour (0-23) on today's date
 * @param minute - Desired placement minute (0-59), default 0
 * @param pixelsPerHour - Pixels per hour at current zoom level, default 64 (v0.4.29)
 */
export async function pickAndPlaceAtTime(
  page: Page,
  taskTileSelector: string,
  stationId: string,
  hour: number,
  minute: number = 0,
  pixelsPerHour: number = 64
): Promise<void> {
  // Step 1: Click task tile to enter pick mode
  await page.locator(taskTileSelector).click();
  await page.waitForSelector('[data-testid="pick-preview"]', { timeout: 3000 });

  // Step 2: Compute absolute Y for the desired time and dispatch events
  await page.evaluate(
    async ({ stationId, hour, minute, pixelsPerHour }) => {
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const stationColumn = document.querySelector(
        `[data-testid="station-column-${stationId}"]`
      ) as HTMLElement;
      if (!stationColumn) throw new Error(`Station column not found: ${stationId}`);

      // Replicate gridStartDate calculation: today - 6 days, midnight
      const gridStart = new Date();
      gridStart.setDate(gridStart.getDate() - 6);
      gridStart.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysDiff = Math.round(
        (today.getTime() - gridStart.getTime()) / (24 * 60 * 60 * 1000)
      );

      // Absolute Y in column coordinates for the desired time
      const totalHours = daysDiff * 24 + hour + minute / 60;
      const absoluteY = totalHours * pixelsPerHour;

      // The handler subtracts PICK_CURSOR_OFFSET_Y (20px) from relativeY,
      // so we add it to get the correct tileTopY after subtraction
      const PICK_CURSOR_OFFSET_Y = 20;
      const relativeY = absoluteY + PICK_CURSOR_OFFSET_Y;

      const rect = stationColumn.getBoundingClientRect();
      const clientX = rect.x + rect.width / 2;
      const clientY = rect.y + relativeY;

      // Dispatch mousemove to trigger validation
      stationColumn.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true, cancelable: true, clientX, clientY,
      }));
      await sleep(200);

      // Dispatch click to place
      stationColumn.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, clientX, clientY,
      }));
    },
    { stationId, hour, minute, pixelsPerHour }
  );

  await page.waitForTimeout(300);
}

/**
 * Perform drag outside station column (cancel drag)
 */
export async function dragTileOutsideColumn(
  page: Page,
  sourceSelector: string
): Promise<void> {
  await page.evaluate(
    async ({ sourceSelector }) => {
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const source = document.querySelector(sourceSelector) as HTMLElement;
      if (!source) {
        throw new Error(`Source element not found: ${sourceSelector}`);
      }

      // Get source position
      const sourceRect = source.getBoundingClientRect();
      const sourceX = sourceRect.x + sourceRect.width / 2;
      const sourceY = sourceRect.y + sourceRect.height / 2;

      // Drop far outside any column
      const dropX = 50; // Far left
      const dropY = sourceY;

      // Create DataTransfer object
      const dataTransfer = new DataTransfer();

      // Dispatch dragstart
      source.dispatchEvent(new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: sourceX,
        clientY: sourceY,
      }));

      await sleep(50);

      // Dispatch dragend (no drop target)
      source.dispatchEvent(new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: dropX,
        clientY: dropY,
      }));
    },
    { sourceSelector }
  );

  await page.waitForTimeout(300);
}

/**
 * Click swap button on a tile
 */
export async function clickSwapButton(
  page: Page,
  tileSelector: string,
  direction: 'up' | 'down'
): Promise<void> {
  // Hover over tile to show swap buttons
  await page.locator(tileSelector).hover();
  await page.waitForTimeout(100);

  // Click the swap button
  const buttonSelector = direction === 'up' ? '[data-testid="swap-up-button"]' : '[data-testid="swap-down-button"]';
  await page.locator(tileSelector).locator(buttonSelector).click();

  await page.waitForTimeout(300);
}

/**
 * Get scheduled start time from tile attribute
 */
export async function getTileScheduledStart(page: Page, tileSelector: string): Promise<string | null> {
  return await page.locator(tileSelector).getAttribute('data-scheduled-start');
}

/**
 * Wait for app to be ready (waits for jobs list or tiles)
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for either tiles OR job cards (some fixtures have no tiles initially)
  await Promise.race([
    page.waitForSelector('[data-testid^="tile-"]', { timeout: 5000 }).catch(() => null),
    page.waitForSelector('[data-testid^="job-card-"]', { timeout: 5000 }).catch(() => null),
  ]);
  await page.waitForTimeout(300);
}

/**
 * Wait for app to be ready with tiles specifically
 */
export async function waitForTilesReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid^="tile-"]', { timeout: 5000 });
  await page.waitForTimeout(300);
}

/**
 * Count tiles on a specific station
 * Matches both fixture tiles (tile-assign-*) and dynamically created tiles (tile-uuid)
 * Uses data-scheduled-start attribute to identify root tile elements
 */
export async function countTilesOnStation(page: Page, stationId: string): Promise<number> {
  const stationColumn = page.locator(`[data-testid="station-column-${stationId}"]`);
  // Match root tile elements only (they have data-scheduled-start attribute)
  const tiles = stationColumn.locator('[data-testid^="tile-"][data-scheduled-start]');
  return await tiles.count();
}

/**
 * Perform HTML5 drag from sidebar task tile to station column with Alt key pressed
 * Used for testing Alt+drop precedence bypass (REQ-13)
 */
export async function dragFromSidebarToStationWithAlt(
  page: Page,
  taskTileSelector: string,
  stationId: string,
  targetY: number
): Promise<void> {
  // Count tiles before drag
  const tilesBefore = await page.locator(`[data-testid="station-column-${stationId}"]`).locator('[data-testid^="tile-"][data-scheduled-start]').count();

  await page.evaluate(
    async ({ taskTileSelector, stationId, targetY }) => {
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const source = document.querySelector(taskTileSelector) as HTMLElement;
      if (!source) {
        throw new Error(`Source element not found: ${taskTileSelector}`);
      }

      const stationColumn = document.querySelector(`[data-testid="station-column-${stationId}"]`) as HTMLElement;
      if (!stationColumn) {
        throw new Error(`Station column not found: ${stationId}`);
      }

      // Get source position
      const sourceRect = source.getBoundingClientRect();
      const sourceX = sourceRect.x + sourceRect.width / 2;
      const sourceY = sourceRect.y + sourceRect.height / 2;

      // Get station column position
      const stationRect = stationColumn.getBoundingClientRect();
      const dropX = stationRect.x + stationRect.width / 2;
      const dropY = stationRect.y + targetY;

      // Create DataTransfer object
      const dataTransfer = new DataTransfer();

      // Dispatch dragstart on source (no Alt yet)
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

      // Simulate Alt key press
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }));
      await sleep(50);

      // Dispatch dragover events WITH altKey: true
      for (let i = 0; i < 5; i++) {
        stationColumn.dispatchEvent(new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: dropX,
          clientY: dropY,
          altKey: true, // Alt key is pressed
        }));
        await sleep(20);
      }

      // Dispatch drop WITH altKey: true
      stationColumn.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: dropX,
        clientY: dropY,
        altKey: true, // Alt key is pressed
      }));

      await sleep(50);

      // Release Alt key
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', altKey: false }));

      // Dispatch dragend on source
      source.dispatchEvent(new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }));
    },
    { taskTileSelector, stationId, targetY }
  );

  // Wait for new tile to appear
  try {
    await page.waitForFunction(
      ({ stationId, expectedCount }) => {
        const column = document.querySelector(`[data-testid="station-column-${stationId}"]`);
        if (!column) return false;
        const tiles = column.querySelectorAll('[data-testid^="tile-"][data-scheduled-start]');
        return tiles.length > expectedCount;
      },
      { stationId, expectedCount: tilesBefore },
      { timeout: 2000 }
    );
  } catch {
    await page.waitForTimeout(300);
  }
}

/**
 * Check if a job appears in the Problems section
 */
export async function isJobInProblemsSection(page: Page, jobId: string): Promise<boolean> {
  // Problems section has jobs with conflict or late status
  const problemsSection = page.locator('[data-testid="problems-section"]');
  const jobCard = problemsSection.locator(`[data-testid="job-card-${jobId}"]`);
  return await jobCard.isVisible().catch(() => false);
}

/**
 * Check if a job card has conflict styling (amber background)
 */
export async function hasConflictStyling(page: Page, jobId: string): Promise<boolean> {
  const jobCard = page.locator(`[data-testid="job-card-${jobId}"]`);
  // Check for amber/conflict background class or shuffle icon
  const hasAmberBg = await jobCard.evaluate((el) => {
    return el.classList.contains('bg-amber-500/10') ||
           el.querySelector('[data-lucide="shuffle"]') !== null ||
           el.innerHTML.includes('shuffle');
  }).catch(() => false);
  return hasAmberBg;
}
