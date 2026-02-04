import { test, expect } from '@playwright/test';

/**
 * E2E tests for Right-Click Context Menu (v0.3.58)
 *
 * Tests the context menu functionality on tiles:
 * - Menu opens on right-click
 * - Menu closes on click outside, ESC, scroll
 * - Menu actions: View details, Toggle completion, Move up, Move down
 * - Disabled states for move options
 */

test.describe('Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app with context-menu fixture
    await page.goto('/?fixture=context-menu');
    // Wait for the app to load
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test('should open context menu on right-click', async ({ page }) => {
    // Find a tile
    const tile = page.locator('[data-testid="tile-assign-menu-1a"]');
    await expect(tile).toBeVisible();

    // Right-click to open context menu
    await tile.click({ button: 'right' });

    // Context menu should appear
    const contextMenu = page.locator('[data-testid="tile-context-menu"]');
    await expect(contextMenu).toBeVisible();

    // Menu should have all options
    await expect(page.locator('[data-testid="context-menu-view-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="context-menu-toggle-complete"]')).toBeVisible();
    await expect(page.locator('[data-testid="context-menu-move-up"]')).toBeVisible();
    await expect(page.locator('[data-testid="context-menu-move-down"]')).toBeVisible();
  });

  test('should close context menu on click outside', async ({ page }) => {
    // Open context menu
    const tile = page.locator('[data-testid="tile-assign-menu-1b"]');
    await tile.click({ button: 'right' });

    const contextMenu = page.locator('[data-testid="tile-context-menu"]');
    await expect(contextMenu).toBeVisible();

    // Click outside the menu
    await page.mouse.click(10, 10);

    // Menu should close
    await expect(contextMenu).not.toBeVisible();
  });

  test('should close context menu on ESC key', async ({ page }) => {
    // Open context menu
    const tile = page.locator('[data-testid="tile-assign-menu-1b"]');
    await tile.click({ button: 'right' });

    const contextMenu = page.locator('[data-testid="tile-context-menu"]');
    await expect(contextMenu).toBeVisible();

    // Press ESC
    await page.keyboard.press('Escape');

    // Menu should close
    await expect(contextMenu).not.toBeVisible();
  });

  test('should close context menu on scroll', async ({ page }) => {
    // Open context menu
    const tile = page.locator('[data-testid="tile-assign-menu-1b"]');
    await tile.click({ button: 'right' });

    const contextMenu = page.locator('[data-testid="tile-context-menu"]');
    await expect(contextMenu).toBeVisible();

    // Scroll the grid
    const grid = page.locator('[data-testid="scheduling-grid"]');
    await grid.evaluate((el) => el.scrollTop += 100);

    // Menu should close
    await expect(contextMenu).not.toBeVisible();
  });

  test('should select job when clicking "Voir détails"', async ({ page }) => {
    // Open context menu
    const tile = page.locator('[data-testid="tile-assign-menu-1b"]');
    await tile.click({ button: 'right' });

    // Click "Voir détails"
    await page.locator('[data-testid="context-menu-view-details"]').click();

    // Menu should close
    await expect(page.locator('[data-testid="tile-context-menu"]')).not.toBeVisible();

    // Job should be selected (job details panel should show job info)
    // The tile's job is MENU-001
    const jobDetailsPanel = page.locator('[data-testid="job-details-panel"]');
    await expect(jobDetailsPanel).toContainText('MENU-001');
  });

  test('should toggle completion when clicking "Marquer terminé"', async ({ page }) => {
    // Find the first tile (not completed)
    const tile = page.locator('[data-testid="tile-assign-menu-1a"]');

    // Verify it's not completed initially
    await expect(tile.locator('[data-testid="tile-incomplete-icon"]')).toBeVisible();

    // Open context menu and toggle completion
    await tile.click({ button: 'right' });
    await page.locator('[data-testid="context-menu-toggle-complete"]').click();

    // Tile should now show completed icon
    await expect(tile.locator('[data-testid="tile-completed-icon"]')).toBeVisible();
  });

  test('should swap up when clicking "Déplacer vers le haut"', async ({ page }) => {
    // Get initial positions of tiles
    const tileA = page.locator('[data-testid="tile-assign-menu-1a"]');
    const tileB = page.locator('[data-testid="tile-assign-menu-1b"]');

    const initialTopA = await tileA.evaluate((el) => el.style.top);
    const initialTopB = await tileB.evaluate((el) => el.style.top);

    // Open context menu on middle tile (1b) and move up
    await tileB.click({ button: 'right' });
    await page.locator('[data-testid="context-menu-move-up"]').click();

    // Wait for the swap to complete
    await page.waitForTimeout(100);

    // Positions should be swapped
    const newTopA = await tileA.evaluate((el) => el.style.top);
    const newTopB = await tileB.evaluate((el) => el.style.top);

    expect(newTopB).toBe(initialTopA);
    expect(newTopA).toBe(initialTopB);
  });

  test('should swap down when clicking "Déplacer vers le bas"', async ({ page }) => {
    // Get initial positions of tiles
    const tileB = page.locator('[data-testid="tile-assign-menu-1b"]');
    const tileC = page.locator('[data-testid="tile-assign-menu-1c"]');

    const initialTopB = await tileB.evaluate((el) => el.style.top);
    const initialTopC = await tileC.evaluate((el) => el.style.top);

    // Open context menu on middle tile (1b) and move down
    await tileB.click({ button: 'right' });
    await page.locator('[data-testid="context-menu-move-down"]').click();

    // Wait for the swap to complete
    await page.waitForTimeout(100);

    // Positions should be swapped
    const newTopB = await tileB.evaluate((el) => el.style.top);
    const newTopC = await tileC.evaluate((el) => el.style.top);

    expect(newTopB).toBe(initialTopC);
    expect(newTopC).toBe(initialTopB);
  });

  test('should disable "Move up" for top tile', async ({ page }) => {
    // Open context menu on top tile (1a - has no tile above)
    const tile = page.locator('[data-testid="tile-assign-menu-1a"]');
    await tile.click({ button: 'right' });

    // "Move up" should be disabled
    const moveUpButton = page.locator('[data-testid="context-menu-move-up"]');
    await expect(moveUpButton).toBeDisabled();
  });

  test('should disable "Move down" for bottom tile', async ({ page }) => {
    // Open context menu on bottom tile (1c - has no tile below)
    const tile = page.locator('[data-testid="tile-assign-menu-1c"]');
    await tile.click({ button: 'right' });

    // "Move down" should be disabled
    const moveDownButton = page.locator('[data-testid="context-menu-move-down"]');
    await expect(moveDownButton).toBeDisabled();
  });

  test('should have both move options enabled for middle tile', async ({ page }) => {
    // Open context menu on middle tile (1b - has tiles above and below)
    const tile = page.locator('[data-testid="tile-assign-menu-1b"]');
    await tile.click({ button: 'right' });

    // Both move options should be enabled
    const moveUpButton = page.locator('[data-testid="context-menu-move-up"]');
    const moveDownButton = page.locator('[data-testid="context-menu-move-down"]');

    await expect(moveUpButton).not.toBeDisabled();
    await expect(moveDownButton).not.toBeDisabled();
  });

  test('should show French labels', async ({ page }) => {
    // Open context menu
    const tile = page.locator('[data-testid="tile-assign-menu-1b"]');
    await tile.click({ button: 'right' });

    // Verify French labels
    await expect(page.locator('[data-testid="context-menu-view-details"]')).toContainText('Voir détails');
    await expect(page.locator('[data-testid="context-menu-toggle-complete"]')).toContainText('Marquer terminé');
    await expect(page.locator('[data-testid="context-menu-move-up"]')).toContainText('Déplacer vers le haut');
    await expect(page.locator('[data-testid="context-menu-move-down"]')).toContainText('Déplacer vers le bas');
  });
});

test.describe('Context Menu - Isolated Tile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=context-menu');
    await page.waitForSelector('[data-testid="scheduling-grid"]');
  });

  test('should disable both move options for isolated tile', async ({ page }) => {
    // Open context menu on isolated tile (2a - only tile on Heidelberg)
    const tile = page.locator('[data-testid="tile-assign-menu-2a"]');
    await tile.click({ button: 'right' });

    // Both move options should be disabled
    const moveUpButton = page.locator('[data-testid="context-menu-move-up"]');
    const moveDownButton = page.locator('[data-testid="context-menu-move-down"]');

    await expect(moveUpButton).toBeDisabled();
    await expect(moveDownButton).toBeDisabled();
  });
});
