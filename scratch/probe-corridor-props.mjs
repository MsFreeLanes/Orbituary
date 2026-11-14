/* probe-corridor-props.mjs — which named prop is standing in which corridor.
 *   node scratch/probe-corridor-props.mjs
 * check-collision says ten points on a corridor centreline are solid, and
 * check-placement says nine pieces of furniture are inside a corridor rect. Both
 * are right and neither says what to move. This walks the centreline of every
 * corridor rect, finds the blocker there, and then finds the prop whose drawn
 * bounding box covers the same point — which is the thing to edit in props.js.
 *
 * The corridor's own axes: a rect written by addCorridor runs along
 * (-sin angle, cos angle) and is `halfZ` long that way, `halfX` across.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4600);
  const rows = await evaluate(`(() => {
    const m = window.__museum, plan = m.plan;
    const corridors = plan.walkable.rects.filter((r) => r.kind === 'corridor');
    const boxes = [];
    plan.rooms.forEach((r) => (r._propBoxes || []).forEach((b) => boxes.push({ ...b, room: r.id, floor: r.floor })));
    const plinths = [];
    plan.rooms.concat([plan.rotunda]).forEach((r) => (r.plinths || []).forEach((sp) => {
      const c = Math.cos(r.angle || 0), s = Math.sin(r.angle || 0);
      const x = r.kind === 'rotunda' ? sp.u : r.kind === 'cupola' ? r.entry.x - sp.u : r.entry.x + sp.u * c + sp.v * s;
      const z = r.kind === 'rotunda' ? sp.v : r.kind === 'cupola' ? r.entry.z - sp.v : r.entry.z - sp.u * s + sp.v * c;
      plinths.push({ room: r.id, x, z, floor: r.floor });
    }));
    const out = [];
    for (const c of corridors) {
      const s = Math.sin(c.angle), ct = Math.cos(c.angle);
      /* the rect's own axes, from plan.js `inside()`: +Z (the way it runs) is
         (sin, cos) and +X (across) is (cos, -sin) */
      const along = (t) => ({ x: c.cx + t * s, z: c.cz + t * ct });
      const across = (t, u) => ({ x: c.cx + t * s + u * ct, z: c.cz + t * ct - u * s });
      for (let t = -c.halfZ + 0.3; t <= c.halfZ - 0.3; t += 0.4) {
        const p = along(t);
        if (!m.rig.blocked(p.x, p.z, c.floor)) continue;
        /* how far from the centreline does the blockage reach, and where is the
           clear walking line? measure across the corridor at this station. */
        let clear = [];
        for (let u = -c.halfX + 0.25; u <= c.halfX - 0.25; u += 0.25) {
          const q = across(t, u);
          if (!m.rig.blocked(q.x, q.z, c.floor) && m.inside(plan.walkable, q.x, q.z, 0.3, c.floor)) clear.push(+u.toFixed(2));
        }
        const near = boxes.filter((b) => b.floor === c.floor && p.x > b.min[0] - 0.2 && p.x < b.max[0] + 0.2 &&
          p.z > b.min[2] - 0.2 && p.z < b.max[2] + 0.2)
          .map((b) => b.room + '/' + b.name + ' box ' + b.min.map((v, i) => v.toFixed(1) + ',' + b.max[i].toFixed(1)).join(' '));
        const pl = plinths.filter((b) => b.floor === c.floor && Math.hypot(b.x - p.x, b.z - p.z) < 0.9)
          .map((b) => b.room + ' plinth (' + b.x.toFixed(2) + ', ' + b.z.toFixed(2) + ')');
        out.push({ range: c.room || 'corridor', floor: c.floor, at: [+p.x.toFixed(2), +p.z.toFixed(2)],
          halfX: c.halfX, clear: clear.length, wide: clear.length > 2, near: near.slice(0, 3), pl: pl.slice(0, 2) });
      }
    }
    return out;
  })()`);
  const seen = new Set();
  for (const r of rows) {
    const k = (r.near.join('|') || r.pl.join('|')) + r.floor;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`${r.floor} range ${r.range} at (${r.at}) halfX ${r.halfX} clear lanes ${r.clear}${r.wide ? ' (walkable past it)' : ' (BLOCKED)'}\n   ${r.near.join('\n   ') || r.pl.join('\n   ') || 'no drawn box here'}`);
  }
  console.log('\nstations blocked:', rows.length, ' distinct things:', seen.size);
});
