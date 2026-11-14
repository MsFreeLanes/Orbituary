/* shot-plate.mjs — a door plate, from the corridor where a visitor reads it.
 *   node scratch/shot-plate.mjs [room-id]
 * Stands two metres out in the corridor, facing the room's mouth, and photographs
 * the plate over the door. The plate's last line is the thing that changes from
 * room to room — the code, the category, and either a link count or WANTED.
 */
import path from 'node:path';
import fs from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const ROOM = process.argv[2] || 'creative-writing';

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4800);
  await evaluate('window.__museum.hud.hideIntro()');
  const setup = `(() => {
    const m = window.__museum, r = m.plan.byId(${JSON.stringify(ROOM)});
    const nx = Math.sin(r.angle), nz = Math.cos(r.angle);
    const s = m.rig.state;
    /* two metres out from the door face, on the corridor's centreline, looking
       straight at the mouth. The plate hangs over the door on the corridor side
       of the wall, which is the only side it is ever read from. */
    s.x = r.entry.x - 2.0 * nx; s.z = r.entry.z - 2.0 * nz;
    s.level = r.floor === 'basement' ? m.S.FLOOR_BASE : 0;
    s.storey = r.floor === 'basement' ? 'basement' : 'ground';
    s.yaw = Math.atan2(-nx, -nz); s.pitch = 0.16;
    m.rig.update(0.05);
    return { room: s.room, at: [+s.x.toFixed(2), +s.z.toFixed(2)], storey: s.storey };
  })()`;
  console.log(JSON.stringify(await evaluate(setup)));
  await nap(1800);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const out = 'plate-' + ROOM + '.png';
  fs.writeFileSync(path.join(process.cwd(), 'scratch', out), Buffer.from(shot.data, 'base64'));
  console.log('wrote scratch/' + out);
});
