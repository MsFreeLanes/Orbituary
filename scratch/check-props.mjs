/* check-props.mjs — do the props stand where the exhibits are?
 *
 *   node scratch/check-props.mjs
 *
 * props.js was written for the twelve-room building, where a room had a
 * handful of exhibits in it. The 51-room building puts up to 21 plinths in a
 * room, on a grid the prop author never saw. So every bucket props.js emits
 * leaves its local bounding box on the room (`room._propBoxes`), and this
 * asks three questions of it: does it stand on a plinth, does it poke through
 * a wall, and does it block a doorway.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const HALF = 0.31;          // half a plinth's footprint, from scale.js
const PLINTH_H = 1.0;       // and a touch over its height

const report = await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  return await evaluate(`(() => {
    const m = window.__museum, S = m.S;
    const HALF = ${HALF}, PLINTH_H = ${PLINTH_H};
    const rooms = m.plan.rooms.concat([m.plan.rotunda]);
    const out = [];
    for (const room of rooms) {
      const boxes = room._propBoxes;
      if (!boxes || !boxes.length) continue;
      const bad = [];
      const at = (b) => '[' + b.name + ' x ' + b.min[0].toFixed(2) + '..' + b.max[0].toFixed(2) +
        ' y ' + b.min[1].toFixed(2) + '..' + b.max[1].toFixed(2) +
        ' z ' + b.min[2].toFixed(2) + '..' + b.max[2].toFixed(2) + ']';
      const w = room.w || 2 * S.ROTUNDA_R, d = room.d || 2 * S.ROTUNDA_R;
      for (const b of boxes) {
        const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
        for (const p of (room.plinths || [])) {
          if (x1 > p.u - HALF && x0 < p.u + HALF && z1 > p.v - HALF && z0 < p.v + HALF &&
              y1 > 0 && y0 < PLINTH_H) {
            bad.push('stands on a plinth at ' + p.u.toFixed(2) + ',' + p.v.toFixed(2) + ' ' + at(b));
          }
        }
        if (room.kind !== 'rotunda') {
          if (x0 < -w / 2 - 0.02 || x1 > w / 2 + 0.02) bad.push('through a side wall, room is ' + (-w / 2) + '..' + (w / 2) + ' ' + at(b));
          if (z1 > d + 0.02) bad.push('through the window wall, room ends at ' + d + ' ' + at(b));
          if (z0 < -0.02) bad.push('through the door wall ' + at(b));
          const dw = (room.door && room.door.w) || 1.4;
          if (z0 < 0.7 && z1 > 0.05 && x1 > -dw / 2 - 0.25 && x0 < dw / 2 + 0.25 && y0 < (room.door ? room.door.h : 2.15)) {
            bad.push('blocks the doorway, which is ' + dw + ' wide ' + at(b));
          }
        }
      }
      out.push({ room: room.id, code: room.code || 'HUB', boxes: boxes.length, bad, all: boxes });
    }
    return out;
  })()`);
});

let fails = 0;
const only = process.argv[2];
for (const r of report) {
  if (only) {
    if (r.room !== only) continue;
    for (const b of r.all) console.log(`${b.name.padEnd(12)} x ${b.min[0].toFixed(2)}..${b.max[0].toFixed(2)}  y ${b.min[1].toFixed(2)}..${b.max[1].toFixed(2)}  z ${b.min[2].toFixed(2)}..${b.max[2].toFixed(2)}`);
    continue;
  }
  console.log(`${r.code} ${r.room}: ${r.boxes} buckets` + (r.bad.length ? ' — ' + r.bad.length + ' problems' : ''));
  for (const b of r.bad) { console.log('   · ' + b); fails++; }
}
console.log(fails ? `\nFAIL: ${fails} prop/plinth or prop/wall collisions` : '\nprops clear of plinths, walls and doorways');
process.exitCode = fails ? 1 : 0;
