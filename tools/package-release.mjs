/** Build a runtime-only ZIP without pruning or changing the development installation. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, appendFile, cp, mkdir, readFile, realpath, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = ['dist/src/server.mjs', 'dist/client/dist/index.html', 'dist/client/dist/app.js',
  'dist/client/dist/styles.css', 'dist/certs/prod-ca-2021.crt', 'config/pests.default.json',
  'config/scoring.default.json', 'package.json'];
const omittedSuffix = /\.(map|log|stackdump|pem|key|p12|pfx)$/i;
const omitted = (name) => name === '.git' || name === '.bin' || name.startsWith('.env') || omittedSuffix.test(name);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function inside(parent, target) {
  const rel = relative(parent, target);
  return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}
async function exists(path) { try { await access(path, constants.F_OK); return true; } catch { return false; } }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, ...options });
  if (result.error || result.status !== 0) throw new Error(`${basename(command)} failed: ${result.error?.message ?? result.stderr?.trim() ?? result.status}`);
  return result.stdout;
}
function python(code, args) {
  for (const command of ['python3', 'python']) {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (!probe.error && probe.status === 0) return run(command, ['-c', code, ...args]);
  }
  throw new Error('Python 3 is required for standard-library ZIP creation and CRC validation.');
}
async function productionPackages() {
  // Run npm through Node so Windows never needs shell interpolation for npm.cmd.
  const nodeDir = dirname(process.execPath);
  const candidates = [process.env.npm_execpath, join(nodeDir, 'node_modules/npm/bin/npm-cli.js'),
    resolve(nodeDir, '../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
  const npm = (await Promise.all(candidates.map(async (path) => await exists(path) ? path : null))).find(Boolean);
  if (!npm) throw new Error('Cannot locate npm-cli.js beside the current Node installation.');
  const inventory = run(process.execPath, [npm, 'ls', '--parseable', '--omit=dev', '--all'], { cwd: root });
  const modules = await realpath(join(root, 'node_modules'));
  const packages = new Map();
  for (const line of inventory.trim().split(/\r?\n/)) {
    const path = await realpath(line.trim());
    if (path === await realpath(root)) continue;
    if (!inside(modules, path)) throw new Error('A production dependency resolves outside node_modules.');
    packages.set(relative(modules, path), path);
  }
  const spec = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  for (const name of Object.keys(spec.dependencies ?? {})) {
    if (!packages.has(name.split('/').join(sep))) throw new Error(`Production dependency missing: ${name}`);
  }
  return { packages, spec };
}
async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await files(join(directory, entry.name), name));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`Release contains an unsupported link or special file: ${name}`);
  }
  return result.sort();
}
async function copyFiltered(source, destination) {
  await cp(source, destination, { recursive: true, dereference: false,
    filter: (path) => path === source || (!omitted(basename(path)) && basename(path) !== 'node_modules') });
}

export async function packageRelease(out = join(root, 'scratchpad/ci-release')) {
  out = resolve(out);
  if (!inside(root, out) || out === join(root, 'node_modules') || out === join(root, 'dist')) throw new Error('Release output must be a dedicated folder inside this repository.');
  const { packages, spec } = await productionPackages();
  const payload = join(out, 'payload');
  if (!inside(out, payload)) throw new Error('Unsafe staging directory.');
  await rm(payload, { recursive: true, force: true });
  await mkdir(payload, { recursive: true });
  await copyFiltered(join(root, 'dist'), join(payload, 'dist'));
  await mkdir(join(payload, 'config'), { recursive: true });
  for (const name of ['pests.default.json', 'scoring.default.json']) {
    const bytes = await readFile(join(root, 'config', name));
    JSON.parse(bytes.toString());
    await writeFile(join(payload, 'config', name), bytes);
  }
  const runtimeSpec = { name: spec.name, version: spec.version, private: true, type: spec.type,
    engines: spec.engines, scripts: { start: spec.scripts.start }, dependencies: spec.dependencies };
  await writeFile(join(payload, 'package.json'), JSON.stringify(runtimeSpec, null, 2) + '\n');
  for (const [name, source] of packages) await copyFiltered(source, join(payload, 'node_modules', name));
  for (const name of required) if (!await exists(join(payload, name))) throw new Error(`Required release file missing: ${name}`);
  const entries = await files(payload);
  if (!entries.some((name) => name.startsWith('dist/client/dist/fonts/') && name.endsWith('.woff2'))) throw new Error('Client font assets missing.');
  const archive = join(out, 'deploy.zip');
  // Commit time, not a fixed date: App Service skips a file whose size and time both match, so a
  // same-length edit (a colour change) would otherwise never reach production.
  const committed = run('git', ['log', '-1', '--format=%ct'], { cwd: root }).trim();
  python(`import pathlib,sys,time,zipfile
base=pathlib.Path(sys.argv[1])
stamp=time.gmtime(int(sys.argv[3]))[:6]
with zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(base.rglob('*')):
  if p.is_file():
   info=zipfile.ZipInfo(p.relative_to(base).as_posix(),date_time=stamp)
   info.compress_type=zipfile.ZIP_DEFLATED
   info.external_attr=0o100644 << 16
   z.writestr(info,p.read_bytes())`, [payload, archive, committed]);
  const manifest = { schemaVersion: 1, commitSha: process.env.GITHUB_SHA ?? null,
    archiveSha256: sha256(await readFile(archive)), serverSha256: sha256(await readFile(join(payload, 'dist/src/server.mjs'))),
    clientSha256: sha256(await readFile(join(payload, 'dist/client/dist/app.js'))),
    archiveBytes: (await stat(archive)).size, entryCount: entries.length,
    entries: await Promise.all(entries.map(async (path) => ({ path, sha256: sha256(await readFile(join(payload, path))) }))) };
  await writeFile(join(out, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(out, 'archive.sha256'), `${manifest.archiveSha256}  deploy.zip\n`);
  await verifyRelease(archive, manifest.archiveSha256);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,
    `archive_sha256=${manifest.archiveSha256}\nserver_sha256=${manifest.serverSha256}\n`);
  console.log(`Release verified: ${entries.length} files, ${manifest.archiveBytes} bytes; SHA256 ${manifest.archiveSha256}`);
  return { archive, manifest };
}

export async function verifyRelease(archive, expectedSha, extractTo) {
  archive = resolve(archive);
  const manifest = JSON.parse(await readFile(join(dirname(archive), 'release-manifest.json'), 'utf8'));
  const actual = sha256(await readFile(archive));
  if (!/^[a-f0-9]{64}$/.test(expectedSha ?? '') || actual !== expectedSha || actual !== manifest.archiveSha256) throw new Error('Release archive SHA256 mismatch.');
  if ((await stat(archive)).size > 60 * 1024 * 1024) throw new Error('Release exceeds the 60 MiB package ceiling.');
  python(`import hashlib,json,pathlib,stat,sys,zipfile
archive,manifest_path,extract=sys.argv[1:]
m=json.loads(pathlib.Path(manifest_path).read_text())
with zipfile.ZipFile(archive) as z:
 names=z.namelist()
 if len(names)!=len(set(names)) or len(names)!=m['entryCount']: raise ValueError('ZIP inventory mismatch')
 if z.testzip(): raise ValueError('ZIP CRC failure')
 if sum(i.file_size for i in z.infolist())>512*1024*1024: raise ValueError('Unpacked release exceeds 512 MiB')
 expected={e['path']:e['sha256'] for e in m['entries']}
 if set(names)!=set(expected): raise ValueError('Manifest paths differ from archive')
 for info in z.infolist():
  p=pathlib.PurePosixPath(info.filename)
  if '\\\\' in info.filename or p.is_absolute() or '..' in p.parts or stat.S_ISLNK(info.external_attr>>16): raise ValueError('Unsafe ZIP path')
  if any(part.startswith('.env') or part in ('.git','.bin') for part in p.parts) or p.suffix.lower() in ('.map','.log','.stackdump','.pem','.key','.p12','.pfx'): raise ValueError('Forbidden release file')
  if hashlib.sha256(z.read(info)).hexdigest()!=expected[info.filename]: raise ValueError('File hash mismatch')
 if extract: z.extractall(extract)
`, [archive, join(dirname(archive), 'release-manifest.json'), extractTo ? resolve(extractTo) : '']);
  for (const name of required) if (!manifest.entries.some((entry) => entry.path === name)) throw new Error(`Required archive file missing: ${name}`);
  if (manifest.entries.some((entry) => /node_modules\/(typescript|vitest|tsx|esbuild|playwright-core)\//.test(entry.path))) throw new Error('Development tooling reached the runtime package.');
  return manifest;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === '--verify') await verifyRelease(args[1], args[2]);
    else if (args.length === 0 || (args[0] === '--out' && args.length === 2)) await packageRelease(args[1]);
    else throw new Error('Usage: node tools/package-release.mjs [--out folder] | --verify archive.zip expected-sha256');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
