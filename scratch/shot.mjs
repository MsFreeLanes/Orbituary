/* Headless-browser harness: opens index.html in Chrome/Edge, waits, reports any
   console error or uncaught exception, runs an optional expression, and writes
   a screenshot. Used only while building; the shipped file needs nothing.
     node scratch/shot.mjs <url> <out.png> [waitMs] [expression]
*/
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) { console.error('no Chrome or Edge found'); process.exit(1); }

const url = process.argv[2] || 'file:///C:/Users/skyee/Documents/Strata/Workspace/index.html';
const out = process.argv[3] || join(here, 'shot.png');
const waitMs = Number(process.argv[4] || 4000);
const expression = process.argv[5] || '';
const port = 9223;
const profile = join(here, 'chrome-profile');

const chrome = spawn(browser, [
  '--headless=new',
  '--remote-debugging-port=' + port,
  '--remote-allow-origins=*',
  '--user-data-dir=' + profile,
  '--no-first-run', '--no-default-browser-check',
  '--allow-file-access-from-files',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader',
  '--hide-scrollbars',
  '--window-size=1600,900',
  '--force-device-scale-factor=1',
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch (err) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('browser devtools never came up');
}

const page = await target();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve; ws.onerror = () => reject(new Error('websocket failed'));
});

let nextId = 1;
const pending = new Map();
const consoleLines = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    consoleLines.push('EXCEPTION: ' + (d.exception?.description || d.text));
  }
  if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
    consoleLines.push(msg.params.type.toUpperCase() + ': ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};
const send = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});

await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable').catch(() => {});
await send('Page.navigate', { url });
await sleep(waitMs);

if (expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  console.log('eval: ' + JSON.stringify(result.result?.value ?? result.exceptionDetails, null, 2));
  await sleep(2200);   // let whatever the expression started settle before shooting
}

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));

console.log(consoleLines.length ? '\n--- console ---\n' + consoleLines.join('\n') : 'console: clean');
console.log('screenshot: ' + out);

const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
for (const t of list) { try { await fetch('http://127.0.0.1:' + port + '/json/close/' + t.id); } catch (e) {} }
ws.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch (err) { /* chrome still holding it */ }
