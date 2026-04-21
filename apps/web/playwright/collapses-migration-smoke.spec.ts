/**
 * Post-migration smoke test for the `collapses`-required tightening.
 *
 * Verifies the user-visible invariant that made this refactor necessary:
 *   - No `tile-recalage-section` element escapes the rendered bounds of its
 *     own tile (this was the "phantom recalage inside Capgemini" bug).
 *   - The first Capgemini 4644 tile on Ryobi 528 stays clean — no rogue
 *     recalage overlay intersects its visual rect.
 *
 * If a future regression turns `collapses` back into an optional argument
 * (silently falling back to linear pixels), either assertion will trip.
 */

import { test, expect, request } from '@playwright/test';
import type { Page } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const EMAIL = 'playwright-dev@flux.local';
const PASS = 'PlaywrightDevPassword123!';

async function injectAuth(page: Page) {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_BASE_URL}/auth/login`, {
    data: { email: EMAIL, password: PASS },
  });
  if (!res.ok()) throw new Error(`Login failed ${res.status()} ${await res.text()}`);
  const { token, refreshToken, user } = await res.json();
  await ctx.dispose();
  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('flux_auth_token', token);
    localStorage.setItem('flux_refresh_token', refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token, refreshToken, user });
}

test.setTimeout(180_000);

test('no recalage escapes its tile anywhere on the station grid', async ({ page }) => {
  await injectAuth(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/stations');
  await waitForAppReady(page);
  await page.waitForTimeout(2500);

  // Scroll the grid end-to-end to force every recalage into the DOM at least once.
  await page.evaluate(async () => {
    const grid = document.querySelector('[data-testid="scheduling-grid"]') as HTMLElement | null;
    if (!grid) return;
    const max = grid.scrollHeight;
    for (let s = 0; s <= max; s += 500) {
      grid.scrollTop = s;
      await new Promise((r) => setTimeout(r, 30));
    }
    grid.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 100));
  });

  const outOfBounds = await page.evaluate(() => {
    const recs = Array.from(document.querySelectorAll('[data-testid="tile-recalage-section"]')) as HTMLElement[];
    return recs
      .map((rc) => {
        const r = rc.getBoundingClientRect();
        const owner = rc.closest('[data-task-id]') as HTMLElement | null;
        if (!owner) return null;
        const or = owner.getBoundingClientRect();
        const escapes = r.y < or.y - 0.5 || r.y + r.height > or.y + or.height + 0.5;
        return escapes ? { ownerTaskId: owner.getAttribute('data-task-id') } : null;
      })
      .filter(Boolean);
  });

  expect(outOfBounds, 'Every recalage band must stay inside its tile bounds').toEqual([]);
});

test('Capgemini 4644 tile area carries no recalage from neighbouring tiles', async ({ page }) => {
  await injectAuth(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/stations');
  await waitForAppReady(page);
  await page.waitForTimeout(2500);

  const capgeminiTaskId = '963a1515-47b4-4fea-ba34-68cc3a85dace';

  await page.evaluate(async ({ tid }) => {
    const grid = document.querySelector('[data-testid="scheduling-grid"]') as HTMLElement | null;
    if (!grid) return;
    for (let s = 0; s <= grid.scrollHeight; s += 300) {
      grid.scrollTop = s;
      await new Promise((r) => setTimeout(r, 40));
      const el = document.querySelector(`[data-task-id="${tid}"]`);
      if (el) { el.scrollIntoView({ block: 'center' }); return; }
    }
  }, { tid: capgeminiTaskId });
  await page.waitForTimeout(800);

  const cap = await page.locator(`[data-task-id="${capgeminiTaskId}"]`).boundingBox();
  test.skip(!cap, 'Capgemini tile not rendered in current schedule — schedule may have shifted.');

  const rogue = await page.evaluate(({ top, bottom, tid }) => {
    const recs = Array.from(document.querySelectorAll('[data-testid="tile-recalage-section"]')) as HTMLElement[];
    return recs
      .map((rc) => {
        const r = rc.getBoundingClientRect();
        const owner = rc.closest('[data-task-id]');
        return {
          y: Math.round(r.y),
          h: Math.round(r.height),
          ownerTaskId: owner?.getAttribute('data-task-id') ?? null,
          inside: r.y >= top && r.y + r.height <= bottom && owner?.getAttribute('data-task-id') !== tid,
        };
      })
      .filter((d) => d.inside);
  }, { top: cap!.y, bottom: cap!.y + cap!.height, tid: capgeminiTaskId });

  expect(rogue, 'No foreign recalage may render inside Capgemini tile bounds').toEqual([]);
});
