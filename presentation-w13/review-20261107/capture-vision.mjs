// Mobile capture of the resident report form's photo analysis. Attaches a sample photo, which runs
// recognition only; the report is never submitted. Credentials come from DFENCE_RESIDENT_EMAIL/PASSWORD.
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../assets/v2');
const BASE = 'https://dfence-sc2006.azurewebsites.net';
const SAMPLE = process.argv[2] ?? 'ockroach';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
await page.getByLabel('Email').fill(process.env.DFENCE_RESIDENT_EMAIL);
await page.getByLabel('Password').fill(process.env.DFENCE_RESIDENT_PASSWORD);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30000 });
await page.goto(`${BASE}/report`, { waitUntil: 'networkidle' });

const chips = page.locator('.sample-photo-chip');
console.log('sample chips:', await chips.count(), '|', ((await page.locator('.sample-chips').textContent()) ?? '').replace(/[^\x20-\x7e]/g, ' '));
// Upload step: the photo picker before any photo is attached.
await page.locator('[data-part="photos"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.screenshot({ path: resolve(OUT_DIR, 'resident-upload-screen.png'), fullPage: false });
if (process.argv.includes('--upload-only')) { console.log('saved upload shot'); await browser.close(); process.exit(0); }
await chips.filter({ hasText: SAMPLE }).first().click();
const card = page.locator('[data-part="ai-vision-assessment"]');
await card.waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
console.log('vision:', ((await card.textContent()) ?? '').slice(0, 240).replace(/[^\x20-\x7e]/g, ' '));
await card.scrollIntoViewIfNeeded();
await page.screenshot({ path: resolve(OUT_DIR, 'resident-vision-screen.png'), fullPage: false });
await card.screenshot({ path: resolve(OUT_DIR, 'resident-vision-card.png') });
await page.locator('[data-part="photos"]').screenshot({ path: resolve(OUT_DIR, 'resident-vision-photos.png') });
console.log('saved; report not submitted');
await browser.close();
