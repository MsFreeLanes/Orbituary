/* diag-blob-where.mjs — the white mass in the middle of the planet, measured.
 *
 *   node scratch/diag-blob-where.mjs
 *
 * Finds the brightest point inside the well's disc in the Cupola framing, then
 * reads that one pixel three ways: as the frame comes out with the bloom pass
 * on, as it comes out with the pass off, and as the linear value the high pass
 * was shown. If it is bright with the pass off, it is a surface, and the only
 * fix is the paint under the eye. If it is bright only with the pass on, it is
 * a fitting somewhere else in the frame glowing onto it.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

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
  await evaluate(`(() => { const m = window.__museum;
    m.rig.teleportTo('cupola');
    m.rig.state.x = 0.20; m.rig.state.z = 0.95;
    m.rig.setYawPitch(Math.atan2(0.20, 0.15), -1.50);
    m.rig.update(0.016); })()`);
  await nap(1500);

  await evaluate(`(() => {
    const m = window.__museum;
    m.__pick = () => {
      for (let i = 0; i < 40; i++) m.lighting.update(m.camera.position, 0.05);
      m.view.render(0.016, m.camera);
      const gl = m.view.renderer.getContext();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      /* the well's disc, in screenshot coordinates: a band across the middle */
      let best = { l: -1 };
      for (let y = 120; y < 820; y++) {
        for (let x = 420; x < 1180; x++) {
          const i = ((H - 1 - y) * W + x) * 4;
          const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
          if (l > best.l) best = { x, y, l: +l.toFixed(1), rgb: [px[i], px[i + 1], px[i + 2]] };
        }
      }
      return best;
    };
    m.__linearAt = (x, y) => {
      const was = m.view.bloom.enabled;
      m.view.bloom.enabled = false;
      m.view.render(0.016, m.camera);
      const hf = (h) => {
        const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
        if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
        if (e === 31) return f ? NaN : s * Infinity;
        return s * Math.pow(2, e - 15) * (1 + f / 1024);
      };
      let out = null;
      for (const t of [m.view.composer.renderTarget1, m.view.composer.renderTarget2]) {
        const n = t.width * t.height;
        const half = t.texture.type === m.THREE.HalfFloatType;
        const buf = half ? new Uint16Array(n * 4) : new Float32Array(n * 4);
        m.view.renderer.readRenderTargetPixels(t, 0, 0, t.width, t.height, buf);
        const g = half ? hf : (v) => v;
        const i = ((t.height - 1 - y) * t.width + x) * 4;
        const rgb = [g(buf[i]), g(buf[i + 1]), g(buf[i + 2])];
        const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
        if (!out || l > out.l) out = { l: +l.toFixed(3), rgb: rgb.map((v) => +v.toFixed(3)) };
      }
      m.view.bloom.enabled = was;
      return out;
    };
  })()`);

  const on = await evaluate('window.__museum.__pick()');
  const lin = await evaluate(`window.__museum.__linearAt(${on.x}, ${on.y})`);
  const off = await evaluate(`(() => { const m = window.__museum;
    m.view.bloom.enabled = false; const p = m.__pick(); m.view.bloom.enabled = true; return p; })()`);
  console.log('brightest point in the disc', JSON.stringify(on));
  console.log('  same pixel, bloom off  ', JSON.stringify(off));
  console.log('  same pixel, linear     ', JSON.stringify(lin));

  /* and the same three readings over a grid, so a single pixel is not the story */
  const grid = await evaluate(`(() => { const m = window.__museum;
    const gl = m.view.renderer.getContext();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    const rows = [];
    for (const [x, y] of [[700, 560], [760, 520], [820, 480], [640, 640], [900, 700], [560, 300], [1000, 300]]) {
      m.view.render(0.016, m.camera);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const i = ((H - 1 - y) * W + x) * 4;
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      const lin = m.__linearAt(x, y);
      rows.push([x, y, 'display ' + l.toFixed(0), 'linear ' + lin.l.toFixed(3)]);
    }
    return rows; })()`);
  for (const r of grid) console.log('  ', r.join('  ·  '));
});
