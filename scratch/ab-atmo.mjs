/* ab-atmo.mjs — is that mark on the wall the atmosphere, or the building?
 *
 *   node scratch/ab-atmo.mjs [roomId]
 *
 * Same view twice: once as built, once with every damp sheet, web and dust
 * cloud hidden. If the mark is in both, it is not the atmosphere.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const id = process.argv[2] || 'science';

const stand = `(() => {
  const m = window.__museum;
  const room = m.plan.byId(${JSON.stringify(id)});
  const d = room.door, n = room.n;
  const px = d.x + n.x * (room.d * 0.62), pz = d.z + n.z * (room.d * 0.62);
  const tx = d.x - n.x * 0.5, tz = d.z - n.z * 0.5;
  m.rig.state.storey = room.floor;
  m.rig.state.x = px; m.rig.state.z = pz;
  m.rig.setYawPitch(Math.atan2(-(tx - px), -(tz - pz)), 0.02);
  m.rig.update(0.016);
  return { ok: true, code: room.code, cat: room.cat };
})()`;

const toggle = (on) => `(() => {
  let n = 0;
  window.__museum.scene.traverse((o) => {
    if (o.userData && o.userData.atmo) { o.visible = ${on}; n++; }
  });
  return n;
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  console.log('view', JSON.stringify(await evaluate(stand)));

  for (const on of [true, false]) {
    console.log('atmosphere meshes hidden:', await evaluate(toggle(on)));
    await nap(1500);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    const f = 'atmo-' + (on ? 'on' : 'off') + '-' + id + '.png';
    writeFileSync(path.join(process.cwd(), 'scratch', f), Buffer.from(img.data, 'base64'));
    console.log('  wrote scratch/' + f);
  }
  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors || []')));
});
