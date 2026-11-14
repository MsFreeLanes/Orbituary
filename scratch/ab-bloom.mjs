/* ab-bloom.mjs — three frames of the same wall: as built, bloom off, and bloom
 * and grain both off.   node scratch/ab-bloom.mjs [roomId]
 *
 * The hairlines survived hiding the atmosphere, wrapping the plaster blooms,
 * pulling the map off, and killing the mipmaps — but they are screen-straight,
 * they start and stop in the middle of a wall, and they cluster where a bright
 * lamp glow meets a dark field. That is the shape of an artifact in the post
 * chain rather than in the building: UnrealBloom composites a chain of
 * half-resolution buffers, and the boundary between them can print as a line.
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
  return { code: room.code, cat: room.cat, tier: m.view.tier, bloom: m.view.bloom.enabled, strength: m.view.bloom.strength, radius: m.view.bloom.radius, threshold: m.view.bloom.threshold };
})()`;

const off = (what) => `(() => {
  const v = window.__museum.view;
  ${what.map((k) => `v.${k}.enabled = false;`).join('\n  ')}
  return { bloom: v.bloom.enabled, grain: v.grain.enabled };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  console.log('view', JSON.stringify(await evaluate(stand)));
  await nap(1500);
  const shot = async (tag) => {
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', 'bloom-' + tag + '-' + id + '.png'), Buffer.from(img.data, 'base64'));
    console.log('shot', tag);
  };
  await shot('base');
  console.log('off:', JSON.stringify(await evaluate(off(['bloom']))));
  await nap(900);
  await shot('nobloom');
  console.log('off:', JSON.stringify(await evaluate(off(['grain']))));
  await nap(900);
  await shot('nobloom-grain');
  console.log('wrote scratch/bloom-*-sc.png');
});
