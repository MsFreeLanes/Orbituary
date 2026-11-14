/* ab-wall.mjs — hide one room's walls and look for the hairlines again.
 *   node scratch/ab-wall.mjs [roomId]
 *
 * If the lines are a coincident sheet rather than the wall's own surface, they
 * stay when the wall goes. If they go with it, they are the wall.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const id = process.argv[2] || 'science';
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const stand = `(() => {
  const m = window.__museum;
  const room = m.plan.byId(${JSON.stringify(id)});
  const d = room.door, n = room.n;
  const px = d.x + n.x * 2.4, pz = d.z + n.z * 2.4;
  m.rig.state.storey = room.floor;
  m.rig.state.x = px; m.rig.state.z = pz;
  m.rig.setYawPitch(Math.atan2(-(d.x - px), -(d.z - pz)), 0.24);
  m.rig.update(0.016);
  return { code: room.code, cat: room.cat };
})()`;

const hideWalls = `(() => {
  const m = window.__museum;
  const room = m.plan.byId(${JSON.stringify(id)});
  let rg = null;
  m.scene.traverse((o) => {
    if (o.isGroup && Math.abs(o.position.x - room.entry.x) < 0.01 &&
        Math.abs(o.position.z - room.entry.z) < 0.01 &&
        Math.abs(o.rotation.y - room.angle) < 0.001) rg = o;
  });
  if (!rg) return { ok: false };
  let n = 0;
  rg.children.forEach((o) => {
    if (o.material && o.material.color && o.material.color.getHexString() === '9aa0aa') { o.visible = false; n++; }
  });
  return { hidden: n };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  console.log('view', JSON.stringify(await evaluate(stand)));
  await nap(1500);
  let img = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(process.cwd(), 'scratch', 'wall-on-' + id + '.png'), Buffer.from(img.data, 'base64'));
  console.log('walls hidden:', JSON.stringify(await evaluate(hideWalls)));
  await nap(1200);
  img = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(process.cwd(), 'scratch', 'wall-off-' + id + '.png'), Buffer.from(img.data, 'base64'));
  console.log('wrote scratch/wall-on-' + id + '.png and wall-off-' + id + '.png');
});
