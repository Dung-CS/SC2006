// Read-only mobile capture of the crew "My dispatch" view. Scrolls only; never toggles or submits.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../assets/v2');
const BASE = 'https://dfence-sc2006.azurewebsites.net';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
const login = JSON.parse(readFileSync(resolve(fileURLToPath(new URL('.', import.meta.url)), '../../scratchpad/crew-login.json'), 'utf8'));
await page.getByLabel('Email').fill(login.email);
await page.getByLabel('Password').fill(login.password);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });
// The crew screen reads today's dispatch; ask for the dispatch's own date instead (read-only GET).
if (login.date) {
  await page.route('**/api/crew/dispatch/checklist', (route) => route.continue({ url: `${route.request().url()}?date=${login.date}` }));
}
await page.goto(`${BASE}/crew`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

const section = page.locator('[data-part="my-dispatch"]').first();
console.log('my-dispatch found:', await section.count());
console.log('text:', ((await section.textContent()) ?? '').slice(0, 200).replace(/[^\x20-\x7e]/g, '?'));
await page.screenshot({ path: resolve(OUT_DIR, 'crew-dispatch-top.png'), fullPage: false });
await page.screenshot({ path: resolve(OUT_DIR, 'crew-dispatch-full.png'), fullPage: true });
const stops = page.locator('[data-part="dispatch-stops"]').first();
if (await stops.count()) {
  await stops.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(OUT_DIR, 'crew-dispatch-stops.png'), fullPage: false });
}
console.log('saved');
await browser.close();
