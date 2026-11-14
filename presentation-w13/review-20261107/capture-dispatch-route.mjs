// Read-only: opens the planned-routes panel and one dispatch's details page. Never saves or edits.
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../assets/v2');
const BASE = 'https://dfence-sc2006.azurewebsites.net';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
await page.getByLabel('Email').fill('ychow015@e.ntu.edu.sg');
await page.getByLabel('Password').fill('ub7H96-8Qw3vaQAkgAeyRSdmMNJs');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });

await page.goto(`${BASE}/ops/dispatch`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.evaluate(() => document.querySelectorAll('details.dispatch-details').forEach((d) => { d.open = true; }));
await page.waitForTimeout(2500);

// the route with the most stops makes the fullest example
const card = await page.evaluateHandle(() => {
  const cards = [...document.querySelectorAll('article[data-team]')];
  cards.sort((a, b) => b.querySelectorAll('li').length - a.querySelectorAll('li').length);
  return cards[0] || null;
});
const el = card.asElement();
if (!el) {
  console.log('no route cards found');
  await browser.close();
  process.exit(1);
}
console.log('team', await el.getAttribute('data-team'));
await el.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await el.screenshot({ path: resolve(OUT_DIR, 'manager-route-card.png') });
console.log('saved manager-route-card.png');

await (await el.$('[data-part="open-dispatch-details"]')).click();
await page.waitForTimeout(3000);
const details = page.locator('[data-part="dispatch-details-page"]').first();
await details.scrollIntoViewIfNeeded();
await details.screenshot({ path: resolve(OUT_DIR, 'manager-route-details-full.png') });
console.log('saved manager-route-details-full.png');

const parts = {
  'manager-route-vehicle': 'section[aria-label="Assigned vehicle and cargo load"]',
  'manager-route-logistics': 'section[aria-label="Logistics equipment checklist"]',
  'manager-route-stops': 'section[aria-label="Route and stops details"]',
};
for (const [name, sel] of Object.entries(parts)) {
  const s = details.locator(sel).first();
  if (await s.count()) {
    await s.scrollIntoViewIfNeeded();
    await s.screenshot({ path: resolve(OUT_DIR, `${name}.png`) });
    console.log(`saved ${name}.png`);
  } else {
    console.log(`missing ${name}`);
  }
}
await browser.close();
