/* diag-cupola-sun.mjs — the same Cupola framing with the sun switched off.
 *
 *   node scratch/diag-cupola-sun.mjs
 *
 * The white mass in the middle of the planet reads as a blown-out cloud, but
 * the pixel at its centre comes out of the renderer at 2.9 of linear
 * luminance with the bloom pass switched off, which no painted cloud at 0.56
 * can do. This is the photograph that says what it is: if the mass goes when
 * the sun does, it is a specular glint off a surface between the eye and the
 * planet, and the planet's paint has nothing to do with it.
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

  await shot('fix-blob-sunon.png');
  await evaluate(`(() => { const m = window.__museum;
    m.__sunWas = m.lighting.sun.intensity; m.lighting.sun.intensity = 0; })()`);
  await shot('fix-blob-sunoff.png');
  console.log('sun intensity restored:', await evaluate(`(() => { const m = window.__museum;
    m.lighting.sun.intensity = m.__sunWas; return m.lighting.sun.intensity; })()`));
});
