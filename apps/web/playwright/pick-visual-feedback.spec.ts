import { test, expect } from '@playwright/test';

/**
 * E2E tests for Pick Visual Feedback (v0.3.56)
 *
 * Tests global cursor behavior during pick mode via body.pick-mode-active class.
 */

test.describe('Pick Visual Feedback', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app with pick-place fixture
    await page.goto('/?fixture=pick-place');
    // Wait for the app to load
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test('should add pick-mode-active class to body during pick', async ({ page }) => {
    // Select job-pick-1 which has unscheduled tasks
    const jobCard = page.locator('[data-testid="job-card-job-pick-1"]');
    await jobCard.click();

    // Wait for Job Details Panel
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Verify body does NOT have the class before pick
    const body = page.locator('body');
    await expect(body).not.toHaveClass(/pick-mode-active/);

    // Click unscheduled task to pick
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-1b"]');
    await unscheduledTask.click();

    // Wait for pick preview to appear (confirms pick started)
    await expect(page.locator('[data-testid="pick-preview"]')).toBeVisible();

    // Body should have pick-mode-active class
    await expect(body).toHaveClass(/pick-mode-active/);
  });

  test('should remove pick-mode-active class from body when pick is cancelled with ESC', async ({ page }) => {
    // Select job-pick-1
    const jobCard = page.locator('[data-testid="job-card-job-pick-1"]');
    await jobCard.click();
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Click unscheduled task to pick
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-1b"]');
    await unscheduledTask.click();

    // Wait for pick to start
    await expect(page.locator('[data-testid="pick-preview"]')).toBeVisible();

    // Body should have pick-mode-active class
    const body = page.locator('body');
    await expect(body).toHaveClass(/pick-mode-active/);

    // Cancel with ESC
    await page.keyboard.press('Escape');

    // Ghost should disappear
    await expect(page.locator('[data-testid="pick-preview"]')).not.toBeVisible();

    // Body should NOT have pick-mode-active class anymore
    await expect(body).not.toHaveClass(/pick-mode-active/);
  });

  test('should remove pick-mode-active class when pick ends (via isPicking state)', async ({ page }) => {
    // This test verifies that the body class is properly synchronized with isPicking state
    // Successful placement is tested in pick-place-sidebar.spec.ts
    // Here we just verify the class is added/removed correctly

    // Select job-pick-1
    const jobCard = page.locator('[data-testid="job-card-job-pick-1"]');
    await jobCard.click();
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Pick a task
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-1b"]');
    await unscheduledTask.click();

    // Verify pick started - body should have class
    const body = page.locator('body');
    await expect(body).toHaveClass(/pick-mode-active/);
    await expect(page.locator('[data-testid="pick-preview"]')).toBeVisible();

    // Cancel with ESC to end pick (simulates any pick end)
    await page.keyboard.press('Escape');

    // Body should NOT have pick-mode-active class anymore
    await expect(body).not.toHaveClass(/pick-mode-active/);
  });

  test('should have grabbing cursor globally during pick mode', async ({ page }) => {
    // Select job-pick-1
    const jobCard = page.locator('[data-testid="job-card-job-pick-1"]');
    await jobCard.click();
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Pick a task
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-1b"]');
    await unscheduledTask.click();

    // Wait for pick to start
    await expect(page.locator('[data-testid="pick-preview"]')).toBeVisible();

    // Check that body has grabbing cursor via the CSS class
    // Note: We verify the class is present, which applies cursor: grabbing via CSS
    const body = page.locator('body');
    await expect(body).toHaveClass(/pick-mode-active/);

    // The CSS rule body.pick-mode-active { cursor: grabbing !important } should apply
    // We can verify the computed style
    const cursor = await body.evaluate((el) => window.getComputedStyle(el).cursor);
    expect(cursor).toBe('grabbing');
  });
});
