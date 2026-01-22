import { test, expect } from '@playwright/test';

/**
 * E2E tests for Pick & Place from Sidebar (v0.3.54)
 *
 * Tests the click-based interaction for placing unscheduled tasks from
 * the Job Details panel sidebar.
 */

test.describe('Pick & Place from Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app with pick-place fixture
    await page.goto('/?fixture=pick-place');
    // Wait for the app to load
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test('should show ghost tile when clicking unscheduled task', async ({ page }) => {
    // Select job-pick-1 which has unscheduled tasks
    const jobCard = page.locator('[data-testid="job-card-job-pick-1"]');
    await jobCard.click();

    // Wait for Job Details Panel to appear
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Find the first unscheduled task
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-1b"]');

    // Click to pick
    await unscheduledTask.click();

    // Ghost preview should appear
    const pickPreview = page.locator('[data-testid="pick-preview"]');
    await expect(pickPreview).toBeVisible();
  });

  test('should cancel pick when pressing ESC', async ({ page }) => {
    // Select job-pick-1
    const jobCard = page.locator('[data-testid="job-card-job-pick-1"]');
    await jobCard.click();
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Find and click unscheduled task
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-1b"]');
    await unscheduledTask.click();

    // Verify ghost is visible
    const pickPreview = page.locator('[data-testid="pick-preview"]');
    await expect(pickPreview).toBeVisible();

    // Press ESC to cancel
    await page.keyboard.press('Escape');

    // Ghost should disappear
    await expect(pickPreview).not.toBeVisible();
  });

  test('should show green ring on valid drop position', async ({ page }) => {
    // Select job-pick-2 which has all unscheduled tasks
    const jobCard = page.locator('[data-testid="job-card-job-pick-2"]');
    await jobCard.click();
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Find first unscheduled task (should be for station-heidelberg)
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-2a"]');
    await unscheduledTask.click();

    // Verify ghost is visible
    await expect(page.locator('[data-testid="pick-preview"]')).toBeVisible();

    // Move to the target station column (Heidelberg)
    const targetColumn = page.locator('[data-testid="station-column-station-heidelberg"]');

    // Get column bounding box and hover at a valid time position
    // Operating hours are 06:00-12:00 and 13:00-22:00
    // We hover at Y position corresponding to ~8:00 AM (within operating hours)
    const box = await targetColumn.boundingBox();
    if (box) {
      // Hover at 100px from top of column (early morning, within operating hours)
      await page.mouse.move(box.x + box.width / 2, box.y + 100);
    }

    // Column should have green ring (ring-green-500 class)
    await expect(targetColumn).toHaveClass(/ring-green-500/);
  });

  test('should allow click on target station column during pick', async ({ page }) => {
    // Select job-pick-2
    const jobCard = page.locator('[data-testid="job-card-job-pick-2"]');
    await jobCard.click();
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Pick the task (targets station-heidelberg)
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-2a"]');
    await unscheduledTask.click();

    // Verify pick started
    await expect(page.locator('[data-testid="pick-preview"]')).toBeVisible();

    // Move mouse to target station at a valid time position
    const targetColumn = page.locator('[data-testid="station-column-station-heidelberg"]');
    const box = await targetColumn.boundingBox();
    if (box) {
      // Hover at 100px from top (within operating hours)
      await page.mouse.move(box.x + box.width / 2, box.y + 100);
    }

    // Target column should have valid ring (green)
    await expect(targetColumn).toHaveClass(/ring-green-500/);

    // Non-target column should be faded (15% opacity) with pointer-events disabled
    const nonTargetColumn = page.locator('[data-testid="station-column-station-polar"]');
    await expect(nonTargetColumn).toHaveClass(/opacity-15/);
    await expect(nonTargetColumn).toHaveClass(/pointer-events-none/);
  });

  test('should show picked state styling on sidebar task', async ({ page }) => {
    // Select job-pick-1
    const jobCard = page.locator('[data-testid="job-card-job-pick-1"]');
    await jobCard.click();
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Find unscheduled task
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-1b"]');

    // Click to pick
    await unscheduledTask.click();

    // Wait for pick preview to appear (confirms pick started)
    await expect(page.locator('[data-testid="pick-preview"]')).toBeVisible();

    // Task should have picked styling - check for ring or outline class
    // The isPicked state adds visual feedback via inline styles or classes
    await expect(unscheduledTask).toHaveCSS('cursor', 'default');
  });

  test('should fade non-target columns to 15% opacity during sidebar pick', async ({ page }) => {
    // Select job-pick-2 which has task for station-heidelberg first
    const jobCard = page.locator('[data-testid="job-card-job-pick-2"]');
    await jobCard.click();
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Pick the first task (targets station-heidelberg)
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-2a"]');
    await unscheduledTask.click();

    // Non-target columns should be faded (opacity-15) with pointer-events disabled
    const nonTargetColumn = page.locator('[data-testid="station-column-station-polar"]');
    await expect(nonTargetColumn).toHaveClass(/opacity-15/);
    await expect(nonTargetColumn).toHaveClass(/pointer-events-none/);

    // Target column should NOT be faded
    const targetColumn = page.locator('[data-testid="station-column-station-heidelberg"]');
    await expect(targetColumn).not.toHaveClass(/opacity-15/);
    await expect(targetColumn).not.toHaveClass(/pointer-events-none/);
  });

  test('should restore column opacity when pick is cancelled', async ({ page }) => {
    // Select job-pick-2
    const jobCard = page.locator('[data-testid="job-card-job-pick-2"]');
    await jobCard.click();
    await page.waitForSelector('[data-testid="job-details-panel"]');

    // Pick the first task
    const unscheduledTask = page.locator('[data-testid="task-tile-task-pick-2a"]');
    await unscheduledTask.click();

    // Verify columns are faded
    const nonTargetColumn = page.locator('[data-testid="station-column-station-polar"]');
    await expect(nonTargetColumn).toHaveClass(/opacity-15/);

    // Cancel with ESC
    await page.keyboard.press('Escape');

    // Columns should return to normal opacity
    await expect(nonTargetColumn).not.toHaveClass(/opacity-15/);
    await expect(nonTargetColumn).not.toHaveClass(/pointer-events-none/);
  });
});
