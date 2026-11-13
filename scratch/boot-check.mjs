/* boot-check.mjs — does the bundle boot, and what did it say if it did not? */
import { withBrowser } from './cdp.mjs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

await withBrowser(async ({ send, evaluate, sleep: nap, consoleLines }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message) + ' @' + (e.filename || 'inline') + ':' + e.lineno));
      window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));`
  });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  console.log('handle:', await evaluate('!!window.__museum'));
  console.log('errors:', JSON.stringify(await evaluate('window.__errors'), null, 1));
  console.log('console:\n' + consoleLines.slice(0, 20).join('\n'));
});
