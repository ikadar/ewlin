import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';

const API = 'http://localhost:8080/api/v1';
const EMAIL = 'playwright@flux.local';
const PASSWORD = 'playwright1234';

async function login(page: import('@playwright/test').Page) {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  const { token, refreshToken, user } = await res.json();
  await ctx.dispose();

  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('flux_auth_token', token);
    localStorage.setItem('flux_refresh_token', refreshToken);
    localStorage.setItem('flux_auth_user', JSON.stringify(user));
  }, { token, refreshToken, user });
}

test.describe('Stats page — real data audit', () => {
  const consoleErrors: string[] = [];

  test('full page screenshot with real data', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`PAGE: ${err.message}`));

    await login(page);
    await page.goto('/stats');
    await page.waitForLoadState('domcontentloaded');
    // Wait for snapshot RTK Query to resolve + D3 to render
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'playwright/screenshots/stats-real-full.png', fullPage: true });

    // Individual chart cards
    const cards = page.locator('.bg-white\\/\\[0\\.02\\]');
    const count = await cards.count();
    for (let i = 0; i < Math.min(count, 6); i++) {
      const card = cards.nth(i);
      if (await card.isVisible()) {
        await card.screenshot({ path: `playwright/screenshots/stats-real-chart-${i}.png` });
      }
    }

    // Sidebar
    const sidebar = page.locator('[data-testid="sidebar"]');
    if (await sidebar.isVisible()) {
      await sidebar.screenshot({ path: 'playwright/screenshots/stats-real-sidebar.png' });
    }

    // Audit
    const svgs = await page.locator('svg').count();
    const circles = await page.locator('svg circle').count();
    const rects = await page.locator('svg rect').count();
    const empty = await page.locator('text=Aucun job planifié').isVisible().catch(() => false);

    console.log('=== REAL DATA AUDIT ===');
    console.log(`Cards: ${count} | SVGs: ${svgs} | Circles: ${circles} | Rects: ${rects}`);
    console.log(`Empty state: ${empty}`);
    console.log(`Errors: ${consoleErrors.length}`);
    consoleErrors.forEach((e) => console.log(`  ${e}`));
  });
});
