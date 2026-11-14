import { chromium } from 'playwright-core';
import { resolve } from 'node:path';

async function test() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('https://dfence-sc2006.azurewebsites.net/signin');
  await page.getByLabel('Email').fill('resident@d-fence.local');
  await page.getByLabel('Password').fill('caF6iAgluc921IbWrQbOsPTNNFVo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/map', { timeout: 20000 });
  await page.waitForTimeout(3000);

  const count = await page.locator('.map-pest-pin').count();
  console.log('map-pest-pin count:', count);
  if (count > 0) {
    // Click on the parent .leaflet-marker-icon or the .map-pest-pin
    await page.evaluate(() => {
      const pin = document.querySelector('.map-pest-pin');
      if (pin) {
        const marker = pin.closest('.leaflet-marker-icon') as HTMLElement || pin as HTMLElement;
        marker.click();
      }
    });
    await page.waitForTimeout(1000);
    const hasBtn = await page.locator('.map-popup-action-btn').isVisible().catch(() => false);
    console.log('map-popup-action-btn visible:', hasBtn);
    if (hasBtn) {
      console.log('btn text:', await page.locator('.map-popup-action-btn').innerText());
      await page.screenshot({ path: resolve(process.cwd(), 'screen-shots/live-map-report-popup.png') });
      await page.locator('.map-popup-action-btn').click();
      await page.waitForTimeout(2000);
      console.log('navigated to:', page.url());
      await page.screenshot({ path: resolve(process.cwd(), 'screen-shots/live-report-detail.png') });
    } else {
      // Print popup HTML
      const popupHtml = await page.evaluate(() => document.querySelector('.leaflet-popup-content')?.outerHTML);
      console.log('Popup HTML:', popupHtml);
    }
  }
  await browser.close();
}

test().catch(console.error);
