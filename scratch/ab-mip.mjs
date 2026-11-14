/* ab-mip.mjs — take the mipmaps away from a wall's map and shoot again.
 *   node scratch/ab-mip.mjs [roomId]
 *
 * The lines are gone with the map off, the painted canvas itself tiles cleanly,
 * and the wall is one welded mesh whose faces each restart their UVs. That
 * combination points at the sampler: where the UVs jump, the derivative blows
 * up and the mip level jumps with it, which draws a crisp line along the seam.
 * Mipmaps off means the sampler cannot jump, so if the lines go, that is what
 * they were.
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

const killMips = `(() => {
  const m = window.__museum;
  const room = m.plan.byId(${JSON.stringify(id)});
  let rg = null;
  m.scene.traverse((o) => {
    if (o.isGroup && Math.abs(o.position.x - room.entry.x) < 0.01 &&
        Math.abs(o.position.z - room.entry.z) < 0.01 &&
        Math.abs(o.rotation.y - room.angle) < 0.001) rg = o;
  });
  const seen = new Set();
  let n = 0;
  rg.children.forEach((o) => {
    const mt = o.material;
    if (!mt || !mt.color || mt.color.getHexString() !== '9aa0aa') return;
    const t = mt.map;
    if (!t || seen.has(t.uuid)) return;
    seen.add(t.uuid);
    t.minFilter = m.THREE.LinearFilter;
    t.magFilter = m.THREE.LinearFilter;
    t.generateMipmaps = false;
    t.anisotropy = 1;
    t.needsUpdate = true;
    n++;
  });
  return { textures: n };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  console.log('view', JSON.stringify(await evaluate(stand)));
  await nap(1500);
  let img = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(process.cwd(), 'scratch', 'mip-on-' + id + '.png'), Buffer.from(img.data, 'base64'));
  console.log('mips off:', JSON.stringify(await evaluate(killMips)));
  await nap(1200);
  img = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(process.cwd(), 'scratch', 'mip-off-' + id + '.png'), Buffer.from(img.data, 'base64'));
  console.log('wrote scratch/mip-on-' + id + '.png and mip-off-' + id + '.png');
});
