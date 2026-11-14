/* shot-codes.mjs — the eight-zone system: door plates, plinth labels, the
 * floor plan and its key, and the acquisitions board.
 *
 *   node scratch/shot-codes.mjs
 *
 * The codes are only worth having if they agree with each other, so this
 * prints every room's code out of the plan and then photographs the same room
 * from three points of view: the plate over its door, the map square it is
 * drawn as, and — for a room with exhibits — the label on one of its plinths.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const facePlate = (id, back) => `(() => {
  const m = window.__museum, S = m.S;
  const room = m.plan.byId(${JSON.stringify(id)});
  if (!room) return { ok: false, why: 'no room ' + ${JSON.stringify(id)} };
  const d = room.door, n = room.n;
  const eye = S.EYE_H;
  const x = d.x - n.x * ${back}, z = d.z - n.z * ${back};
  m.rig.state.storey = room.floor;
  m.rig.state.x = x; m.rig.state.z = z;
  const sx = d.x - n.x * 0.05, sz = d.z - n.z * 0.05, sy = d.h + 0.32;
  const horiz = Math.hypot(sx - x, sz - z);
  m.rig.setYawPitch(Math.atan2(-(sx - x), -(sz - z)), Math.atan2(sy - eye, horiz));
  m.rig.update(0.016);
  return { ok: true, code: room.code, zone: room.zone, name: room.name, storey: room.floor };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');

  const zones = await evaluate('window.__museum.plan.zones.map(function (z) { return z.key + " " + z.name + " " + z.rooms + " rooms"; })');
  console.log('zones:', JSON.stringify(zones));

  const codes = await evaluate(`(() => {
    const m = window.__museum;
    const by = {};
    m.plan.rooms.forEach(r => { (by[r.zone] = by[r.zone] || []).push(r.code + ' ' + r.cat); });
    const hub = [m.plan.rotunda, m.plan.stairHall, m.plan.stairRoom].map(p => p.code + ' ' + p.cat);
    by.HUB = (by.HUB || []).concat(hub);
    return by;
  })()`);
  for (const k of Object.keys(codes)) console.log(k + ': ' + codes[k].join(' | '));

  const shot = async (name) => {
    await nap(1600);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', name), Buffer.from(img.data, 'base64'));
    console.log('wrote scratch/' + name);
  };

  /* a ground-floor door plate: the plate, the code, the zone name */
  console.log('plate:', JSON.stringify(await evaluate(facePlate('privacy', 2.4))));
  await shot('codes-door-privacy.png');

  /* a cellar door plate, which is the same system in a worse light */
  console.log('cellar plate:', JSON.stringify(await evaluate(facePlate('open-source', 2.2))));
  await shot('codes-door-cellar.png');

  /* the plinth label: code in the corner, price in the corner, zone spine */
  const label = await evaluate(`(() => {
    const m = window.__museum;
    const room = m.plan.byId('media');
    const p = room.plinths[0];
    const x = room.entry.x + room.n.x * p.v + room.u.x * p.u;
    const z = room.entry.z + room.n.z * p.v + room.u.z * p.u;
    /* the label faces back towards the door, so the visitor stands between
       the door and the plinth and looks at the face that is turned to him */
    const ex = x - room.n.x * 1.5, ez = z - room.n.z * 1.5;
    m.rig.state.storey = 'ground';
    m.rig.state.x = ex; m.rig.state.z = ez;
    m.rig.setYawPitch(Math.atan2(-(x - ex), -(z - ez)), Math.atan2(0.92 - m.S.EYE_H, 1.5));
    m.rig.update(0.016);
    return { code: room.code, cat: room.cat, plinth: p.u.toFixed(2) + ',' + p.v.toFixed(2) };
  })()`);
  console.log('label:', JSON.stringify(label));
  await shot('codes-plinth-media.png');

  /* the acquisitions board in the rotunda: it used to run off its own canvas
     once the building grew past twelve rooms, so it gets photographed */
  await evaluate(`(() => {
    const m = window.__museum, S = m.S;
    const z0 = -S.ROTUNDA_R + 0.32, z = z0 + 3.1;
    m.rig.state.storey = 'ground';
    m.rig.state.x = 0; m.rig.state.z = z;
    m.rig.setYawPitch(Math.atan2(0, -(z0 - z)), Math.atan2(1.78 - S.EYE_H, 3.1));
    m.rig.update(0.016);
  })()`);
  await shot('codes-board-rotunda.png');

  /* the floor plan and its key, and the card, in one frame */
  await evaluate(`(() => {
    const m = window.__museum;
    m.rig.state.storey = 'ground';
    m.rig.teleportTo('rotunda');
  })()`);
  await shot('codes-map-rotunda.png');

  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors || []')));
});
