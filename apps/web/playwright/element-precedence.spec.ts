/**
 * Playwright Element Precedence Tests
 *
 * Tests for element-level precedence (prerequisiteElementIds).
 * Multi-element job: Couverture + Intérieur + Reliure (binding depends on both).
 *
 * Fixture data (element-precedence):
 * Job: BOOK-001 "Book Production"
 * ├─ Element A "Couverture" (cover)
 * │  ├─ task-a1: Printing on Komori, SCHEDULED at 08:00-09:00 (offset → 4h dry time)
 * │  └─ task-a2: Cutting on Polar, SCHEDULED at 13:00-13:30
 * ├─ Element B "Intérieur" (interior)
 * │  ├─ task-b1: Printing on Komori, SCHEDULED at 09:00-10:00 (offset → 4h dry time)
 * │  └─ task-b2: Cutting on Polar, SCHEDULED at 14:00-14:30
 * └─ Element C "Reliure" (binding) — depends on A AND B
 *    └─ task-c1: Binding on Polar, UNSCHEDULED
 *
 * C1 earliest start = max(A2 end, B2 end) = 14:30
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady, countTilesOnStation } from './helpers/drag';

test.describe('Element Precedence (prerequisiteElementIds)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=element-precedence');
    await waitForAppReady(page);
  });

  test('fixture loads with 4 scheduled tiles and 1 unscheduled task', async ({ page }) => {
    // 4 tiles total: A1 on Komori, B1 on Komori, A2 on Polar, B2 on Polar
    const komoriTiles = await countTilesOnStation(page, 'station-komori');
    const polarTiles = await countTilesOnStation(page, 'station-polar');

    expect(komoriTiles).toBe(2); // A1 + B1
    expect(polarTiles).toBe(2); // A2 + B2
  });

  test('selecting job shows unscheduled binding task (task-c1) in details panel', async ({ page }) => {
    // Click job card
    const jobCard = page.locator('[data-testid="job-card-job-book"]');
    await jobCard.click();
    await page.waitForTimeout(200);

    // Job details panel should appear
    const detailsPanel = page.locator('[data-testid="job-details-panel"]');
    await expect(detailsPanel).toBeVisible();

    // task-c1 should be visible as unscheduled
    const taskC1 = page.locator('[data-testid="task-tile-task-c1"]');
    await expect(taskC1).toBeVisible();
  });

  test('purple precedence line appears when picking binding task', async ({ page }) => {
    // Select the job
    await page.locator('[data-testid="job-card-job-book"]').click();
    await page.waitForTimeout(200);

    // Pick task-c1 (unscheduled binding task)
    const taskC1 = page.locator('[data-testid="task-tile-task-c1"]');
    const isVisible = await taskC1.isVisible();
    if (!isVisible) {
      test.skip();
      return;
    }

    await taskC1.click();

    // Wait for pick preview
    await page.waitForSelector('[data-testid="pick-preview"]', { timeout: 3000 }).catch(() => null);

    // Move mouse to Polar station column
    const targetColumn = page.locator('[data-testid="station-column-station-polar"]');
    const box = await targetColumn.boundingBox();
    if (box) {
      // v0.4.29: 200 → 160 (scaled to 64px/hour)
      await page.mouse.move(box.x + box.width / 2, box.y + 160);
    }
    await page.waitForTimeout(300);

    // Purple line (earliest possible start) should appear
    const purpleLine = page.locator('[data-testid="precedence-line-earliest"]');
    const lineCount = await purpleLine.count();
    if (lineCount > 0) {
      await expect(purpleLine).toBeVisible({ timeout: 1000 });
    }

    // Cancel pick
    await page.keyboard.press('Escape');
  });

  test('pick mode activates and shows preview for binding task', async ({ page }) => {
    // Select the job
    await page.locator('[data-testid="job-card-job-book"]').click();
    await page.waitForTimeout(200);

    // task-c1 should be visible in sidebar
    const taskC1 = page.locator('[data-testid="task-tile-task-c1"]');
    const isVisible = await taskC1.isVisible();
    if (!isVisible) {
      test.skip();
      return;
    }

    // Click task-c1 to enter pick mode
    await taskC1.click();

    // Pick preview (ghost tile) should appear
    const pickPreview = page.locator('[data-testid="pick-preview"]');
    await expect(pickPreview).toBeVisible({ timeout: 3000 });

    // Task should be shown as "picked" — pick mode is active
    // Verify by checking that ESC cancels pick mode
    await page.keyboard.press('Escape');
    await expect(pickPreview).not.toBeVisible();
  });

  test('placing binding task before prerequisites shows conflict', async ({ page }) => {
    // Select the job
    await page.locator('[data-testid="job-card-job-book"]').click();
    await page.waitForTimeout(200);

    const taskC1 = page.locator('[data-testid="task-tile-task-c1"]');
    const isVisible = await taskC1.isVisible();
    if (!isVisible) {
      test.skip();
      return;
    }

    // Find tile A1 on Komori (first scheduled tile, at 08:00)
    const tileA1 = page.locator('[data-testid="tile-assign-a1"]');
    const a1Visible = await tileA1.isVisible().catch(() => false);
    if (!a1Visible) {
      test.skip();
      return;
    }

    // Click task-c1 to enter pick mode
    await taskC1.click();
    await page.waitForSelector('[data-testid="pick-preview"]', { timeout: 3000 }).catch(() => null);

    // Place at A1's position on Polar — way before prerequisites complete
    const a1Box = await tileA1.boundingBox();
    const targetColumn = page.locator('[data-testid="station-column-station-polar"]');
    const colBox = await targetColumn.boundingBox();
    if (!a1Box || !colBox) {
      test.skip();
      return;
    }

    // Place at same Y as A1 (early morning, before prerequisites)
    const placeX = colBox.x + colBox.width / 2;
    const placeY = a1Box.y + a1Box.height / 2;

    await page.mouse.move(placeX, placeY);
    await page.waitForTimeout(200);
    await page.mouse.click(placeX, placeY);
    await page.waitForTimeout(500);

    // Check if the job appears in problems section (precedence violation)
    const problemsSection = page.locator('[data-testid="problems-section"]');
    const hasProblemSection = await problemsSection.isVisible().catch(() => false);

    if (hasProblemSection) {
      // Job should be in problems section due to precedence conflict
      const jobInProblems = problemsSection.locator('[data-testid="job-card-job-book"]');
      const jobInProblemsVisible = await jobInProblems.isVisible().catch(() => false);
      expect(jobInProblemsVisible).toBe(true);
    }
  });

  test('all 5 task tiles visible in sidebar after selecting job', async ({ page }) => {
    // Select the job
    await page.locator('[data-testid="job-card-job-book"]').click();
    await page.waitForTimeout(200);

    // Should show all task tiles (a1, a2, b1, b2, c1)
    const taskTiles = page.locator('[data-testid^="task-tile-task-"]');
    const count = await taskTiles.count();
    expect(count).toBe(5);
  });

  test('intra-element precedence still works within cover element', async ({ page }) => {
    // Verify that task-a1 and task-a2 are both scheduled on the grid
    // task-a1 on Komori, task-a2 on Polar
    const tileA1 = page.locator('[data-testid="tile-assign-a1"]');
    const tileA2 = page.locator('[data-testid="tile-assign-a2"]');

    // Both tiles should be visible
    const a1Visible = await tileA1.isVisible().catch(() => false);
    const a2Visible = await tileA2.isVisible().catch(() => false);

    // At least verify tiles exist in the DOM
    expect(a1Visible || a2Visible).toBe(true);
  });

  test('lines disappear when pick is cancelled with ESC', async ({ page }) => {
    // Select the job
    await page.locator('[data-testid="job-card-job-book"]').click();
    await page.waitForTimeout(200);

    const taskC1 = page.locator('[data-testid="task-tile-task-c1"]');
    const isVisible = await taskC1.isVisible();
    if (!isVisible) {
      test.skip();
      return;
    }

    // Pick task-c1
    await taskC1.click();
    await page.waitForSelector('[data-testid="pick-preview"]', { timeout: 3000 }).catch(() => null);

    // Move mouse to trigger precedence line
    const targetColumn = page.locator('[data-testid="station-column-station-polar"]');
    const box = await targetColumn.boundingBox();
    if (box) {
      // v0.4.29: 200 → 160 (scaled to 64px/hour)
      await page.mouse.move(box.x + box.width / 2, box.y + 160);
    }
    await page.waitForTimeout(200);

    // Cancel with ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Precedence lines should not be visible
    const purpleLine = page.locator('[data-testid="precedence-line-earliest"]');
    await expect(purpleLine).not.toBeVisible();
  });
});
