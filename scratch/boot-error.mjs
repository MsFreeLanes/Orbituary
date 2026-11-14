/* boot-error.mjs — open the museum and print whatever it threw.
 *   node scratch/boot-error.mjs
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap, consoleLines }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  console.log('booted:', await evaluate('!!window.__museum'));
  console.log('console:');
  for (const l of consoleLines) console.log('  ' + l);
});
