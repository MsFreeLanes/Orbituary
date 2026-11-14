/* diag-bloom-cost.mjs — what the Cupola frame's haze is actually made of.
 *
 *   node scratch/diag-bloom-cost.mjs
 *
 * probe-bloom says how much of a frame is bloom; this says which fittings are
 * paying for it. Each suspect is taken out of the frame one at a time and the
 * haze measured again, and nothing is muted by hiding geometry — a hole in the
 * frame changes what else shows through and what else is lit, and the
 * arithmetic then says the suspect was free. Emissive fittings are muted by
 * switching their emission off and painting them black, which keeps their
 * depth and their place in the frame and takes only their light. The sun's
 * specular is attributed by switching the sun off, which is the only handle it
 * has: a 321-of-linear glint on a polished tube is not a material you can
 * switch to grey.
 *
 * The haze is a difference of two frames, on minus off, and the tone curve is
 * not straight: the same bloom energy lifts a dark part of the frame by more
 * display points than it lifts a bright one. So a frame whose bright surfaces
 * have been replaced by dark ones can measure a bigger haze while every
 * over-threshold pixel in it is dimmer. The linear column is the check on
 * that: it is the share of the frame the high pass actually takes.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

/* each suspect: a way to find its meshes, and how to take its light away */
const SUSPECTS = [
  ['earth to 0.86', `const a = []; sky.group.traverse((o) => { if (o.renderOrder === -2 || o.renderOrder === -1) a.push(o); }); return a;`, 'grey', 0xefefef],
  ['every lamp', `const a = []; view.scene.traverse((o) => { const m = o.material; if (m && m.emissive && m.emissive.getHex() !== 0) a.push(o); }); return a;`, 'emissive'],
  ['rim emission', `const a = []; view.scene.traverse((o) => { const m = o.material; if (m && m.emissive && m.emissive.getHex() === 0x00e5ff) a.push(o); }); return a;`, 'emissive'],
  ['hall lamp faces', `const a = []; view.scene.traverse((o) => { const m = o.material; if (m && m.emissive && (m.emissive.getHex() === 0xffe3b8 || m.emissive.getHex() === 0xffb347 || m.emissive.getHex() === 0xffb700)) a.push(o); }); return a;`, 'emissive'],
  ['cellar concrete', `const a = []; view.scene.traverse((o) => { if (!o.isMesh) return;
      const mt = o.material; if (!mt || !mt.map || mt.color.getHex() !== 0xc8c4be) return;
      const b = new THREE.Box3().setFromObject(o); if ((b.min.y + b.max.y) / 2 < -1) a.push(o); }); return a;`, 'grey', 0xefefef],
  ['stair steel', `const a = []; view.scene.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x33383f) a.push(o); }); return a;`, 'grey', 0x8f8f8f],
  ['well lining', `const a = []; view.scene.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x2b3037) a.push(o); }); return a;`, 'grey', 0x8f8f8f]
];

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
  /* probe-bloom's own cupola-down framing, so the numbers line up with it */
  await evaluate(`(() => { const m = window.__museum;
    m.rig.teleportTo('cupola');
    m.rig.state.x = 0.20; m.rig.state.z = 0.95;
    m.rig.setYawPitch(Math.atan2(0.20, 0.15), -1.50);
    m.rig.update(0.016); })()`);
  await nap(1200);

  await evaluate(`(() => {
    const m = window.__museum;
    m.__frame = () => {
      for (let i = 0; i < 40; i++) m.lighting.update(m.camera.position, 0.05);
      m.view.render(0.016, m.camera);
      const gl = m.view.renderer.getContext();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0, blown = 0, n = px.length / 4;
      for (let i = 0; i < px.length; i += 4) {
        const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        sum += l; if (l > 235) blown++;
      }
      return { mean: +(sum / n).toFixed(1), clip: +(100 * blown / n).toFixed(2) };
    };
    m.__linear = () => {
      /* the composer's own HDR target: what the high pass is shown, before any
         of it is decided. The bloom pass composites additively back into the
         buffer it read, so the target has to be read with the pass switched
         off, or the glow it added is counted as if it were a surface. The
         composer alternates between two targets, so both are read and the one
         that can exceed 1.0 is the linear scene. */
      const was = m.view.bloom.enabled;
      m.view.bloom.enabled = false;
      m.view.render(0.016, m.camera);
      const hf = (h) => {
        const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
        if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
        if (e === 31) return f ? NaN : s * Infinity;
        return s * Math.pow(2, e - 15) * (1 + f / 1024);
      };
      let best = null;
      for (const t of [m.view.composer.renderTarget1, m.view.composer.renderTarget2]) {
        const w = t.width, h = t.height, n = w * h;
        const half = t.texture.type === m.THREE.HalfFloatType;
        const buf = half ? new Uint16Array(n * 4) : new Float32Array(n * 4);
        m.view.renderer.readRenderTargetPixels(t, 0, 0, w, h, buf);
        const g = half ? hf : (v) => v;
        let over = 0, sum = 0, max = 0;
        for (let i = 0; i < n; i++) {
          const l = 0.2126 * g(buf[i * 4]) + 0.7152 * g(buf[i * 4 + 1]) + 0.0722 * g(buf[i * 4 + 2]);
          sum += l; if (l > 0.70) over++; if (l > max) max = l;
        }
        /* the tone-mapped target is sRGB and its mean is higher than the
           linear one's, so the mean cannot pick between them: only the linear
           buffer can hold a value over 1.0 */
        if (!best || max > best.max) best = { max: +max.toFixed(1), mean: +(sum / n).toFixed(3), over: +(100 * over / n).toFixed(2) };
      }
      m.view.bloom.enabled = true;
      return best;
    };
    m.__haze = () => {
      const lin = m.__linear();
      m.view.bloom.enabled = true;
      const on = m.__frame();
      m.view.bloom.enabled = false;
      const off = m.__frame();
      m.view.bloom.enabled = true;
      return { haze: +(on.mean - off.mean).toFixed(1), clip: on.clip, mean: on.mean,
        off: off.mean, over: lin.over, linmean: lin.mean, linmax: lin.max };
    };
    m.__mute = (list, how, grey) => {
      const saved = [], meshes = [];
      for (const o of list) {
        if (o.isMesh || o.isPoints) meshes.push(o);
        else if (o.isGroup) o.traverse((c) => { if (c.isMesh || c.isPoints) meshes.push(c); });
      }
      for (const o of meshes) {
        const mt = o.material;
        if (!mt || Array.isArray(mt)) continue;
        if (how === 'emissive') {
          saved.push([mt, mt.emissive.getHex(), mt.emissiveIntensity, mt.color.getHex(), mt.opacity]);
          mt.emissive.setHex(0); mt.emissiveIntensity = 0; mt.color.setHex(0);
        } else {
          saved.push([mt, null, null, mt.color.getHex(), mt.opacity]);
          if (o.isPoints) mt.opacity = 0; else mt.color.setHex(grey === undefined ? 0 : grey);
        }
      }
      return saved;
    };
    m.__restore = (saved) => {
      for (const [mt, em, ei, col, op] of saved) {
        if (em !== null) { mt.emissive.setHex(em); mt.emissiveIntensity = ei; }
        mt.color.setHex(col); mt.opacity = op;
      }
    };
  })()`);

  const base = await evaluate('window.__museum.__haze()');
  console.log('frame'.padEnd(16), JSON.stringify(base));

  const sweep = [];
  for (const thr of [0.70, 0.80, 0.90, 1.05, 1.30]) {
    const r = await evaluate(`(() => { const m = window.__museum;
      const was = m.view.bloom.threshold; m.view.bloom.threshold = ${thr};
      const out = m.__haze(); m.view.bloom.threshold = was; return out; })()`);
    sweep.push(thr.toFixed(2) + ':' + r.haze);
  }
  console.log('haze vs threshold'.padEnd(16), sweep.join('  '));

  for (const [name, find, how, grey] of SUSPECTS) {
    const r = await evaluate(`(() => {
      const m = window.__museum, sky = m.sky, plan = m.plan, view = m.view, S = m.S, THREE = m.THREE;
      const list = (() => { ${find} })();
      if (!list || !list.length) return { skipped: 'nothing found' };
      const saved = m.__mute(list, ${JSON.stringify(how)}, ${grey === undefined ? 'undefined' : grey});
      const out = m.__haze();
      m.__restore(saved);
      out.objects = list.length;
      return out;
    })()`);
    console.log(name.padEnd(16), JSON.stringify(r), 'haze cost',
      r.haze === undefined ? '-' : +(base.haze - r.haze).toFixed(1));
  }

  /* the sun's specular: the only way to take a glint off a polished tube is to
     take the sun away */
  const sun = await evaluate(`(() => { const m = window.__museum;
    const was = m.lighting.sun.intensity; m.lighting.sun.intensity = 0;
    const out = m.__haze(); m.lighting.sun.intensity = was; return out; })()`);
  console.log('sun off'.padEnd(16), JSON.stringify(sun), 'haze cost', +(base.haze - sun.haze).toFixed(1));
});
