# Specification Guidelines

These guidelines apply to all specifications written under `docs/specs/`.

---

## Purpose

A specification is a **communication document** written by a product owner (with Claude's help) for a developer (who will implement with Claude's help). It must convey **what** to build and **why**, with enough precision to eliminate ambiguity — but never prescribe **how** to implement it.

---

## Language

- Write the spec in **both English and French** (two separate files, like `feature-name.md` and `feature-name-fr.md`)
- The English version is the reference; the French version is a translation for stakeholders

---

## Structure

Every spec should follow this section structure. Sections marked **(optional)** can be omitted if not relevant.

### 1. Problem Statement
What is broken or missing today? Why does it matter to the user?
Keep it short (3-5 sentences max).

### 2. Goal
One paragraph describing the desired outcome. Answer: "What will the user be able to do after this is shipped?"

### 3. Detailed Behavior
The core of the spec. Describe the feature's behavior exhaustively:
- Modes, states, transitions
- User interactions (keyboard shortcuts, clicks, toggles)
- Default values, edge cases
- Use tables for structured properties (e.g., toggle behavior, field mappings)

### 4. Visual Previews **(optional)**
Screenshots, mockups, or links to interactive HTML previews.
These are extremely valuable — include them when possible.

### 5. Data Specification
For each variant/category/mode, specify exactly what data is displayed:
- Use template strings with field placeholders: `{field1} {field2} {field3}`
- Provide **concrete examples** with real-looking data
- Use tables to map each field to its data source

### 6. Business Logic
Rules, computations, detection logic, parsing rules.

**Critical rule: every algorithm must be unambiguous.**
- Use numbered steps
- Include concrete input/output examples for each step
- When an algorithm is non-trivial, show a **worked example** walking through the steps with real data
- If the logic depends on conditions, use explicit decision trees or tables — not prose

Bad (vague):
> "Identify the cover element (element with label containing 'couv' or being the element with prerequisiteElementIds referencing all others — to be refined)"

Good (precise):
> "Cover detection — in order of priority:
> 1. Element whose `name` or `label` contains the substring `couv` (case-insensitive)
> 2. If no match: the element that has no press task (`cat-offset` / `cat-typo`)
> 3. If still ambiguous: the last element in the `elements` array
>
> Example: Job 24185 has elements `[int-1, int-2, couv]`. Element `couv` matches rule 1 → it is the cover."

### 7. Data Availability Analysis **(optional)**
Only include this if there are genuine **gaps** — fields that don't exist yet, data that needs to be threaded through, or new API endpoints required.

Do NOT list fields that already exist and work. Do NOT add reminders like "verify that fields are saved" — that's implementation noise.

### 8. Future Enhancements **(optional)**
Brief bullet list of ideas for later iterations. Keep it short — these are not commitments.

---

## What NOT to include

### No implementation section
Do not write architecture diagrams, component trees, prop interfaces, file names, hook names, or step-by-step implementation plans. The developer will use Claude in **plan mode** to generate an implementation plan from the **current codebase** — which is always more accurate than a spec writer's assumptions about code structure.

### No obvious statements
If something is self-evident from the feature description, don't repeat it. For example, if the spec says "display quantity from `element.spec.quantite`", don't add a section saying "this feature requires ElementSpec fields to be populated." That's noise.

### No UI framework specifics
Don't specify React component names, CSS classes, state management patterns, or framework-specific details. Describe behavior, not implementation.

---

## Writing style

- **Be concrete, not abstract.** Every rule should have at least one example.
- **Prefer tables over prose** for structured data (field mappings, property lists, category-specific content).
- **Use template strings** to show data format: `{reference} · {element.name} • {category-specific content}`
- **Show real-looking examples**, not placeholders: `24185 · couv • Couché Satin 115g 64x90 Q/Q 5000ex`
- **Keep it scannable.** Developers won't read a spec linearly — they'll jump to the section they need. Use clear headings and consistent formatting.
- **Signal uncertainty explicitly.** If a rule needs refinement, say "TBD" or "to be decided with [stakeholder]" — don't hide ambiguity behind vague wording.

---

## File organization

