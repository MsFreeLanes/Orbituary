/* shot-cellar.mjs — the cellar's atmosphere: damp at the foot of the walls,
 * webs in the ceiling corners, dust in the lamp light.
 *
 *   node scratch/shot-cellar.mjs [roomId ...]
 *
 * Three views of each room: from the door looking level into the room (the
 * damp band), from the door looking up at the corner (the web), and from the
 * middle of the room looking back at the doorway, where the lamp is behind
 * you and the dust should be in front of you.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const DEFAULTS = ['science', 'journalism'];

const look = (id, where, pitch) => `(() => {
  const m = window.__museum;
  const room = m.plan.byId(${JSON.stringify(id)});
  if (!room) return { ok: false };
  const d = room.door, n = room.n;
  const at = ${JSON.stringify(where)};
  let px, pz, tx, tz;
  if (at === 'door') { px = d.x + n.x * 0.55; pz = d.z + n.z * 0.55; tx = d.x + n.x * (room.d - 0.4); tz = d.z + n.z * (room.d - 0.4); }
  else if (at === 'corner') { px = d.x + n.x * 0.7; pz = d.z + n.z * 0.7; tx = d.x + n.x * 2.4 - n.z * (room.w / 2 - 0.4); tz = d.z + n.z * 2.4 + n.x * (room.w / 2 - 0.4); }
  else { px = d.x + n.x * (room.d * 0.62); pz = d.z + n.z * (room.d * 0.62); tx = d.x - n.x * 0.5; tz = d.z - n.z * 0.5; }
  m.rig.state.storey = room.floor;
  m.rig.state.x = px; m.rig.state.z = pz;
  m.rig.setYawPitch(Math.atan2(-(tx - px), -(tz - pz)), ${pitch});
  m.rig.update(0.016);
  return { ok: true, code: room.code, cat: room.cat, ceil: room.ceil };
})()`;

const hall = (pitch) => `(() => {
  const m = window.__museum, S = m.S;
  m.rig.state.storey = 'basement';
  m.rig.state.x = 1.6; m.rig.state.z = -1.2;
  const tx = -4.4, tz = 3.4;
  m.rig.setYawPitch(Math.atan2(-(tx - m.rig.state.x), -(tz - m.rig.state.z)), ${pitch});
  m.rig.update(0.016);
  return { ok: true, at: 'stair hall', floor: S.FLOOR_BASE };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');

  const shoot = async (tag, expr) => {
    console.log(tag, JSON.stringify(await evaluate(expr)));
    await nap(1500);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', 'cellar-' + tag + '.png'), Buffer.from(img.data, 'base64'));
    console.log('  wrote scratch/cellar-' + tag + '.png');
  };

  for (const id of process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS) {
    await shoot(id + '-door', look(id, 'door', -0.04));
    await shoot(id + '-corner', look(id, 'corner', 0.34));
    await shoot(id + '-dust', look(id, 'middle', 0.02));
  }
  await shoot('hall', hall(0.16));
  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors || []')));
});
