import { chromium } from '/Users/jpi/Documents/dev/claude-code/jcf/node_modules/playwright/index.mjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Step 1: Convert markdown to HTML with pandoc (--standalone for full <html> document)
execSync('pandoc -s tab-filtering-fr.md -o tab-filtering-fr-tmp.html', { cwd: __dirname });

let html = readFileSync(resolve(__dirname, 'tab-filtering-fr-tmp.html'), 'utf-8');

// Clean pandoc title
html = html.replace(/<title>.*?<\/title>/, '<title></title>');

// Inline images as base64
html = html.replace(/src="(screenshots\/[^"]+)"/g, (match, imgPath) => {
  const fullPath = resolve(__dirname, imgPath);
  try {
    const imgData = readFileSync(fullPath);
    const base64 = imgData.toString('base64');
    const ext = imgPath.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return `src="data:${mime};base64,${base64}"`;
  } catch (e) {
    console.warn(`Could not read image ${fullPath}:`, e.message);
    return match;
  }
});

// Inject print CSS
const css = `<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 9.5pt; line-height: 1.35; max-width: 100%; margin: 0; padding: 0 10px; color: #1a1a1a; }
  h1 { font-size: 17pt; margin-top: 0; margin-bottom: 6px; padding-top: 6px; }
  h2 { font-size: 13pt; margin-top: 16px; margin-bottom: 4px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  h3 { font-size: 11pt; margin-top: 12px; margin-bottom: 3px; }
  p { margin: 4px 0; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 8.5pt; }
  th, td { border: 1px solid #ccc; padding: 3px 6px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  code { background: #f4f4f4; padding: 1px 3px; border-radius: 2px; font-size: 8.5pt; }
  pre { background: #f4f4f4; padding: 6px 10px; border-radius: 4px; font-size: 8.5pt; overflow-x: auto; margin: 4px 0; }
  pre code { background: none; padding: 0; }
  img { max-width: 100%; height: auto; margin: 6px 0; border-radius: 4px; }
  blockquote { border-left: 3px solid #ccc; margin: 6px 0; padding: 2px 12px; color: #555; }
  hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
  ul, ol { margin: 4px 0; padding-left: 20px; }
  li { margin: 1px 0; }
</style>`;
html = html.replace('</head>', css + '</head>');

// Generate PDF
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.pdf({
  path: resolve(__dirname, 'tab-filtering-fr.pdf'),
  format: 'A4',
  margin: { top: '15mm', bottom: '20mm', left: '12mm', right: '12mm' },
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:9px;color:#888;width:100%;text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});
console.log('PDF generated: tab-filtering-fr.pdf');
await browser.close();

// Clean up temp file
execSync('rm tab-filtering-fr-tmp.html', { cwd: __dirname });
