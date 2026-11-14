/* shot-wall.mjs — stand close to one room's far wall and photograph what is
 * hung on it.  node scratch/shot-wall.mjs trophy-hall [width-m]
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const id = process.argv[2] || 'trophy-hall';
const back = process.argv[3] ? Number(process.argv[3]) : 1.6;
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  console.log(JSON.stringify(await evaluate(`(() => {
    const m = window.__museum, S = m.S;
    const room = m.plan.byId(${JSON.stringify(id)});
    const d = room.door, n = room.n;
    m.rig.state.storey = room.floor;
    m.rig.state.x = d.x + n.x * (room.d - ${back});
    m.rig.state.z = d.z + n.z * (room.d - ${back});
    const tx = d.x + n.x * (room.d + 1), tz = d.z + n.z * (room.d + 1);
    m.rig.setYawPitch(Math.atan2(-(tx - m.rig.state.x), -(tz - m.rig.state.z)), 0.12);
    m.rig.update(0.016);
    return { code: room.code, cat: room.cat };
  })()`)));
  await nap(1800);
  const img = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(process.cwd(), 'scratch', 'wall-' + id + '.png'), Buffer.from(img.data, 'base64'));
  console.log('wrote scratch/wall-' + id + '.png');
});
