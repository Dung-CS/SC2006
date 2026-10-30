/**
 * D-Fence — bundle the client.
 *
 *     node client/build.mjs           # one build into client/dist
 *     node client/build.mjs --watch   # rebuild on change, for development
 *
 * esbuild rather than a framework toolchain, deliberately. The client imports types and constants
 * from `src/` — `ReportSiteScreen` takes its character limit from the server's own module rather
 * than retyping it — so the bundler has to follow imports out of `client/` and into the server
 * tree, and it has to do so without a configuration file that becomes its own thing to maintain.
 * This is the whole build: one entry point, one output, no plugins.
 *
 * **Type checking is not done here.** esbuild strips types without reading them; `npm run
 * typecheck` is what proves the client compiles, and it runs over the same files. A build that
 * "succeeded" while the code did not typecheck would be the worst of both.
 */
import { build, context } from 'esbuild';
import { copyFile, cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(here, 'dist');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [resolve(here, 'src', 'main.tsx')],
  outfile: resolve(outdir, 'app.js'),
  bundle: true,
  // IIFE rather than ESM, and for one reason worth recording: jsdom cannot execute ES modules, so
  // an ESM bundle can only be smoke-tested by building a second, different artefact — and a test
  // that runs a different bundle from the one served proves the wrong thing. There is one entry
  // point and no dynamic import here, so IIFE costs nothing and keeps the tested artefact and the
  // served artefact byte-identical.
  format: 'iife',
  platform: 'browser',
  // The browsers a marker and a teaching lab will actually have. Lower than this and React 18's
  // own output stops being valid anyway.
  target: ['es2020', 'chrome100', 'firefox100', 'safari15'],
  jsx: 'automatic',
  sourcemap: true,
  // Minified, because 10.1.2's one-second budget includes the download, and the difference is
  // roughly a factor of three. The source map means the minification costs nothing in debuggability.
  minify: true,
  // `process.env.NODE_ENV` appears inside React's own source; without this the bundle carries the
  // development build, which is markedly slower and warns into the console of a live demonstration.
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
};

await mkdir(outdir, { recursive: true });
await copyFile(resolve(here, 'index.html'), resolve(outdir, 'index.html'));
/**
 * One stylesheet, not two. Leaflet ships its own CSS and the map is unusable without it (every
 * pane is absolutely positioned by those rules), but `index.html` links exactly one stylesheet and
 * the CSP allows `style-src 'self'` with no inline styles - so the two are concatenated here
 * rather than added as a second `<link>` a future edit could forget.
 */
const leafletCss = await readFile(
  resolve(here, '..', 'node_modules', 'leaflet', 'dist', 'leaflet.css'),
  'utf8',
);
// Leaflet's stylesheet references four sprites with relative URLs. Nothing here uses the default
// marker or the built-in layers control, so they would never be requested - but copying them costs
// four files and removes any chance of a 404 in the console during a demonstration.
await mkdir(resolve(outdir, 'images'), { recursive: true });
const leafletImages = resolve(here, '..', 'node_modules', 'leaflet', 'dist', 'images');
for (const name of await readdir(leafletImages)) {
  await copyFile(resolve(leafletImages, name), resolve(outdir, 'images', name));
}

/**
 * Inter and IBM Plex Mono, self-hosted.
 *
 * Inter (400/500/600/700) is the interface face, per client/DESIGN.md. IBM Plex Mono (400/500)
 * stays for code-like values (`--mono`).
 *
 * Copied from npm and served from our own origin, for the same reason Leaflet is: the CSP names no
 * external font host, so `font-src 'self'` must stay intact.
 *
 * Latin only, and only the weights the stylesheet asks for. woff2 alone: every browser in the
 * `target` list above has supported it for years, and the woff fallback would double the bytes.
 */
const FONT_FACES = [
  { family: 'Inter', pkg: 'inter', weights: [400, 500, 600, 700] },
  { family: 'IBM Plex Mono', pkg: 'ibm-plex-mono', weights: [400, 500] },
];

