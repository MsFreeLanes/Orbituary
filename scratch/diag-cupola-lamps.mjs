/* diag-cupola-lamps.mjs — the white blow-out in the middle of the planet,
 * photographed three ways in the same framing at the same hour:
 *
 *   fix-blob-on.png      as built
 *   fix-blob-nolamp.png  the stair hall's own lamp faces switched off
 *   fix-blob-noemis.png  every emissive face in the building switched off
 *
 * If the blob survives the second and dies in the third, it is a fitting, not
 * the planet. Emissive faces are muted by taking their emission and their base
 * colour away, not by hiding them: a hole in the frame changes what else shows
 * through, and the arithmetic then says the suspect was free.
 *
 *   node scratch/diag-cupola-lamps.mjs
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
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

  const shot = async (name) => {
    await evaluate('(() => { const m = window.__museum; for (let i = 0; i < 30; i++) m.lighting.update(m.camera.position, 0.05); m.view.render(0.016, m.camera); })()');
    await nap(400);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', name), Buffer.from(img.data, 'base64'));
    console.log('wrote scratch/' + name);
  };

  await shot('fix-blob-on.png');

  for (const [name, hexes, file] of [
    ['hall lamp faces', ['ffe3b8', 'ffb347', 'ffb700'], 'fix-blob-nolamp.png'],
    ['every emissive', null, 'fix-blob-noemis.png']
  ]) {
    const n = await evaluate(`(() => {
      const m = window.__museum, want = ${JSON.stringify(hexes)};
      const saved = [];
      m.view.scene.traverse((o) => {
        const mt = o.material;
        if (!mt || !mt.emissive || mt.emissive.getHexString() === '000000') return;
        if (want && !want.includes(mt.emissive.getHexString())) return;
        saved.push([mt, mt.emissive.getHex(), mt.emissiveIntensity, mt.color.getHex()]);
        mt.emissiveIntensity = 0; mt.color.setHex(0);
      });
      m.__saved = saved;
      return saved.length;
    })()`);
    console.log(name, 'muted', n, 'materials');
    await shot(file);
    await evaluate(`(() => { const m = window.__museum;
      for (const [mt, em, ei, col] of m.__saved) { mt.emissive.setHex(em); mt.emissiveIntensity = ei; mt.color.setHex(col); } })()`);
  }
});
