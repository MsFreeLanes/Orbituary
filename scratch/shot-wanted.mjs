/* shot-wanted.mjs — the empty plinth in a cellar storeroom, close up.
 *   node scratch/shot-wanted.mjs [room-id]
 * Stands a metre and a half in front of the plinth and looks at the card,
 * because at the room's own scale the card is 44 cm across and the words are
 * set to be read from half a metre, not from the door.
 */
import path from 'node:path';
import fs from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const ROOM = process.argv[2] || 'journalism';

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 760, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4800);
  await evaluate('window.__museum.hud.hideIntro()');
  const setup = `(() => {
    const m = window.__museum, r = m.plan.byId(${JSON.stringify(ROOM)});
    const spot = (r.plinths || []).find((s) => s.wanted);
    if (!spot) return { error: 'no wanted plinth in ' + ${JSON.stringify(ROOM)} };
    /* the room's own frame: n is the way in, u runs across */
    const nx = Math.sin(r.angle), nz = Math.cos(r.angle);
    const ux = Math.cos(r.angle), uz = -Math.sin(r.angle);
    const px = r.entry.x + spot.v * nx + spot.u * ux;
    const pz = r.entry.z + spot.v * nz + spot.u * uz;
    const s = m.rig.state;
    s.x = px - 3.0 * nx; s.z = pz - 3.0 * nz; s.level = m.S.FLOOR_BASE;
    s.storey = 'basement'; s.yaw = Math.atan2(-nx, -nz); s.pitch = -0.18;
    m.rig.update(0.05);
    return { at: [+s.x.toFixed(2), +s.z.toFixed(2)], plinth: [+px.toFixed(2), +pz.toFixed(2)],
      yaw: +s.yaw.toFixed(2), room: s.room };
  })()`;
  console.log(JSON.stringify(await evaluate(setup)));
  await nap(1800);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.cwd(), 'scratch', 'wanted-plinth.png'), Buffer.from(shot.data, 'base64'));
  console.log('wrote scratch/wanted-plinth.png');
});
