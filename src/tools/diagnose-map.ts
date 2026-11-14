import { chromium } from 'playwright-core';
import { resolve } from 'node:path';

async function diagnose() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  
  for (const [device, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ] as const) {
    console.log(`\n=== Testing ${device} (${viewport.width}x${viewport.height}) ===`);
    const page = await browser.newPage({ viewport });

    const consoleMessages: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    });

    // Sign in as resident
    await page.goto('https://dfence-sc2006.azurewebsites.net/signin');
    await page.getByLabel('Email').fill('resident@d-fence.local');
    await page.getByLabel('Password').fill('caF6iAgluc921IbWrQbOsPTNNFVo');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/map', { timeout: 20000 });
    await page.waitForTimeout(3500);

    // Inspect map container and tiles
    const mapAnalysis = await page.evaluate(() => {
      const mapCanvas = document.querySelector('.map-canvas') as HTMLElement | null;
      const leafletContainer = document.querySelector('.leaflet-container') as HTMLElement | null;
      const tilePane = document.querySelector('.leaflet-tile-pane') as HTMLElement | null;
      const tiles = Array.from(document.querySelectorAll('.leaflet-tile')) as HTMLImageElement[];
      const clusterPolygons = Array.from(document.querySelectorAll('.cluster-polygon'));
      const markers = Array.from(document.querySelectorAll('.map-pest-pin, .custom-map-pin'));
      const pills = Array.from(document.querySelectorAll('.cluster-map-pill'));

      return {
        mapCanvas: mapCanvas ? {
          offsetWidth: mapCanvas.offsetWidth,
          offsetHeight: mapCanvas.offsetHeight,
          clientWidth: mapCanvas.clientWidth,
          clientHeight: mapCanvas.clientHeight,
          display: window.getComputedStyle(mapCanvas).display,
          position: window.getComputedStyle(mapCanvas).position,
          height: window.getComputedStyle(mapCanvas).height,
        } : null,
        leafletContainer: leafletContainer ? {
          offsetWidth: leafletContainer.offsetWidth,
          offsetHeight: leafletContainer.offsetHeight,
          position: window.getComputedStyle(leafletContainer).position,
        } : null,
        tilePane: tilePane ? {
          transform: window.getComputedStyle(tilePane).transform,
          filter: window.getComputedStyle(tilePane).filter,
        } : null,
        tilesCount: tiles.length,
        loadedTilesCount: tiles.filter((t) => t.complete && t.naturalWidth > 0).length,
        sampleTileSrc: tiles[0]?.src ?? null,
        sampleTileRect: tiles[0] ? tiles[0].getBoundingClientRect() : null,
        clusterPolygonsCount: clusterPolygons.length,
        markersCount: markers.length,
        pillsCount: pills.length,
      };
    });

    console.log('Map analysis:', JSON.stringify(mapAnalysis, null, 2));
    if (consoleMessages.length > 0) {
      console.log('Console messages:', consoleMessages.slice(0, 10));
    }
    if (failedRequests.length > 0) {
      console.log('Failed requests:', failedRequests.slice(0, 10));
    }

    const shotPath = resolve(process.cwd(), `screen-shots/diagnose-map-${device}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Saved screenshot to ${shotPath}`);

    const shotFullPath = resolve(process.cwd(), `screen-shots/diagnose-map-${device}-full.png`);
    await page.screenshot({ path: shotFullPath, fullPage: true });
    console.log(`Saved full page screenshot to ${shotFullPath}`);
  }

  await browser.close();
}

diagnose().catch(console.error);
