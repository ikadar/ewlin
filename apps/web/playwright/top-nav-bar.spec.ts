/**
 * Playwright Top Navigation Bar Tests
 *
 * Tests for v0.3.34: Top Navigation Bar
 * Quick Placement toggle and Zoom control functionality.
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.3.34: Top Navigation Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.describe('TopNavBar visibility', () => {
    test('displays the navigation bar at top of page', async ({ page }) => {
      const navBar = page.locator('[data-testid="top-nav-bar"]');
      await expect(navBar).toBeVisible();
    });

    test('displays the logo', async ({ page }) => {
      const logo = page.locator('[data-testid="nav-logo"]');
      await expect(logo).toBeVisible();
      await expect(logo).toHaveText('Flux');
    });

    test('displays Quick Placement button', async ({ page }) => {
      const button = page.locator('[data-testid="quick-placement-button"]');
      await expect(button).toBeVisible();
    });

    test('displays zoom control', async ({ page }) => {
      const zoomControl = page.locator('[data-testid="zoom-control"]');
      await expect(zoomControl).toBeVisible();
    });
  });

  test.describe('Quick Placement button', () => {
    test('is disabled when no job is selected', async ({ page }) => {
      // Click empty area to ensure no job is selected
      await page.locator('[data-testid="scheduling-grid"]').click({ position: { x: 50, y: 300 } });
      await page.waitForTimeout(100);

      const button = page.locator('[data-testid="quick-placement-button"]');
      await expect(button).toBeDisabled();
    });

    test('is enabled when a job is selected', async ({ page }) => {
      // Select a job
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      await jobCard.click();
      await page.waitForTimeout(100);

      const button = page.locator('[data-testid="quick-placement-button"]');
      await expect(button).not.toBeDisabled();
    });

    test('toggles Quick Placement mode when clicked', async ({ page }) => {
      // Select a job first
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      await jobCard.click();
      await page.waitForTimeout(100);

      const button = page.locator('[data-testid="quick-placement-button"]');

      // Click to enable
      await button.click();
      await page.waitForTimeout(100);

      // Check that button shows active state (has emerald color)
      await expect(button).toHaveClass(/bg-emerald-500/);

      // Click to disable
      await button.click();
      await page.waitForTimeout(100);

      // Check that button shows inactive state
      await expect(button).not.toHaveClass(/bg-emerald-500/);
    });
  });

  test.describe('Zoom control', () => {
    test('displays 100% as default zoom level', async ({ page }) => {
      const zoomLevel = page.locator('[data-testid="zoom-level"]');
      await expect(zoomLevel).toHaveText('100%');
    });

    test('zoom out decreases zoom level', async ({ page }) => {
      const zoomOutButton = page.locator('[data-testid="zoom-out-button"]');
      const zoomLevel = page.locator('[data-testid="zoom-level"]');

      await zoomOutButton.click();
      await page.waitForTimeout(100);

      await expect(zoomLevel).toHaveText('75%');

      await zoomOutButton.click();
      await page.waitForTimeout(100);

      await expect(zoomLevel).toHaveText('50%');
    });

    test('zoom in increases zoom level', async ({ page }) => {
      const zoomInButton = page.locator('[data-testid="zoom-in-button"]');
      const zoomLevel = page.locator('[data-testid="zoom-level"]');

      await zoomInButton.click();
      await page.waitForTimeout(100);

      await expect(zoomLevel).toHaveText('150%');

      await zoomInButton.click();
      await page.waitForTimeout(100);

      await expect(zoomLevel).toHaveText('200%');
    });

    test('zoom out button is disabled at minimum zoom', async ({ page }) => {
      const zoomOutButton = page.locator('[data-testid="zoom-out-button"]');

      // Zoom out to minimum (50%)
      await zoomOutButton.click();
      await zoomOutButton.click();

      await expect(zoomOutButton).toBeDisabled();
    });

    test('zoom in button is disabled at maximum zoom', async ({ page }) => {
      const zoomInButton = page.locator('[data-testid="zoom-in-button"]');

      // Zoom in to maximum (200%)
      await zoomInButton.click();
      await zoomInButton.click();

      await expect(zoomInButton).toBeDisabled();
    });

    test('zoom changes affect tile height', async ({ page }) => {
      // Find a tile and get its initial height
      const tile = page.locator('[data-testid^="tile-"]').first();
      const initialHeight = await tile.evaluate((el) => el.getBoundingClientRect().height);

      // Zoom in
      const zoomInButton = page.locator('[data-testid="zoom-in-button"]');
      await zoomInButton.click();
      await page.waitForTimeout(200);

      // Check tile height increased
      const newHeight = await tile.evaluate((el) => el.getBoundingClientRect().height);
      expect(newHeight).toBeGreaterThan(initialHeight);
    });

    test('zoom changes affect grid height', async ({ page }) => {
      // Get initial grid height
      const grid = page.locator('[data-testid="scheduling-grid"]');
      const initialScrollHeight = await grid.evaluate((el) => el.scrollHeight);

      // Zoom in
      const zoomInButton = page.locator('[data-testid="zoom-in-button"]');
      await zoomInButton.click();
      await page.waitForTimeout(200);

      // Check grid scroll height increased
      const newScrollHeight = await grid.evaluate((el) => el.scrollHeight);
      expect(newScrollHeight).toBeGreaterThan(initialScrollHeight);
    });
  });

  test.describe('Keyboard shortcuts still work', () => {
    test('Alt+Q still toggles Quick Placement mode', async ({ page }) => {
      // Select a job first
      const jobCard = page.locator('[data-testid^="job-card-"]').first();
      await jobCard.click();
      await page.waitForTimeout(100);

      const button = page.locator('[data-testid="quick-placement-button"]');

      // Press Alt+Q
      await page.keyboard.press('Alt+KeyQ');
      await page.waitForTimeout(100);

      // Check that button shows active state
      await expect(button).toHaveClass(/bg-emerald-500/);

      // Press Alt+Q again
      await page.keyboard.press('Alt+KeyQ');
      await page.waitForTimeout(100);

      // Check that button shows inactive state
      await expect(button).not.toHaveClass(/bg-emerald-500/);
    });
  });
});
