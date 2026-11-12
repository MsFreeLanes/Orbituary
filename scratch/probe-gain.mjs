/* Sweep a gain over every light anchor and re-measure the same framings, so
   the room brightness constant is chosen from numbers instead of guesses. */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const SAMPLE = `(() => {
  const m = window.__museum;
  m.view.render(0.016, m.camera);
  const gl = m.view.renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  function band(fy0, fy1) {
    const x0 = Math.floor(W * 0.30), w = Math.floor(W * 0.40);
    const y0 = Math.floor(H * fy0), h = Math.floor(H * (fy1 - fy0));
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, blown = 0, n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      sum += l; if (l > 235) blown++;
    }
    return (sum / n).toFixed(0) + '/' + (100 * blown / n).toFixed(0);
  }
  return { floor: band(0.10, 0.30), mid: band(0.45, 0.60) };
})()`;

const framings = [
  ['rotunda', `m.rig.state.x = 0; m.rig.state.z = 1.5; m.rig.setYawPitch(Math.PI, -0.02);`],
  ['corridor', `const c = m.plan.corridors.find((c) => c.dir.z > 0.5);
     m.rig.state.x = 0; m.rig.state.z = (c.t0 + c.t1) / 2; m.rig.setYawPitch(Math.PI, -0.05);`],
  ['gaming', `m.rig.teleportTo('gaming'); { const r = m.plan.byId('gaming');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`],
  ['privacy', `m.rig.teleportTo('privacy'); { const r = m.plan.byId('privacy');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`],
  ['linux', `m.rig.teleportTo('linux'); { const r = m.plan.byId('linux');
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), -0.05); }`]
];

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4500);
  await evaluate(`(() => { const m = window.__museum;
    m.lighting.anchors.forEach((a) => { a.base = a.i; }); })()`);

  for (const gain of [1, 1.7, 2.4, 3.2]) {
    await evaluate(`(() => { const m = window.__museum;
      m.lighting.anchors.forEach((a) => { a.i = a.base * ${gain}; }); })()`);
    const row = [];
    for (const [name, set] of framings) {
      await evaluate(`(() => { const m = window.__museum; ${set} })()`);
      await sleep(1100);
      const r = await evaluate(SAMPLE);
      row.push(name + ' f' + r.floor + ' m' + r.mid);
    }
    console.log('gain ' + String(gain).padEnd(4), row.join('  '));
  }
});
