/* shot-landing.mjs — the bottom of the flight, from the hall it lands in.
 *
 *   node scratch/shot-landing.mjs
 *
 * Two framings of the same corner, at 13:00 so the planet is lit under the
 * glass: one standing east of the flight's foot, looking back at where the
 * stair arrives at the well's sill and where the glazing stops, and one from
 * the same place looking up the shaft, which is the way the well reads from
 * below. The first is the photograph that answers "is the landing still a
 * landing?" — the flat across the mouth's south, the sill, the flight's last
 * treads and the hall's own slab all have to be legible in it.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const place = (x, z, tx, tz, pitch, storey) => `(() => {
  const m = window.__museum;
  m.rig.state.storey = ${JSON.stringify(storey || 'basement')};
  m.rig.state.x = ${x}; m.rig.state.z = ${z};
  m.rig.setYawPitch(Math.atan2(${-(tx - x)}, ${-(tz - z)}), ${pitch});
  m.rig.update(0.016);
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  for (let i = 0; i < 2; i++) {
    await evaluate(`(() => { const s = document.querySelector('input.time');
      s.value = '780'; s.dispatchEvent(new Event('input')); })()`);
    await nap(350);
  }
  const shot = async (name) => {
    await nap(2200);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', name), Buffer.from(img.data, 'base64'));
    console.log('wrote scratch/' + name);
  };

  /* standing on the bottom landing, looking back up the flight: the landing
     underfoot is the hall's own floor, the well's wall is behind the eye, and
     the flight rises away from a slab rather than out of a window */
  await evaluate(place(0.60, -0.45, 0.60, -4.00, -0.12));
  await shot('fix-stair-landing.png');

  /* from the hall's east side, looking west at the well's south face: the
     flat wall, the sill, the foot of the flight and the slab around it */
  await evaluate(place(3.60, 2.40, -0.20, -0.90, 0.06));
  await shot('fix-stair-face.png');

  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors || []')));
});
