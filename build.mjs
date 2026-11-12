/* build.mjs — one file in, one file out.
 *
 *   node build.mjs          → index-v2.html (minified, everything inside)
 *   node build.mjs --debug  → index-v2.html (readable bundle, no minify)
 *
 * esbuild is called as the prebuilt binary with inherited stdio, which keeps
 * it inside what the sandbox allows. The result opens by double-click: no
 * server, no CDN, no module fetches.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const debug = process.argv.includes('--debug');
const bin = path.join(root, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe');
const wrapper = path.join(root, 'node_modules', '.bin', 'esbuild.cmd');
const exe = existsSync(bin) ? bin : wrapper;

const out = path.join(root, 'scratch', 'bundle.js');
const args = [
  'src/main.js',
  '--bundle',
  '--format=iife',
  '--target=es2022',
  '--platform=browser',
  '--legal-comments=none',
  `--outfile=${out}`
];
if (!debug) args.push('--minify');

const res = spawnSync(exe, args, { cwd: root, stdio: 'inherit' });
if (res.status !== 0) {
  console.error('esbuild failed', res.status);
  process.exit(res.status || 1);
}

const bundle = readFileSync(out, 'utf8').replace(/<\/script/gi, '<\\/script');
const shell = readFileSync(path.join(root, 'src', 'shell.html'), 'utf8');
if (!shell.includes('/*__BUNDLE__*/')) throw new Error('shell.html lost its bundle marker');
const html = shell.replace('/*__BUNDLE__*/', () => bundle);

const dest = path.join(root, 'index-v2.html');
writeFileSync(dest, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`index-v2.html  ${kb} KB  ${debug ? 'readable' : 'minified'}  bundle ${out}`);
