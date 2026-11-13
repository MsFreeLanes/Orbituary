/* probe: what it costs to hand the ten-light pool from anchor to anchor.
 *
 *   node scratch/probe-anchor-cost.mjs                     → the live lighting.js
 *   node scratch/probe-anchor-cost.mjs scratch/lighting-baseline.js
 *
 * No browser and no renderer: the hand-over is plain arithmetic over the
 * plan's anchors, so node times it honestly and the number is comparable
 * across runs. Three things come out of each station:
 *   scanned — how many anchors the frame even looked at
 *   us      — wall-clock microseconds per lighting.update() call (best of 3)
 *   in      — how many of the ten lights the pool chose are on the storey the
 *             visitor is standing on, which is the whole point of the pass.
 *             one anchor is allowed to read as out of band by design: the
 *             head of the stair hangs in the shaft and belongs to either.
 * The last station is deliberately nowhere at all: it measures what a frame
 * costs before a single anchor is considered, so the anchor cost is readable.
 */
import { buildPlan } from '../src/plan.js';
import { S } from '../src/scale.js';
import * as THREE from 'three';
import path from 'node:path';

const N = 20000;
/* a lighting module picked from the command line, named from the repo root;
   the default is the one the museum actually builds with */
const target = process.argv[2]
  ? new URL('file:///' + path.resolve(process.cwd(), process.argv[2]).replace(/\\/g, '/'))
  : '../src/lighting.js';
const label = process.argv[2] || 'src/lighting.js';
const { createLighting } = await import(target);

const plan = buildPlan();
const lighting = createLighting(THREE, plan);

const BASE_TOP = S.FLOOR_BASE + S.CEIL_BASE;   // the cellar ceiling plane
const inBand = (y, storey) => storey === 'basement'
  ? (y >= S.FLOOR_BASE - 0.01 && y <= BASE_TOP + 0.01)
  : (y >= -0.01 && y <= 7.0);

const cellar = plan.rooms.find((r) => r.floor === 'basement' && r.flicker > 0.4)
  || plan.rooms.find((r) => r.floor === 'basement');
const ground = plan.rooms.find((r) => r.cat === 'Privacy')
  || plan.rooms.find((r) => r.floor === 'ground');
const s = plan.stair;
/* where the rig's eye sits halfway down the flight: the treads, not the slab */
const flightEye = (z) => -(z - s.z) / s.run * s.drop + S.EYE_H;

const stations = [
  ['rotunda    ', { x: 0, z: 0, y: S.EYE_H }, 'ground'],
  ['corridor   ', { x: 0, z: 20, y: S.EYE_H }, 'ground'],
  ['ground room', { x: ground.center.x, z: ground.center.z, y: S.EYE_H }, 'ground'],
  ['mid flight ', { x: s.x, z: s.z + s.run * 0.55, y: flightEye(s.z + s.run * 0.55) }, 'basement'],
  ['stair hall ', { x: 0, z: 1.5, y: S.FLOOR_BASE + S.EYE_H }, 'basement'],
  ['cellar arm ', { x: 0, z: 14, y: S.FLOOR_BASE + S.EYE_H }, 'basement'],
  ['cellar room', { x: cellar.center.x, z: cellar.center.z, y: S.FLOOR_BASE + S.EYE_H }, 'basement'],
  ['nowhere    ', { x: 400, z: 400, y: S.EYE_H }, 'ground']
];

console.log(label, '· anchors', lighting.anchors.length, '· pool', lighting.pool.length);
console.log('station       scanned   us/frame  pool y range        in storey');
for (const [name, pos, storey] of stations) {
  const p = new THREE.Vector3(pos.x, pos.y, pos.z);
  for (let i = 0; i < 400; i++) lighting.update(p, 0.05);   // settle the cross-fade
  let best = Infinity;
  for (let run = 0; run < 3; run++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) lighting.update(p, 0.05);
    best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1000 / N);
  }
  const ys = lighting.pool.map((l) => l.userData.anchor ? l.userData.anchor.y : l.position.y);
  const good = ys.filter((y) => inBand(y, storey)).length;
  const scanned = lighting.scanned === undefined ? lighting.anchors.length : lighting.scanned;
  console.log(name, String(scanned).padStart(6),
    best.toFixed(2).padStart(9), '  ',
    (Math.min(...ys).toFixed(2) + ' … ' + Math.max(...ys).toFixed(2)).padEnd(18),
    good + '/10');
}

/* the cellar room's key light: the bug this whole pass is about. the key is
 * the brightest thing in the pool, so its height says which storey the room
 * was lit from. */
const pos = new THREE.Vector3(cellar.center.x, S.FLOOR_BASE + S.EYE_H, cellar.center.z);
const keyOf = () => lighting.pool.reduce((b, l) => (!b || l.intensity > b.intensity) ? l : b, null);
for (let i = 0; i < 400; i++) lighting.update(pos, 0.05);
const key = keyOf();
console.log('cellar room', cellar.cat, 'flicker', cellar.flicker,
  'key y', key.position.y.toFixed(2), 'intensity', key.intensity.toFixed(1),
  '(cellar band is', S.FLOOR_BASE.toFixed(2), 'to', BASE_TOP.toFixed(2), ')');

/* the flicker, if lighting consumes it: the key's intensity over ten seconds
 * of frames. a room whose tube is failing should not hold one flat number. */
let lo = Infinity, hi = -Infinity;
for (let i = 0; i < 200; i++) {
  lighting.update(pos, 0.05);
  const k = keyOf();
  lo = Math.min(lo, k.intensity); hi = Math.max(hi, k.intensity);
}
console.log('key intensity over 10 s:', lo.toFixed(1), '→', hi.toFixed(1));

/* the moon's shadow box: how wide, and how many centimetres a texel that is */
const cam = lighting.moon.shadow.camera;
const wide = Math.max(cam.right - cam.left, cam.top - cam.bottom);
console.log('shadow box', wide.toFixed(0) + ' m across on 2048 →',
  (100 * wide / 2048).toFixed(2) + ' cm/texel',
  '· centred at', lighting.moon.target.position.toArray().map((v) => v.toFixed(1)).join(','));
