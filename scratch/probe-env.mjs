/* How bright is the environment map, really? Walk scene.environmentIntensity
   down and read the floor band each time. */
import { withBrowser } from './cdp.mjs';
import path from 'node:path';

const measure = `(() => {
  const m = window.__museum;
  const r = m.view.renderer;
  m.view.render(0.016, m.camera);
  const gl = r.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const x0 = Math.floor(W * 0.35), w = Math.floor(W * 0.30);
  const y0 = Math.floor(H * 0.12), h = Math.floor(H * 0.20);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let sum = 0, blown = 0, n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    sum += l; if (l > 235) blown++;
  }
  return (sum / n).toFixed(1) + ' / blown ' + (100 * blown / n).toFixed(1) + '%';
})()`;

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4500);
  await evaluate(`(() => { const m = window.__museum; m.rig.stopTour();
    m.rig.state.x = 0; m.rig.state.z = 1.5; m.rig.setYawPitch(Math.PI, -0.02); })()`);
  await sleep(1200);

  console.log(await evaluate(`(() => {
    const m = window.__museum;
    const out = { sceneEnvIntensity: m.view.scene.environmentIntensity,
      envIsPMREM: !!m.view.scene.environment, toneMapping: m.view.renderer.toneMapping,
      exposure: m.view.renderer.toneMappingExposure };
    m.view.scene.traverse((o) => {
      if (o.material && o.material.map && o.geometry && o.geometry.type === 'CircleGeometry' && !out.floor) {
        out.floor = { envMapIntensity: o.material.envMapIntensity, roughness: o.material.roughness,
          color: '#' + o.material.color.getHexString(), tintUsed: true };
      }
    });
    return out;
  })()`));

  for (const k of [1, 0.5, 0.25, 0.12, 0.05, 0]) {
    await evaluate(`(() => { const m = window.__museum; m.view.scene.environmentIntensity = ${k}; })()`);
    await sleep(400);
    console.log('environmentIntensity ' + k + ' -> floor ' + await evaluate(measure));
  }
});
