/**
 * E2E Tests: Forme Status & Date Tracking
 * v0.4.32c
 *
 * Tests:
 * - Forme dropdown visibility based on die-cutting tasks
 * - Date display in DD/MM/YYYY format
 * - Tooltip includes Forme status
 */

import { test, expect } from '@playwright/test';

test.describe('Forme Status & Date Tracking', () => {
  test.beforeEach(async ({ page }) => {
    // Load the forme-date-tracking fixture
    await page.goto('/?fixture=forme-date-tracking');
    // Wait for grid to render
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test.describe('Forme Dropdown Visibility', () => {
    test('shows Forme dropdown for die-cutting elements', async ({ page }) => {
      // Click on the die-cutting job in the sidebar
      const jobCard = page.locator('[data-testid="job-card-job-forme"]');
      await expect(jobCard).toBeVisible();
      await jobCard.click();

      // Wait for Job Details Panel to appear
      await page.waitForSelector('[data-testid="job-details-panel"]');

      // Check that Forme dropdown is visible
      const formeDropdown = page.locator('[data-testid="prerequisite-forme-dropdown"]');
      await expect(formeDropdown).toBeVisible();

      // Verify it shows the current status (Commandée)
      await expect(formeDropdown).toContainText('Commandée');
    });

    test('hides Forme dropdown for non-die-cutting elements', async ({ page }) => {
      // Click on the non-die-cutting job in the sidebar
      const jobCard = page.locator('[data-testid="job-card-job-no-forme"]');
      await expect(jobCard).toBeVisible();
      await jobCard.click();

      // Wait for Job Details Panel to appear
      await page.waitForSelector('[data-testid="job-details-panel"]');

      // Check that Forme dropdown is NOT visible
      const formeDropdown = page.locator('[data-testid="prerequisite-forme-dropdown"]');
      await expect(formeDropdown).not.toBeVisible();

      // But Paper and BAT dropdowns should still be visible
      await expect(page.locator('[data-testid="prerequisite-paper-dropdown"]')).toBeVisible();
      await expect(page.locator('[data-testid="prerequisite-bat-dropdown"]')).toBeVisible();
    });
  });

  test.describe('Date Display', () => {
    test('displays date next to status in DD/MM/YYYY format', async ({ page }) => {
      // Click on the die-cutting job in the sidebar
      const jobCard = page.locator('[data-testid="job-card-job-forme"]');
      await expect(jobCard).toBeVisible();
      await jobCard.click();

      // Wait for Job Details Panel to appear
      await page.waitForSelector('[data-testid="job-details-panel"]');

      // Check that Paper dropdown shows a date (format: DD/MM/YYYY)
      const paperDate = page.locator('[data-testid="prerequisite-paper-date"]');
      await expect(paperDate).toBeVisible();
      // Verify date format (DD/MM/YYYY)
      const paperDateText = await paperDate.textContent();
      expect(paperDateText).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

      // Check that Forme dropdown shows a date
      const formeDate = page.locator('[data-testid="prerequisite-forme-date"]');
      await expect(formeDate).toBeVisible();
      const formeDateText = await formeDate.textContent();
      expect(formeDateText).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    test('BAT approved date is displayed', async ({ page }) => {
      // Click on the die-cutting job in the sidebar
      const jobCard = page.locator('[data-testid="job-card-job-forme"]');
      await expect(jobCard).toBeVisible();
      await jobCard.click();

      // Wait for Job Details Panel to appear
      await page.waitForSelector('[data-testid="job-details-panel"]');

      // Check that BAT dropdown shows a date
      const batDate = page.locator('[data-testid="prerequisite-bat-date"]');
      await expect(batDate).toBeVisible();
      const batDateText = await batDate.textContent();
      expect(batDateText).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
  });

  test.describe('Forme Dropdown Options', () => {
    test('shows all Forme status options in French', async ({ page }) => {
      // Click on the die-cutting job in the sidebar
      const jobCard = page.locator('[data-testid="job-card-job-forme"]');
      await expect(jobCard).toBeVisible();
      await jobCard.click();

      // Wait for Job Details Panel
      await page.waitForSelector('[data-testid="job-details-panel"]');

      // Open Forme dropdown
      await page.locator('[data-testid="prerequisite-forme-dropdown"]').click();

      // Wait for options to appear
      await page.waitForSelector('[data-testid="prerequisite-forme-options"]');

      // Check all French labels are present
      await expect(page.locator('[data-testid="prerequisite-forme-option-none"]')).toContainText('Pas de forme');
      await expect(page.locator('[data-testid="prerequisite-forme-option-in_stock"]')).toContainText('Sur stock');
      await expect(page.locator('[data-testid="prerequisite-forme-option-to_order"]')).toContainText('À commander');
      await expect(page.locator('[data-testid="prerequisite-forme-option-ordered"]')).toContainText('Commandée');
      await expect(page.locator('[data-testid="prerequisite-forme-option-delivered"]')).toContainText('Livrée');
    });
  });

  test.describe('Blocking Visual with Forme', () => {
    test('blocked tile with forme shows dashed border', async ({ page }) => {
      // The forme job has formeStatus: 'ordered' which is blocking
      // The die-cutting task tile should show dashed border
      const blockedTile = page.locator('[data-testid="tile-assign-forme-cut"]');
      await expect(blockedTile).toBeVisible();

      // Check that tile has data-is-blocked attribute
      await expect(blockedTile).toHaveAttribute('data-is-blocked', 'true');

      // Verify dashed border style
      const borderStyle = await blockedTile.evaluate((el) => {
        return window.getComputedStyle(el).borderLeftStyle;
      });
      expect(borderStyle).toBe('dashed');
    });

    test('tooltip shows Forme status for blocked element', async ({ page }) => {
      // Find the blocked tile
      const blockedTile = page.locator('[data-testid="tile-assign-forme-cut"]');
      await expect(blockedTile).toBeVisible();

      // Hover over the tile for 2+ seconds to trigger tooltip
      await blockedTile.hover();
      await page.waitForTimeout(2500);

      // Check tooltip appears with Forme status
      const tooltip = page.locator('[data-testid="prerequisite-tooltip"]');
      await expect(tooltip).toBeVisible();

      // Tooltip should show Forme with warning icon (blocking)
      await expect(tooltip).toContainText('Forme');
      await expect(tooltip).toContainText('Commandée');

      // Should have warning icon for Forme (blocking)
      const warningIcons = tooltip.locator('text=⚠');
      await expect(warningIcons.first()).toBeVisible();
    });
  });
});
