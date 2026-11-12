/* Does a tour actually walk the visitor there? Headless renders at a few
   frames a second and the frame loop clamps dt, so this needs a long wait. */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const key = (send, code, vk) => {
  const base = { code, key: code.slice(3), windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  return send('Input.dispatchKeyEvent', { type: 'keyDown', ...base })
    .then(() => send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }));
};

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4200);
  await key(send, 'KeyR', 82);
  for (let i = 0; i < 8; i++) {
    await sleep(6000);
    const s = await evaluate(`(() => { const m = window.__museum, st = m.rig.state;
      const t = m.rig.touring;
      return { room: st.room, x: +st.x.toFixed(1), z: +st.z.toFixed(1),
        t: t && +t.t.toFixed(1), dur: t && +t.dur.toFixed(1), to: t && t.room, fps: m.view.fps }; })()`);
    console.log(i, s);
    if (!s.t) break;
  }
  console.log('final', await evaluate(`(() => { const m = window.__museum, st = m.rig.state;
    const r = m.plan.byId(st.room);
    return { room: st.room, inRoom: r ? Math.hypot(st.x - r.center.x, st.z - r.center.z).toFixed(1) : null,
      yaw: +st.yaw.toFixed(2) }; })()`));
});
