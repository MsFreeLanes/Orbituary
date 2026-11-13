/* probe: is the sun's shadow box the right size? the same framing rendered
 * twice — once with the box the live lighting pass builds (S.SHADOW_SPAN,
 * riding along with the visitor) and once with the box the old pass asked for
 * (reach + 12, parked on the origin) — so what changes between the two frames
 * is the shadow map and nothing else.
 *
 *   node scratch/probe-shadow.mjs
 *
 * The floor band's spread is the crispness number: the sun throws bright
 * bars between dark ones, and a map too coarse to resolve them flattens the
 * spread without moving the mean.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

/* parked at the origin, the old box is the whole plan: 124 m on a 2048 map */
const OLD_SPAN = 62;

/* re-asserting the live box is not a no-op once another mode has stretched
   the extents: the lighting pass only moves the box when the visitor moves,
   so the extents have to be put back by hand between framings. */
const liveBox = (sunR) => `(() => {
  const m = window.__museum, S = m.S, sun = m.lighting.sun, cam = sun.shadow.camera;
  cam.left = -S.SHADOW_SPAN; cam.right = S.SHADOW_SPAN;
  cam.top = S.SHADOW_SPAN; cam.bottom = -S.SHADOW_SPAN;
  cam.near = 1; cam.far = ${sunR} + 2 * S.SHADOW_SPAN;
  cam.updateProjectionMatrix();
  const dir = sun.position.clone().sub(sun.target.position).normalize();
  const x = Math.round(m.rig.state.x / 0.5) * 0.5, z = Math.round(m.rig.state.z / 0.5) * 0.5;
  sun.target.position.set(x, 0, z);
  sun.position.copy(sun.target.position).addScaledVector(dir, ${sunR});
})()`;

const frame = (setup) => `(() => {
  const m = window.__museum, sun = m.lighting.sun, cam = sun.shadow.camera;
  for (let i = 0; i < 60; i++) m.lighting.update(m.camera.position, 0.05);
  ${setup}
  m.view.render(0.016, m.camera);
  const gl = m.view.renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const x0 = Math.floor(W * 0.18), w = Math.floor(W * 0.64);
  const y0 = Math.floor(H * 0.06), h = Math.floor(H * 0.20);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let sum = 0, sq = 0, n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    sum += l; sq += l * l;
  }
  const mean = sum / n;
  return { texel: (2 * cam.right / 2048 * 100).toFixed(2) + ' cm',
    box: (2 * cam.right).toFixed(0) + ' m @ ' + sun.target.position.toArray().map((v) => v.toFixed(1)).join(','),
    band: 'floor ' + mean.toFixed(0) + ' spread ' + Math.sqrt(Math.max(0, sq / n - mean * mean)).toFixed(1) };
})()`;

/* the old pass set the extents but never refreshed the orthographic
   projection, so three kept its default ±5 m. both readings are shown: what
   the old code asked for, and what it actually got. */
const oldBox = (span) => `(() => {
  const m = window.__museum, sun = m.lighting.sun, cam = sun.shadow.camera;
  cam.left = -${span}; cam.right = ${span}; cam.top = ${span}; cam.bottom = -${span};
  cam.near = 1; cam.far = 240;
  cam.updateProjectionMatrix();
  const dir = sun.position.clone().sub(sun.target.position).normalize();
  sun.target.position.set(0, 0, 0);
  sun.position.copy(sun.target.position).addScaledVector(dir, ${'sunR'});
})()`;

const framings = [
  ['privacy', `const r = m.plan.byId('privacy');
     m.rig.state.x = r.entry.x + r.n.x * 1.8; m.rig.state.z = r.entry.z + r.n.z * 1.8;
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), 0.16);`],
  ['social', `const r = m.plan.byId('social-networks');
     m.rig.state.x = r.entry.x + r.n.x * 1.8; m.rig.state.z = r.entry.z + r.n.z * 1.8;
     m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), 0.16);`]
];

await withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  const sunR = await evaluate('window.__museum.lighting.sun.position.distanceTo(window.__museum.lighting.sun.target.position)');

  for (const [name, set] of framings) {
    for (const [mode, setup] of [
      ['live', liveBox(sunR)],
      ['old', oldBox(OLD_SPAN).replace('sunR', String(sunR))],
      ['default', oldBox(5).replace('sunR', String(sunR))]
    ]) {
      await evaluate(`(() => { const m = window.__museum; ${set} })()`);
      await sleep(900);
      const out = await evaluate(frame(setup));
      const file = 'shadow-' + mode + '-' + name + '.png';
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path.join(process.cwd(), 'scratch', file), Buffer.from(shot.data, 'base64'));
      console.log(name.padEnd(8), mode.padEnd(8), out.box.padEnd(34), out.texel.padEnd(10), out.band, '· wrote', file);
    }
  }
});

