/* The smallest useful Chrome DevTools Protocol client: no dependencies, just the
   global WebSocket and fetch that Node already has. Shared by shot.mjs (which
   photographs the room) and audit.mjs (which pokes it).

     await withBrowser(({ send, evaluate, sleep }) => { ... })

   The browser is always torn down, even if the callback throws. */
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
const PORT = 9223;
const PROFILE = join(here, 'chrome-profile');

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTarget() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const page = list.find((target) => target.type === 'page');
      if (page) return page;
    } catch (err) { /* the port is not listening yet */ }
    await sleep(250);
  }
  throw new Error('browser devtools never came up');
}

export async function withBrowser(run) {
  const browser = BROWSERS.find((path) => existsSync(path));
  if (!browser) throw new Error('no Chrome or Edge found');

  const chrome = spawn(browser, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--remote-allow-origins=*',
    '--user-data-dir=' + PROFILE,
    '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle', '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--window-size=1600,900',
    '--force-device-scale-factor=1',
    'about:blank'
  ], { stdio: 'ignore' });

  let ws;
  try {
    const target = await waitForTarget();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('websocket to devtools failed'));
    });

    const pending = new Map();
    let nextId = 1;
    const consoleLines = [];
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        consoleLines.push('EXCEPTION: ' + (details.exception?.description || details.text));
      }
      if (message.method === 'Runtime.consoleAPICalled' &&
          (message.params.type === 'error' || message.params.type === 'warning')) {
        consoleLines.push(message.params.type.toUpperCase() + ': ' +
          message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
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

    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text);
      }
      return result.result?.value;
    };

    return await run({ send, evaluate, sleep, consoleLines });
  } finally {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      for (const target of list) {
        try { await fetch('http://127.0.0.1:' + PORT + '/json/close/' + target.id); } catch (err) {}
      }
    } catch (err) { /* the browser is already going away */ }
    if (ws) ws.close();
    chrome.kill();
    try { rmSync(PROFILE, { recursive: true, force: true }); } catch (err) { /* Chrome still holds it */ }
  }
}
