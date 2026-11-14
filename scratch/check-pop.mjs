/* check-pop.mjs — how many times does the building appear while you walk?
 *   node scratch/check-pop.mjs [path-to-html]
 *
 * The cull switches whole ranges. If the threshold is a single distance, a body
 * walking past it makes a range vanish or arrive in one frame, and that is the
 * pop-in — the object count has nothing to do with it. This walks a fixed route
 * by stepping the rig, and counts every time a range's visibility flips, with
 * the distance from the visitor at the moment of the flip. A flip at a distance
 * is a range appearing in front of you; a flip at zero is one going out behind
 * your back, which nobody sees and which is the whole point of the cull.
 */
import path from 'node:path';
import fs from 'node:fs';
import { withBrowser } from './cdp.mjs';

const file = process.argv[2] || 'index-v2.html';
const URL_FILE = 'file:///' + path.resolve(file).replace(/\\/g, '/');
if (!fs.existsSync(path.resolve(file))) { console.error('no such file:', path.resolve(file)); process.exit(1); }

const run = `(async () => {
  const m = window.__museum, rig = m.rig;
  const wings = m.builtWings;
  const flips = [];
  const prev = new Map(wings.map((w) => [w.name, w.group.visible]));
  const dist = (w) => Math.min(...w.rects.map((r) => {
    const st = Math.sin(r.angle), ct = Math.cos(r.angle);
    const dx = rig.state.x - r.cx, dz = rig.state.z - r.cz;
    const lx = Math.abs(dx * ct - dz * st) - r.halfX, lz = Math.abs(dx * st + dz * ct) - r.halfZ;
    return Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
  }));
  const sample = () => {
    wings.forEach((w) => {
      const was = prev.get(w.name);
      if (w.group.visible !== was) {
        flips.push({ w: w.name, to: w.group.visible ? 'on' : 'off', d: +dist(w).toFixed(1), at: +metres.toFixed(1) });
        prev.set(w.name, w.group.visible);
      }
    });
  };
  const route = ['gaming', 'rotunda', 'reading', 'stair', 'journalism', 'rotunda'];
  let metres = 0, last = { x: rig.state.x, z: rig.state.z };
  for (const id of route) {
    if (!rig.walkTo(id, { arriveYaw: 0 })) continue;
    let guard = 0;
    while (rig.touring && guard++ < 1500) {
      rig.update(0.05);
      const s = rig.state;
      metres += Math.hypot(s.x - last.x, s.z - last.z); last = { x: s.x, z: s.z };
      m.built.cull.update(new m.THREE.Vector3(s.x, s.level + 1.65, s.z),
        new m.THREE.Vector3(-Math.sin(s.yaw), 0, -Math.cos(s.yaw)));
      sample();
    }
    rig.stopTour();
  }
  const front = flips.filter((f) => f.to === 'on' && f.d > 2.0);
  /* a wing that flips twice in five metres of walking is the tripwire: the
     threshold is a line and a body walked across it, so the range arrived,
     left, and arrived again. that is the pop-in people see. */
  let osc = 0;
  const lastFlip = new Map();
  let walked = 0, acc = 0;
  flips.forEach((f) => {
    const p = lastFlip.get(f.w);
    if (p !== undefined && Math.abs(f.at - p) < 5) osc++;
    lastFlip.set(f.w, f.at);
  });
  return { metres: +metres.toFixed(0), flips: flips.length, appearingAhead: front.length,
    oscillating: osc, minOn: Math.min(...flips.filter((f) => f.to === 'on').map((f) => f.d)).toFixed(1),
    worst: front.sort((a, b) => b.d - a.d).slice(0, 4), offBehind: flips.filter((f) => f.to === 'off').length };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate(`(() => {
    const m = window.__museum;
    m.hud.hideIntro();
    /* the wings are not exported by name, so read them back off the scene:
       every range group carries a name the builder gives it */
    m.builtWings = [];
    m.scene.traverse((o) => { if (o.name && /^range/.test(o.name)) m.builtWings.push({ name: o.name, group: o, rects: (o.userData && o.userData.rects) || [] }); });
    if (!m.builtWings.length) {
      m.built.wings.forEach((w, i) => m.builtWings.push({ name: w.name || ('range' + i), group: w.group, rects: w.rects }));
    }
    return m.builtWings.length;
  })()`);
  const r = await evaluate(run);
  console.log(file, '| walked', r.metres, 'm |', r.flips, 'visibility flips |', r.offBehind,
    'going out behind you |', r.appearingAhead, 'appearing ahead |', r.oscillating,
    'oscillating on a threshold | nearest arrival', r.minOn, 'm');
  if (r.worst.length) console.log('   worst appearances:', JSON.stringify(r.worst));
});
