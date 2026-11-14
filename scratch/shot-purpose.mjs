/* shot-purpose.mjs — the four rooms about the museum itself.
 *
 *   node scratch/shot-purpose.mjs
 *
 * Box Office, Acquisitions Hall, Rules Room, Trophy Hall: the four cabinets
 * off the rotunda that have no plinths in them, photographed from just inside
 * the door, which is where a visitor actually sees them from.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const stand = (id) => `(() => {
  const m = window.__museum, S = m.S;
  const room = m.plan.byId(${JSON.stringify(id)});
  if (!room) return { ok: false };
  const d = room.door, n = room.n;
  m.rig.state.storey = room.floor;
  m.rig.state.x = d.x + n.x * 0.55; m.rig.state.z = d.z + n.z * 0.55;
  const tx = d.x + n.x * (room.d - 0.4), tz = d.z + n.z * (room.d - 0.4);
  m.rig.setYawPitch(Math.atan2(-(tx - m.rig.state.x), -(tz - m.rig.state.z)), -0.06);
  m.rig.update(0.016);
  return { ok: true, code: room.code, cat: room.cat, w: room.w, d: room.d };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');

  for (const id of ['box-office', 'acquisitions-hall', 'rules-room', 'trophy-hall']) {
    console.log(id, JSON.stringify(await evaluate(stand(id))));
    await nap(1500);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', 'purpose-' + id + '.png'), Buffer.from(img.data, 'base64'));
    console.log('  wrote scratch/purpose-' + id + '.png');
  }
  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors || []')));
});