```
docs/specs/
├── GUIDELINES.md              ← this file
├── feature-name/
│   ├── feature-name.md        ← English spec (reference)
│   ├── feature-name-fr.md     ← French spec
│   ├── mockup.html            ← interactive HTML mockup (self-contained)
│   ├── screenshots/           ← PNGs captured from the mockup
│   └── generate-pdf-fr.mjs    ← PDF generation script
└── other-feature/
    └── ...
```

---

## Asset generation pipeline

Specs often need visual assets (mockups, screenshots) and a PDF deliverable. Here is the standard toolchain and process.

### Prerequisites

| Tool | Location | Purpose |
|------|----------|---------|
| **Pandoc** | `pandoc` (homebrew) | Markdown → HTML conversion |
| **Playwright** | `@playwright/test` in `/Users/jpi/Documents/dev/claude-code/jcf/node_modules/playwright` | Headless browser for screenshots + PDF |

### Step 1: Interactive HTML mockup

Create a **self-contained HTML file** (`mockup.html`) that visually demonstrates the feature. This file:
- Is a single file with all CSS/JS inlined (no external dependencies)
- Shows before/after, mode toggles, or interactive variants the reader can explore
- Uses realistic data, not lorem ipsum
- Matches the app's visual style (dark theme, same fonts/colors)

The mockup serves two purposes: it lets the product owner validate the design interactively, and it is the source for screenshots embedded in the spec.

### Step 2: Screenshots from the mockup

Use Playwright to capture specific sections of the mockup as PNGs:

```javascript
import { chromium } from '/Users/jpi/Documents/dev/claude-code/jcf/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${resolve(__dirname, 'mockup.html')}`);

// Capture a specific element by selector
const element = await page.$('#section-offset');
await element.screenshot({ path: 'screenshots/tile-offset.png' });

await browser.close();
```

Save screenshots to `screenshots/` with descriptive names. These are then referenced in the markdown spec via `![Alt text](screenshots/filename.png)`.

### Step 3: Markdown → PDF

This is a two-stage process:

**3a. Convert Markdown to HTML with Pandoc:**

```bash
pandoc feature-name-fr.md -o feature-name-fr-tmp.html
```

**3b. Convert HTML to PDF with Playwright (`generate-pdf-fr.mjs`):**

The script does the following:
1. Reads the Pandoc-generated HTML
2. Replaces relative image paths (`screenshots/*.png`) with inline base64 data URIs (so the PDF is self-contained)
3. Injects custom CSS for print styling (fonts, table borders, code blocks, margins)
4. Renders to PDF via Playwright with A4 format, page numbers in footer

```bash
node generate-pdf-fr.mjs
```

Standard PDF settings:
- Format: A4
- Margins: top 15mm, bottom 20mm, left/right 12mm
- Footer: page number / total pages
- Background printing enabled

**PDF style philosophy:** compact and dense — favor smaller font sizes, tighter line-height, reduced margins and padding. The goal is to fit more content per page without wasting whitespace. But don't go to extremes (no 7pt body text, no 0px margins) — it should remain comfortably readable.

**3c. Clean up the temp HTML:**

```bash
rm feature-name-fr-tmp.html
```

### Generating all assets in one go

Typical full command sequence from the spec folder:

```bash
cd docs/specs/feature-name/

# 1. Screenshots from mockup
node capture-screenshots.mjs

# 2. Markdown → HTML → PDF
pandoc feature-name-fr.md -o feature-name-fr-tmp.html
node generate-pdf-fr.mjs
rm feature-name-fr-tmp.html
```

### Template: `generate-pdf-fr.mjs`

Each spec folder gets its own copy (paths are relative). The script follows this pattern:

```javascript
import { chromium } from '/Users/jpi/Documents/dev/claude-code/jcf/node_modules/playwright/index.mjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let html = readFileSync(resolve(__dirname, 'SPEC-NAME-fr-tmp.html'), 'utf-8');

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
  path: resolve(__dirname, 'SPEC-NAME-fr.pdf'),
  format: 'A4',
  margin: { top: '15mm', bottom: '20mm', left: '12mm', right: '12mm' },
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:9px;color:#888;width:100%;text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});
console.log('PDF generated.');
await browser.close();
```

Replace `SPEC-NAME` with the actual file name prefix.
