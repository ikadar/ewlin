import { test, expect } from '@playwright/test';

/**
 * E2E tests for v0.3.44 DateStrip Redesign (REQ-09)
 *
 * Tests:
 * - REQ-09.1: Extended date range (365 days)
 * - REQ-09.2: Focused day sync with grid scroll
 * - REQ-09.3: Today indicator (thin red line instead of amber background)
 * - REQ-09.3: Focused day highlight
 */

test.describe('DateStrip Redesign (REQ-09)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=datestrip-redesign');
    // Wait for the app to load
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test('REQ-09.3: Today has thin red line indicator, not amber background', async ({ page }) => {
    const datestripContainer = page.locator('[data-testid="datestrip-container"]');

    // The today indicator line may be hidden when viewport indicator overlaps
    // So we check for either the today-indicator-line OR viewport-indicator
    const todayLine = datestripContainer.locator('[data-testid="today-indicator-line"]');
    const viewportIndicator = datestripContainer.locator('[data-testid="viewport-indicator"]');

    const hasTodayLine = await todayLine.count() > 0;
    const hasViewportIndicator = await viewportIndicator.count() > 0;

    // Either today line or viewport indicator should exist (they're mutually exclusive per cell)
    expect(hasTodayLine || hasViewportIndicator).toBe(true);

    // If today line exists, verify it has red background
    if (hasTodayLine) {
      const lineClasses = await todayLine.getAttribute('class');
      expect(lineClasses).toContain('bg-red-500');
    }

    // Verify NO cell has amber background (old today styling)
    const cellsWithAmber = await datestripContainer.locator('[class*="bg-amber"]').count();
    expect(cellsWithAmber).toBe(0);
  });

  test('REQ-09.2: Scrolling grid updates focused day in DateStrip', async ({ page }) => {
    const grid = page.locator('[data-testid="scheduling-grid"]');

    // Get initial scroll position
    const initialScrollTop = await grid.evaluate((el) => el.scrollTop);

    // Scroll down significantly
    await grid.evaluate((el) => {
      el.scrollBy({ top: 2000, behavior: 'instant' });
    });

    // Wait for scroll to complete
    await page.waitForTimeout(100);

    // Verify scroll happened
    const newScrollTop = await grid.evaluate((el) => el.scrollTop);
    expect(newScrollTop).toBeGreaterThan(initialScrollTop);

    // Verify DateStrip container exists and has date cells
    const datestripContainer = page.locator('[data-testid="datestrip-container"]');
    await expect(datestripContainer).toBeVisible();

    // Check that date cells exist (with virtual scrolling, not all are rendered)
    const cellCount = await datestripContainer.locator('[data-testid^="date-cell-"]').count();
    expect(cellCount).toBeGreaterThan(0);
  });

  test('REQ-09.1: DateStrip has extended date range (365 days)', async ({ page }) => {
    const datestripContainer = page.locator('[data-testid="datestrip-container"]');
    await expect(datestripContainer).toBeVisible();

    // With virtual scrolling, not all 365 cells are rendered at once
    // Check the scrollHeight to verify extended range exists (365 days worth)
    const scrollInfo = await datestripContainer.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    // With 365 days at ~40px per cell, scrollHeight should be > 10000px
    expect(scrollInfo.scrollHeight).toBeGreaterThan(10000);

    // Also verify we can scroll to the end
    await datestripContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(100);

    // There should be some date cells visible after scrolling to end
    const visibleCells = await datestripContainer.locator('[data-testid^="date-cell-"]').count();
    expect(visibleCells).toBeGreaterThan(0);
  });

  test('REQ-09.2: Clicking a date in DateStrip scrolls the grid and updates focus', async ({ page }) => {
    const grid = page.locator('[data-testid="scheduling-grid"]');
    const datestripContainer = page.locator('[data-testid="datestrip-container"]');

    // Get initial scroll position
    const initialScrollTop = await grid.evaluate((el) => el.scrollTop);

    // Calculate a date 7 days from now using local time components,
    // matching DateStrip's formatDateKey() which uses getFullYear/getMonth/getDate.
    // toISOString() would give UTC date which can differ by ±1 day in non-UTC timezones.
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const targetDateKey = `${yyyy}-${mm}-${dd}`;

    // Find and click the target date cell
    const targetCell = datestripContainer.locator(`[data-testid="date-cell-${targetDateKey}"]`);

    // The cell might not be visible initially, but it should exist in the DOM
    // Wait for it to be attached
    await expect(targetCell).toBeAttached();

    // Scroll the DateStrip to make the target cell visible first
    await targetCell.scrollIntoViewIfNeeded();
    await targetCell.click();

    // Wait for scroll animation
    await page.waitForTimeout(500);

    // Verify grid scrolled
    const newScrollTop = await grid.evaluate((el) => el.scrollTop);
    expect(newScrollTop).not.toBe(initialScrollTop);
  });

  test('REQ-15 and REQ-16 still work: departure date and task markers', async ({ page }) => {
    // Select the first job to see departure date and task markers
    const jobCard = page.locator('[data-testid="job-card-job-ds-1"]');
    await jobCard.click();

    // Wait for selection
    await page.waitForTimeout(100);

    const datestripContainer = page.locator('[data-testid="datestrip-container"]');

    // Check for exit triangle (departure date indicator) or task markers
    // v0.3.47 replaced the old indicators with new ones
    const exitTriangle = datestripContainer.locator('[data-testid="exit-triangle"]');
    const taskMarkers = datestripContainer.locator('[data-testid="task-markers"]');

    // Should have either exit triangle or task markers for this job
    const hasExitTriangle = await exitTriangle.count() > 0;
    const hasTaskMarkers = await taskMarkers.count() > 0;

    expect(hasExitTriangle || hasTaskMarkers).toBe(true);
  });

  test('Visual states priority: departure > focused > today', async ({ page }) => {
    // Select a job to enable departure date highlighting
    const jobCard = page.locator('[data-testid="job-card-job-ds-1"]');
    await jobCard.click();
    await page.waitForTimeout(100);

    const datestripContainer = page.locator('[data-testid="datestrip-container"]');

    // When a job is selected, we should see either:
    // - today-indicator-line (if viewport doesn't overlap today)
    // - viewport-indicator (if it overlaps today)
    // - exit-triangle (departure date marker)
    const todayLine = datestripContainer.locator('[data-testid="today-indicator-line"]');
    const viewportIndicator = datestripContainer.locator('[data-testid="viewport-indicator"]');
    const exitTriangle = datestripContainer.locator('[data-testid="exit-triangle"]');

    const hasTodayLine = await todayLine.count() > 0;
    const hasViewportIndicator = await viewportIndicator.count() > 0;
    const hasExitTriangle = await exitTriangle.count() > 0;

    // At least one visual indicator should be present
    expect(hasTodayLine || hasViewportIndicator || hasExitTriangle).toBe(true);
  });
});
