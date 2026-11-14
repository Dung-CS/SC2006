// Read-only capture of a populated crew My Jobs view. Clicks tabs only; never toggles or submits.
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../assets/v2');
const BASE = 'https://dfence-sc2006.azurewebsites.net';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
await page.getByLabel('Email').fill('crew-demo-mto9gt35@d-fence.local');
await page.getByLabel('Password').fill('FieldWork2026x');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });
await page.goto(`${BASE}/crew`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

for (const tab of ['Today', 'Upcoming', 'All', 'Completed']) {
  await page.getByRole('button', { name: tab, exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  const empty = await page.getByText('Nothing here').count();
  console.log(`${tab}: ${empty ? 'empty' : 'has content'}`);
  if (!empty) {
    await page.screenshot({ path: resolve(OUT_DIR, `crew-jobs-${tab.toLowerCase()}.png`), fullPage: false });
    await page.screenshot({ path: resolve(OUT_DIR, `crew-jobs-${tab.toLowerCase()}-full.png`), fullPage: true });
  }
}
await browser.close();
