/* shot-doorwall.mjs — the wall the door is in, close up and looking up.
 *   node scratch/shot-doorwall.mjs [roomId] [distance]
 * The plate hangs above the door on the corridor side, so from inside the
 * room the only way to see it is through a gap in the wall above the opening.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const id = process.argv[2] || 'science';
const at = process.argv[3] ? Number(process.argv[3]) : 1.3;
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  console.log(JSON.stringify(await evaluate(`(() => {
    const m = window.__museum;
    const room = m.plan.byId(${JSON.stringify(id)});
    const d = room.door, n = room.n;
    const px = d.x + n.x * ${at}, pz = d.z + n.z * ${at};
    m.rig.state.storey = room.floor;
    m.rig.state.x = px; m.rig.state.z = pz;
    m.rig.setYawPitch(Math.atan2(-(d.x - px), -(d.z - pz)), 0.24);
    m.rig.update(0.016);
    return { code: room.code, cat: room.cat, door: d.w + ' x ' + d.h, ceil: room.ceil };
  })()`)));
  await nap(1800);
  const clip = process.env.CLIP ? JSON.parse(process.env.CLIP) : null;
  const img = await send('Page.captureScreenshot', {
    format: 'png',
    ...(clip ? { clip: { ...clip, scale: 3 } } : {})
  });
  writeFileSync(path.join(process.cwd(), 'scratch', 'doorwall-' + id + (clip ? '-zoom' : '') + '.png'), Buffer.from(img.data, 'base64'));
  console.log('wrote scratch/doorwall-' + id + (clip ? '-zoom' : '') + '.png');
});
