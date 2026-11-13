/* probe-cull.mjs — where the spoke cull drops a range the visitor can see
 * through a viewport.
 *
 *   node scratch/probe-cull.mjs
 *
 * building.js keeps the cull's rules private, but they are two lines of
 * arithmetic over the plan: a range is on when the visitor stands within REACH
 * of one of its rects (its shell and its three rooms), or when the visitor is
 * in the drum and facing down it. This replays those rules from the plan
 * without a browser, so the flicker can be counted rather than squinted at:
 * every ground room is sampled at its door, its middle and its window wall,
 * and for each standing position the script asks which *other* ranges would be
 * switched off and how far away the nearest viewport of that range is.
 */
import { buildPlan } from '../src/plan.js';
import { S } from '../src/scale.js';

const REACH = 6.0;          // building.js: metres of shell either side of you
const CONE = 55 * Math.PI / 180;

const plan = buildPlan();

/* the same rects building.js hands the cull: the range's shell, then its rooms */
function shellRect(c) {
  const a0 = c.floor === 'basement' ? 0 : S.ROTUNDA_R - 0.4;
  const mid = (a0 + c.t1) / 2;
  return {
    cx: c.dir.x * mid, cz: c.dir.z * mid,
    halfX: c.half, halfZ: (c.t1 - a0) / 2,
    angle: Math.atan2(c.dir.x, c.dir.z), range: c.range
  };
}
function distToRect(x, z, r) {
  const st = Math.sin(r.angle), ct = Math.cos(r.angle);
  const dx = x - r.cx, dz = z - r.cz;
  const lx = Math.abs(dx * ct - dz * st) - r.halfX;
  const lz = Math.abs(dx * st + dz * ct) - r.halfZ;
  const ax = lx > 0 ? lx : 0, az = lz > 0 ? lz : 0;
  return Math.sqrt(ax * ax + az * az);
}

const ground = plan.corridors.filter((c) => c.floor !== 'basement');
const ranges = ground.map((c) => {
  const rects = [shellRect(c)];
  plan.rooms.filter((r) => r.floor !== 'basement' && r.range === c.range)
    .forEach((r) => rects.push({
      cx: r.center.x, cz: r.center.z, halfX: r.w / 2, halfZ: r.d / 2,
      angle: r.angle, range: c.range
    }));
  return { range: c.range, dir: c.dir, rects, bearing: Math.atan2(c.dir.x, c.dir.z) };
});

/* the viewports: a side room's windows look out of its own range and land on
   whatever range stands on the other side of that wall */
const views = [];
plan.rooms.filter((r) => r.floor !== 'basement' && r.windows.length).forEach((r) => {
  r.windows.forEach((w) => {
    let best = null;
    for (const rg of ranges) {
      if (rg.range === r.range) continue;
      for (const rect of rg.rects) {
        const d = distToRect(w.x, w.z, rect);
        if (!best || d < best.d) best = { d, range: rg.range, bearing: rg.bearing };
      }
    }
    views.push({ room: r.id, range: r.range, x: w.x, z: w.z, seen: best });
  });
});

/* sample each ground room at its door, its middle and its window wall */
const spots = [];
plan.rooms.filter((r) => r.floor !== 'basement').forEach((r) => {
  const w = r.windows[0];
  spots.push({ room: r.id, at: 'door', x: r.entry.x, z: r.entry.z });
  spots.push({ room: r.id, at: 'middle', x: r.center.x, z: r.center.z });
  if (w) spots.push({ room: r.id, at: 'window', x: w.x, z: w.z });
});
plan.corridors.filter((c) => c.floor !== 'basement').forEach((c) => {
  for (const t of [c.t0 + 6, (c.t0 + c.t1) / 2, c.t1 - 2]) {
    spots.push({ room: c.range + ' corridor', at: 'corridor', x: c.dir.x * t, z: c.dir.z * t });
  }
});

let flicker = 0, worst = null;
for (const s of spots) {
  const mine = ranges.find((rg) => rg.rects.some((r) => distToRect(s.x, s.z, r) < REACH));
  if (!mine) continue;
  const bearing = Math.atan2(s.x, s.z);
  for (const rg of ranges) {
    if (rg.range === mine.range) continue;
    const near = Math.min(...rg.rects.map((r) => distToRect(s.x, s.z, r)));
    if (near < REACH) continue;                 // the cull keeps it on
    /* would a viewport of the visitor's own range be looking at it? */
    const seen = views.filter((v) => v.range === mine.range && v.seen.range === rg.range
      && v.seen.d < 8);
    if (!seen.length) continue;
    flicker++;
    const arc = Math.abs(((rg.bearing - bearing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (!worst || arc < worst.arc) worst = { arc, s, mine: mine.range, off: rg.range, near };
  }
}

console.log('ranges the cull drops while one of the visitor\'s own viewports looks at them:', flicker);
if (worst) {
  console.log('tightest case: standing in ' + worst.s.room + ' (' + worst.mine + '), '
    + worst.off + ' is culled at ' + worst.near.toFixed(1) + ' m, '
    + (worst.arc * 57.2958).toFixed(1) + ' deg of bearing away');
}

/* how far off-axis can a visitor get inside a range? that decides the arc a
   neighbour rule has to cover without popping the next one over */
let offAxis = 0, who = null;
for (const r of plan.rooms.filter((x) => x.floor !== 'basement')) {
  const rg = ranges.find((x) => x.range === r.range);
  let d = Math.atan2(r.center.x, r.center.z) - rg.bearing;
  d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  if (Math.abs(d) > offAxis) { offAxis = Math.abs(d); who = r.id + '/' + r.range; }
}
console.log('a room centre can sit ' + (offAxis * 57.2958).toFixed(1) +
  ' deg off its own spoke axis (' + who + '); one spoke step is 30 deg');

/* and the neighbour rule render.js actually applies: it finds the ranges by
   their bounding boxes and sorts them by bearing, which has to come out in
   wheel order for the two neighbours in the list to be the two neighbours on
   the wheel. This is the same arithmetic, on the plan's rects instead of the
   groups' boxes. */
const wheel = ground.map((c) => c.range);
const boxes = ranges.map((rg) => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const r of rg.rects) {
    const st = Math.sin(r.angle), ct = Math.cos(r.angle);
    const ex = Math.abs(ct) * r.halfX + Math.abs(st) * r.halfZ;
    const ez = Math.abs(st) * r.halfX + Math.abs(ct) * r.halfZ;
    x0 = Math.min(x0, r.cx - ex); x1 = Math.max(x1, r.cx + ex);
    z0 = Math.min(z0, r.cz - ez); z1 = Math.max(z1, r.cz + ez);
  }
  return { range: rg.range, bearing: Math.atan2((x0 + x1) / 2, (z0 + z1) / 2) };
});
const sorted = boxes.slice().sort((a, b) => a.bearing - b.bearing).map((b) => b.range);
const start = sorted.indexOf(wheel[0]);
const ringOrder = sorted.slice(start).concat(sorted.slice(0, start));
console.log('bounding-box bearings sort into wheel order:',
  ringOrder.every((r, i) => r === wheel[i]) ? 'yes' : 'NO — ' + ringOrder.join(', '));

/* and the neighbour distances the cull has to cover */
let lo = Infinity, hi = 0;
for (const v of views) { if (v.seen.d < lo) lo = v.seen.d; if (v.seen.d > hi) hi = v.seen.d; }
console.log('viewport to the nearest other range\'s shell: ' + lo.toFixed(2) + ' m to ' + hi.toFixed(2) + ' m');
console.log('viewports total:', views.length, '· ground ranges:', ranges.length);
