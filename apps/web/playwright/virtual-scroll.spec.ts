import { test, expect } from '@playwright/test';

test.describe('Virtual Scrolling (v0.3.46)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=virtual-scroll');
    // Wait for the grid to load
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test('renders grid with 365-day virtual height', async ({ page }) => {
    // The grid should have the full virtual height for 365 days
    // v0.4.29: Each day = 24 hours * 64px = 1536px (was 80px = 1920px)
    // Total = 365 * 1536 = 560640px

    const grid = page.locator('[data-testid="scheduling-grid"]');
    await expect(grid).toBeVisible();

    // Check that scrollable height is very large (365 days worth)
    const scrollHeight = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="scheduling-grid"]');
      return grid?.scrollHeight ?? 0;
    });

    // The height should be at least 560000px (365 days * 1536px)
    expect(scrollHeight).toBeGreaterThan(560000);
  });

  test('shows tiles for today initially (day 6 in grid)', async ({ page }) => {
    // Grid starts 6 days before today, so today is at index 6
    // Select job VS-001 first
    await page.click('text=VS-001');

    // Wait for selection
    await page.waitForTimeout(200);

    // The tile should be visible (today's tiles are in visible range)
    const tiles = page.locator('[data-testid^="tile-assign"]');
    await expect(tiles.first()).toBeVisible({ timeout: 3000 });
  });

  test('can scroll to see tiles on far days', async ({ page }) => {
    // Select the job that has a tile on day 10 (from today)
    await page.click('text=VS-001');

    // Scroll down to approximately day 16 (6 days offset + 10 days from today)
    const grid = page.locator('[data-testid="scheduling-grid"]');
    await grid.evaluate((el) => {
      el.scrollTop = 16 * 1536; // Day 16 in grid (10 days from today) - v0.4.29: 1536px/day (24h * 64px/h)
    });

    // Wait for the virtual scroll to update
    await page.waitForTimeout(300);

    // The grid should have scrolled
    // v0.4.29: 16 days * 1536px/day = 24576px (was 16 * 1920 = 30720)
    const scrollTop = await grid.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(20000);
  });

  test('DateStrip container has correct virtual height', async ({ page }) => {
    const datestrip = page.locator('[data-testid="datestrip-container"]');

    // Check that DateStrip has full virtual height (365 days * 40px each)
    const scrollHeight = await datestrip.evaluate((el) => el.scrollHeight);

    // Should be 365 * 40 = 14600px
    expect(scrollHeight).toBe(14600);
  });

  test('navigation to date via DateStrip click works', async ({ page }) => {
    // Get the DateStrip container
    const datestrip = page.locator('[data-testid="datestrip-container"]');

    // Scroll the DateStrip to see more dates
    await datestrip.evaluate((el) => {
      el.scrollTop = 300; // Scroll down a bit
    });

    // Wait for render
    await page.waitForTimeout(100);

    // Click on a date cell (should navigate the grid)
    const dateCell = datestrip.locator('button').nth(5);
    await dateCell.click();

    // Wait for grid scroll animation
    await page.waitForTimeout(500);

    // The grid should have scrolled
    const gridScrollTop = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="scheduling-grid"]');
      return grid?.scrollTop ?? 0;
    });

    // The grid should have scrolled to some position (not 0)
    expect(gridScrollTop).toBeGreaterThan(0);
  });

  test('grid renders limited DOM elements (performance)', async ({ page }) => {
    // Count the number of hour grid lines - should be limited by virtual scrolling
    const gridLineCount = await page.evaluate(() => {
      return document.querySelectorAll('[data-testid="hour-grid-line"]').length;
    });

    // With 3 stations and bufferDays=3 (7 days), we should have:
    // 7 days * 24 hours + 1 = 169 lines per station
    // 3 stations = 507 lines max
    // Should be much less than 365 * 24 * 3 = 26280 lines
    expect(gridLineCount).toBeLessThan(1000);
    expect(gridLineCount).toBeGreaterThan(100); // But still some lines
  });

  test('scroll performance is smooth (no excessive re-renders)', async ({ page }) => {
    const grid = page.locator('[data-testid="scheduling-grid"]');

    // Measure time for a large scroll
    const startTime = Date.now();

    // Scroll through 100 days
    for (let i = 0; i < 10; i++) {
      await grid.evaluate((el, day) => {
        el.scrollTop = day * 1536; // v0.4.29: 1536px/day
      }, i * 10);
      await page.waitForTimeout(50);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in under 2 seconds (10 scrolls * 50ms wait + render time)
    expect(duration).toBeLessThan(2000);
  });

  test('edge case: scroll to last day (364)', async ({ page }) => {
    const grid = page.locator('[data-testid="scheduling-grid"]');

    // Scroll to the last day
    await grid.evaluate((el) => {
      el.scrollTop = 364 * 1536; // v0.4.29: 1536px/day
    });

    // Wait for render
    await page.waitForTimeout(200);

    // Should not crash, grid should still be visible
    await expect(grid).toBeVisible();

    // Hour grid lines should still be rendered
    const gridLineCount = await page.evaluate(() => {
      return document.querySelectorAll('[data-testid="hour-grid-line"]').length;
    });

    expect(gridLineCount).toBeGreaterThan(0);
  });

  test('edge case: scroll to first day (0)', async ({ page }) => {
    const grid = page.locator('[data-testid="scheduling-grid"]');

    // First scroll away, then back to 0
    await grid.evaluate((el) => {
      el.scrollTop = 50 * 1536; // v0.4.29: 1536px/day
    });
    await page.waitForTimeout(100);

    await grid.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    // Should not crash, grid should still be visible
    await expect(grid).toBeVisible();

    // Hour grid lines should still be rendered at the start
    const gridLineCount = await page.evaluate(() => {
      return document.querySelectorAll('[data-testid="hour-grid-line"]').length;
    });

    expect(gridLineCount).toBeGreaterThan(0);
  });
});
