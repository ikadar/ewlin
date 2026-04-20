/**
 * Calage phases and folder tab visual contract.
 *
 * Covers:
 *  - Folder tab on tile hover: completion + pin buttons appear.
 *  - Inline check is hidden (moved to the tab).
 *  - Inline pin is hidden when the tile is not pinned.
 *  - The divider under setup sections is dashed red (F-variant).
 *  - Re-calage sections render when the assignment carries them.
 *
 * Recalage data flows from the Rust engine through the PHP DTO into
 * TaskAssignment.recalages. This spec does not force peremption — it
 * asserts the rendering contract, so the tile-recalage-section test is
 * conditional on the current schedule having at least one recalage.
 */

import { test, expect } from '@playwright/test';
import { waitForTilesReady } from './helpers/drag';

test.describe('Tile calage phases + folder tab', () => {
  test('folder tab appears on hover with completion and pin buttons', async ({ page }) => {
    await page.goto('/');
    await waitForTilesReady(page);

    const tile = page.locator('[data-testid^="tile-"]').first();
    await expect(tile).toBeVisible();

    const tab = tile.locator('.folder-tab');
    // Before hover: tab is in the DOM but CSS-hidden (opacity 0).
    await expect(tab).toHaveCSS('opacity', '0');

    await tile.hover();
    // After hover: tab is visible.
    await expect(tab).toHaveCSS('opacity', '1');

    await expect(tile.locator('[data-testid="tile-tab-complete"]')).toBeVisible();
    await expect(tile.locator('[data-testid="tile-tab-pin"]')).toBeVisible();
  });

  test('inline check is always hidden, inline pin always visible', async ({ page }) => {
    await page.goto('/');
    await waitForTilesReady(page);

    const tile = page.locator('[data-testid^="tile-"]').first();
    await expect(tile).toBeVisible();

    // Circle (action) must never be inline — it lives exclusively in the tab.
    await expect(tile.locator('.inline-check')).toHaveCSS('display', 'none');

    // Pin is always rendered on planning tiles so users can pin/unpin from the grid.
    await expect(tile.locator('.inline-pin')).not.toHaveCSS('display', 'none');
  });

  test('setup section divider is dashed red', async ({ page }) => {
    await page.goto('/');
    await waitForTilesReady(page);

    const setup = page.locator('[data-testid="tile-setup-section"]').first();
    // Render only happens when there is a setup duration. Allow the whole
    // spec to pass if the current dataset has no setup-bearing tile.
    const count = await setup.count();
    test.skip(count === 0, 'No tile with setup section in current schedule.');

    await expect(setup).toHaveCSS('border-bottom-style', 'dashed');
    // Color is rgba(239,68,68,0.9) — browsers normalize differently but the
    // red channel alone is a robust discriminator.
    const borderColor = await setup.evaluate((el) => getComputedStyle(el).borderBottomColor);
    expect(borderColor).toMatch(/rgba?\(\s*239\s*,\s*68\s*,\s*68/);
  });

  test('recalage section renders with the setup divider style when present', async ({ page }) => {
    await page.goto('/');
    await waitForTilesReady(page);

    const recalage = page.locator('[data-testid="tile-recalage-section"]').first();
    const count = await recalage.count();
    test.skip(count === 0, 'No recalage in current schedule — run a compute that triggers peremption to exercise this branch.');

    await expect(recalage).toHaveCSS('border-bottom-style', 'dashed');
    const borderColor = await recalage.evaluate((el) => getComputedStyle(el).borderBottomColor);
    expect(borderColor).toMatch(/rgba?\(\s*239\s*,\s*68\s*,\s*68/);
  });
});
