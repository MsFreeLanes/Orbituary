/* hull-clearance.mjs — does the skin fit between the ranges?
 * The plan interleaves the side rooms of neighbouring spokes, and the hull
 * stands 0.725 m out from every room wall that carries a viewport, so the
 * question is how much room is left between two ranges' skins. The rooms are
 * turned to their spokes, so this measures the real rectangles rather than
 * their bounding boxes.
 *   node scratch/hull-clearance.mjs
 */
import { buildPlan } from '../src/plan.js';
import { S } from '../src/scale.js';

const plan = buildPlan();
const ground = plan.rooms.filter((r) => r.floor !== 'basement');
const pad = S.WALL_T / 2 + S.HULL_T;

/* the room's footprint, pushed out by the hull's offset, as four world points
   taken in order round the corner — out of order they cross themselves and
   every test below reads them as a bowtie */
function poly(r) {
  const st = Math.sin(r.angle), ct = Math.cos(r.angle);
  const hx = r.w / 2 + pad, hz = r.d / 2 + pad;
  const out = [];
  for (const [lx, lz] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) {
    out.push({ x: r.center.x + lx * ct + lz * st, z: r.center.z - lx * st + lz * ct });
  }
  return out;
}

const edges = (p) => p.map((a, i) => [a, p[(i + 1) % p.length]]);

/* 0 when the two convex outlines overlap, otherwise the clear distance */
function gap(A, B) {
  const span = (P, n) => {
    let lo = Infinity, hi = -Infinity;
    for (const v of P) { const d = v.x * n.x + v.z * n.z; if (d < lo) lo = d; if (d > hi) hi = d; }
    return [lo, hi];
  };
  for (const P of [A, B]) {
    for (const [a, b] of edges(P)) {
      const n = { x: -(b.z - a.z), z: b.x - a.x };
      const [a0, a1] = span(A, n), [b0, b1] = span(B, n);
      if (a1 <= b0 || b1 <= a0) {
        /* a separating axis: the closest the two can be is a corner to an edge */
        let best = Infinity;
        const ptSeg = (p, q, r) => {
          const vx = r.x - q.x, vz = r.z - q.z, L = vx * vx + vz * vz;
          let t = L ? ((p.x - q.x) * vx + (p.z - q.z) * vz) / L : 0;
          t = Math.max(0, Math.min(1, t));
          return Math.hypot(p.x - (q.x + vx * t), p.z - (q.z + vz * t));
        };
        for (const [q, r] of edges(B)) for (const p of A) best = Math.min(best, ptSeg(p, q, r));
        for (const [q, r] of edges(A)) for (const p of B) best = Math.min(best, ptSeg(p, q, r));
        return best;
      }
    }
  }
  return 0;
}

const polys = ground.map((r) => ({ room: r, p: poly(r) }));
let worst = { d: Infinity };
for (let i = 0; i < polys.length; i++) {
  for (let j = i + 1; j < polys.length; j++) {
    if (polys[i].room.range === polys[j].room.range) continue;
    const d = gap(polys[i].p, polys[j].p);
    if (d < worst.d) worst = { d, a: polys[i].room.id + '/' + polys[i].room.range, b: polys[j].room.id + '/' + polys[j].room.range };
  }
}
console.log('tightest two hull skins on different ranges:',
  worst.d === 0 ? 'THEY INTERSECT' : worst.d.toFixed(2) + ' m apart', '—', worst.a, 'vs', worst.b);

/* The padded-footprint test above is conservative: the skin only exists on
   the face that carries the viewports, not all the way round a room. So the
   second pass measures the plates themselves — the box of skin over each
   room's window wall — and reports the tightest pair on different ranges. */
function plate(r) {
  const st = Math.sin(r.angle), ct = Math.cos(r.angle);
  const in0 = r.d + S.WALL_T / 2, out = r.d + S.HULL_OUT;
  const out4 = [];
  for (const [lx, lz] of [[-r.w / 2, in0], [r.w / 2, in0], [r.w / 2, out], [-r.w / 2, out]]) {
    out4.push({ x: r.entry.x + lx * ct + lz * st, z: r.entry.z - lx * st + lz * ct });
  }
  return out4;
}

const plates = ground.filter((r) => r.windows.length).map((r) => ({ room: r, p: plate(r) }));
let tight = { d: Infinity };
for (let i = 0; i < plates.length; i++) {
  for (let j = i + 1; j < plates.length; j++) {
    if (plates[i].room.range === plates[j].room.range) continue;
    const d = gap(plates[i].p, plates[j].p);
    if (d < tight.d) tight = { d, a: plates[i].room.id + '/' + plates[i].room.range, b: plates[j].room.id + '/' + plates[j].room.range };
  }
}
console.log('tightest two viewport plates on different ranges:',
  tight.d === 0 ? 'THEY INTERSECT' : tight.d.toFixed(2) + ' m apart', '—', tight.a, 'vs', tight.b);

for (const r of ground.filter((x) => x.side !== 0)) {
  const w = r.windows[0];
  let near = Infinity, who = '';
  for (const q of polys) {
    if (q.room === r || q.room.range === r.range) continue;
    for (const [a, b] of edges(q.p)) {
      const vx = b.x - a.x, vz = b.z - a.z, L = vx * vx + vz * vz;
      let t = L ? ((w.x - a.x) * vx + (w.z - a.z) * vz) / L : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(w.x - (a.x + vx * t), w.z - (a.z + vz * t));
      if (d < near) { near = d; who = q.room.id; }
    }
  }
  if (near < 12) console.log('viewport out of ' + r.id.padEnd(20), near.toFixed(2) + ' m to', who);
}
