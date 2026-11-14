import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const LOGOS_DIR = path.resolve(__dirname, '../assets/logos');

const ICONS = [
  { name: 'vitest', slug: 'vitest', color: 'FCC72B' },
  { name: 'playwright', slug: 'playwright', color: '2EAD33' },
  { name: 'testinglibrary', slug: 'testinglibrary', color: 'E33332' },
  { name: 'tailwindcss', slug: 'tailwindcss', color: '06B6D4' },
];

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });

  for (const icon of ICONS) {
    const pngPath = path.resolve(LOGOS_DIR, `${icon.name}.png`);
    if (fs.existsSync(pngPath)) {
      console.log(`Already exists: ${icon.name}.png`);
      continue;
    }
    const url = `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/${icon.slug}.svg`;
    try {
      console.log(`Fetching ${url}...`);
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`Failed to fetch ${icon.name}: ${resp.status}`);
        continue;
      }
      const svg = await resp.text();
      const html = `<!DOCTYPE html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div style="width:380px;height:380px;display:flex;align-items:center;justify-content:center;">
          ${svg.replace('<svg ', `<svg width="360" height="360" fill="#${icon.color}" `)}
        </div>
      </body></html>`;
      await page.setContent(html);
      await page.screenshot({ path: pngPath, omitBackground: true });
      console.log(`Saved ${pngPath}`);
    } catch (e) {
      console.error(`Error for ${icon.name}:`, e.message);
    }
  }

  await browser.close();
}

main().catch(console.error);
