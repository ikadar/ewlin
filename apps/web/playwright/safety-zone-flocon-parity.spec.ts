/**
 * Playwright end-to-end: safety-zone snowflake parity between grid views.
 *
 * Regression for: operator schedule tiles were hiding the Safety Zone
 * flocon because `TileSegment` required `canToggleFrozen` (a bundle of
 * `onToggleFrozenOverride`, `jobId`, `stationId`, `sequenceIndex`) in
 * addition to `inSafetyZone`. `Tile` (station view) only required
 * `inSafetyZone`, so flocons appeared there — creating a visual
 * inconsistency where the same tile showed the snowflake on one grid
 * and not on the other.
 *
 * Fix: render the flocon whenever `inSafetyZone` is true, and gate
 * only the CLICK behavior on `canToggleFrozen`. This test asserts
 * flocon counts in the two views are consistent: if the station view
 * shows at least one flocon, the operator view must too.
 *
 * Memory rule: real DB + real API only — no fixture mode.
 * Pre-reqs: PHP API on :8080, dev server on :5173.
 */

import { test, request, expect, type Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const EMAIL = 'playwright-dev@flux.local';
const PASS = 'PlaywrightDevPassword123!';

async function injectAuth(page: Page) {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_BASE_URL}/auth/login`, {
    data: { email: EMAIL, password: PASS },
  });
  if (!res.ok()) throw new Error(`Login failed ${res.status()}`);
  const { token, refreshToken, user } = await res.json();
  await ctx.dispose();
  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('flux_auth_token', token);
    localStorage.setItem('flux_refresh_token', refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token, refreshToken, user });
}

test.describe('Safety zone flocon parity — station vs operator view', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  async function countSafetyInstances(page: Page, tileSelector: string, floconSelector: string) {
    // Wait for at least one tile to render (otherwise the counts are 0
    // simply because the view hasn't hydrated yet).
    await page.locator(tileSelector).first().waitFor({ timeout: 15_000 });
    // Give the layout a frame to settle (collapses, scroll-to-now, etc.).
    await page.waitForTimeout(750);
    const tileCount = await page.locator(tileSelector).count();
    const floconCount = await page.locator(floconSelector).count();
    return { tileCount, floconCount };
  }

  test('flocon count in operator view matches station view', async ({ page }) => {
    // ─── Operator view first (hot path — the fix target) ───────────
    await page.goto('/');
    const operator = await countSafetyInstances(
      page,
      '[data-testid^="tile-segment-"]',
      '[data-testid="tile-segment-safety-flocon"]',
    );
    expect(operator.tileCount).toBeGreaterThan(0);
    console.log(`[operator view] tiles=${operator.tileCount} flocons=${operator.floconCount}`);

    // Also measure how many segments are marked inside the safety zone
    // (via data-safety-frozen attribute) — the flocon MUST render for
    // each of them now that the fix decouples visual from interactivity.
    const safetySegs = await page.locator('[data-testid^="tile-segment-"][data-safety-frozen="true"]').count();
    console.log(`[operator view] safety-frozen segments=${safetySegs}`);
    expect(operator.floconCount).toBe(safetySegs);

    // ─── Station view ──────────────────────────────────────────────
    await page.goto('/stations');
    const station = await countSafetyInstances(
      page,
      '[data-testid^="tile-"]',
      '[data-testid="tile-safety-flocon"]',
    );
    expect(station.tileCount).toBeGreaterThan(0);
    console.log(`[station view] tiles=${station.tileCount} flocons=${station.floconCount}`);

    // ─── Parity assertion ──────────────────────────────────────────
    // The views can render different tile counts (operator view may
    // split a tile into multiple segments at operator boundaries), so
    // we don't require equality on flocons. The minimum invariant: if
    // the station view detected ANY tile inside the safety zone, the
    // operator view must too.
    if (station.floconCount > 0) {
      expect(operator.floconCount).toBeGreaterThan(0);
    }
  });
});