await mkdir(resolve(outdir, 'fonts'), { recursive: true });
let fontCss = '';
for (const { family, pkg, weights } of FONT_FACES) {
  for (const weight of weights) {
    const file = `${pkg}-latin-${weight}-normal.woff2`;
    await copyFile(
      resolve(here, '..', 'node_modules', '@fontsource', pkg, 'files', file),
      resolve(outdir, 'fonts', file),
    );
    // `font-display: swap` - the text is readable in the fallback while the face downloads, which
    // matters more here than avoiding the reflow: 10.1.2 budgets one second, and a blocking font
    // spends it on a blank screen.
    fontCss +=
      `@font-face {
` +
      `  font-family: '${family}';
` +
      `  font-style: normal;
` +
      `  font-weight: ${weight};
` +
      `  font-display: swap;
` +
      `  src: url('/fonts/${file}') format('woff2');
` +
      `}
`;
  }
}

const ourCss = await readFile(resolve(here, 'styles.css'), 'utf8');

// Validate CSS brace balance so unclosed rules cannot corrupt concatenated vendor bundles (e.g. leaflet.css)
const openBraces = (ourCss.match(/{/g) || []).length;
const closeBraces = (ourCss.match(/}/g) || []).length;
if (openBraces !== closeBraces) {
  throw new Error(`CSS brace balance error in styles.css: ${openBraces} opening vs ${closeBraces} closing braces. Unclosed rule would corrupt Leaflet styles.`);
}

/**
 * Tailwind v4 utilities, from `client/tailwind.css` (no Preflight; see that file). The CLI is run
 * as a child process and its stdout appended to the same one stylesheet, after ours, so the build
 * gains one step and no plugin.
 */
const tailwindCss = execFileSync(
  process.execPath,
  [resolve(here, '..', 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'), '-i', resolve(here, 'tailwind.css'), '--minify'],
  { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);

await writeFile(
  resolve(outdir, 'styles.css'),
  `/* --- Inter and IBM Plex Mono, self-hosted rather than fetched from Google Fonts --- */
${fontCss}
${ourCss}

/* --- Tailwind utilities (client/tailwind.css) --- */
${tailwindCss}

/* --- Leaflet 1.9.4, bundled rather than fetched from a CDN --- */
${leafletCss}
`,
);

/**
 * Everything in `client/public` is served from the root: the manifest, the icons and the service
 * worker (11.8.1-11.8.4, 11.8.7).
 *
 * The service worker in particular MUST be at the root, because a worker's scope cannot rise above
 * the path it was served from — one served from `/assets/sw.js` could not control `/` and would
 * silently control nothing.
 */
const publicDir = resolve(here, 'public');
for (const name of await readdir(publicDir)) {
  await cp(resolve(publicDir, name), resolve(outdir, name), { recursive: true });
}

/**
 * 11.8.11 — stamp the service worker with a hash of what it caches.
 *
 * The cache name contains this stamp, and `activate` deletes every cache that is not the current
 * one, so a deployment that changes the bundle changes the cache and the old shell goes. With a
 * fixed cache name an installed application serves a version of itself that no longer exists on
 * the server, and the user's only escape is clearing site data — which they will not think of.
 */
async function stampServiceWorker() {
  const hash = createHash('sha256');
  for (const name of ['app.js', 'index.html', 'styles.css']) {
    hash.update(await readFile(resolve(outdir, name)));
  }
  const stamp = hash.digest('hex').slice(0, 12);
  const worker = await readFile(resolve(publicDir, 'sw.js'), 'utf8');
  // `replaceAll`, not `replace`. The placeholder appears in the file's own doc comment before it
  // appears in the `VERSION` constant, so `replace` stamped the comment and left the constant
  // reading `__BUILD__` — one fixed cache name for every build ever, which is precisely the defect
  // the stamp exists to prevent. Caught by a test that executed the worker rather than reading it.
  const stamped = worker.replaceAll('__BUILD__', stamp);
  if (stamped.includes('__BUILD__')) {
    throw new Error('the service worker still contains an unstamped placeholder');
  }
  await writeFile(resolve(outdir, 'sw.js'), stamped, 'utf8');
  return stamp;
}

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('watching client/src for changes…');
} else {
  await build(options);
  const stamp = await stampServiceWorker();
  console.log(`client bundled into ${outdir} (service worker build ${stamp})`);
}
