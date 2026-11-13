/* does the hour itself matter? the night probe pins to 02:00 with one input
 * event and the exposure probe will not pin to 07:47 however the events are
 * ordered, so try both minutes the same way, with and without the intro hidden.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const READ = `JSON.stringify({ value: document.querySelector('input.time').value,
  clock: document.querySelector('.sky-clock').textContent,
  alt: (window.__museum.sky.state.sunAlt * 180 / Math.PI).toFixed(1),
  i: window.__museum.lighting.sun.intensity.toFixed(2) })`;

const set = (min) => `(() => { const s = document.querySelector('input.time');
  s.value = '${min}'; s.dispatchEvent(new Event('input')); })()`;

await withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4500);
  console.log('intro up, 120  ', await evaluate(set(120)));
  await sleep(500); console.log('  after 0.5 s  ', await evaluate(READ));
  console.log('intro up, 467  ', await evaluate(set(467)));
  await sleep(500); console.log('  after 0.5 s  ', await evaluate(READ));
  await evaluate('window.__museum.hud.hideIntro()');
  await sleep(500);
  console.log('intro down, 467', await evaluate(set(467)));
  await sleep(500); console.log('  after 0.5 s  ', await evaluate(READ));
  console.log('intro down, 960', await evaluate(set(960)));
  await sleep(500); console.log('  after 0.5 s  ', await evaluate(READ));
});
