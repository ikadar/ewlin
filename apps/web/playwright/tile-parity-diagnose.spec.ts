/**
 * Diagnostic: compare rendered tile structure between station and operator
 * views, only looking at tiles that actually contain a setup section (the
 * zone where the visual ghost band was reported).
 */

import { test, request } from '@playwright/test';
import { waitForAppReady } from './helpers/drag';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const EMAIL = 'playwright-dev@flux.local';
const PASS = 'PlaywrightDevPassword123!';

async function injectAuth(page: import('@playwright/test').Page) {
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

async function scrollUntilSetup(
  page: import('@playwright/test').Page,
  gridSelectors: string[],
): Promise<string> {
  return await page.evaluate(async (selectors) => {
    const grid = selectors
      .map((s) => document.querySelector(s) as HTMLElement | null)
      .find((el) => el !== null);
    if (!grid) return 'no-grid';
    const step = 600;
    const startedAt = Date.now();
    for (let s = 0; s < grid.scrollHeight; s += step) {
      grid.scrollTop = s;
      await new Promise((r) => setTimeout(r, 50));
      const setup = document.querySelector('[data-testid="tile-setup-section"]');
      if (setup) {
        // Scroll the setup into a reasonable on-screen position
        setup.scrollIntoView({ block: 'center' });
        return `found at ${s}`;
      }
      if (Date.now() - startedAt > 60_000) return `timeout at ${s}`;
    }
    return 'not-found';
  }, gridSelectors);
}

async function inspectFirstTileWithSetup(
  page: import('@playwright/test').Page,
  label: string,
) {
  const info = await page.evaluate(() => {
    const setup = document.querySelector('[data-testid="tile-setup-section"]') as HTMLElement | null;
    if (!setup) return { found: false };

    // Walk up to the tile root (the node carrying data-job-id)
    let cur: HTMLElement | null = setup;
    while (cur && !cur.hasAttribute('data-job-id')) cur = cur.parentElement;
    const root = cur;
    if (!root) return { found: false };

    const pick = (el: HTMLElement | null) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        boxShadow: cs.boxShadow,
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        borderBottom: cs.borderBottom,
        outline: cs.outline,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        testid: el.getAttribute('data-testid'),
      };
    };

    // Try both title shapes: Tile.tsx has [data-testid="tile-content"],
    // TileSegment.tsx has a plain <div class="text-[11px] ...">.
    const title =
      (root.querySelector('[data-testid="tile-content"]') as HTMLElement | null) ??
      (root.querySelector('div.text-\\[11px\\]') as HTMLElement | null);

    return {
      found: true,
      root: pick(root),
      title: pick(title),
      setup: pick(setup),
    };
  });

  console.log(`\n[${label}] ================================`);
  console.log(JSON.stringify(info, null, 2));
  return info;
}

async function boundedScreenshot(
  page: import('@playwright/test').Page,
  path: string,
) {
  await page.evaluate(() => {
    const setup = document.querySelector('[data-testid="tile-setup-section"]') as HTMLElement | null;
    if (setup) {
      let cur: HTMLElement | null = setup;
      while (cur && !cur.hasAttribute('data-job-id')) cur = cur.parentElement;
      if (cur) {
        cur.setAttribute('data-focus-tile', 'true');
      }
    }
  });
  const focused = page.locator('[data-focus-tile="true"]').first();
  if (await focused.count()) {
    await focused.screenshot({ path });
  } else {
    await page.screenshot({ path, fullPage: false });
  }
  await page.evaluate(() => {
    document.querySelectorAll('[data-focus-tile]').forEach((el) => el.removeAttribute('data-focus-tile'));
  });
}

test.setTimeout(180_000);

test('station vs operator tile with setup — parity', async ({ page }) => {
  await injectAuth(page);

  await page.goto('/stations');
  await waitForAppReady(page);
  await page.waitForTimeout(2500);
  const stationScroll = await scrollUntilSetup(page, [
    '[data-testid="scheduling-grid"]',
    '[data-testid="operator-scheduling-grid"]',
  ]);
  console.log('station scroll:', stationScroll);
  await page.waitForTimeout(400);
  await inspectFirstTileWithSetup(page, 'STATION');
  await boundedScreenshot(page, 'tile-parity-station-setup.png');

  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForTimeout(2500);
  const opScroll = await scrollUntilSetup(page, [
    '[data-testid="operator-scheduling-grid"]',
    '[data-testid="scheduling-grid"]',
  ]);
  console.log('operator scroll:', opScroll);
  await page.waitForTimeout(400);
  await inspectFirstTileWithSetup(page, 'OPERATOR');
  await boundedScreenshot(page, 'tile-parity-operator-setup.png');
});
