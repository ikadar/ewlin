import { chromium } from '/Users/jpi/Documents/dev/claude-code/jcf/node_modules/playwright/index.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockupPath = `file://${resolve(__dirname, 'mockup.html')}`;
const screenshotsDir = resolve(__dirname, 'screenshots');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(mockupPath);
await page.waitForTimeout(500);

// Helper: capture the card area (table + tabs)
async function captureCard(name) {
  const card = await page.$('.bg-white.dark\\:bg-dark-elevated.rounded-lg');
  await card.screenshot({ path: resolve(screenshotsDir, name) });
}

// 1. Tab "Tous" (default state)
await captureCard('tab-tous.png');

// 2. Tab "À faire prépresse"
await page.click('[data-filter="prepresse"]');
await page.waitForTimeout(200);
await captureCard('tab-prepresse.png');

// 3. Tab "Cdes papier"
await page.click('[data-filter="papier"]');
await page.waitForTimeout(200);
await captureCard('tab-papier.png');

// 4. Tab "Cdes formes"
await page.click('[data-filter="formes"]');
await page.waitForTimeout(200);
await captureCard('tab-formes.png');

// 5. Tab "Plaques à produire"
await page.click('[data-filter="plaques"]');
await page.waitForTimeout(200);
await captureCard('tab-plaques.png');

// 6. Back to "Tous"
await page.click('[data-filter="all"]');
await page.waitForTimeout(200);
await captureCard('tab-tous-retour.png');

console.log('Tab filtering screenshots captured.');
await browser.close();
