/* probe-ab.mjs — where did the rotunda's exposure go?
 *
 * probe-exposure's rotunda framing stands on the Cupola's glass and reads the
 * deck 3.2 to 4.45 m ahead. Nothing in that band is new geometry, so the
 * number that moved came in through something the camera does not look at
 * directly: the well's own brightness, the bloom it used to throw, or the
 * hall's lamp. This turns the new pieces off one at a time, at runtime, and
 * reads the same two bands each time.
 */
import { withBrowser } from './cdp.mjs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const SAMPLE = `(() => {
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
    let sum = 0, blown = 0, dark = 0, n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      sum += l; if (l > 235) blown++; if (l < 12) dark++;
    }
    return (sum / n).toFixed(0) + ' (clip ' + (100 * blown / n).toFixed(0) + '%, dark ' + (100 * dark / n).toFixed(0) + '%)';
  }
  return { floor: band(0.10, 0.30), mid: band(0.45, 0.60) };
})()`;

const FIND = `(() => {
  const m = window.__museum, T = m.THREE;
  const scene = m.sky.group.parent;
  const found = { sheenUp: [], sheenDown: [], cone: [], pane: [], lamp: null, lights: [] };
  scene.traverse((o) => {
    const mat = o.material;
    if (o.isPointLight) {
      found.lights.push([+o.position.x.toFixed(2), +o.position.y.toFixed(2), +o.position.z.toFixed(2),
        +o.intensity.toFixed(1), +(o.distance || 0).toFixed(0)]);
      if (o.position.x > 3 && o.matrixWorld.elements[13] < -1) found.lamp = o;
      return;
    }
    if (!mat) return;
    const wy = o.matrixWorld.elements[13];
    if (o.isMesh && mat.isMeshBasicMaterial && mat.map && mat.blending === T.AdditiveBlending) {
      (wy < -1 ? found.sheenDown : found.sheenUp).push(o);
    } else if (o.isMesh && mat.color && mat.color.getHex() === 0x2b3037 && mat.side === T.DoubleSide) {
      found.cone.push(o);
    } else if (o.isMesh && mat.clearcoat === 1) {
      found.pane.push(o);
    }
  });
  window.__ab = found;
  return { sheenUp: found.sheenUp.length, sheenDown: found.sheenDown.length,
    cone: found.cone.length, pane: found.pane.length,
    lamp: found.lamp ? [found.lamp.position.x, +found.lamp.position.y.toFixed(2), found.lamp.position.z] : null,
    lights: found.lights };
})()`;

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  await evaluate('window.__museum.hud.hideIntro()');
  for (let i = 0; i < 2; i++) {
    await evaluate(`(() => { const s = document.querySelector('input.time');
      s.value = '467'; s.dispatchEvent(new Event('input')); })()`);
    await nap(350);
  }
  console.log('found', JSON.stringify(await evaluate(FIND)));
  const frame = `(() => { const m = window.__museum;
    m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = 1.5;
    m.rig.setYawPitch(Math.PI, -0.02); m.rig.update(0.016); })()`;
  const step = async (label, patch) => {
    if (patch) await evaluate(patch);
    await evaluate(frame);
    await nap(400);
    console.log(label.padEnd(22), JSON.stringify(await evaluate(SAMPLE)));
  };
  await step('as built');
  await evaluate(`(() => { const m = window.__museum;
    m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = 1.5;
    m.rig.setYawPitch(Math.PI, -0.02); m.rig.update(0.016); })()`);
  await nap(30000);
  console.log('after 30 s more frames   ', JSON.stringify(await evaluate(SAMPLE)));
  console.log('exposure', await evaluate('window.__museum.view.renderer.toneMappingExposure.toFixed(3)'),
    'fog', await evaluate('window.__museum.view.scene.fog.density.toFixed(4)'));
  await step('bloom+shadows forced on',
    'window.__museum.view.bloom.enabled = true; window.__museum.view.renderer.shadowMap.enabled = true; window.__museum.view.renderer.setPixelRatio(1)');
  console.log('tier', await evaluate('window.__museum.view.tier'), 'fps',
    await evaluate('window.__museum.view.fps.toFixed(1)'));
});
