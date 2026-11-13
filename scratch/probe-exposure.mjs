/* Numeric look check: for each framing, read back the rendered frame and report
   the mean luminance of the floor band and the wall band, plus how much of the
   floor is clipped. Faster and more honest than squinting at screenshots.

   The cellar framings need one thing the rig does not have yet: a floor of its
   own. The rig stands at eye height over y = 0 wherever it is, so the probe
   puts the camera on the cellar slab the way probe-cellar.mjs does, and lets
   the light pool see which storey the visitor is on. */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

/* --hour 07:47 pins the clock the framings are read at. The key light is the
   sun now, so two runs taken eight minutes apart are not the same photograph:
   the run that recorded the building before this change was made at 07:47, so
   the run that records it after is pinned to 07:47 as well. */
const HOUR = (() => {
  const i = process.argv.indexOf('--hour');
  if (i < 0) return null;
  const [h, min] = String(process.argv[i + 1] || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(min) ? h * 60 + min : null;
})();

const SAMPLE = `(() => {
  const m = window.__museum;
  /* the pool cross-fades over about a quarter of a second, so settle it
     before reading pixels rather than blaming the room for the walk */
  for (let i = 0; i < 60; i++) m.lighting.update(m.camera.position, 0.05);
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
  /* 'creative' has not been a room id since the twelve-spoke plan */
  ['reading', `m.rig.teleportTo('reading'); { const r = m.plan.byId('reading');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`],
  ['linux', `m.rig.teleportTo('linux'); { const r = m.plan.byId('linux');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`],
  /* the cellar: a room with a tube that is only half trying, and one that is
     hardly trying at all. `base` stands the camera on the cellar slab. */
  ['cellar', `m.rig.teleportTo('open-source'); { const r = m.plan.byId('open-source');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`, 'base'],
  ['cellar-dim', `const dim = m.plan.rooms.filter(r => r.floor === 'basement' && !r.items.length)[0]; m.rig.teleportTo(dim.id); { const r = m.plan.byId(dim.id);
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`, 'base'],
  ['cellar-arm', `m.rig.state.x = 0; m.rig.state.z = 12; m.rig.setYawPitch(Math.PI, -0.05);`, 'base'],
  ['stair-hall', `m.rig.state.x = 0; m.rig.state.z = 1.6; m.rig.setYawPitch(0, 0.20);`, 'base'],
  ['stair-flight', `const s = m.plan.stair; m.rig.state.x = s.x; m.rig.state.z = s.z + s.run * 0.55;
     m.rig.setYawPitch(Math.PI, -0.30);`, 'flight']
];

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4500);
  if (HOUR !== null) {
    /* the first move of the slider after the page loads is swallowed — the HUD
       has not finished wiring the row by then — so the minute is put in twice
       and read back before any framing is measured. */
    for (let i = 0; i < 2; i++) {
      await evaluate(`(() => { const s = document.querySelector('input.time');
        s.value = '${HOUR}'; s.dispatchEvent(new Event('input')); })()`);
      await sleep(350);
    }
    console.log('pinned to', await evaluate('document.querySelector(".sky-clock").textContent'),
      '· slider', await evaluate('document.querySelector("input.time").value'), '(asked ' + HOUR + ')',
      '· sun altitude', (await evaluate('window.__museum.sky.state.sunAlt') * 180 / Math.PI).toFixed(1) + '°',
      '· key', await evaluate('window.__museum.lighting.sun.intensity.toFixed(2)'));
  }
  /* stand the camera on the floor the framing asks for. the rig writes
     camera.position every frame, so this has to ride along with it. */
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
      + ' env ' + m.view.scene.environmentIntensity; })()`));
});
