/* hull-geometry.mjs — the plan in numbers, for the hull pass.
 * What the outer skin has to follow: the arm footprints in the arm's own
 * frame, and where every viewport sits on them.
 *   node scratch/hull-geometry.mjs
 */
import { buildPlan } from '../src/plan.js';
import { S } from '../src/scale.js';

const plan = buildPlan();
const ground = plan.rooms.filter((r) => r.floor !== 'basement');
console.log('rooms', plan.rooms.length, 'ground', ground.length, 'reach', plan.reach.toFixed(2));

/* the four world corners of a room, the same way buildRoom lays them out */
function corners(r) {
  const st = Math.sin(r.angle), ct = Math.cos(r.angle);
  const out = [];
  for (const lx of [-r.w / 2, r.w / 2]) {
    for (const lz of [0, r.d]) {
      out.push({ x: r.entry.x + lx * ct + lz * st, z: r.entry.z - lx * st + lz * ct });
    }
  }
  return out;
}

const arms = plan.corridors.filter((c) => c.floor !== 'basement');
console.log('arms', arms.length, 't1', arms.map((c) => +c.t1.toFixed(2)).join(' '));

for (const c of arms) {
  const mine = ground.filter((r) => r.range === c.range);
  let latMax = 0, tMax = 0, tMin = 1e9;
  for (const r of mine) {
    for (const p of corners(r)) {
      const along = c.dir.x * p.x + c.dir.z * p.z;
      const across = c.lat.x * p.x + c.lat.z * p.z;
      latMax = Math.max(latMax, Math.abs(across));
      tMax = Math.max(tMax, along);
      tMin = Math.min(tMin, along);
    }
  }
  console.log(`arm ${String(c.range).padEnd(10)} dir ${c.dir.x.toFixed(2)},${c.dir.z.toFixed(2)} t1 ${c.t1.toFixed(2)} rooms ${mine.length} along ${tMin.toFixed(1)}..${tMax.toFixed(1)} latMax ${latMax.toFixed(2)} kinds ${mine.map((r) => r.kind[0] + (r.side === 0 ? 'T' : r.side)).join(' ')}`);
}

const kinds = {};
for (const r of ground) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
console.log('kinds', JSON.stringify(kinds));
const winCount = ground.reduce((n, r) => n + r.windows.length, 0);
console.log('windows', winCount, 'ceilings', [...new Set(ground.map((r) => r.ceil))].join(' '));
for (const r of ground.filter((x) => x.kind === 'hall').slice(0, 2)) {
  console.log(r.id, r.kind, 'w', r.w, 'd', r.d, 'ceil', r.ceil, 'winW', r.winW, 'winH', r.winH, 'sill', r.winSill, 'wins', r.windows.map((w) => w.u.toFixed(2)).join(' '));
}
for (const r of ground.filter((x) => x.kind !== 'hall').slice(0, 4)) {
  console.log(r.id, r.kind, 'side', r.side, 'w', r.w, 'd', r.d, 'ceil', r.ceil, 'wins', r.windows.map((w) => w.u.toFixed(2)).join(' '));
}
console.log('S.ROTUNDA_R', S.ROTUNDA_R, 'WALL_T', S.WALL_T, 'CEIL_HALL', S.CEIL_HALL, 'CEIL_ROOM', S.CEIL_ROOM, 'CEIL_CORRIDOR', S.CEIL_CORRIDOR);
