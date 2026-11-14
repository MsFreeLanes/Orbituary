/* diag-bloom-who.mjs — which fitting is fogging the Cupola frame?
 *
 *   node scratch/diag-bloom-who.mjs
 *
 * The bloom pass is a black box you cannot interrogate from outside, so this
 * does it two ways at once.
 *
 * By subtraction: the same framing is measured with the pass on and off, and
 * then again with one suspect at a time taken out of the frame. Nothing is
 * muted by hiding geometry — a hole in the frame changes what else is lit and
 * what else shows through — so each suspect is muted by painting it black,
 * which keeps its depth and its place in the frame and takes only its light.
 *
 * And by moving the threshold: the haze as a function of the threshold IS the
 * luminance distribution of the frame, which is the only honest way to say
 * that a surface at 0.75 is what is glowing. A haze that dies between 0.70 and
 * 0.80 is a frame of surfaces sitting just over the line; a haze that survives
 * to 1.30 is a lamp.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const SUSPECTS = [
  /* the planet is not painted black here: black opens a hole in the frame that
     every other fitting's bloom then pours into, and the arithmetic says the
     planet costs nothing. It is pulled to 0.86 of itself instead, which is the
     change the fix actually makes — the disc stays a disc, and only the part
     of it the high pass was taking goes away. */
  ['earth −14%', `const a = []; sky.group.traverse((o) => { if (o.renderOrder === -2 || o.renderOrder === -1) a.push(o); }); return a;`, 0xefefef],
  ['cupola deck', `return [plan.byId('cupola').group];`],
  ['hull rim', `const a = []; view.scene.traverse((o) => { const m = o.material; if (m && m.emissive && m.emissive.getHex() === 0x00e5ff) a.push(o); }); return a;`],
  /* the stair is welded into one mesh per material, so it cannot be picked out
     by piece: this takes the cellar's concrete pile — the flight, both
     landings and the hall's own slab — by its material and its level, which is
     the only handle the weld leaves. The well's lining is its own material. */
  ['cellar concrete', `const a = []; view.scene.traverse((o) => { if (!o.isMesh) return;
      const mt = o.material; if (!mt || !mt.map || mt.color.getHex() !== 0xc8c4be) return;
      const b = new THREE.Box3().setFromObject(o); if ((b.min.y + b.max.y) / 2 < -1) a.push(o); }); return a;`],
  ['well lining', `const a = []; view.scene.traverse((o) => { if (o.isMesh && o.material &&
      o.material.color && o.material.color.getHex() === 0x2b3037) a.push(o); }); return a;`]
];

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  /* the same hour probe-bloom frames at: at the default hour the planet is
     half in its own night and the arithmetic says it costs nothing */
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
    m.__haze = () => {
      const on = m.__frame();
      m.view.bloom.enabled = false;
      const off = m.__frame();
      m.view.bloom.enabled = true;
      return { haze: +(on.mean - off.mean).toFixed(1), clip: on.clip, mean: on.mean };
    };
    /* paint a whole subtree black (or to a grey), keeping depth, shadow and
       geometry */
    m.__mute = (list, grey) => {
      grey = grey === undefined ? 0x000000 : grey;
      const saved = [], meshes = [];
      for (const o of list) {
        if (o.isMesh || o.isPoints) meshes.push(o);
        else if (o.isGroup) o.traverse((c) => { if (c.isMesh || c.isPoints) meshes.push(c); });
      }
      for (const o of meshes) {
        const mt = o.material;
        if (!mt || Array.isArray(mt)) continue;
        saved.push([mt, mt.color.getHex(), mt.opacity]);
        if (o.isPoints) mt.opacity = 0; else mt.color.setHex(grey);
      }
      return saved;
    };
    m.__restore = (saved) => { for (const [mt, hex, op] of saved) { mt.color.setHex(hex); mt.opacity = op; } };
  })()`);

  const base = await evaluate('window.__museum.__haze()');
  console.log('frame'.padEnd(16), JSON.stringify(base));

  const sweep = [];
  for (const thr of [0.55, 0.70, 0.75, 0.80, 0.90, 1.05, 1.30]) {
    const r = await evaluate(`(() => { const m = window.__museum;
      const was = m.view.bloom.threshold; m.view.bloom.threshold = ${thr};
      const out = m.__haze(); m.view.bloom.threshold = was; return out; })()`);
    sweep.push(thr.toFixed(2) + ':' + r.haze);
  }
  console.log('haze vs threshold', sweep.join('  '));

  for (const [name, find, grey] of SUSPECTS) {
    const r = await evaluate(`(() => {
      const m = window.__museum, sky = m.sky, plan = m.plan, view = m.view, S = m.S, THREE = m.THREE;
      const list = (() => { ${find} })();
      if (!list.length) return { skipped: 'nothing found' };
      const saved = m.__mute(list, ${grey === undefined ? 'undefined' : grey});
      const out = m.__haze();
      m.__restore(saved);
      out.objects = list.length;
      return out;
    })()`);
    console.log(name.padEnd(16), JSON.stringify(r), 'haze cost',
      r.haze === undefined ? '-' : +(base.haze - r.haze).toFixed(1));
  }
});
