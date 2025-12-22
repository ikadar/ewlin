/**
 * Playwright Drag Helpers
 *
 * Reusable helper functions for drag-and-drop testing with pragmatic-drag-and-drop.
 * Uses HTML5 DragEvent API with DataTransfer for 100% reliability.
 */

import type { Page } from '@playwright/test';

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
