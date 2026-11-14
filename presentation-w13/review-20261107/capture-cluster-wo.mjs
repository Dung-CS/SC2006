import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR = resolve(__dirname, '../assets/v2');
const BASE = 'https://dfence-sc2006.azurewebsites.net';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('ychow015@e.ntu.edu.sg');
  await page.getByLabel('Password').fill('ub7H96-8Qw3vaQAkgAeyRSdmMNJs');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });

  // 1. Cluster detail (scoring drivers)
  console.log('Navigating to cluster detail...');
  await page.goto(`${BASE}/ops/clusters/c62ed749-ff4a-4272-bb07-f2036199fb10`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(OUT_DIR, 'manager-cluster-detail.png'), fullPage: false });
  console.log('Saved manager-cluster-detail.png');

  // 2. Work order detail (showing lifecycle state)
  console.log('Navigating to work order detail...');
  await page.goto(`${BASE}/ops/work-orders/b3a97e56-ad57-4805-b5f2-53edfe555c70`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(OUT_DIR, 'manager-wo-detail.png'), fullPage: false });
  console.log('Saved manager-wo-detail.png');

  await browser.close();
}

main().catch(console.error);
