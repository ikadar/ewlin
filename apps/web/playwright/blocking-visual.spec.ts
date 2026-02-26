/**
 * E2E Tests: Blocking Visual & Tooltip
 * v0.4.32b: Scheduler Tile Blocking Visual & Tooltip
 *
 * Tests for visual feedback on blocked tiles and prerequisite tooltip.
 */

import { test, expect } from '@playwright/test';

test.describe('Blocking Visual', () => {
  test.beforeEach(async ({ page }) => {
    // Load blocking-visual fixture (uses baseURL from playwright.config.ts)
    await page.goto('/?fixture=blocking-visual');
    // Wait for grid to render
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test('blocked tile shows dashed border', async ({ page }) => {
    // Find the blocked tile (BLOCKED-001)
    const blockedTile = page.locator('[data-testid="tile-assign-blocked-paper"]');
    await expect(blockedTile).toBeVisible();

    // Check that tile has data-is-blocked attribute
    await expect(blockedTile).toHaveAttribute('data-is-blocked', 'true');

    // Verify dashed border style (via computed style)
    const borderStyle = await blockedTile.evaluate((el) => {
      return window.getComputedStyle(el).borderLeftStyle;
    });
    expect(borderStyle).toBe('dashed');
  });

  test('ready tile shows solid border', async ({ page }) => {
    // Find the ready tile (READY-001)
    const readyTile = page.locator('[data-testid="tile-assign-ready"]');
    await expect(readyTile).toBeVisible();

    // Check that tile does NOT have data-is-blocked attribute
    await expect(readyTile).not.toHaveAttribute('data-is-blocked', 'true');

    // Verify solid border style (via computed style)
    const borderStyle = await readyTile.evaluate((el) => {
      return window.getComputedStyle(el).borderLeftStyle;
    });
    expect(borderStyle).toBe('solid');
  });

  test('tooltip appears after 500ms hover on blocked tile', async ({ page }) => {
    // Find blocked tile
    const blockedTile = page.locator('[data-testid="tile-assign-blocked-paper"]');
    await expect(blockedTile).toBeVisible();

    // Tooltip should not be visible initially
    const tooltip = page.locator('[data-testid="tile-tooltip"]');
    await expect(tooltip).not.toBeVisible();

    // Hover over the tile
    await blockedTile.hover();

    // Tooltip should still not be visible after 200ms (before 500ms delay)
    await page.waitForTimeout(200);
    await expect(tooltip).not.toBeVisible();

    // Wait for the remaining time (total 800ms to be safe)
    await page.waitForTimeout(600);

    // Now tooltip should be visible
    await expect(tooltip).toBeVisible();
  });

  test('ready tile tooltip has no warning indicators', async ({ page }) => {
    // Find ready tile
    const readyTile = page.locator('[data-testid="tile-assign-ready"]');
    await expect(readyTile).toBeVisible();

    // Hover over the tile and wait for tooltip
    await readyTile.hover();
    await page.waitForTimeout(800);

    // Tooltip appears on all tiles
    const tooltip = page.locator('[data-testid="tile-tooltip"]');
    await expect(tooltip).toBeVisible();

    // No warning indicators (all prerequisites are ready)
    await expect(tooltip).not.toContainText('⚠');
  });

  test('tooltip shows warning indicator for blocking items', async ({ page }) => {
    // Find blocked tile (paper is blocking)
    const blockedTile = page.locator('[data-testid="tile-assign-blocked-paper"]');
    await expect(blockedTile).toBeVisible();

    // Hover and wait for tooltip
    await blockedTile.hover();
    await page.waitForTimeout(800);

    // Check tooltip content
    const tooltip = page.locator('[data-testid="tile-tooltip"]');
    await expect(tooltip).toBeVisible();

    // Should show warning icon for paper (blocking)
    await expect(tooltip).toContainText('⚠');
    await expect(tooltip).toContainText('Papier');
  });

  test('tooltip shows check indicator for ready items', async ({ page }) => {
    // Find blocked tile (paper is blocking but BAT is ready)
    const blockedTile = page.locator('[data-testid="tile-assign-blocked-paper"]');
    await expect(blockedTile).toBeVisible();

    // Hover and wait for tooltip
    await blockedTile.hover();
    await page.waitForTimeout(800);

    // Check tooltip content
    const tooltip = page.locator('[data-testid="tile-tooltip"]');
    await expect(tooltip).toBeVisible();

    // Should show check icon for ready items
    await expect(tooltip).toContainText('✓');
  });

  test('tooltip disappears when mouse leaves tile', async ({ page }) => {
    // Find blocked tile
    const blockedTile = page.locator('[data-testid="tile-assign-blocked-paper"]');
    await expect(blockedTile).toBeVisible();

    // Hover and wait for tooltip to appear
    await blockedTile.hover();
    await page.waitForTimeout(800);

    const tooltip = page.locator('[data-testid="tile-tooltip"]');
    await expect(tooltip).toBeVisible();

    // Move mouse away from the tile
    await page.mouse.move(0, 0);

    // Wait for any transitions
    await page.waitForTimeout(100);

    // Tooltip should disappear
    await expect(tooltip).not.toBeVisible();
  });

  test('hover less than 500ms does not show tooltip', async ({ page }) => {
    // Find blocked tile
    const blockedTile = page.locator('[data-testid="tile-assign-blocked-paper"]');
    await expect(blockedTile).toBeVisible();

    // Hover for only 200ms (less than 500ms delay), then move away
    await blockedTile.hover();
    await page.waitForTimeout(200);
    await page.mouse.move(0, 0);

    // Wait a bit
    await page.waitForTimeout(100);

    // Tooltip should NOT be visible
    const tooltip = page.locator('[data-testid="tile-tooltip"]');
    await expect(tooltip).not.toBeVisible();
  });

  test('multiple blocked tiles show correct states', async ({ page }) => {
    // Check all blocked tiles have dashed border
    const blockedPaper = page.locator('[data-testid="tile-assign-blocked-paper"]');
    const blockedBat = page.locator('[data-testid="tile-assign-blocked-bat"]');
    const blockedPlates = page.locator('[data-testid="tile-assign-blocked-plates"]');

    // All should have data-is-blocked="true"
    await expect(blockedPaper).toHaveAttribute('data-is-blocked', 'true');
    await expect(blockedBat).toHaveAttribute('data-is-blocked', 'true');
    await expect(blockedPlates).toHaveAttribute('data-is-blocked', 'true');

    // All should have dashed border
    for (const tile of [blockedPaper, blockedBat, blockedPlates]) {
      const borderStyle = await tile.evaluate((el) => {
        return window.getComputedStyle(el).borderLeftStyle;
      });
      expect(borderStyle).toBe('dashed');
    }
  });
});
