/**
 * Diagnostic: is the recalage overlay actually in the DOM with the new
 * red background? Uses a freshly-created dev user against the real API.
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

async function inspectRecalages(page: import('@playwright/test').Page, label: string) {
  const info = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('[data-testid="tile-recalage-section"]'),
    ) as HTMLElement[];
    return {
      count: nodes.length,
      samples: nodes.slice(0, 5).map((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          rect: { w: Math.round(r.width), h: Math.round(r.height), visible: r.width * r.height > 0 },
          backgroundColor: cs.backgroundColor,
          outline: cs.outline,
          borderBottom: cs.borderBottom,
          inline: el.getAttribute('style')?.slice(0, 160),
          parentTestid: el.parentElement?.getAttribute('data-testid'),
        };
      }),
    };
  });
  console.log(`[${label}]`, JSON.stringify(info, null, 2));
  return info;
}

test.setTimeout(90_000);

test('recalage visible on station view', async ({ page }) => {
  await injectAuth(page);
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`BROWSER ERROR: ${m.text()}`);
  });

  await page.goto('/stations');
  await waitForAppReady(page);
  await page.waitForTimeout(3000);

  // Scroll the grid aggressively until at least one recalage appears.
  await page.evaluate(async () => {
    const grid = (
      document.querySelector('[data-testid="scheduling-grid"]') ??
      document.querySelector('[data-testid="operator-scheduling-grid"]')
    ) as HTMLElement | null;
    if (!grid) return 'no-grid';
    const step = 3000;
    const start = Date.now();
    for (let s = 0; s < grid.scrollHeight; s += step) {
      grid.scrollTop = s;
      await new Promise((r) => setTimeout(r, 40));
      if (document.querySelector('[data-testid="tile-recalage-section"]')) return `found at ${s}`;
      if (Date.now() - start > 55_000) return `timeout at ${s}`;
    }
    return 'not-found';
  }).then((r) => console.log('scroll result:', r));
  await page.waitForTimeout(800);

  await page.screenshot({ path: 'playwright-recalage-station.png', fullPage: false });
  await inspectRecalages(page, 'STATION');
});

test('recalage visible on operator view', async ({ page }) => {
  await injectAuth(page);
  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForTimeout(3000);

  await page.evaluate(async () => {
    const grid = document.querySelector('[data-testid="operator-scheduling-grid"]') as HTMLElement | null;
    if (!grid) return;
    for (let s = 0; s < grid.scrollHeight; s += 400) {
      grid.scrollTop = s;
      await new Promise((r) => setTimeout(r, 60));
      if (document.querySelector('[data-testid="tile-recalage-section"]')) return;
    }
  });
  await page.waitForTimeout(800);

  await page.screenshot({ path: 'playwright-recalage-operator.png', fullPage: false });
  await inspectRecalages(page, 'OPERATOR');
});
