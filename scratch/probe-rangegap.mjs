/* probe-rangegap.mjs — how far apart two ranges' shells stand, range pair by
 * range pair. The cull fix in render.js needs one number: the gap under which
 * two ranges count as neighbours, meaning a viewport in one looks into the
 * other. This measures the plan's own rects, which is what the cull measures.
 *   node scratch/probe-rangegap.mjs
 */
import { buildPlan } from '../src/plan.js';
import { S } from '../src/scale.js';

const plan = buildPlan();

function shellRect(c) {
  const a0 = c.floor === 'basement' ? 0 : S.ROTUNDA_R - 0.4;
  const mid = (a0 + c.t1) / 2;
  return {
    cx: c.dir.x * mid, cz: c.dir.z * mid,
    halfX: c.half, halfZ: (c.t1 - a0) / 2,
    angle: Math.atan2(c.dir.x, c.dir.z)
  };
}

/* distance between two rotated rects, 0 when they overlap */
function rectGap(a, b) {
  const rects = [a, b];
  const axes = [];
  for (const r of rects) {
    const st = Math.sin(r.angle), ct = Math.cos(r.angle);
    axes.push({ x: ct, z: -st }, { x: st, z: ct });
  }
  let gap = 0;
  for (const n of axes) {
    const sp = (r) => {
      const st = Math.sin(r.angle), ct = Math.cos(r.angle);
      const ex = Math.abs(n.x * ct + n.z * st) * r.halfX + Math.abs(n.x * st - n.z * ct) * r.halfZ;
      const c = r.cx * n.x + r.cz * n.z;
      return [c - ex, c + ex];
    };
    const [a0, a1] = sp(a), [b0, b1] = sp(b);
    const sep = Math.max(a0 - b1, b0 - a1);
    if (sep > gap) gap = sep;
  }
  return gap;
}

const ground = plan.corridors.filter((c) => c.floor !== 'basement');
const ranges = ground.map((c) => {
  const rects = [shellRect(c)];
  plan.rooms.filter((r) => r.floor !== 'basement' && r.range === c.range)
    .forEach((r) => rects.push({ cx: r.center.x, cz: r.center.z, halfX: r.w / 2, halfZ: r.d / 2, angle: r.angle }));
  return { range: c.range, rects };
});

const rows = [];
ranges.forEach((A, i) => {
  const near = ranges.map((B, j) => {
    if (i === j) return null;
    let best = Infinity;
    for (const a of A.rects) for (const b of B.rects) best = Math.min(best, rectGap(a, b));
    return { range: B.range, step: Math.min(Math.abs(i - j), 12 - Math.abs(i - j)), gap: best };
  }).filter(Boolean).sort((p, q) => p.gap - q.gap);
  rows.push(near);
});

const byStep = {};
for (const row of rows) for (const n of row) {
  byStep[n.step] = byStep[n.step] || { lo: Infinity, hi: 0 };
  const s = byStep[n.step];
  if (n.gap < s.lo) s.lo = n.gap;
  if (n.gap > s.hi) s.hi = n.gap;
}
for (const step of Object.keys(byStep).sort((a, b) => a - b)) {
  const s = byStep[step];
  console.log('spokes ' + step + ' apart: shells ' + s.lo.toFixed(2) + ' m to ' + s.hi.toFixed(2) + ' m apart');
}
console.log('tightest pair overall:', JSON.stringify(rows[0][0]));
