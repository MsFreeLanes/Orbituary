/* probe-deck-ring.mjs — the Observatory's six pedestals against the twelve spokes.
 *   node scratch/probe-deck-ring.mjs
 * check-collision walks the centreline of every corridor rect and reports eight
 * solid stations, all of them inside the drum, where a spoke's centreline passes
 * a pedestal on the deck ring. This prints the spoke bearings, the ring bearings
 * and the perpendicular distance from each pedestal to each spoke, so the ring
 * can be turned to sit between the doors instead of in front of them.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4600);
  const out = await evaluate(`(() => {
    const m = window.__museum, plan = m.plan;
    const bearing = (x, z) => ((Math.atan2(x, z) * 180 / Math.PI) + 360) % 360;
    const spokes = plan.walkable.rects.filter((r) => r.kind === 'corridor' && r.floor === 'ground')
      .map((r) => ({ bearing: +bearing(r.dir ? r.dir.x : Math.sin(r.angle), r.dir ? r.dir.z : Math.cos(r.angle)).toFixed(1),
        halfX: r.halfX, len: +(2 * r.halfZ).toFixed(1) }))
      .sort((a, b) => a.bearing - b.bearing);
    const cu = plan.rooms.find((r) => r.kind === 'cupola');
    const ring = (cu ? cu.plinths : []).map((sp) => {
      const x = cu.entry.x - sp.u, z = cu.entry.z - sp.v;
      const d = spokes.map((k) => {
        const a = k.bearing * Math.PI / 180;
        const ux = Math.sin(a), uz = Math.cos(a);
        const along = x * ux + z * uz;
        return Math.abs(x * uz - z * ux) < 0.01 || along > 0 ? +Math.hypot(x - ux * (x * ux + z * uz), z - uz * (x * ux + z * uz)).toFixed(2) : 99;
      });
      return { at: [+x.toFixed(2), +z.toFixed(2)], r: +Math.hypot(x, z).toFixed(2),
        bearing: +bearing(x, z).toFixed(1), nearest: Math.min(...d) };
    });
    return { spokes, ring, door: [0, 4.5], well: plan.stair };
  })()`);
  console.log('spoke bearings:', out.spokes.map((s) => s.bearing).join(' '));
  console.log('deck ring:');
  for (const r of out.ring) console.log('  ', String(r.bearing).padStart(6), 'r', r.r, 'at', JSON.stringify(r.at), 'off the nearest spoke by', r.nearest);
});
