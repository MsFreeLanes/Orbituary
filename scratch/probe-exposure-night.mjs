/* probe-exposure-night.mjs — probe-exposure.mjs's framings at two in the
 * morning, when the sun is 52° under the horizon and the station is running on
 * its own fittings.
 *
 *   node scratch/probe-exposure-night.mjs            the night as it is now
 *   node scratch/probe-exposure-night.mjs --nohem    the same night with the
 *     hemisphere left where it was before the sun took over the key light, so
 *     the compensation the night needed can be seen for what it is worth
 *   node scratch/probe-exposure-night.mjs --oldnight the night as the previous
 *     build had it: no key light but the moon's, cold and 0.26–0.46 strong,
 *     with the hemisphere at 0.42. sky.js still knows where the moon is, so the
 *     old light can be hung back up and measured against what replaced it.
 *
 * The hour is set through the HUD's slider, and ALWAYS NIGHT is left as the
 * visitor left it — checked — because that is the state the museum boots in.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const NOHEM = process.argv.includes('--nohem');
const OLDNIGHT = process.argv.includes('--oldnight');
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

/* the key light the building had before the sun took the job: the moon's real
   bearing, floored above the roofline, cold, and as bright as its phase allows */
const OLD = `(() => {
  const m = window.__museum, T = m.THREE, s = m.sky.state;
  const d = s.moonDir || [0, 0.4, 1];
  const len = Math.hypot(d[0], d[2]) || 1;
  const lift = Math.max(0.22, d[1]);
  const horiz = Math.sqrt(1 - lift * lift);
  const r = m.plan.reach * 1.6;
  m.lighting.hemi.intensity = 0.42;
  m.lighting.sun.color.setHex(0xbfd4ff);
  m.lighting.sun.intensity = 0.26 + 0.2 * (Math.abs(s.phase - 0.5) < 0.25 ? 1 : 0.35);
  m.lighting.sun.position.copy(m.lighting.sun.target.position)
    .add(new T.Vector3(d[0] / len * horiz * r, lift * r, d[2] / len * horiz * r));
})()`;

const SAMPLE = `(() => {
  const m = window.__museum;
  for (let i = 0; i < 60; i++) m.lighting.update(m.camera.position, 0.05);
  ${NOHEM ? 'm.lighting.hemi.intensity = 0.42;' : ''}
  ${OLDNIGHT ? OLD : ''}
  m.view.render(0.016, m.camera);
  const gl = m.view.renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  function band(fy0, fy1) {
    const x0 = Math.floor(W * 0.30), w = Math.floor(W * 0.40);
    const y0 = Math.floor(H * fy0), h = Math.floor(H * (fy1 - fy0));
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, blown = 0, dark = 0, n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      sum += l; if (l > 235) blown++; if (l < 12) dark++;
    }
    return (sum / n).toFixed(0) + ' (clip ' + (100 * blown / n).toFixed(0) + '%, dark ' + (100 * dark / n).toFixed(0) + '%)';
  }
  const key = m.lighting.pool.reduce((b, l) => (!b || l.intensity > b.intensity) ? l : b, null);
  return { floor: band(0.10, 0.30), mid: band(0.45, 0.60),
    key: key ? 'y' + key.position.y.toFixed(2) + ' i' + key.intensity.toFixed(1) : 'none' };
})()`;

const framings = [
  ['rotunda', `m.rig.state.x = 0; m.rig.state.z = 1.5; m.rig.setYawPitch(Math.PI, -0.02);`],
  ['corridor', `const c = m.plan.corridors.find((c) => c.dir.z > 0.5);
     m.rig.state.x = 0; m.rig.state.z = (c.t0 + c.t1) / 2; m.rig.setYawPitch(Math.PI, -0.05);`],
  ['gaming', `m.rig.teleportTo('gaming'); { const r = m.plan.byId('gaming');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`],
  ['privacy', `m.rig.teleportTo('privacy'); { const r = m.plan.byId('privacy');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`],
  ['reading', `m.rig.teleportTo('reading'); { const r = m.plan.byId('reading');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`],
  ['linux', `m.rig.teleportTo('linux'); { const r = m.plan.byId('linux');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`],
  ['cellar', `m.rig.teleportTo('open-source'); { const r = m.plan.byId('open-source');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`, 'base'],
  ['cellar-dim', `m.rig.teleportTo('astronomy'); { const r = m.plan.byId('astronomy');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`, 'base'],
  ['cellar-arm', `m.rig.state.x = 0; m.rig.state.z = 12; m.rig.setYawPitch(Math.PI, -0.05);`, 'base'],
  ['stair-hall', `m.rig.state.x = 0; m.rig.state.z = 1.6; m.rig.setYawPitch(0, 0.20);`, 'base'],
  ['stair-flight', `const s = m.plan.stair; m.rig.state.x = s.x; m.rig.state.z = s.z + s.run * 0.55;
     m.rig.setYawPitch(Math.PI, -0.30);`, 'flight']
];

await withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: URL_FILE });
  await sleep(4500);
  /* the first move of the slider after load is swallowed, so the minute goes in
     twice and comes back read before any framing is measured */
  for (let i = 0; i < 2; i++) {
    await evaluate(`(() => { const s = document.querySelector('input.time');
      s.value = '120'; s.dispatchEvent(new Event('input')); })()`);
    await sleep(350);
  }
  console.log('hour', await evaluate('document.querySelector(".sky-clock").textContent'),
    '· sun altitude', (await evaluate('window.__museum.sky.state.sunAlt') * 180 / Math.PI).toFixed(1) + '°');
  await evaluate(`(() => { const m = window.__museum, S = m.S;
    m.__eyeY = null;
    const upd = m.rig.update.bind(m.rig);
    m.rig.update = (dt) => { const out = upd(dt);
      if (m.__eyeY === 'flight') {
        const s = m.plan.stair;
        m.camera.position.y = -(m.rig.state.z - s.z) / s.run * s.drop + S.EYE_H;
      } else if (m.__eyeY) m.camera.position.y = S.FLOOR_BASE + S.EYE_H;
      return out; };
  })()`);
  for (const [name, set, eye] of framings) {
    await evaluate(`(() => { const m = window.__museum; m.__eyeY = ${JSON.stringify(eye || null)}; ${set} })()`);
    await sleep(900);
    const r = await evaluate(SAMPLE);
    console.log(name.padEnd(11), 'floor', String(r.floor).padEnd(22), 'mid', String(r.mid).padEnd(22), 'key', r.key);
  }
  console.log('mood', await evaluate(`(() => { const m = window.__museum;
    return 'exposure ' + m.view.renderer.toneMappingExposure.toFixed(2) + ' bloom ' + m.view.bloom.strength.toFixed(2)
      + ' sun ' + m.lighting.sun.intensity.toFixed(2) + ' hemi ' + m.lighting.hemi.intensity.toFixed(2); })()`));
});
