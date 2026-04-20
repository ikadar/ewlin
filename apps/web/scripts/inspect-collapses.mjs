// Diagnostic script — logs in via the UI form, loads operator + station
// planning views, counts collapse bands and screenshots them.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5173';
const EMAIL = process.env.EMAIL || 'claude-pw@local.test';
const PASSWORD = process.env.PASSWORD || 'ClaudeWatch1234aA';

const VIEWS = [
  { name: 'operator', path: '/', shot: '/tmp/inspect-operator.png' },
  { name: 'station',  path: '/stations', shot: '/tmp/inspect-station.png' },
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

page.on('pageerror', (err) => console.error('[page error]', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[console.error]', msg.text());
});

// ----- Login -----
console.log('Logging in as', EMAIL);
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.locator('input[type="email"], input[placeholder*="example"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.getByRole('button', { name: /se connecter/i }).click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15_000 });
console.log('Logged in →', page.url());

for (const view of VIEWS) {
  console.log(`\n=== ${view.name} (${view.path}) ===`);
  await page.goto(BASE + view.path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-testid="operator-scheduling-grid"], [data-testid="scheduling-grid"]', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const bands = await page.locator('[data-testid="collapse-band"]').count();
  console.log('  collapse-band count =', bands);

  const byKind = await page.evaluate(() => {
    const out = {};
    const heights = {};
    document.querySelectorAll('[data-testid="collapse-band"]').forEach((el) => {
      const k = el.getAttribute('data-kind') || 'unknown';
      out[k] = (out[k] || 0) + 1;
      const h = Math.round(el.getBoundingClientRect().height);
      heights[k] = h;
    });
    return { count: out, heights };
  });
  console.log('  by kind =', JSON.stringify(byKind));

  const sample = await page.evaluate(() => {
    const band = document.querySelector('[data-testid="collapse-band"]');
    if (!band) return null;
    const rect = band.getBoundingClientRect();
    const chip = band.querySelector('div.inline-flex');
    const chipRect = chip ? chip.getBoundingClientRect() : null;
    const svg = band.querySelector('svg');
    const computed = window.getComputedStyle(band);
    return {
      bandRect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      bandStyle: { zIndex: computed.zIndex, background: computed.backgroundColor, opacity: computed.opacity, visibility: computed.visibility, display: computed.display },
      chipText: chip ? chip.textContent : null,
      chipRect: chipRect ? { x: Math.round(chipRect.x), y: Math.round(chipRect.y), w: Math.round(chipRect.width), h: Math.round(chipRect.height) } : null,
      hasSvg: !!svg,
    };
  });
  console.log('  sample band =', JSON.stringify(sample, null, 2));

  // Snapshot a "diagnostic dump" of computed collapses, even if zero rendered.
  const diag = await page.evaluate(() => {
    // Look for clues in window/document about why no bands
    const bands = document.querySelectorAll('[data-testid="collapse-band"]').length;
    const stripes = document.querySelectorAll('[data-testid="unavailability-overlay"]').length;
    return { bandsInDom: bands, unavailabilityStripesInDom: stripes };
  });
  console.log('  diag =', JSON.stringify(diag));

  // Inspect the DateStrip viewport indicator for collapse-awareness.
  const viewportHours = await page.evaluate(() => {
    // Collect ALL day cells that have a viewport indicator visible
    const cells = document.querySelectorAll('[data-testid^="date-cell-"]');
    const flagged = [];
    cells.forEach((c) => {
      const ind = c.querySelector('[data-testid="viewport-indicator"]');
      if (ind) {
        const rect = ind.getBoundingClientRect();
        const cellTestId = c.getAttribute('data-testid');
        flagged.push({ day: cellTestId, y: Math.round(rect.y), h: Math.round(rect.height) });
      }
    });
    return { dateCellCount: cells.length, indicatorCount: flagged.length, flagged: flagged.slice(0, 12) };
  });
  console.log('  date cells in DOM:', viewportHours.dateCellCount, '— with viewport indicator:', viewportHours.indicatorCount);
  console.log('  flagged days:', JSON.stringify(viewportHours.flagged, null, 2));

  // Scroll to the first WEEKEND band so we screenshot that visually (2× taller).
  await page.evaluate(() => {
    const band = document.querySelector('[data-testid="collapse-band"][data-kind="weekend"]')
              ?? document.querySelector('[data-testid="collapse-band"]');
    if (!band) return;
    const rect = band.getBoundingClientRect();
    // Find scroll container — operator view uses a different testid than station view
    const candidates = ['[data-testid="operator-scheduling-grid"]', '[data-testid="scheduling-grid"]'];
    for (const sel of candidates) {
      const c = document.querySelector(sel);
      if (c) {
        c.scrollTop = Math.max(0, c.scrollTop + rect.top - 100);
        break;
      }
    }
  });
  await page.waitForTimeout(800);

  await page.screenshot({ path: view.shot, fullPage: false });
  console.log('  screenshot →', view.shot);
}

await browser.close();
