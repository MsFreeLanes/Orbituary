/* shot-cellar.mjs — the cellar, furnished.
 *   node scratch/shot-cellar.mjs
 * Fourteen rooms used to be empty shells. This stands in one and looks at the
 * shelving, the flat file and the bench, then turns to the pallet by the door.
 */
import path from 'node:path';
import fs from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const ROOM = process.argv[2] || 'journalism';

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4800);
  await evaluate('window.__museum.hud.hideIntro()');
  const setup = `(() => { const m = window.__museum; m.rig.teleportTo(${JSON.stringify(ROOM)});
    const s = m.rig.state; const r = m.plan.byId(${JSON.stringify(ROOM)});
    return { room: s.room, storey: s.storey, at: [+s.x.toFixed(2), +s.z.toFixed(2)],
      angle: +r.angle.toFixed(2), entry: [+r.entry.x.toFixed(2), +r.entry.z.toFixed(2)] }; })()`;
  console.log(JSON.stringify(await evaluate(setup)));
  /* look down the room towards the back wall, then back towards the door */
  const shots = [['bench', 0.0], ['shelving', -Math.PI / 2], ['door', Math.PI]];
  for (const [name, dyaw] of shots) {
    await evaluate(`(() => { const m = window.__museum; const s = m.rig.state; const r = m.plan.byId(${JSON.stringify(ROOM)});
      s.yaw = r.angle + Math.PI + ${dyaw}; s.pitch = -0.06; m.rig.update(0.05); return s.room; })()`);
    await nap(1500);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', ROOM + '-' + name + '.png'), Buffer.from(shot.data, 'base64'));
    console.log('wrote scratch/' + ROOM + '-' + name + '.png');
  }
});
