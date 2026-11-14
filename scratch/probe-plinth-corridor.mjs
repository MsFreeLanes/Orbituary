/* probe-plinth-corridor.mjs — did the plan's own repair pass see the problem?
 *   node scratch/probe-plinth-corridor.mjs
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4600);
  const out = await evaluate(`(() => {
    const m = window.__museum, plan = m.plan;
    const corridors = plan.walkable.rects.filter((r) => r.kind === 'corridor');
    const inRect = (r, x, z, pad) => {
      const dx = x - r.cx, dz = z - r.cz, c = Math.cos(r.angle), s = Math.sin(r.angle);
      return Math.abs(dx * c - dz * s) < r.halfX + pad && Math.abs(dx * s + dz * c) < r.halfZ + pad;
    };
    const world = (room, sp) => {
      const c = Math.cos(room.angle), s = Math.sin(room.angle);
      return { x: room.entry.x + sp.u * c + sp.v * s, z: room.entry.z - sp.u * s + sp.v * c };
    };
    const bad = [];
    plan.rooms.forEach((room) => {
      (room.plinths || []).forEach((sp) => {
        const p = world(room, sp);
        const hits = corridors.filter((cr) => cr.floor === room.floor && inRect(cr, p.x, p.z, 0));
        if (hits.length) bad.push({ room: room.id, kind: room.kind, at: [+p.x.toFixed(2), +p.z.toFixed(2)],
          u: +sp.u.toFixed(2), v: +sp.v.toFixed(2), d: room.d, w: room.w,
          entry: [+room.entry.x.toFixed(2), +room.entry.z.toFixed(2)], angle: +(room.angle || 0).toFixed(3),
          cr: hits.map((h) => '(' + h.cx.toFixed(1) + ',' + h.cz.toFixed(1) + ') hx ' + h.halfX + ' hz ' + h.halfZ.toFixed(1) + ' ang ' + h.angle.toFixed(2)).join(' ') });
      });
    });
    return { repairs: plan.plinthRepairs, bad };
  })()`);
  console.log('plan.plinthRepairs:', JSON.stringify(out.repairs));
  console.log('plinths still inside a corridor rect:', out.bad.length);
  for (const b of out.bad) console.log(' ', b.room, b.at, 'local u', b.u, 'v', b.v, 'room', b.w + 'x' + b.d,
    'entry', JSON.stringify(b.entry), 'ang', b.angle, '\n     corridor', b.cr);
});
