/* diag-bloom-buffer.mjs — look at the buffer the bloom pass actually reads.
 *
 *   node scratch/diag-bloom-buffer.mjs
 *
 * Every other probe measures the finished 8-bit frame, and ACES makes that
 * frame a bad witness: a bright surface and a dark one can both "gain" the
 * same points from the pass while only one of them is feeding it. So this
 * reads the composer's own render target — the linear HDR scene, before the
 * high pass and before tone mapping — and asks the only question the threshold
 * cares about: how many pixels are over it, and where they are.
 *
 * It writes diag-bloom-mask.png, where every pixel the high pass takes is
 * shown at its own colour and everything under the threshold is shown at a
 * quarter of itself. That picture says which fitting is fogging the room.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const SAMPLE = `(() => {
  const m = window.__museum;
  for (let i = 0; i < 60; i++) m.lighting.update(m.camera.position, 0.05);
  /* with the pass off, the RenderPass's own target still holds the linear
     scene: the chain is RenderPass → [bloom] → OutputPass, and only the last
     one turns the picture into something a display can show */
  m.view.bloom.enabled = false;
  m.view.render(0.016, m.camera);
  m.view.bloom.enabled = true;
  /* the composer alternates its two targets between frames, so which one the
     RenderPass wrote into this frame is not something to assume: both are read
     and the linear one is the one that can exceed 1.0. A tone-mapped target is
     clamped, so it can never be mistaken for it. */
  const hf = (h) => {
    const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
    if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
    if (e === 31) return f ? NaN : s * Infinity;
    return s * Math.pow(2, e - 15) * (1 + f / 1024);
  };
  const read = (rt) => {
    const n = rt.width * rt.height * 4;
    const half = rt.texture.type === m.THREE.HalfFloatType;
    const buf = half ? new Uint16Array(n) : new Float32Array(n);
    m.view.renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
    const out = new Float32Array(n);
    let max = 0;
    for (let i = 0; i < n; i += 4) {
      for (let k = 0; k < 3; k++) {
        const v = half ? hf(buf[i + k]) : buf[i + k];
        out[i + k] = v; if (v > max) max = v;
      }
    }
    return { rt, px: out, max };
  };
  const a = read(m.view.composer.renderTarget1);
  const b = read(m.view.composer.renderTarget2);
  const scene = a.max >= b.max ? a : b;
  const rt = scene.rt, W = rt.width, H = rt.height, n = W * H * 4;
  const get = (i) => scene.px[i];
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const img = x.createImageData(W, H);
  const d = img.data;
  let sum = 0, over = 0, hot = 0, peak = 0, peakAt = null;
  const thr = m.view.bloom.threshold;
  for (let p = 0; p < n; p += 4) {
    const r = get(p), g = get(p + 1), b = get(p + 2);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += l;
    if (l > peak) { peak = l; peakAt = [(p >> 2) % W, (p >> 2) / W | 0]; }
    if (l > thr) over++;
    if (l > 1.30) hot++;
    const k = (H - 1 - ((p >> 2) / W | 0)) * W * 4 + ((p >> 2) % W) * 4;   // the target reads bottom-up
    const q = l > thr ? 1 : 0.25;
    d[k] = Math.min(255, r * 255 * q); d[k + 1] = Math.min(255, g * 255 * q);
    d[k + 2] = Math.min(255, b * 255 * q); d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const px = m.view.renderer.getContext();
  return { W, H, type: rt.texture.type, max: +scene.max.toFixed(2),
    mean: +(sum / (n / 4)).toFixed(3),
    over: +(100 * over / (n / 4)).toFixed(2), over130: +(100 * hot / (n / 4)).toFixed(2),
    peak: +peak.toFixed(2), peakAt, png: c.toDataURL('image/png').split(',')[1] };
})()`;

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  for (let i = 0; i < 2; i++) {
    await evaluate(`(() => { const s = document.querySelector('input.time');
      s.value = '${13 * 60}'; s.dispatchEvent(new Event('input')); })()`);
    await nap(350);
  }
  for (const [name, set] of [
    ['cupola-down', `m.rig.teleportTo('cupola');
      m.rig.state.x = 0.20; m.rig.state.z = 0.95;
      m.rig.setYawPitch(Math.atan2(0.20, 0.15), -1.50);`],
    ['rotunda-floor', `m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = 1.5;
      m.rig.setYawPitch(Math.PI, -0.02);`]
  ]) {
    await evaluate(`(() => { const m = window.__museum; ${set} m.rig.update(0.016); })()`);
    await nap(1200);
    const r = await evaluate(SAMPLE);
    writeFileSync(path.join(process.cwd(), 'scratch', 'diag-bloom-mask-' + name + '.png'),
      Buffer.from(r.png, 'base64'));
    console.log(name.padEnd(14), 'max', r.max, 'mean linear', r.mean,
      '· over ' + r.over + '% · over 1.30 ' + r.over130 + '% · peak', r.peak, 'at', r.peakAt);
  }
});
