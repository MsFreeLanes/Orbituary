/* shot-stair.mjs — photograph the flight from the rotunda, and the pedestal
 * that stands over the hole it falls through.
 *   node scratch/shot-stair.mjs
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const pose = (x, z, yaw, pitch) => `(() => {
  const m = window.__museum;
  m.rig.state.x = ${x}; m.rig.state.z = ${z};
  m.rig.setYawPitch(${yaw}, ${pitch});
  m.rig.update(0.016);
  return m.rig.state.room;
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  const shot = async (tag) => {
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', tag + '.png'), Buffer.from(img.data, 'base64'));
    console.log('wrote scratch/' + tag + '.png');
  };
  // from the entry, straight down the axis at the flight
  console.log('room', await evaluate(pose(0, 4.2, Math.PI, -0.18)));
  await nap(900);
  await shot('stair-from-entry');
  // closer: the top of the flight and the pedestal standing in the opening
  console.log('room', await evaluate(pose(0, -1.2, Math.PI, -0.30)));
  await nap(900);
  await shot('stair-top-pedestal');
});
