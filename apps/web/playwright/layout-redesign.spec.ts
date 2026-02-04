/**
 * E2E Tests for v0.3.43 - Layout Redesign & Zoom
 * Tests for REQ-07.1, REQ-07.2, REQ-07.3, REQ-08
 */

import { test, expect } from '@playwright/test';

test.describe('v0.3.43 - Layout Redesign & Zoom', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=layout-redesign');
    // Wait for the grid to be visible
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test.describe('REQ-07.1: Sidebar full viewport height', () => {
    test('sidebar spans from top to bottom of viewport', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      // Get sidebar bounding box and viewport size
      const sidebarBox = await sidebar.boundingBox();
      const viewportSize = page.viewportSize();

      expect(sidebarBox).not.toBeNull();
      expect(viewportSize).not.toBeNull();

      if (sidebarBox && viewportSize) {
        // Sidebar should start at top (y = 0)
        expect(sidebarBox.y).toBe(0);

        // Sidebar height should equal viewport height
        expect(sidebarBox.height).toBe(viewportSize.height);
      }
    });

    test('sidebar appears before top nav bar visually', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      const topNavBar = page.locator('[data-testid="top-nav-bar"]');

      const sidebarBox = await sidebar.boundingBox();
      const navBarBox = await topNavBar.boundingBox();

      expect(sidebarBox).not.toBeNull();
      expect(navBarBox).not.toBeNull();

      if (sidebarBox && navBarBox) {
        // Sidebar should be to the left of nav bar
        expect(sidebarBox.x).toBeLessThan(navBarBox.x);

        // Nav bar should start after sidebar width
        expect(navBarBox.x).toBeGreaterThanOrEqual(sidebarBox.width);
      }
    });
  });

  test.describe('REQ-07.2: Flux logo removed', () => {
    test('Flux logo is not visible in toolbar', async ({ page }) => {
      // The logo element should not exist
      const logo = page.locator('[data-testid="nav-logo"]');
      await expect(logo).not.toBeVisible();

      // Also check that "Flux" text is not present in the nav bar
      const navBar = page.locator('[data-testid="top-nav-bar"]');
      const navBarText = await navBar.textContent();
      expect(navBarText).not.toContain('Flux');
    });
  });

  test.describe('REQ-07.3: User/Settings icons in sidebar', () => {
    test('Settings icon is visible in sidebar', async ({ page }) => {
      const settingsButton = page.locator('[data-testid="sidebar-settings-button"]');
      await expect(settingsButton).toBeVisible();
    });

    test('User icon is visible in sidebar', async ({ page }) => {
      const userButton = page.locator('[data-testid="sidebar-user-button"]');
      await expect(userButton).toBeVisible();
    });

    test('User/Settings icons are at the bottom of sidebar', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      const settingsButton = page.locator('[data-testid="sidebar-settings-button"]');
      const userButton = page.locator('[data-testid="sidebar-user-button"]');

      const sidebarBox = await sidebar.boundingBox();
      const settingsBox = await settingsButton.boundingBox();
      const userBox = await userButton.boundingBox();

      expect(sidebarBox).not.toBeNull();
      expect(settingsBox).not.toBeNull();
      expect(userBox).not.toBeNull();

      if (sidebarBox && settingsBox && userBox) {
        // Settings and User buttons should be in bottom half of sidebar
        const sidebarMidpoint = sidebarBox.y + sidebarBox.height / 2;
        expect(settingsBox.y).toBeGreaterThan(sidebarMidpoint);
        expect(userBox.y).toBeGreaterThan(sidebarMidpoint);
      }
    });

    test('User/Settings icons are not in top nav bar', async ({ page }) => {
      // Old test IDs should not exist
      const userButton = page.locator('[data-testid="user-button"]');
      const settingsButton = page.locator('[data-testid="settings-button"]');

      await expect(userButton).not.toBeVisible();
      await expect(settingsButton).not.toBeVisible();
    });
  });

  test.describe('REQ-08: Zoom levels', () => {
    // v0.4.29: All zoom levels scaled to 80% for UI Scale Harmonization
    test('all 6 zoom levels are accessible', async ({ page }) => {
      const zoomControl = page.locator('[data-testid="zoom-control"]');
      await expect(zoomControl).toBeVisible();

      const zoomOutButton = page.locator('[data-testid="zoom-out-button"]');
      const zoomInButton = page.locator('[data-testid="zoom-in-button"]');
      const zoomLevel = page.locator('[data-testid="zoom-level"]');

      // Start by zooming all the way out
      while (!(await zoomOutButton.isDisabled())) {
        await zoomOutButton.click();
        await page.waitForTimeout(100);
      }

      // Should be at minimum (25%)
      await expect(zoomLevel).toHaveText('25%');

      // Collect all zoom levels by zooming in
      const zoomLevels: string[] = [];
      zoomLevels.push(await zoomLevel.textContent() || '');

      while (!(await zoomInButton.isDisabled())) {
        await zoomInButton.click();
        await page.waitForTimeout(100);
        const level = await zoomLevel.textContent();
        if (level && !zoomLevels.includes(level)) {
          zoomLevels.push(level);
        }
      }

      // Verify all 6 zoom levels
      expect(zoomLevels).toContain('25%');
      expect(zoomLevels).toContain('50%');
      expect(zoomLevels).toContain('75%');
      expect(zoomLevels).toContain('100%');
      expect(zoomLevels).toContain('150%');
      expect(zoomLevels).toContain('200%');
      expect(zoomLevels).toHaveLength(6);
    });

    test('25% zoom level shows more compact grid', async ({ page }) => {
      const zoomOutButton = page.locator('[data-testid="zoom-out-button"]');
      const zoomLevel = page.locator('[data-testid="zoom-level"]');

      // Zoom all the way out to 25%
      while (!(await zoomOutButton.isDisabled())) {
        await zoomOutButton.click();
        await page.waitForTimeout(100);
      }

      await expect(zoomLevel).toHaveText('25%');

      // Grid should still be visible at 25% zoom
      const grid = page.locator('[data-testid="scheduling-grid"]');
      await expect(grid).toBeVisible();
    });
  });
});
