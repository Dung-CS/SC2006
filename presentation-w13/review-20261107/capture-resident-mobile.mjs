// Read-only mobile capture of resident pages. Navigates, scrolls and opens a report; never submits.
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../assets/v2');
const BASE = 'https://dfence-sc2006.azurewebsites.net';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
await page.getByLabel('Email').fill('resident@d-fence.local');
await page.getByLabel('Password').fill('caF6iAgluc921IbWrQbOsPTNNFVo');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });

const shot = async (name) => {
  await page.screenshot({ path: resolve(OUT_DIR, `${name}.png`), fullPage: false });
  console.log(`saved ${name}.png`);
};

await page.goto(`${BASE}/report`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await shot('m-resident-report-top');
await page.mouse.wheel(0, 700);
await page.waitForTimeout(1200);
await shot('m-resident-report-mid');
await page.mouse.wheel(0, 900);
await page.waitForTimeout(1200);
await shot('m-resident-report-low');

await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await shot('m-resident-my-reports');
const first = page.locator('a[href*="/reports/"]').first();
if (await first.count()) {
  await first.click();
  await page.waitForTimeout(2500);
  console.log('detail url', page.url());
  await shot('m-resident-report-detail');
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(1200);
  await shot('m-resident-report-detail-2');
} else {
  console.log('no report links found');
}

await page.goto(`${BASE}/map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await shot('m-resident-map');
await browser.close();
