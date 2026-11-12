/* Which light is blowing out the rotunda floor? Take the same framing four
   times, each time switching one contributor off, and compare the pixels. */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const framing = `const m = window.__museum;
  m.rig.stopTour();
  m.rig.state.x = 0; m.rig.state.z = 1.5;
  m.rig.setYawPitch(Math.PI, -0.02);`;

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4500);

  async function shot(name) {
    await evaluate(`(() => { ${framing} })()`);
    await sleep(1500);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', 'ab-' + name + '.png'), Buffer.from(img.data, 'base64'));
    /* sample a horizontal strip of the frame: mean luminance of the floor band */
    /* hard numbers: render one frame by hand, then read the pixels back. the
       floor band is the lower middle of the frame, where the white sheet is */
    const lum = await evaluate(`(() => {
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
      return 'floor ' + (sum / n).toFixed(1) + ' blown ' + (100 * blown / n).toFixed(1) + '%  ' + W + 'x' + H;
    })()`);
    console.log('shot ab-' + name + '.png', lum);
  }

  await shot('0-baseline');

  await evaluate(`(() => {
    const m = window.__museum;
    m.view.scene.traverse((o) => {
      const mt = o.material;
      if (!mt) return;
      const list = Array.isArray(mt) ? mt : [mt];
      for (const x of list) if (x.roughness !== undefined && x.roughness < 0.8 && !x.emissiveMap && x.emissiveIntensity === undefined) x.roughness = 1.0;
    });
  })()`);
  await shot('1-roughness1');

  await evaluate(`(() => { const m = window.__museum; m.view.scene.environment = null; })()`);
  await shot('2-noenv');

  await evaluate(`(() => { const m = window.__museum; m.lighting.moon.intensity = 0; m.lighting.hemi.intensity = 0; })()`);
  await shot('3-nomoonhemi');

  await evaluate(`(() => { const m = window.__museum; for (const l of m.lighting.pool) l.intensity = 0; })()`);
  await shot('4-nopool');

  await evaluate(`(() => { const m = window.__museum; m.view.bloom.strength = 0; })()`);
  await shot('5-nobloom');
});
