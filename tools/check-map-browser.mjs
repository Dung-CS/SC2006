import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Run: node tools/check-map-browser.mjs. Generated bundles/evidence stay ignored.
const base = new URL('../scratchpad/map-readability/', import.meta.url);
await mkdir(base, { recursive: true });
await build({ entryPoints: [new URL('map-browser-fixture.tsx', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')],
  bundle: true, outfile: new URL('browser.js', base).pathname.replace(/^\/(\w:)/, '$1'), format: 'iife',
  loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl', '.png': 'dataurl' } });
const server = createServer(async (req, res) => {
  const path = req.url === '/browser.js' ? 'browser.js' : req.url === '/browser.css' ? 'browser.css' : null;
  res.setHeader('Content-Type', path?.endsWith('js') ? 'text/javascript' : path ? 'text/css' : 'text/html');
  res.end(path ? await readFile(new URL(path, base)) : '<html><link rel="stylesheet" href="/browser.css"><body><div id="root"></div><script src="/browser.js"></script></body></html>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.DFENCE_BROWSER_EXECUTABLE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://www.onemap.gov.sg/**', (route) => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.testMap);
  const state = () => page.evaluate(() => ({ zoom: window.testMap.getZoom(), centre: window.testMap.getCenter() }));
  const stable = async (before) => { await page.waitForTimeout(350); assert.deepEqual(await state(), before); };
  // A user zooms before the async payload arrives. New data must not take the viewport back.
  await page.locator('.leaflet-control-zoom-in').click();
  await page.waitForTimeout(350); const first = await state();
  await page.evaluate(() => window.renderMap()); await stable(first);
  // Polling passes new arrays and callbacks. Repeated payloads must preserve zoom and pan.
  const canvas = page.locator('.map-canvas'); const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 30, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(500); const panned = await state();
  for (let i = 0; i < 4; i++) { await page.evaluate(() => window.renderMap()); await stable(panned); }
  // An explicit selection and a team change may frame once, then stay stable on refresh.
  await page.evaluate(() => window.renderMap({ selected: 'one' })); await page.waitForTimeout(500);
  const selected = await state();
  assert.notDeepEqual(selected.centre, panned.centre, 'Explicit focus must actually reframe after a suppressed initial fit');
  assert.ok(selected.centre.lat > 1.31 && selected.centre.lat < 1.34);
  assert.ok(selected.centre.lng > 103.83 && selected.centre.lng < 103.86);
  await page.locator('.leaflet-control-zoom-in').click(); await page.waitForTimeout(350); const zoomed = await state();
  assert.ok(zoomed.zoom > selected.zoom);
  await page.evaluate(() => window.renderMap({ selected: 'one' })); await stable(zoomed);
  await page.locator('.leaflet-control-zoom-in').click(); await page.waitForTimeout(350);
  const beforeTeam = await state();
  await page.evaluate(() => window.renderMap({ viewKey: 'team-two' })); await page.waitForTimeout(500);
  const team = await state(); assert.ok(team.zoom < beforeTeam.zoom, 'Team change must actually reframe'); await page.evaluate(() => window.renderMap({ viewKey: 'team-two' })); await stable(team);
  assert.equal(await page.locator('.cluster-map-pill').count(), 0);
  assert.equal(await page.locator('.route-stop-pin').count(), 2);
  await page.screenshot({ path: new URL('map-browser.png', base).pathname.replace(/^\/(\w:)/, '$1') });
  assert.deepEqual(errors, []);
  await writeFile(new URL('verification.json', base), JSON.stringify({ passed: true, first, panned, selected, zoomed, team, errors }, null, 2));
  console.log('PASS: late data, zoom control, pan, polling rerenders, selection, team framing, duplicate badges; no page errors.');
} finally { await browser.close(); server.close(); }
