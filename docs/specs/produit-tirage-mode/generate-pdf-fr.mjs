import { chromium } from '/Users/jpi/Documents/dev/claude-code/jcf/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, 'tile-content-by-station-group-fr-tmp.html');
let html = readFileSync(htmlPath, 'utf-8');

// Remove the auto-generated title from pandoc
html = html.replace(/<title>.*?<\/title>/, '<title></title>');

// Replace relative image paths with base64 data URIs
html = html.replace(/src="(screenshots\/[^"]+)"/g, (match, imgPath) => {
  const fullPath = resolve(__dirname, imgPath);
  try {
    const imgData = readFileSync(fullPath);
    const base64 = imgData.toString('base64');
    const ext = imgPath.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    return `src="data:${mime};base64,${base64}"`;
  } catch (e) {
    console.warn(`Warning: could not read image ${fullPath}:`, e.message);
    return match;
  }
});

// Inject custom CSS for PDF styling
const customCSS = `
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    max-width: 100%;
    margin: 0;
    padding: 0 20px;
    color: #1a1a1a;
  }
  h1 { font-size: 22pt; margin-top: 0; padding-top: 10px; }
  h2 { font-size: 16pt; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  h3 { font-size: 13pt; margin-top: 20px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 10pt; }
  pre { background: #f4f4f4; padding: 10px 14px; border-radius: 5px; font-size: 10pt; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  img { max-width: 100%; height: auto; margin: 10px 0; border-radius: 6px; }
  blockquote { border-left: 3px solid #ccc; margin: 12px 0; padding: 4px 16px; color: #555; }
  hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
</style>
`;

html = html.replace('</head>', customCSS + '</head>');

const browser = await chromium.launch();
const page = await browser.newPage();

// Use setContent since images are now inline as base64
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const pdfPath = resolve(__dirname, 'tile-content-by-station-group-fr.pdf');
await page.pdf({
  path: pdfPath,
  format: 'A4',
  margin: { top: '20mm', bottom: '25mm', left: '15mm', right: '15mm' },
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:9px;color:#888;width:100%;text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});

console.log('PDF generated:', pdfPath);
await browser.close();
