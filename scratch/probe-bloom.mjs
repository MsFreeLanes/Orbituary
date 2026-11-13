/* probe-bloom.mjs — how much of a frame is the bloom pass, and how much of it
 * is the geometry under it. The same framing is rendered twice, once with the
 * bloom pass enabled and once with it switched off, and the two frames are
 * read back the way probe-exposure reads them. The difference is the haze: a
 * few points of mean luminance is a fitting that glows, twenty is a room that
 * has been fogged, and the Cupola is where that line gets drawn.
 *
 *   node scratch/probe-bloom.mjs            → the framings below
 *   node scratch/probe-bloom.mjs --cupola   → just the Cupola, twice
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const HOUR = 13 * 60;

const SAMPLE = `(() => {
  const m = window.__museum;
  for (let i = 0; i < 60; i++) m.lighting.update(m.camera.position, 0.05);
  function frame() {
    m.view.render(0.016, m.camera);
    const gl = m.view.renderer.getContext();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, blown = 0, hot = 0, n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      sum += l; if (l > 235) blown++; if (l > 200) hot++;
    }
    return { mean: +(sum / n).toFixed(1), clip: +(100 * blown / n).toFixed(2),
      hot: +(100 * hot / n).toFixed(2) };
  }
  const on = frame();
  m.view.bloom.enabled = false;
  const off = frame();
  m.view.bloom.enabled = true;
  /* every emissive face the frame can actually see, so a number here can be
     traced back to the material that set it */
  const emis = [];
  m.view.scene.traverse((o) => {
    const mt = o.material;
    if (!mt || !mt.emissive || mt.emissive.getHex() === 0) return;
    if (!o.visible) return;
    const e = mt.emissive, i = mt.emissiveIntensity === undefined ? 1 : mt.emissiveIntensity;
    const luma = (0.2126 * e.r + 0.7152 * e.g + 0.0722 * e.b) * i;
    if (luma < 0.3) return;
    emis.push('#' + mt.emissive.getHexString() + ' i' + i.toFixed(2) + ' luma' + luma.toFixed(2));
  });
  return { on, off, haze: +(on.mean - off.mean).toFixed(1),
    threshold: +m.view.bloom.threshold.toFixed(2), strength: +m.view.bloom.strength.toFixed(2),
    emis: [...new Set(emis)].sort() };
})()`;

const FRAMINGS = [
  ['cupola-down', `m.rig.teleportTo('cupola');
     m.rig.state.x = 0.20; m.rig.state.z = 0.95;
     m.rig.setYawPitch(Math.atan2(0.20, 0.15), -1.50);`],
  ['cupola-across', `m.rig.teleportTo('cupola');
     m.rig.state.x = 0.9; m.rig.state.z = 3.6;
     m.rig.setYawPitch(0.0, -0.35);`],
  ['rotunda-floor', `m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = 1.5;
     m.rig.setYawPitch(Math.PI, -0.02);`],
  ['corridor-night', `const c = m.plan.corridors.find((c) => c.dir.z > 0.5);
     m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = (c.t0 + c.t1) / 2;
     m.rig.setYawPitch(Math.PI, -0.05);`]
];

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  for (let i = 0; i < 2; i++) {
    await evaluate(`(() => { const s = document.querySelector('input.time');
      s.value = '${HOUR}'; s.dispatchEvent(new Event('input')); })()`);
    await sleep(350);
  }
  for (const [name, set] of FRAMINGS) {
    await evaluate(`(() => { const m = window.__museum; ${set} m.rig.update(0.016); })()`);
    await sleep(1200);
    const r = await evaluate(SAMPLE);
    console.log(name.padEnd(15), 'bloom on', JSON.stringify(r.on), 'off', JSON.stringify(r.off),
      'haze', r.haze, '· thr', r.threshold, 'strength', r.strength);
    if (name === 'cupola-down') console.log('   emissives:', r.emis.join(' | '));
  }
});
