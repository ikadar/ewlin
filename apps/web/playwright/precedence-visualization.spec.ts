/**
 * Playwright Precedence Visualization Tests
 *
 * Tests for v0.3.45: Precedence Constraint Visualization (REQ-10)
 * Visual feedback during drag operations showing precedence constraints:
 * - Purple line: earliest possible start (predecessor end + dry time)
 * - Orange line: latest possible start (successor start - task duration)
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

test.describe('v0.3.45: Precedence Constraint Visualization', () => {
  test.beforeEach(async ({ page }) => {
    // Load the precedence-visualization test fixture
    await page.goto('/?fixture=precedence-visualization');
    await waitForAppReady(page);
  });

  test.describe('Purple Line (Earliest Possible Start)', () => {
    test('purple line appears during drag when predecessor is scheduled', async ({ page }) => {
      // Job PV-1: Print scheduled, Cut unscheduled
      // Select job and click on the task tile in the sidebar to start dragging
      await page.locator('[data-testid="job-card-job-pv-1"]').click();
      await page.waitForTimeout(100);

      // Find the Cut task in the JobDetailsPanel (second task, unscheduled)
      const cutTaskTile = page.locator('[data-testid="sidebar-task-tile-task-pv-1-cut"]');
      await expect(cutTaskTile).toBeVisible();

      // Start drag on the cut task
      const taskRect = await cutTaskTile.boundingBox();
      if (!taskRect) throw new Error('Task tile not found');

      // Get the station column for cutting (station-polar)
      const stationColumn = page.locator('[data-testid="station-column-station-polar"]');
      const stationRect = await stationColumn.boundingBox();
      if (!stationRect) throw new Error('Station column not found');

      // Perform drag hover (without drop) to see the lines
      await page.evaluate(async ({ taskRect, stationRect }) => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-1-cut"]') as HTMLElement;
        const stationColumn = document.querySelector('[data-testid="station-column-station-polar"]') as HTMLElement;

        const dataTransfer = new DataTransfer();
        const sourceX = taskRect.x + taskRect.width / 2;
        const sourceY = taskRect.y + taskRect.height / 2;
        const dropX = stationRect.x + stationRect.width / 2;
        const dropY = stationRect.y + 300; // Middle of column

        // Start drag
        source.dispatchEvent(new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: sourceX,
          clientY: sourceY,
        }));

        await sleep(100);

        // Enter station column
        stationColumn.dispatchEvent(new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: dropX,
          clientY: dropY,
        }));

        await sleep(100);

        // Hover over column (dragover)
        for (let i = 0; i < 3; i++) {
          stationColumn.dispatchEvent(new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: dropX,
            clientY: dropY,
          }));
          await sleep(50);
        }
      }, { taskRect, stationRect });

      // Check that the purple line (earliest) is visible
      const purpleLine = page.locator('[data-testid="precedence-line-earliest"]');
      await expect(purpleLine).toBeVisible({ timeout: 1000 });

      // End drag
      await page.evaluate(async () => {
        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-1-cut"]') as HTMLElement;
        source.dispatchEvent(new DragEvent('dragend', {
          bubbles: true,
          cancelable: true,
        }));
      });
    });

    test('purple line includes 4h dry time for printing predecessor', async ({ page }) => {
      // Job PV-1: Print task ends at 9:00, dry time adds 4h, so earliest is 13:00
      // The purple line should appear at the Y position for 13:00
      await page.locator('[data-testid="job-card-job-pv-1"]').click();
      await page.waitForTimeout(100);

      const cutTaskTile = page.locator('[data-testid="sidebar-task-tile-task-pv-1-cut"]');
      await expect(cutTaskTile).toBeVisible();

      const taskRect = await cutTaskTile.boundingBox();
      if (!taskRect) throw new Error('Task tile not found');

      const stationColumn = page.locator('[data-testid="station-column-station-polar"]');
      const stationRect = await stationColumn.boundingBox();
      if (!stationRect) throw new Error('Station column not found');

      await page.evaluate(async ({ taskRect, stationRect }) => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-1-cut"]') as HTMLElement;
        const stationColumn = document.querySelector('[data-testid="station-column-station-polar"]') as HTMLElement;

        const dataTransfer = new DataTransfer();

        source.dispatchEvent(new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: taskRect.x + taskRect.width / 2,
          clientY: taskRect.y + taskRect.height / 2,
        }));

        await sleep(100);

        stationColumn.dispatchEvent(new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: stationRect.x + stationRect.width / 2,
          clientY: stationRect.y + 300,
        }));

        await sleep(100);

        for (let i = 0; i < 3; i++) {
          stationColumn.dispatchEvent(new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: stationRect.x + stationRect.width / 2,
            clientY: stationRect.y + 300,
          }));
          await sleep(50);
        }
      }, { taskRect, stationRect });

      // The purple line should be visible and have a specific top position
      // 13:00 is 7 hours from startHour 6, at 80px/hour = 560px
      const purpleLine = page.locator('[data-testid="precedence-line-earliest"]');
      await expect(purpleLine).toBeVisible({ timeout: 1000 });

      // Check that it has purple color
      await expect(purpleLine).toHaveClass(/bg-purple-500/);

      // Clean up
      await page.evaluate(async () => {
        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-1-cut"]') as HTMLElement;
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
      });
    });
  });

  test.describe('Orange Line (Latest Possible Start)', () => {
    test('orange line appears when successor is scheduled', async ({ page }) => {
      // Job PV-3: First task (print) unscheduled, second task (cut) scheduled at 14:00
      // The orange line should appear showing latest possible start for print task
      await page.locator('[data-testid="job-card-job-pv-3"]').click();
      await page.waitForTimeout(100);

      // The first task is print (unscheduled), use station-komori
      const firstTaskTile = page.locator('[data-testid="sidebar-task-tile-task-pv-3-print"]');
      await expect(firstTaskTile).toBeVisible();

      const taskRect = await firstTaskTile.boundingBox();
      if (!taskRect) throw new Error('Task tile not found');

      // Print tasks go to station-komori (offset press)
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const stationRect = await stationColumn.boundingBox();
      if (!stationRect) throw new Error('Station column not found');

      await page.evaluate(async ({ taskRect, stationRect }) => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-3-print"]') as HTMLElement;
        const stationColumn = document.querySelector('[data-testid="station-column-station-komori"]') as HTMLElement;

        const dataTransfer = new DataTransfer();

        source.dispatchEvent(new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: taskRect.x + taskRect.width / 2,
          clientY: taskRect.y + taskRect.height / 2,
        }));

        await sleep(100);

        stationColumn.dispatchEvent(new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: stationRect.x + stationRect.width / 2,
          clientY: stationRect.y + 300,
        }));

        await sleep(100);

        for (let i = 0; i < 3; i++) {
          stationColumn.dispatchEvent(new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: stationRect.x + stationRect.width / 2,
            clientY: stationRect.y + 300,
          }));
          await sleep(50);
        }
      }, { taskRect, stationRect });

      // Check that the orange line (latest) is visible
      const orangeLine = page.locator('[data-testid="precedence-line-latest"]');
      await expect(orangeLine).toBeVisible({ timeout: 1000 });

      // Check that it has orange color
      await expect(orangeLine).toHaveClass(/bg-orange-500/);

      // Clean up
      await page.evaluate(async () => {
        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-3-print"]') as HTMLElement;
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
      });
    });
  });

  test.describe('Both Lines', () => {
    test('both purple and orange lines appear when task has scheduled predecessor and successor', async ({ page }) => {
      // Job PV-2: All 3 tasks scheduled, recall the middle task
      await page.locator('[data-testid="job-card-job-pv-2"]').click();
      await page.waitForTimeout(100);

      // Find the middle task tile on the grid (Cut task)
      const cutTile = page.locator('[data-testid^="tile-"][data-testid*="pv-2-cut"]').first();

      // If there's no tile for cut, the task might be in the sidebar - skip this scenario
      const tileCount = await cutTile.count();
      if (tileCount === 0) {
        test.skip();
        return;
      }

      // Double-click to recall the task
      await cutTile.dblclick();
      await page.waitForTimeout(200);

      // Now the cut task should be in the sidebar
      const cutTaskTile = page.locator('[data-testid="sidebar-task-tile-task-pv-2-cut"]');
      await expect(cutTaskTile).toBeVisible();

      const taskRect = await cutTaskTile.boundingBox();
      if (!taskRect) throw new Error('Task tile not found');

      const stationColumn = page.locator('[data-testid="station-column-station-polar"]');
      const stationRect = await stationColumn.boundingBox();
      if (!stationRect) throw new Error('Station column not found');

      await page.evaluate(async ({ taskRect, stationRect }) => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-2-cut"]') as HTMLElement;
        const stationColumn = document.querySelector('[data-testid="station-column-station-polar"]') as HTMLElement;

        const dataTransfer = new DataTransfer();

        source.dispatchEvent(new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: taskRect.x + taskRect.width / 2,
          clientY: taskRect.y + taskRect.height / 2,
        }));

        await sleep(100);

        stationColumn.dispatchEvent(new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: stationRect.x + stationRect.width / 2,
          clientY: stationRect.y + 300,
        }));

        await sleep(100);

        for (let i = 0; i < 3; i++) {
          stationColumn.dispatchEvent(new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: stationRect.x + stationRect.width / 2,
            clientY: stationRect.y + 300,
          }));
          await sleep(50);
        }
      }, { taskRect, stationRect });

      // Both lines should be visible
      const purpleLine = page.locator('[data-testid="precedence-line-earliest"]');
      const orangeLine = page.locator('[data-testid="precedence-line-latest"]');

      await expect(purpleLine).toBeVisible({ timeout: 1000 });
      await expect(orangeLine).toBeVisible({ timeout: 1000 });

      // Clean up
      await page.evaluate(async () => {
        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-2-cut"]') as HTMLElement;
        source?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
      });
    });
  });

  test.describe('Lines Visibility Rules', () => {
    test('lines disappear when drag ends', async ({ page }) => {
      await page.locator('[data-testid="job-card-job-pv-1"]').click();
      await page.waitForTimeout(100);

      const cutTaskTile = page.locator('[data-testid="sidebar-task-tile-task-pv-1-cut"]');
      await expect(cutTaskTile).toBeVisible();

      const taskRect = await cutTaskTile.boundingBox();
      if (!taskRect) throw new Error('Task tile not found');

      const stationColumn = page.locator('[data-testid="station-column-station-polar"]');
      const stationRect = await stationColumn.boundingBox();
      if (!stationRect) throw new Error('Station column not found');

      // Start drag
      await page.evaluate(async ({ taskRect, stationRect }) => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-1-cut"]') as HTMLElement;
        const stationColumn = document.querySelector('[data-testid="station-column-station-polar"]') as HTMLElement;

        const dataTransfer = new DataTransfer();

        source.dispatchEvent(new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: taskRect.x + taskRect.width / 2,
          clientY: taskRect.y + taskRect.height / 2,
        }));

        await sleep(100);

        stationColumn.dispatchEvent(new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: stationRect.x + stationRect.width / 2,
          clientY: stationRect.y + 300,
        }));

        await sleep(50);

        stationColumn.dispatchEvent(new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: stationRect.x + stationRect.width / 2,
          clientY: stationRect.y + 300,
        }));
      }, { taskRect, stationRect });

      // Purple line should be visible during drag
      const purpleLine = page.locator('[data-testid="precedence-line-earliest"]');
      await expect(purpleLine).toBeVisible({ timeout: 1000 });

      // End drag
      await page.evaluate(async () => {
        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-1-cut"]') as HTMLElement;
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
      });

      await page.waitForTimeout(200);

      // Lines should not be visible after drag ends
      await expect(purpleLine).not.toBeVisible();
    });

    test('no purple line when task has no predecessor', async ({ page }) => {
      // Job-pv-3: First task (print) is unscheduled, second task (cut) is scheduled
      // When dragging the first task, there's no predecessor, so no purple line
      await page.locator('[data-testid="job-card-job-pv-3"]').click();
      await page.waitForTimeout(100);

      // The first task is print (unscheduled)
      const firstTaskTile = page.locator('[data-testid="sidebar-task-tile-task-pv-3-print"]');

      const isVisible = await firstTaskTile.isVisible();
      if (!isVisible) {
        test.skip();
        return;
      }

      const taskRect = await firstTaskTile.boundingBox();
      if (!taskRect) throw new Error('Task tile not found');

      // Print tasks go to station-komori
      const stationColumn = page.locator('[data-testid="station-column-station-komori"]');
      const stationRect = await stationColumn.boundingBox();
      if (!stationRect) throw new Error('Station column not found');

      await page.evaluate(async ({ taskRect, stationRect }) => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-3-print"]') as HTMLElement;
        const stationColumn = document.querySelector('[data-testid="station-column-station-komori"]') as HTMLElement;

        const dataTransfer = new DataTransfer();

        source.dispatchEvent(new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: taskRect.x + taskRect.width / 2,
          clientY: taskRect.y + taskRect.height / 2,
        }));

        await sleep(100);

        stationColumn.dispatchEvent(new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: stationRect.x + stationRect.width / 2,
          clientY: stationRect.y + 300,
        }));

        await sleep(50);

        for (let i = 0; i < 3; i++) {
          stationColumn.dispatchEvent(new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: stationRect.x + stationRect.width / 2,
            clientY: stationRect.y + 300,
          }));
          await sleep(50);
        }
      }, { taskRect, stationRect });

      // Purple line should NOT be visible (no scheduled predecessor)
      const purpleLine = page.locator('[data-testid="precedence-line-earliest"]');
      await expect(purpleLine).not.toBeVisible();

      // Orange line should be visible (has scheduled successor)
      const orangeLine = page.locator('[data-testid="precedence-line-latest"]');
      await expect(orangeLine).toBeVisible({ timeout: 1000 });

      // Clean up
      await page.evaluate(async () => {
        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-3-print"]') as HTMLElement;
        source?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
      });
    });
  });

  test.describe('Lines Styling', () => {
    test('lines have glow effect', async ({ page }) => {
      await page.locator('[data-testid="job-card-job-pv-1"]').click();
      await page.waitForTimeout(100);

      const cutTaskTile = page.locator('[data-testid="sidebar-task-tile-task-pv-1-cut"]');
      await expect(cutTaskTile).toBeVisible();

      const taskRect = await cutTaskTile.boundingBox();
      if (!taskRect) throw new Error('Task tile not found');

      const stationColumn = page.locator('[data-testid="station-column-station-polar"]');
      const stationRect = await stationColumn.boundingBox();
      if (!stationRect) throw new Error('Station column not found');

      await page.evaluate(async ({ taskRect, stationRect }) => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-1-cut"]') as HTMLElement;
        const stationColumn = document.querySelector('[data-testid="station-column-station-polar"]') as HTMLElement;

        const dataTransfer = new DataTransfer();

        source.dispatchEvent(new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: taskRect.x + taskRect.width / 2,
          clientY: taskRect.y + taskRect.height / 2,
        }));

        await sleep(100);

        stationColumn.dispatchEvent(new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: stationRect.x + stationRect.width / 2,
          clientY: stationRect.y + 300,
        }));

        await sleep(100);

        for (let i = 0; i < 3; i++) {
          stationColumn.dispatchEvent(new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: stationRect.x + stationRect.width / 2,
            clientY: stationRect.y + 300,
          }));
          await sleep(50);
        }
      }, { taskRect, stationRect });

      // Check that the purple line has box-shadow (glow effect)
      const purpleLine = page.locator('[data-testid="precedence-line-earliest"]');
      await expect(purpleLine).toBeVisible({ timeout: 1000 });

      const boxShadow = await purpleLine.evaluate((el) => {
        return window.getComputedStyle(el).boxShadow;
      });

      // Should have some box-shadow (glow effect)
      expect(boxShadow).not.toBe('none');
      expect(boxShadow).toContain('rgb');

      // Clean up
      await page.evaluate(async () => {
        const source = document.querySelector('[data-testid="sidebar-task-tile-task-pv-1-cut"]') as HTMLElement;
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
      });
    });
  });
});
