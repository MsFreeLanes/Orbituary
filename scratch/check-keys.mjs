/* check-keys.mjs — do the keys do what the ticket says they do?
 *   node scratch/check-keys.mjs
 * H walks you to the front door, Shift+H puts you there, Tab opens the
 * brochure. Each is pressed for real, through the browser's input pipeline,
 * and the answer is read off the rig and the panel rather than the source.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const key = (send, code, shift) => send('Input.dispatchKeyEvent', {
  type: 'keyDown', code, windowsVirtualKeyCode: code === 'Tab' ? 9 : code.charCodeAt(3) + 65,
  key: code === 'Tab' ? 'Tab' : code.slice(3).toLowerCase(), ...(shift ? { modifiers: 8 } : {})
});

const where = `(() => { const m = window.__museum, s = m.rig.state;
  return { x: +s.x.toFixed(2), z: +s.z.toFixed(2), touring: !!m.rig.touring,
    brochure: getComputedStyle(document.querySelector('.brochure')).display }; })()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  await evaluate('window.__museum.rig.teleportTo("shopping")');
  await nap(600);
  console.log('from the Customs House:', JSON.stringify(await evaluate(where)));
  await key(send, 'KeyH');
  await nap(900);
  console.log('after H:            ', JSON.stringify(await evaluate(where)));
  await evaluate('window.__museum.rig.stopTour()');
  await key(send, 'KeyH', true);
  await nap(700);
  console.log('after Shift+H:      ', JSON.stringify(await evaluate(where)));
  await key(send, 'Tab');
  await nap(400);
  console.log('after Tab:          ', JSON.stringify(await evaluate(where)));
});
