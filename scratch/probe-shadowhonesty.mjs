/* probe-shadowhonesty.mjs — is the sun's light reaching a room through its own
 * hull, or through geometry the cull has switched off?
 *
 *   node scratch/probe-shadowhonesty.mjs
 *
 * The shadow map follows the visitor and covers ±20 m around them, so anything
 * further away than that cannot throw a shadow: the drum, the other ranges, the
 * neighbouring station. That is the trade the performance pass made and
 * building.js documents. This measures how much sun a room is actually getting
 * by reading the same framing twice: once as the hour has it, and once with the
 * key light switched off at the lamp.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const BAND = `(() => {
  const m = window.__museum;
  for (let i = 0; i < 60; i++) m.lighting.update(m.camera.position, 0.05);
  m.view.render(0.016, m.camera);
  const gl = m.view.renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const x0 = Math.floor(W * 0.30), w = Math.floor(W * 0.40);
  const y0 = Math.floor(H * 0.10), h = Math.floor(H * 0.20);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let sum = 0, n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
  return Math.round(sum / n);
})()`;

const STAND = (id) => id ? `m.rig.teleportTo(${JSON.stringify(id)});
  const r = m.plan.byId(${JSON.stringify(id)});
  const stand = Math.min(0.9, r.d * 0.2);
  m.rig.state.x = r.entry.x + r.n.x * stand; m.rig.state.z = r.entry.z + r.n.z * stand;
  m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.02);` : `
  m.__eyeY = 'base';
  m.rig.state.storey = 'basement'; m.rig.state.x = 0; m.rig.state.z = 12;
  m.rig.setYawPitch(Math.PI, -0.05);`;

const CASES = [
  ['privacy (faces 120)', 'privacy', 8 * 60],
  ['privacy (faces 120)', 'privacy', 16 * 60],
  ['gaming (faces 0)', 'gaming', 12 * 60],
  ['media (faces 180)', 'media', 12 * 60],
  ['modding (faces 30ish)', 'modding', 8 * 60],
  ['cellar arm', null, 8 * 60],
  ['cellar arm', null, 12 * 60]
];

await withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await sleep(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  /* the cellar framing needs the camera standing on the cellar slab: the rig
     puts the eye over y = 0 wherever it is, the way probe-exposure does */
  await evaluate(`(() => { const m = window.__museum, S = m.S;
    m.__eyeY = null;
    const upd = m.rig.update.bind(m.rig);
    m.rig.update = (dt) => { const out = upd(dt);
      if (m.__eyeY) m.camera.position.y = S.FLOOR_BASE + S.EYE_H;
      return out; };
  })()`);

  for (const [label, id, hour] of CASES) {
    await evaluate(`(() => { const m = window.__museum;
      const s = document.querySelector('input.time');
      s.value = '${hour}'; s.dispatchEvent(new Event('input'));
      m.__eyeY = null;
      ${STAND(id)}
    })()`);
    await sleep(1100);
    const on = await evaluate(BAND);
    const off = await evaluate(`(() => { const m = window.__museum;
      m.lighting.sun.intensity = 0; return ${BAND}; })()`);
    const culled = await evaluate(`(() => { const m = window.__museum;
      const owner = m.view.scene.children.find((o) => o.userData && o.userData.cull);
      let hidden = 0, shown = 0;
      owner.children.forEach((g) => { if (g.visible) shown++; else hidden++; });
      return { shown, hidden }; })()`);
    console.log(label.padEnd(24) + ' ' + String(hour / 60).padStart(2, '0') + ':00' +
      '   floor sun ' + String(on).padStart(3) +
      ' · no sun ' + String(off).padStart(3) +
      ' · sun + ' + String(on - off).padStart(3) +
      ' · groups on ' + culled.shown + '/' + (culled.shown + culled.hidden));
  }
});
