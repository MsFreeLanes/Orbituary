/* probe-sunhours.mjs — which terminus halls the sun actually reaches, hour by
 * hour, and how much of their floor is sun rather than lamp.
 *
 *   node scratch/probe-sunhours.mjs [room id] [room id] ...
 *
 * The twelve ranges shade one another: a hall's two neighbours stand about
 * 26 m away and 6 m tall, so a sun under about 13 degrees of altitude is
 * behind their hulls. That is worth knowing before choosing which hall to
 * photograph, and it is the sort of thing a moon fixed above the roofline
 * never had to answer.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const rooms = process.argv.slice(2);
const halls = rooms.length ? rooms : ['media', 'art', 'privacy', 'gaming', 'linux'];

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

await withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await sleep(4500);
  await evaluate('window.__museum.hud.hideIntro()');

  for (const id of halls) {
    const out = [];
    for (let hour = 6; hour <= 17; hour += 2) {
      await evaluate(`(() => { const m = window.__museum;
        const box = document.querySelector('.toggle input');
        box.checked = false; box.dispatchEvent(new Event('change'));
        const s = document.querySelector('input.time');
        s.value = '${hour * 60}'; s.dispatchEvent(new Event('input'));
        m.rig.teleportTo(${JSON.stringify(id)});
        const r = m.plan.byId(${JSON.stringify(id)});
        const stand = Math.min(0.9, r.d * 0.2);
        m.rig.state.x = r.entry.x + r.n.x * stand; m.rig.state.z = r.entry.z + r.n.z * stand;
        m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.02);
      })()`);
      await sleep(900);
      const on = await evaluate(BAND);
      const off = await evaluate(`(() => { const m = window.__museum;
        m.lighting.sun.intensity = 0; return ${BAND}; })()`);
      const st = await evaluate(`(() => { const m = window.__museum, s = m.sky.state;
        const d = m.lighting.sun.position.clone().sub(m.lighting.sun.target.position);
        const n = m.plan.byId(${JSON.stringify(id)});
        return { alt: +(s.sunAlt * 57.3).toFixed(1),
          bearing: +((Math.atan2(d.x, d.z) * 57.3 + 360) % 360).toFixed(0),
          hall: +((Math.atan2(n.n.x, n.n.z) * 57.3 + 360) % 360).toFixed(0),
          i: +m.lighting.sun.intensity.toFixed(2) }; })()`);
      out.push(`${String(hour).padStart(2, '0')}:00 floor ${String(on).padStart(3)} (lamp ${String(off).padStart(3)}, sun +${on - off})` +
        ` sun ${String(st.i).padStart(4)} at ${String(st.alt).padStart(5)} deg / bearing ${String(st.bearing).padStart(3)}` +
        `, hall faces ${st.hall}`);
    }
    console.log(id + ':\n  ' + out.join('\n  '));
  }
});
