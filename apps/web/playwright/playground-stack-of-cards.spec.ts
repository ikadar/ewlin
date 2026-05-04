/**
 * Playground smoke test — stack-of-cards (Q2 of 2026-05-04 mindmap).
 *
 * The playground lives at the repo root as a static file. Vite serves
 * the apps/web directory by default ; we load the playground from the
 * monorepo root via the dev server's static file proxy. The test
 * validates that the playground :
 *   1. Mounts a top card with the device frame.
 *   2. Surfaces the +5 min cumulative button (forceShow=true).
 *   3. Increments the visual counter on click.
 *   4. Pop the top card on "Terminé".
 *
 * The HTML playground is purely client-side ; no backend involvement,
 * so the test stays fast and deterministic. Run headed.
 *
 * Run headed:
 *   pnpm playwright test playground-stack-of-cards --headed --workers=1
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('stack-of-cards playground renders + +5min cumulative + Terminé', async ({ page }) => {
  // Load the static HTML directly from disk via setContent so the test
  // doesn't need the playground to be served by Vite.
  const playgroundPath = resolve(
    __dirname,
    '..',
    '..',
    '..',
    'playground-stack-of-cards.html',
  );
  const html = readFileSync(playgroundPath, 'utf8');
  await page.setContent(html);

  // 1. Top card mounted with the J-12345 ref (first sample data).
  const topCard = page.locator('.card.top');
  await expect(topCard).toBeVisible();
  await expect(topCard).toContainText('J-12345');

  // 2. End-prompt visible (forceShow checkbox is on by default).
  const plus5 = page.locator('#btn-plus5');
  await expect(plus5).toBeVisible();
  await expect(plus5).toContainText('+5 min de plus');

  // 3. Click increments the cumulative counter.
  await plus5.click();
  await expect(page.locator('#plus5-sub')).toContainText('5 min en attente');
  await plus5.click();
  await expect(page.locator('#plus5-sub')).toContainText('10 min en attente');
  await plus5.click();
  await expect(page.locator('#plus5-sub')).toContainText('15 min en attente');

  // 4. After the 800ms debounce, the counter resets and the toast fires.
  await expect(page.locator('#toast.show')).toBeVisible({ timeout: 2_000 });
  // Counter resets to 0 after commit.
  await expect(page.locator('#plus5-val')).toContainText('0 min');

  // 5. "Terminé" pops the top card — peek-1 (J-12346) should rise.
  await page.locator('#btn-done-card').click();
  await expect(page.locator('.card.top')).toContainText('J-12346');
});
