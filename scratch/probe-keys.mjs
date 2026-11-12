/* Drive the keyboard the way a visitor does: R for a random room, T for the
   next stop on the tour, H for help, G for the sky dial, Escape to stop. */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const key = (send, code, vk) => {
  const base = { code, key: code.slice(3), windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  return send('Input.dispatchKeyEvent', { type: 'keyDown', ...base })
    .then(() => send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }));
};

const where = (evaluate) => evaluate(`(() => {
  const m = window.__museum, s = m.rig.state;
  return { room: s.room, x: +s.x.toFixed(1), z: +s.z.toFixed(1),
    touring: m.rig.touring, help: !!document.querySelector('.help.on, .help.show, .help[data-on]'),
    skyOpen: m.hud.root.classList.contains('sky-open') };
})()`);

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4200);
  console.log('start   ', await where(evaluate));

  await key(send, 'KeyR', 82);
  await sleep(5000);
  console.log('after R ', await where(evaluate));

  await key(send, 'KeyT', 84);
  await sleep(4000);
  console.log('after T ', await where(evaluate));

  await key(send, 'KeyH', 72);
  await sleep(400);
  console.log('after H ', await where(evaluate));
  await key(send, 'KeyH', 72);

  await key(send, 'KeyG', 71);
  await sleep(300);
  console.log('after G ', await where(evaluate));

  await key(send, 'Escape', 27);
  await sleep(600);
  console.log('after Esc', await where(evaluate));

  console.log('errors', await evaluate(`(window.__errs || []).slice(0, 5)`));
});
