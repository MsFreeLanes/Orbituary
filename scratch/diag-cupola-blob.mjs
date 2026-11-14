/* diag-cupola-blob.mjs — the white blob in the middle of the Cupola's planet.
 *
 *   node scratch/diag-cupola-blob.mjs
 *
 * Four frames of one framing, each answering a different question:
 *   diag-blob-on.png      the frame as it is
 *   diag-blob-off.png     bloom switched off: if the blob survives, it is not
 *                         the bloom pass, it is a surface
 *   diag-blob-noearth.png the planet painted black: if the blob survives, it
 *                         is not the planet
 *   diag-blob-nostair.png the flight and both landings painted black: if the
 *                         blob goes, the stair is the plate in the window
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
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
  /* the framing of scratch/shot-palette.mjs, so these frames are comparable
     with palette-cupola-earth.png — the photograph the complaint came in with */
  await evaluate(`(() => { const m = window.__museum;
    m.rig.teleportTo('cupola');
    m.rig.state.x = 0.20; m.rig.state.z = 0.95;
    m.rig.setYawPitch(Math.atan2(-(0.0 - 0.20), -(0.8 - 0.95)), -1.50);
    m.rig.update(0.016); })()`);
  await nap(1500);

  const shot = async (name) => {
    await evaluate(`(() => { const m = window.__museum;
      for (let i = 0; i < 40; i++) m.lighting.update(m.camera.position, 0.05);
      m.view.render(0.016, m.camera); })()`);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', name), Buffer.from(img.data, 'base64'));
    console.log('wrote scratch/' + name);
  };

  await shot('diag-blob-on.png');
  await evaluate('window.__museum.view.bloom.enabled = false');
  await shot('diag-blob-off.png');
  await evaluate('window.__museum.view.bloom.enabled = true');

  const mute = `(() => {
    const m = window.__museum, plan = m.plan, S = m.S, THREE = m.THREE;
    m.__saved = [];
    const hit = (o) => { const mt = o.material; if (!mt || Array.isArray(mt)) return;
      m.__saved.push([mt, mt.color.getHex()]); mt.color.setHex(0x000000); };
    ${'${FIND}'}
  })()`;

  const shots = [
    ['diag-blob-noearth.png', `m.sky.group.traverse((o) => { if (o.renderOrder === -2 || o.renderOrder === -1) hit(o); });`],
    /* the cellar's concrete pile: the flight, both landings and the hall's own
       slab, welded into one mesh per material, so this is the only handle */
    ['diag-blob-noconcrete.png', `m.view.scene.traverse((o) => { if (!o.isMesh) return;
        const mt = o.material; if (!mt || !mt.map || mt.color.getHex() !== 0xc8c4be) return;
        const b = new THREE.Box3().setFromObject(o); if ((b.min.y + b.max.y) / 2 < -1) hit(o); });`],
    ['diag-blob-nolining.png', `m.view.scene.traverse((o) => { if (o.isMesh && o.material &&
        o.material.color && o.material.color.getHex() === 0x2b3037) hit(o); });`]
  ];
  for (const [name, find] of shots) {
    await evaluate(mute.replace('${FIND}', find));
    await shot(name);
    await evaluate(`(() => { const m = window.__museum;
      for (const [mt, hex] of m.__saved) mt.color.setHex(hex); m.__saved = []; })()`);
  }
});
