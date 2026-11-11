/* Photograph one state of the museum: open index.html, wait for the room to
   settle, run an optional expression to move the camera or open a panel, then
   write a PNG and report anything the page put on the console.

     node scratch/shot.mjs <url> <out.png> [waitMs] [expression]
*/
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'file:///C:/Users/skyee/Documents/Strata/Workspace/index.html';
const out = process.argv[3] || join(here, 'shot.png');
const waitMs = Number(process.argv[4] || 4000);
const expression = process.argv[5] || '';

await withBrowser(async ({ send, evaluate, consoleLines }) => {
  await send('Page.navigate', { url });
  await sleep(waitMs);

  if (expression) {
    console.log('eval: ' + JSON.stringify(await evaluate(expression)));
    await sleep(2200);   // let whatever the expression started settle before shooting
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(consoleLines.length ? '\n--- console ---\n' + consoleLines.join('\n') : 'console: clean');
  console.log('screenshot: ' + out);
});
