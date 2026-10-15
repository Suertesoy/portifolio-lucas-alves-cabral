/* Renders scripts/social-cover/cover.html to assets/social/cover-1200x630.png (exactly 1200 × 630).

   Needs Playwright's browser engine only for this one-off export — it is NOT a project dependency and is not used by the
   site build. Provide it however is convenient:
     npm i --no-save playwright-core && npx playwright-core install chromium     (then: npm run cover)
   or point PLAYWRIGHT_CORE at an existing install:  PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core npm run cover
   Fonts (Inter Tight, JetBrains Mono) come from Google Fonts, as on the site, so the export needs network access. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const OUT = path.join(ROOT, 'assets', 'social', process.env.COVER_NAME || 'cover-1200x630.png');
const FORMAT = OUT.endsWith('.jpg') ? 'jpeg' : 'png';

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(HERE, 'cover.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
await page.waitForTimeout(300);
await page.screenshot({ path: OUT, type: FORMAT, ...(FORMAT === 'jpeg' ? { quality: 92 } : {}), clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();

const b = fs.readFileSync(OUT);
const dims = FORMAT === 'png' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
console.log(`wrote ${path.relative(ROOT, OUT)} — ${(b.length / 1024).toFixed(0)} KB${dims ? `, ${dims[0]}×${dims[1]}` : ''}`);
