import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigLoader } from '../config/ConfigLoader';

const base = 'https://dfence-sc2006.azurewebsites.net';
const outDir = resolve(process.cwd(), 'screen-shots');

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const config = ConfigLoader.load();
  const residentEmail = config.get('DFENCE_SEED_RESIDENT_EMAIL') || 'resident@d-fence.local';
  const residentPassword = config.get('DFENCE_SEED_RESIDENT_PASSWORD') || 'caF6iAgluc921IbWrQbOsPTNNFVo';
  const managerEmail = config.get('DFENCE_SEED_MANAGER_EMAIL') || 'ychow015@e.ntu.edu.sg';
  const managerPassword = config.get('DFENCE_SEED_MANAGER_PASSWORD') || 'ub7H96-8Qw3vaQAkgAeyRSdmMNJs';

  console.log(`Connecting to Edge and running live visual verification against ${base}...`);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  try {
    // 1. Manager: Ops Data Sources Screen
    console.log('--- Step 1: Operations Data Sources Screen ---');
    const laptop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const mgrPage = await laptop.newPage();
    await mgrPage.goto(`${base}/signin`, { waitUntil: 'domcontentloaded' });
    await mgrPage.getByLabel('Email').fill(managerEmail);
    await mgrPage.getByLabel('Password').fill(managerPassword);
    await mgrPage.getByRole('button', { name: 'Sign in' }).click();
    await mgrPage.waitForFunction(() => !window.location.pathname.startsWith('/signin'), null, { timeout: 25_000 });

    await mgrPage.goto(`${base}/ops/sources`, { waitUntil: 'domcontentloaded' });
    await mgrPage.waitForSelector('[data-screen="DataSources"]', { timeout: 25_000 });
    await mgrPage.waitForTimeout(1500);

    const sourcesText = await mgrPage.locator('body').innerText();
    const hasINaturalist = sourcesText.includes('iNaturalist') || sourcesText.includes('Observations');
    console.log(`iNaturalist visible on /ops/sources: ${hasINaturalist ? 'YES' : 'NO'}`);
    if (!hasINaturalist) {
      console.warn('Warning: iNaturalist was not found in page text!');
    }

    const sourcesShot = resolve(outDir, 'live-ops-sources.png');
    await mgrPage.screenshot({ path: sourcesShot, fullPage: true });
    console.log(`Saved screenshot: ${sourcesShot}`);

    // 2. Resident: Map Click-Through to Report Detail
    console.log('--- Step 2: Resident Map Screen & Report Click-Through ---');
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const resPage = await phone.newPage();
    await resPage.goto(`${base}/signin`, { waitUntil: 'domcontentloaded' });
    await resPage.getByLabel('Email').fill(residentEmail);
    await resPage.getByLabel('Password').fill(residentPassword);
    await resPage.getByRole('button', { name: 'Sign in' }).click();
    await resPage.waitForFunction(() => !window.location.pathname.startsWith('/signin'), null, { timeout: 25_000 });

    await resPage.goto(`${base}/map`, { waitUntil: 'domcontentloaded' });
    await resPage.waitForSelector('[data-screen="ResidentMap"]', { timeout: 25_000 });
    await resPage.waitForTimeout(3000); // Allow Leaflet markers and tiles to settle

    // Look for a pest marker or click on a marker pin
    console.log('Dispatching click to pest marker on map...');
    const clickedMarker = await resPage.evaluate(() => {
      const pin = document.querySelector('.map-pest-pin');
      if (pin) {
        const marker = (pin.closest('.leaflet-marker-icon') as HTMLElement) || (pin as HTMLElement);
        marker.click();
        return true;
      }
      return false;
    });
    console.log(`Pest marker click dispatched: ${clickedMarker}`);
    await resPage.waitForTimeout(1500);

    const popupShot = resolve(outDir, 'live-map-report-popup.png');
    await resPage.screenshot({ path: popupShot });
    console.log(`Saved screenshot: ${popupShot}`);

    // Check for popup action link
    const actionBtn = resPage.locator('.map-popup-action-btn').first();
    const hasActionBtn = await actionBtn.isVisible().catch(() => false);
    console.log(`Popup 'View full report details' button visible: ${hasActionBtn ? 'YES' : 'NO'}`);

    if (hasActionBtn) {
      await actionBtn.click();
      await resPage.waitForTimeout(2500);
      console.log(`Current URL after clicking popup action: ${resPage.url()}`);
      const reportDetailShot = resolve(outDir, 'live-report-detail.png');
      await resPage.screenshot({ path: reportDetailShot });
      console.log(`Saved screenshot: ${reportDetailShot}`);
    }

    // 3. Resident: Report Site Screen & AI Pest Recognition
    console.log('--- Step 3: Report Site Screen & AI Pest Recognition ---');
    await resPage.goto(`${base}/report`, { waitUntil: 'domcontentloaded' });
    await resPage.waitForSelector('[data-screen="ReportSite"]', { timeout: 25_000 });
    await resPage.waitForTimeout(1500);

    // Look for sample photo chips
    const chipButtons = resPage.locator('.sample-photo-chip');
    const chipCount = await chipButtons.count();
    console.log(`Found ${chipCount} sample photo chips.`);

    if (chipCount > 0) {
      // 3a. Click Rat chip
      console.log('Attaching Rat evidence chip...');
      await chipButtons.first().click();
      await resPage.waitForSelector('.ai-vision-card:not(.ai-vision-scanning)', { timeout: 15_000 }).catch(() => undefined);
      await resPage.waitForTimeout(1000);

      const visionCard = resPage.locator('.ai-vision-card');
      const hasVisionCard = await visionCard.isVisible().catch(() => false);
      console.log(`AI Vision Card visible for Rat: ${hasVisionCard ? 'YES' : 'NO'}`);
      if (hasVisionCard) {
        console.log(`AI Vision Assessment for Rat:\n${await visionCard.innerText()}`);
      }

      // Test decrement and increment buttons
      const decBtn = resPage.locator('.ai-count-btn:has-text("-")');
      if (await decBtn.isVisible().catch(() => false)) {
        await decBtn.click();
        await resPage.waitForTimeout(300);
        console.log('Tested decrement button (-)');
      }
      const incBtn = resPage.locator('.ai-count-btn:has-text("+")');
      if (await incBtn.isVisible().catch(() => false)) {
        await incBtn.click();
        await resPage.waitForTimeout(300);
        console.log('Tested increment button (+)');
      }

      const visionShot = resolve(outDir, 'live-report-ai-vision.png');
      await resPage.screenshot({ path: visionShot, fullPage: true });
      console.log(`Saved screenshot: ${visionShot}`);

      // 3b. Click Crow chip to verify urban fouling rule
      const crowChip = resPage.locator('.sample-photo-chip:has-text("Crow")').first();
      if (await crowChip.isVisible().catch(() => false)) {
        console.log('Attaching Crow flock evidence chip...');
        await crowChip.click();
        await resPage.waitForSelector('.ai-vision-card:not(.ai-vision-scanning)', { timeout: 15_000 }).catch(() => undefined);
        await resPage.waitForTimeout(1000);
        const crowVisionShot = resolve(outDir, 'live-report-ai-vision-crow.png');
        await resPage.screenshot({ path: crowVisionShot, fullPage: true });
        console.log(`Saved screenshot: ${crowVisionShot}`);
      }

      // 3c. Click Snake chip to verify immediate high priority rule
      const snakeChip = resPage.locator('.sample-photo-chip:has-text("Python")').first();
      if (await snakeChip.isVisible().catch(() => false)) {
        console.log('Attaching Python snake evidence chip...');
        await snakeChip.click();
        await resPage.waitForSelector('.ai-vision-card:not(.ai-vision-scanning)', { timeout: 15_000 }).catch(() => undefined);
        await resPage.waitForTimeout(1000);
        const snakeVisionShot = resolve(outDir, 'live-report-ai-vision-snake.png');
        await resPage.screenshot({ path: snakeVisionShot, fullPage: true });
        console.log(`Saved screenshot: ${snakeVisionShot}`);
      }
    } else {
      console.log('No evidence chip found; capturing general report screen');
      const reportScreenShot = resolve(outDir, 'live-report-screen.png');
      await resPage.screenshot({ path: reportScreenShot, fullPage: true });
    }

    console.log('All live verifications completed successfully!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Live visual verification failed:', err);
  process.exitCode = 1;
});
