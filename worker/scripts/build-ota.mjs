// Builds Tandem's JavaScript for over the air updates and puts it next to the API,
// so the phones download new screens straight from our own server.
// Runs on every deploy. If the build fails, the API still deploys and the phones keep their current code.
//
// Output (served as static files by the worker):
//   ota-dist/ota/manifest.json   the update description, read by /ota/manifest
//   ota-dist/ota/a/<sha>.<ext>   the bundle and every image and font, named by content hash
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTENT_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', json: 'application/json', mp3: 'audio/mpeg', wav: 'audio/wav',
};

/** Hash of every file the app is built from, skipping installed packages and build output. */
function sourceHash(dir) {
  const h = createHash('sha256');
  const skip = new Set(['node_modules', 'dist', '.expo', 'android', 'ios', '.eas', 'web-build']);
  const walk = (d, rel) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (skip.has(e.name) || e.name.startsWith('.git')) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, `${rel}${e.name}/`);
      else { h.update(`${rel}${e.name}\n`); h.update(readFileSync(p)); }
    }
  };
  walk(dir, '');
  return h.digest('hex');
}

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '../../fitness');
const out = resolve(here, '../ota-dist');
const files = join(out, 'ota', 'a');
const tmp = resolve(here, '../.ota-export');

rmSync(out, { recursive: true, force: true });
mkdirSync(files, { recursive: true });
writeFileSync(join(out, 'ota', 'manifest.json'), 'null');

const env = { ...process.env, EXPO_OFFLINE: '1', EXPO_NO_TELEMETRY: '1', CI: '1', NODE_ENV: 'production' };
delete env.API_URL; // the phones always talk to the live API
const run = (cmd) => execSync(cmd, { cwd: app, env, stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 }).toString();
const sha = (buf) => createHash('sha256').update(buf).digest();
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

try {
  if (process.env.SKIP_OTA) throw new Error('SKIP_OTA is set');
  if (!existsSync(join(app, 'node_modules', 'expo'))) {
    console.log('[ota] installing app packages');
    run('npm ci --no-audit --no-fund --loglevel=error');
  }
  console.log('[ota] bundling Tandem for Android');
  rmSync(tmp, { recursive: true, force: true });
  run(`npx expo export --platform android --output-dir "${tmp}"`);
  const config = JSON.parse(run('npx expo config --type public --json'));
  const runtimeVersion = typeof config.runtimeVersion === 'string' ? config.runtimeVersion : config.version;

  const meta = JSON.parse(readFileSync(join(tmp, 'metadata.json'), 'utf8')).fileMetadata.android;
  const place = (rel, ext) => {
    const buf = readFileSync(join(tmp, rel));
    const digest = sha(buf);
    const key = digest.toString('hex');
    cpSync(join(tmp, rel), join(files, `${key}${ext}`));
    return { hash: b64url(digest), key, fileExtension: ext, url: `/ota/a/${key}${ext}` };
  };
  const launch = place(meta.bundle, '.bundle');
  const assets = meta.assets.map((a) => {
    const ext = `.${a.ext}`;
    const p = place(a.path, ext);
    return { ...p, contentType: CONTENT_TYPES[a.ext] ?? 'application/octet-stream' };
  });

  // The id comes from the app's source files and config, so a deploy that changes only the API sends no update.
  // (The compiled bundle differs by a few bytes on every build, so it cannot be the id.)
  const idHex = sha(Buffer.from(JSON.stringify([sourceHash(app), config]))).toString('hex');
  const id = `${idHex.slice(0, 8)}-${idHex.slice(8, 12)}-4${idHex.slice(13, 16)}-a${idHex.slice(17, 20)}-${idHex.slice(20, 32)}`;
  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    runtimeVersion,
    launchAsset: { hash: launch.hash, key: launch.key, contentType: 'application/javascript', fileExtension: '.bundle', url: launch.url },
    assets,
    metadata: {},
    extra: { expoClient: config },
  };
  writeFileSync(join(out, 'ota', 'manifest.json'), JSON.stringify(manifest));
  rmSync(tmp, { recursive: true, force: true });
  console.log(`[ota] update ${id} for runtime ${runtimeVersion}: ${assets.length} assets`);
} catch (e) {
  console.error('[ota] skipped, the phones keep their current code:', e.message);
}
