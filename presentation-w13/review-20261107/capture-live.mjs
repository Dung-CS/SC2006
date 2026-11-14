import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR = resolve(__dirname, '../assets/v2');
const BASE = 'https://dfence-sc2006.azurewebsites.net';

async function main() {
  console.log('Launching Edge...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // 1. Sign in as manager
  console.log('Signing in as Operations Manager...');
  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('ychow015@e.ntu.edu.sg');
  await page.getByLabel('Password').fill('ub7H96-8Qw3vaQAkgAeyRSdmMNJs');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });
  console.log('Signed in. Current URL:', page.url());

  // 2. Capture /ops/dispatch (Streamlined Dispatch Cards)
  console.log('Navigating to /ops/dispatch...');
  await page.goto(`${BASE}/ops/dispatch`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Allow leaflet & cards to settle
  await page.screenshot({ path: resolve(OUT_DIR, 'manager-dispatch-cards.png'), fullPage: false });
  console.log('Saved manager-dispatch-cards.png');

  // Check for "View & Edit Dispatch Details" button or link
  const detailsBtn = page.getByRole('button', { name: /View & Edit Dispatch Details|Details/i }).first();
  const hasDetailsBtn = await detailsBtn.isVisible().catch(() => false);
  if (hasDetailsBtn) {
    console.log('Clicking View & Edit Dispatch Details...');
    await detailsBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: resolve(OUT_DIR, 'manager-dispatch-details.png'), fullPage: false });
    console.log('Saved manager-dispatch-details.png');
  } else {
    console.log('Details button not found on dispatch card, inspecting page links...');
    const links = await page.locator('a').evaluateAll(els => els.map(e => e.href));
    console.log('Links on dispatch page:', links.filter(l => l.includes('/ops/')));
  }

  // 3. Capture /ops (Dashboard with Priority Table)
  console.log('Navigating to /ops (Dashboard)...');
  await page.goto(`${BASE}/ops`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(OUT_DIR, 'manager-ops-dashboard.png'), fullPage: false });
  console.log('Saved manager-ops-dashboard.png');

  // Find a cluster row to capture cluster breakdown
  const clusterLink = page.locator('table a').first();
  if (await clusterLink.isVisible().catch(() => false)) {
    console.log('Opening cluster detail...');
    await clusterLink.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: resolve(OUT_DIR, 'manager-cluster-detail.png'), fullPage: false });
    console.log('Saved manager-cluster-detail.png');
  }

  // 4. Sign in as Cleaning Crew
  console.log('Signing in as Cleaning Crew...');
  const crewContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, // mobile view for field crew
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const crewPage = await crewContext.newPage();
  await crewPage.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
  await crewPage.getByLabel('Email').fill('crew-demo-mto9gt35@d-fence.local');
  await crewPage.getByLabel('Password').fill('FieldWork2026x');
  await crewPage.getByRole('button', { name: 'Sign in' }).click();
  await crewPage.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });
  console.log('Crew signed in. URL:', crewPage.url());

  // Capture /crew or My Jobs
  await crewPage.waitForTimeout(3000);
  await crewPage.screenshot({ path: resolve(OUT_DIR, 'crew-my-jobs.png'), fullPage: false });
  console.log('Saved crew-my-jobs.png');

  // Also desktop view for crew
  const crewDesktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const crewDeskPage = await crewDesktopContext.newPage();
  await crewDeskPage.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
  await crewDeskPage.getByLabel('Email').fill('crew-demo-mto9gt35@d-fence.local');
  await crewDeskPage.getByLabel('Password').fill('FieldWork2026x');
  await crewDeskPage.getByRole('button', { name: 'Sign in' }).click();
  await crewDeskPage.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });
  await crewDeskPage.waitForTimeout(3000);
  await crewDeskPage.screenshot({ path: resolve(OUT_DIR, 'crew-jobs-desktop.png'), fullPage: false });
  console.log('Saved crew-jobs-desktop.png');

  // 5. Sign in as Resident
  console.log('Signing in as Resident...');
  const resContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const resPage = await resContext.newPage();
  await resPage.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
  await resPage.getByLabel('Email').fill('resident@d-fence.local');
  await resPage.getByLabel('Password').fill('caF6iAgluc921IbWrQbOsPTNNFVo');
  await resPage.getByRole('button', { name: 'Sign in' }).click();
  await resPage.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });
  console.log('Resident signed in. URL:', resPage.url());

  // Capture Report Site page
  await resPage.goto(`${BASE}/report`, { waitUntil: 'networkidle' });
  await resPage.waitForTimeout(2000);
  await resPage.screenshot({ path: resolve(OUT_DIR, 'resident-report-form.png'), fullPage: false });
  console.log('Saved resident-report-form.png');

  // Capture My Reports page
  await resPage.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  await resPage.waitForTimeout(2000);
  await resPage.screenshot({ path: resolve(OUT_DIR, 'resident-my-reports.png'), fullPage: false });
  console.log('Saved resident-my-reports.png');

  // Capture Resident Map
  await resPage.goto(`${BASE}/map`, { waitUntil: 'networkidle' });
  await resPage.waitForTimeout(3000);
  await resPage.screenshot({ path: resolve(OUT_DIR, 'resident-map.png'), fullPage: false });
  console.log('Saved resident-map.png');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
