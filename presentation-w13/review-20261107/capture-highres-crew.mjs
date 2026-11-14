import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR = resolve(__dirname, '../assets/v2');
const BASE = 'https://dfence-sc2006.azurewebsites.net';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  // Viewport 480x960 with deviceScaleFactor: 3 produces 1440x2880 pixels (>300 DPI)
  const context = await browser.newContext({
    viewport: { width: 480, height: 960 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('crew-demo-mto9gt35@d-fence.local');
  await page.getByLabel('Password').fill('FieldWork2026x');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });

  await page.goto(`${BASE}/crew`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: resolve(OUT_DIR, 'crew-my-jobs.png'), fullPage: false });
  console.log('Saved high-res crew-my-jobs.png');

  await browser.close();
}

main().catch(console.error);
