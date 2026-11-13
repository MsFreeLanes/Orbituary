/* probe-sun.mjs — how much of a room's light is the sun, room by room.
 *
 *   node scratch/probe-sun.mjs
 *
 * Each framing is read three times: as the hour has it, with the key light
 * switched off at the lamp (so the interior fittings and the hemisphere are all
 * that is left), and with the key light pushed to four times what the hour
 * asks for. The middle column is what the station looks like with no sun; the
 * gap to the third is what the sun is actually doing through the hull.
 *
 * The hour is set through the HUD's slider, and ALWAYS NIGHT is switched off
 * for the daylight framings so the sky in the windows agrees with the light.
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
  function band(fy0, fy1) {
    const x0 = Math.floor(W * 0.30), w = Math.floor(W * 0.40);
    const y0 = Math.floor(H * fy0), h = Math.floor(H * (fy1 - fy0));
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    return Math.round(sum / n);
  }
  const sun = m.lighting.sun;
  return { floor: band(0.10, 0.30), mid: band(0.45, 0.60), i: +sun.intensity.toFixed(2) };
})()`;

const FRAMINGS = [
  ['media-hall', 8 * 60, `m.rig.teleportTo('media'); { const r = m.plan.byId('media');
     const stand = Math.min(0.9, r.d * 0.2);
     m.rig.state.x = r.entry.x + r.n.x * stand; m.rig.state.z = r.entry.z + r.n.z * stand;
     m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.02); }`],
  ['media-hall', 16 * 60, `m.rig.teleportTo('media'); { const r = m.plan.byId('media');
     const stand = Math.min(0.9, r.d * 0.2);
     m.rig.state.x = r.entry.x + r.n.x * stand; m.rig.state.z = r.entry.z + r.n.z * stand;
     m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.02); }`],
  ['art-hall', 8 * 60, `m.rig.teleportTo('art'); { const r = m.plan.byId('art');
     const stand = Math.min(0.9, r.d * 0.2);
     m.rig.state.x = r.entry.x + r.n.x * stand; m.rig.state.z = r.entry.z + r.n.z * stand;
     m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.02); }`],
  ['gaming-hall', 12 * 60, `m.rig.teleportTo('gaming'); { const r = m.plan.byId('gaming');
     const stand = Math.min(0.9, r.d * 0.2);
     m.rig.state.x = r.entry.x + r.n.x * stand; m.rig.state.z = r.entry.z + r.n.z * stand;
     m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.02); }`],
  ['modding-room', 8 * 60, `m.rig.teleportTo('modding'); { const r = m.plan.byId('modding');
     m.rig.state.x = r.entry.x + r.n.x * 1.8; m.rig.state.z = r.entry.z + r.n.z * 1.8;
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`],
  ['corridor', 9 * 60, `const c = m.plan.corridors.find((c) => c.dir.z < -0.5);
     m.rig.state.x = 0; m.rig.state.z = (c.t0 + c.t1) / 2; m.rig.setYawPitch(0, -0.05);`],
  ['rotunda', 12 * 60, `m.rig.state.x = 0; m.rig.state.z = 1.5; m.rig.setYawPitch(Math.PI, -0.02);`],
  ['cellar-arm', 12 * 60, `m.rig.state.x = 0; m.rig.state.z = 12; m.rig.setYawPitch(Math.PI, -0.05);`, 'base'],
  ['rotunda-night', 2 * 60, `m.rig.state.x = 0; m.rig.state.z = 1.5; m.rig.setYawPitch(Math.PI, -0.02);`]
];

await withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await sleep(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  await evaluate(`(() => { const m = window.__museum, S = m.S;
    m.__eyeY = null;
    const upd = m.rig.update.bind(m.rig);
    m.rig.update = (dt) => { const out = upd(dt);
      if (m.__eyeY) m.camera.position.y = S.FLOOR_BASE + S.EYE_H;
      return out; };
  })()`);

  for (const [name, hour, set, eye] of FRAMINGS) {
    await evaluate(`(() => {
      const m = window.__museum;
      const box = document.querySelector('.toggle input');
      box.checked = ${hour === 2 * 60 ? 'true' : 'false'}; box.dispatchEvent(new Event('change'));
      const s = document.querySelector('input.time');
      s.value = '${hour}'; s.dispatchEvent(new Event('input'));
      m.__eyeY = ${JSON.stringify(eye || null)};
      ${set}
    })()`);
    await sleep(1200);
    const asHour = await evaluate(BAND);
    const off = await evaluate(`(() => { const m = window.__museum;
      m.lighting.sun.intensity = 0; return ${BAND}; })()`);
    const up = await evaluate(`(() => { const m = window.__museum;
      m.lighting.sun.intensity = ${asHour.i} * 4; return ${BAND}; })()`);
    const st = await evaluate(`(() => { const m = window.__museum, s = m.sky.state;
      const d = m.lighting.sun.position.clone().sub(m.lighting.sun.target.position);
      return { sunAlt: +(s.sunAlt * 57.3).toFixed(1),
        lightAlt: +(Math.asin(d.y / d.length()) * 57.3).toFixed(1),
        bearing: +((Math.atan2(d.x, d.z) * 57.3 + 360) % 360).toFixed(1),
        hemi: +m.lighting.hemi.intensity.toFixed(2) }; })()`);
    console.log(`${name.padEnd(13)} ${String(hour / 60).padStart(2, '0')}:00  sun ${String(asHour.i).padStart(5)}` +
      `  floor ${String(asHour.floor).padStart(3)} / off ${String(off.floor).padStart(3)} / x4 ${String(up.floor).padStart(3)}` +
      `   mid ${String(asHour.mid).padStart(3)} / off ${String(off.mid).padStart(3)} / x4 ${String(up.mid).padStart(3)}` +
      `   ${JSON.stringify(st)}`);
  }
});
