import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR = resolve(__dirname, '../assets/v2');
const BASE = 'https://dfence-sc2006.azurewebsites.net';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('ychow015@e.ntu.edu.sg');
  await page.getByLabel('Password').fill('ub7H96-8Qw3vaQAkgAeyRSdmMNJs');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });

  await page.goto(`${BASE}/ops/dispatch`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click via evaluate to bypass visibility check if it was scrolled off or under a fixed bar
  console.log('Evaluating click on open-dispatch-details...');
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('[data-part="open-dispatch-details"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked result:', clicked);

  if (clicked) {
    await page.waitForTimeout(2000);
    // Take screenshot of the details page section
    const detailsSection = page.locator('.dispatch-details-page').first();
    if (await detailsSection.isVisible().catch(() => false)) {
      await detailsSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await detailsSection.screenshot({ path: resolve(OUT_DIR, 'manager-dispatch-details.png') });
      console.log('Saved manager-dispatch-details.png from element!');
    } else {
      await page.screenshot({ path: resolve(OUT_DIR, 'manager-dispatch-details.png'), fullPage: true });
      console.log('Saved manager-dispatch-details.png fullpage!');
    }
  }

  await browser.close();
}

main().catch(console.error);
