/** Boot a clean ZIP extraction with memory stores and blocked outbound HTTP. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyRelease } from './package-release.mjs';

const archive = resolve(process.argv[2] ?? 'scratchpad/ci-release/deploy.zip');
const manifest = JSON.parse(await readFile(join(dirname(archive), 'release-manifest.json'), 'utf8'));
const extraction = await mkdtemp(join(dirname(archive), 'smoke-'));
let child;
let output = '';
try {
  await verifyRelease(archive, manifest.archiveSha256, extraction);
  const listener = createServer();
  await new Promise((done, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', done); });
  const port = listener.address().port;
  await new Promise((done) => listener.close(done));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(DATABASE_URL$|AZURE_|DFENCE_VISION_|ONE_MAP_|TELEGRAM_|SUPABASE_|DFENCE_SEED_)/.test(key)) env[key] = '';
  const password = randomUUID();
  Object.assign(env, { PORT: String(port), DATABASE_URL: '', DFENCE_REQUIRE_HTTPS: 'false',
    DFENCE_SEED_MANAGER_EMAIL: 'release-smoke@d-fence.test', DFENCE_SEED_MANAGER_PASSWORD: password,
    DFENCE_SEED_RESIDENT_PASSWORD: '' });
  const entry = pathToFileURL(join(extraction, 'dist/src/server.mjs')).href;
  child = spawn(process.execPath, ['--input-type=module', '-e',
    `globalThis.fetch=async()=>{throw new Error('Outbound HTTP disabled for release smoke');};await import(${JSON.stringify(entry)});`],
    { cwd: extraction, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (data) => { output = (output + data).slice(-12000); });
  child.stderr.on('data', (data) => { output = (output + data).slice(-12000); });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error('Extracted server exited during startup.');
    try { ready = (await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await new Promise((done) => setTimeout(done, 250));
  }
  assert.ok(ready, 'Extracted server must become healthy.');
  const auth = await fetch(base + '/api/auth/signin', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.DFENCE_SEED_MANAGER_EMAIL, password }), signal: AbortSignal.timeout(5000) });
  assert.equal(auth.status, 200);
  const session = await auth.json();
  assert.equal(session.role, 'OperationsManager');
  const preview = await fetch(base + '/api/ops/dispatch/routes', {
    headers: { authorization: `Bearer ${session.token}` }, signal: AbortSignal.timeout(5000) });
  assert.equal(preview.status, 200);
  const body = await preview.json();
  assert.deepEqual(body.routes, []);
  assert.deepEqual(body.unplanned, []);
  const shell = await fetch(base + '/ops/dispatch', { signal: AbortSignal.timeout(5000) });
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /<html/i);
  console.log('PASS: clean release extraction starts; health, manager sign-in, route API and client shell respond. Memory stores only; outbound HTTP blocked.');
} catch (error) {
  console.error(error.message);
  console.error(output.replace(/sign in as.*$/gm, 'seed sign-in configured'));
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    const ended = new Promise((done) => child.once('exit', done));
    child.kill();
    await ended;
  }
  // extraction is a fresh mkdtemp child of the archive folder, never a source directory.
  if (dirname(extraction) !== dirname(archive)) throw new Error('Unsafe smoke extraction cleanup path.');
  await rm(extraction, { recursive: true, force: true });
}
