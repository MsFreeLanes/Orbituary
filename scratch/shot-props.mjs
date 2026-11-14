/* shot-props.mjs — the rooms that have furniture of their own.
 *
 *   node scratch/shot-props.mjs [roomId ...]
 *
 * Photographed from just inside the door, looking in, which is the view that
 * tells you whether a workbench is standing in the walkway or a shelf is
 * buried under a plinth. Pass room ids to shoot something else.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const DEFAULTS = ['gaming', 'media', 'privacy', 'shopping', 'ai', 'reading', 'linux'];

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
  return { ok: true, code: room.code, cat: room.cat, w: room.w, d: room.d, plinths: room.plinths.length };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');

  for (const id of process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS) {
    console.log(id, JSON.stringify(await evaluate(stand(id))));
    await nap(1500);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', 'props-' + id + '.png'), Buffer.from(img.data, 'base64'));
    console.log('  wrote scratch/props-' + id + '.png');
  }
  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors || []')));
});
