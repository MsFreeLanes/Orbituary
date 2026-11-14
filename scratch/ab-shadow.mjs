/* ab-shadow.mjs — the same wall with the shadow map off.
 *   node scratch/ab-shadow.mjs [roomId]
 *
 * The hairlines survive hiding the atmosphere, wrapping the plaster blooms,
 * killing the mipmaps and switching bloom off, and they are straight lines that
 * start and stop in the middle of a surface. That is how a point light's cube
 * shadow map prints its face seams onto the wall behind it: the cellar's lamps
 * are point lights, and the pool casts from them. This turns the shadow map off
 * for the whole scene and shoots the same frame again.
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
  let casters = 0, castLights = 0;
  m.scene.traverse((o) => { if (o.castShadow) casters++; if (o.isLight && o.castShadow) castLights++; });
  return { code: room.code, tier: m.view.tier, shadows: m.view.renderer.shadowMap.enabled, casters, castLights, type: m.view.renderer.shadowMap.type };
})()`;

const noShadows = `(() => {
  const v = window.__museum.view;
  v.renderer.shadowMap.enabled = false;
  window.__museum.scene.traverse((o) => { if (o.material) { const mm = Array.isArray(o.material) ? o.material : [o.material]; mm.forEach((q) => { q.needsUpdate = true; }); } });
  return { shadows: v.renderer.shadowMap.enabled };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  console.log('view', JSON.stringify(await evaluate(stand)));
  await nap(1500);
  let img = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(process.cwd(), 'scratch', 'shadow-on-' + id + '.png'), Buffer.from(img.data, 'base64'));
  console.log('shadows:', JSON.stringify(await evaluate(noShadows)));
  await nap(1200);
  img = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(process.cwd(), 'scratch', 'shadow-off-' + id + '.png'), Buffer.from(img.data, 'base64'));
  console.log('wrote scratch/shadow-on-' + id + '.png and shadow-off-' + id + '.png');
});
