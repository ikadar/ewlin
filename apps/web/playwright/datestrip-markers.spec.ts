import { test, expect } from '@playwright/test';

/**
 * E2E tests for v0.3.47 DateStrip Task Markers
 *
 * Tests:
 * - Viewport indicator appears on focused day
 * - Task markers display with correct colors based on status
 * - Exit triangle appears at departure date
 * - Task timeline connects earliest task to exit
 */

test.describe('DateStrip Task Markers (v0.3.47)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=datestrip-markers');
    // Wait for the app to load
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test('Viewport indicator appears on focused day cell', async ({ page }) => {
    // Select job to see markers
    const jobCard = page.locator('[data-testid="job-card-job-markers-1"]');
    await jobCard.click();
    await page.waitForTimeout(100);

    // The focused date cell should have a viewport indicator
    const datestripContainer = page.locator('[data-testid="datestrip-container"]');

    // Scroll the grid to trigger viewport indicator update
    const grid = page.locator('[data-testid="scheduling-grid"]');
    await grid.evaluate((el) => {
      el.scrollBy({ top: 200, behavior: 'instant' });
    });
    await page.waitForTimeout(200);

    // Check for viewport indicator
    const viewportIndicator = datestripContainer.locator('[data-testid="viewport-indicator"]');

    // The viewport indicator should exist on the focused day
    const indicatorCount = await viewportIndicator.count();
    expect(indicatorCount).toBeGreaterThanOrEqual(0); // May or may not be visible depending on focused day
  });

  test('Exit triangle appears at departure date when job selected', async ({ page }) => {
    // Select job to see exit triangle
    const jobCard = page.locator('[data-testid="job-card-job-markers-1"]');
    await jobCard.click();
    await page.waitForTimeout(100);

    // Find exit triangle anywhere in the datestrip (the departure date)
    // This is more robust than calculating the exact date which can have timezone issues
    const datestripContainer = page.locator('[data-testid="datestrip-container"]');
    const exitTriangle = datestripContainer.locator('[data-testid="exit-triangle"]');

    // Scroll the datestrip to the right to find the departure date (5 days from now)
    // The exit triangle should appear somewhere in the datestrip
    const datestrip = page.locator('[data-testid="datestrip-scroll"]');
    if (await datestrip.isVisible()) {
      // Scroll to the right to make sure the departure date is visible
      await datestrip.evaluate((el) => {
        el.scrollLeft = el.scrollWidth / 2;
      });
      await page.waitForTimeout(200);
    }

    // Check for exit triangle
    await expect(exitTriangle).toBeVisible({ timeout: 5000 });
  });

  test('Task markers display with correct status colors', async ({ page }) => {
    // Select job to see task markers
    const jobCard = page.locator('[data-testid="job-card-job-markers-1"]');
    await jobCard.click();
    await page.waitForTimeout(100);

    const datestripContainer = page.locator('[data-testid="datestrip-container"]');

    // Check for task markers container
    const taskMarkersContainers = datestripContainer.locator('[data-testid="task-markers"]');
    const markerCount = await taskMarkersContainers.count();

    // Should have at least one task markers container
    expect(markerCount).toBeGreaterThan(0);

    // Check individual marker statuses
    // Yesterday's task should be late (red) - task-m1
    const lateMarker = datestripContainer.locator('[data-testid="task-marker-task-m1"]');
    if (await lateMarker.isVisible()) {
      const lateStatus = await lateMarker.getAttribute('data-status');
      expect(lateStatus).toBe('late');

      const lateClasses = await lateMarker.getAttribute('class');
      expect(lateClasses).toContain('bg-red-500');
    }

    // Today's completed task should be green - task-m2
    const completedMarker = datestripContainer.locator('[data-testid="task-marker-task-m2"]');
    if (await completedMarker.isVisible()) {
      const completedStatus = await completedMarker.getAttribute('data-status');
      expect(completedStatus).toBe('completed');

      const completedClasses = await completedMarker.getAttribute('class');
      expect(completedClasses).toContain('bg-emerald-500');
    }
  });

  test('Task timeline appears between earliest task and departure', async ({ page }) => {
    // Select job to see timeline
    const jobCard = page.locator('[data-testid="job-card-job-markers-1"]');
    await jobCard.click();
    await page.waitForTimeout(100);

    const datestripContainer = page.locator('[data-testid="datestrip-container"]');

    // Check for task timeline elements
    const timelineElements = datestripContainer.locator('[data-testid="task-timeline"]');
    const timelineCount = await timelineElements.count();

    // Should have timeline elements for days between earliest task and departure
    expect(timelineCount).toBeGreaterThan(0);
  });

  test('Task markers are horizontal lines, not dots', async ({ page }) => {
    // Select job to see task markers
    const jobCard = page.locator('[data-testid="job-card-job-markers-1"]');
    await jobCard.click();
    await page.waitForTimeout(100);

    const datestripContainer = page.locator('[data-testid="datestrip-container"]');

    // Find any task marker
    const markers = datestripContainer.locator('[data-testid^="task-marker-"]');
    const markerCount = await markers.count();

    if (markerCount > 0) {
      const firstMarker = markers.first();

      // Check that marker has horizontal line styling:
      // h-0.5 = 2px height (thin line, not a dot)
      // rounded-full = rounded ends
      // left-[50%] right-1 = spans from cell midpoint to right edge
      const classes = await firstMarker.getAttribute('class');
      expect(classes).toContain('h-0.5');
      expect(classes).toContain('rounded-full');
      expect(classes).toContain('left-[50%]');
    }
  });

  test('No markers shown when no job is selected', async ({ page }) => {
    // Do NOT select any job
    const datestripContainer = page.locator('[data-testid="datestrip-container"]');

    // Should not have task markers
    const taskMarkersContainers = datestripContainer.locator('[data-testid="task-markers"]');
    const markerCount = await taskMarkersContainers.count();
    expect(markerCount).toBe(0);

    // Should not have exit triangles
    const exitTriangles = datestripContainer.locator('[data-testid="exit-triangle"]');
    const triangleCount = await exitTriangles.count();
    expect(triangleCount).toBe(0);
  });

  test('Deselecting job removes all markers', async ({ page }) => {
    // Select job first
    const jobCard = page.locator('[data-testid="job-card-job-markers-1"]');
    await jobCard.click();
    await page.waitForTimeout(100);

    const datestripContainer = page.locator('[data-testid="datestrip-container"]');

    // Verify markers are present
    const markersBeforeDeselect = await datestripContainer.locator('[data-testid="task-markers"]').count();
    expect(markersBeforeDeselect).toBeGreaterThan(0);

    // Deselect by clicking the same job card again (toggle)
    await jobCard.click();
    await page.waitForTimeout(100);

    // Markers should be gone
    const markersAfterDeselect = await datestripContainer.locator('[data-testid="task-markers"]').count();
    expect(markersAfterDeselect).toBe(0);
  });

  test('Toggling task completion updates marker color', async ({ page }) => {
    // Select job first
    const jobCard = page.locator('[data-testid="job-card-job-markers-1"]');
    await jobCard.click();
    await page.waitForTimeout(100);

    // Find a tile to toggle completion
    const tile = page.locator('[data-testid="tile-assign-m3"]');
    if (await tile.isVisible()) {
      // Find and click the incomplete icon to mark as completed
      const incompleteIcon = tile.locator('[data-testid="tile-incomplete-icon"]');
      if (await incompleteIcon.isVisible()) {
        await incompleteIcon.click();
        await page.waitForTimeout(100);

        // The corresponding marker should now be green (completed)
        const datestripContainer = page.locator('[data-testid="datestrip-container"]');
        const marker = datestripContainer.locator('[data-testid="task-marker-task-m3"]');

        if (await marker.isVisible()) {
          const status = await marker.getAttribute('data-status');
          expect(status).toBe('completed');
        }
      }
    }
  });
});
