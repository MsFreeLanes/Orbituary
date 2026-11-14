/* ab-texture.mjs — take the map off a room's wall material and shoot again.
 *   node scratch/ab-texture.mjs [roomId]
 *
 * The hairlines survived hiding the atmosphere, wrapping the plaster blooms and
 * (visually) hiding the wall itself, so the question left is whether they come
 * from the picture on the wall or from the wall's shape and light. This pulls
 * the map off and leaves the geometry, the lamps and the fog exactly as they
 * are: lines gone means the texture, lines left means the geometry.
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

const pullMap = `(() => {
  const m = window.__museum;
  const room = m.plan.byId(${JSON.stringify(id)});
  let rg = null;
  m.scene.traverse((o) => {
    if (o.isGroup && Math.abs(o.position.x - room.entry.x) < 0.01 &&
        Math.abs(o.position.z - room.entry.z) < 0.01 &&
        Math.abs(o.rotation.y - room.angle) < 0.001) rg = o;
  });
  if (!rg) return { ok: false };
  const out = [];
  rg.children.forEach((o) => {
    const mt = o.material;
    if (!mt || !mt.color || mt.color.getHexString() !== '9aa0aa') return;
    out.push({
      verts: o.geometry.attributes.position.count,
      hadMap: !!mt.map,
      hadBump: !!mt.bumpMap,
      hadRough: !!mt.roughnessMap,
      repeat: mt.map ? [mt.map.repeat.x, mt.map.repeat.y] : null,
      aniso: mt.map ? mt.map.anisotropy : null,
    });
    mt.map = null; mt.bumpMap = null; mt.roughnessMap = null;
    mt.needsUpdate = true;
  });
  return out;
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  console.log('view', JSON.stringify(await evaluate(stand)));
  await nap(1500);
  let img = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(process.cwd(), 'scratch', 'tex-on-' + id + '.png'), Buffer.from(img.data, 'base64'));
  console.log('map pulled:', JSON.stringify(await evaluate(pullMap)));
  await nap(1200);
  img = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(process.cwd(), 'scratch', 'tex-off-' + id + '.png'), Buffer.from(img.data, 'base64'));
  console.log('wrote scratch/tex-on-' + id + '.png and tex-off-' + id + '.png');
});
